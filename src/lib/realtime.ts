import { createClient, type RealtimeChannel } from "@supabase/supabase-js";
import type { GameSnapshot, IntruderGuessRecord, VoteRecord } from "../types";

const SESSION_CHANNEL = "eccegame:session:main";

export const SESSION_EVENTS = {
  snapshotReplaced: "session_snapshot_replaced",
  voteSubmitted: "session_vote_submitted",
  intruderGuessSubmitted: "session_intruder_guess_submitted",
  votesReset: "session_votes_reset"
} as const;

type SessionEventName = (typeof SESSION_EVENTS)[keyof typeof SESSION_EVENTS];

interface SnapshotReplacedPayload {
  snapshot: GameSnapshot | null;
  votes: Record<string, VoteRecord>;
  guesses: Record<string, IntruderGuessRecord>;
  updatedAt: string | null;
}

interface VoteSubmittedPayload {
  vote: VoteRecord;
  updatedAt: string;
}

interface IntruderGuessSubmittedPayload {
  guess: IntruderGuessRecord;
  updatedAt: string;
}

interface VotesResetPayload {
  updatedAt: string | null;
}

interface SessionRealtimeHandlers {
  onSnapshotReplaced: (payload: SnapshotReplacedPayload) => void;
  onVoteSubmitted: (payload: VoteSubmittedPayload) => void;
  onIntruderGuessSubmitted: (payload: IntruderGuessSubmittedPayload) => void;
  onVotesReset: (payload: VotesResetPayload) => void;
  onChannelStatus?: (status: string) => void;
}

let supabaseClient: ReturnType<typeof createClient> | null = null;

function getEnv(name: "VITE_SUPABASE_URL" | "VITE_SUPABASE_ANON_KEY") {
  return (import.meta.env[name] as string | undefined)?.trim() || "";
}

export function isRealtimeConfigured() {
  return Boolean(getEnv("VITE_SUPABASE_URL") && getEnv("VITE_SUPABASE_ANON_KEY"));
}

function getSupabaseClient() {
  if (!isRealtimeConfigured()) {
    return null;
  }

  if (!supabaseClient) {
    supabaseClient = createClient(getEnv("VITE_SUPABASE_URL"), getEnv("VITE_SUPABASE_ANON_KEY"), {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }

  return supabaseClient;
}

function attachHandler<TPayload>(
  channel: RealtimeChannel,
  event: SessionEventName,
  handler: (payload: TPayload) => void
) {
  channel.on("broadcast", { event }, ({ payload }) => {
    handler(payload as TPayload);
  });
}

export function subscribeToSessionRealtime(handlers: SessionRealtimeHandlers) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return () => {};
  }

  const channel = supabase.channel(SESSION_CHANNEL);

  attachHandler<SnapshotReplacedPayload>(channel, SESSION_EVENTS.snapshotReplaced, handlers.onSnapshotReplaced);
  attachHandler<VoteSubmittedPayload>(channel, SESSION_EVENTS.voteSubmitted, handlers.onVoteSubmitted);
  attachHandler<IntruderGuessSubmittedPayload>(
    channel,
    SESSION_EVENTS.intruderGuessSubmitted,
    handlers.onIntruderGuessSubmitted
  );
  attachHandler<VotesResetPayload>(channel, SESSION_EVENTS.votesReset, handlers.onVotesReset);

  channel.subscribe((status) => {
    handlers.onChannelStatus?.(status);
  });

  return () => {
    void supabase.removeChannel(channel);
  };
}
