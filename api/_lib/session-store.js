import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../..");
const STATE_DIR = path.join(projectRoot, ".runtime");
const STATE_FILE = path.join(STATE_DIR, "shared-state.json");
const STATE_ROW_ID = "main";

let supabaseClient = null;

function defaultState() {
  return {
    snapshot: null,
    votes: {},
    guesses: {},
    updatedAt: null
  };
}

function isSupabaseConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function normalizeState(raw) {
  return {
    snapshot: raw?.snapshot ?? null,
    votes: raw?.votes ?? {},
    guesses: raw?.guesses ?? {},
    updatedAt: raw?.updatedAt ?? raw?.updated_at ?? null
  };
}

function getSupabaseClient() {
  if (!isSupabaseConfigured()) {
    return null;
  }

  if (!supabaseClient) {
    supabaseClient = createClient(
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

  return supabaseClient;
}

async function ensureStateFile() {
  await fs.mkdir(STATE_DIR, { recursive: true });
  try {
    await fs.access(STATE_FILE);
  } catch {
    await fs.writeFile(STATE_FILE, JSON.stringify(defaultState(), null, 2), "utf8");
  }
}

async function readFileState() {
  await ensureStateFile();
  try {
    const raw = await fs.readFile(STATE_FILE, "utf8");
    return normalizeState(JSON.parse(raw));
  } catch {
    return defaultState();
  }
}

async function writeFileState(nextState) {
  await ensureStateFile();
  const payload = {
    snapshot: nextState.snapshot ?? null,
    votes: nextState.votes ?? {},
    guesses: nextState.guesses ?? {},
    updatedAt: new Date().toISOString()
  };
  await fs.writeFile(STATE_FILE, JSON.stringify(payload, null, 2), "utf8");
  return payload;
}

async function ensureSupabaseRow() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error("Supabase n'est pas configuré.");
  }

  const { data, error } = await supabase
    .from("game_state")
    .select("id, snapshot, votes, guesses, updated_at")
    .eq("id", STATE_ROW_ID)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (data) {
    return normalizeState(data);
  }

  const initialState = {
    id: STATE_ROW_ID,
    snapshot: null,
    votes: {},
    guesses: {},
    updated_at: new Date().toISOString()
  };

  const { data: inserted, error: insertError } = await supabase
    .from("game_state")
    .upsert(initialState, { onConflict: "id" })
    .select("snapshot, votes, guesses, updated_at")
    .single();

  if (insertError) {
    throw insertError;
  }

  return normalizeState(inserted);
}

async function readSupabaseState() {
  return ensureSupabaseRow();
}

async function writeSupabaseState(nextState) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error("Supabase n'est pas configuré.");
  }

  const payload = {
    id: STATE_ROW_ID,
    snapshot: nextState.snapshot ?? null,
    votes: nextState.votes ?? {},
    guesses: nextState.guesses ?? {},
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from("game_state")
    .upsert(payload, { onConflict: "id" })
    .select("snapshot, votes, guesses, updated_at")
    .single();

  if (error) {
    throw error;
  }

  return normalizeState(data);
}

export function findCardEntry(snapshot, cardId) {
  if (!snapshot?.teams) {
    return null;
  }

  for (const team of snapshot.teams) {
    const card = team.cards?.find((item) => item.id === cardId);
    if (card) {
      return { team, card };
    }
  }

  return null;
}

export function getStorageMode() {
  return isSupabaseConfigured() ? "supabase" : "file";
}

export async function readState() {
  if (isSupabaseConfigured()) {
    return readSupabaseState();
  }
  return readFileState();
}

export async function writeState(nextState) {
  if (isSupabaseConfigured()) {
    return writeSupabaseState(nextState);
  }
  return writeFileState(nextState);
}

export { defaultState, isSupabaseConfigured };
