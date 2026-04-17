import type {
  GameSnapshot,
  IntruderGuessRecord,
  SharedSessionState,
  VoteChoice,
  VoteRecord
} from "../types";

async function parseJsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "La requête a échoué.");
  }

  return (await response.json()) as T;
}

export async function fetchSharedState(): Promise<SharedSessionState> {
  const response = await fetch("/api/state");
  return parseJsonResponse<SharedSessionState>(response);
}

export async function pushSnapshot(snapshot: GameSnapshot): Promise<SharedSessionState> {
  const response = await fetch("/api/snapshot", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ snapshot })
  });
  return parseJsonResponse<SharedSessionState>(response);
}

export async function submitVote(
  cardId: string,
  choice: VoteChoice
): Promise<{ vote: VoteRecord; updatedAt: string }> {
  const response = await fetch("/api/votes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ cardId, choice })
  });
  return parseJsonResponse<{ vote: VoteRecord; updatedAt: string }>(response);
}

export async function resetVotes(): Promise<SharedSessionState> {
  const response = await fetch("/api/votes/reset", {
    method: "POST"
  });
  return parseJsonResponse<SharedSessionState>(response);
}

export async function submitIntruderGuess(
  cardId: string,
  suspectIds: string[]
): Promise<{ guess: IntruderGuessRecord; updatedAt: string }> {
  const response = await fetch("/api/intruders/guess", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ cardId, suspectIds })
  });
  return parseJsonResponse<{ guess: IntruderGuessRecord; updatedAt: string }>(response);
}
