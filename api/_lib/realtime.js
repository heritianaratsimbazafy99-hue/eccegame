import { createClient } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "./session-store.js";

const SESSION_CHANNEL = "eccegame:session:main";

export const SESSION_EVENTS = {
  snapshotReplaced: "session_snapshot_replaced",
  voteSubmitted: "session_vote_submitted",
  intruderGuessSubmitted: "session_intruder_guess_submitted",
  votesReset: "session_votes_reset"
};

let supabaseRealtimeClient = null;

function getRealtimeClient() {
  if (!isSupabaseConfigured()) {
    return null;
  }

  if (!supabaseRealtimeClient) {
    supabaseRealtimeClient = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
  }

  return supabaseRealtimeClient;
}

export async function broadcastSessionEvent(event, payload) {
  const supabase = getRealtimeClient();
  if (!supabase) {
    return false;
  }

  const channel = supabase.channel(SESSION_CHANNEL, {
    config: {
      broadcast: {
        ack: true
      }
    }
  });

  try {
    await channel.send({
      type: "broadcast",
      event,
      payload
    });
    return true;
  } catch (error) {
    console.error("Realtime broadcast failed", error);
    return false;
  } finally {
    await supabase.removeChannel(channel);
  }
}

export { SESSION_CHANNEL };
