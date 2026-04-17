import { findCardEntry, readState, writeState } from "./session-store.js";

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export async function getSessionState() {
  return readState();
}

export async function replaceSnapshot(snapshot) {
  if (!snapshot?.teams || !snapshot?.participants) {
    throw new HttpError(400, "Snapshot invalide.");
  }

  return writeState({
    snapshot,
    votes: {},
    guesses: {}
  });
}

export async function createVote(cardId, choice) {
  if (!cardId || !["A", "B"].includes(choice)) {
    throw new HttpError(400, "Vote invalide.");
  }

  const state = await readState();
  if (!state.snapshot) {
    throw new HttpError(409, "Aucune session active.");
  }

  const entry = findCardEntry(state.snapshot, cardId);
  if (!entry) {
    throw new HttpError(404, "Carte introuvable.");
  }

  if (state.votes[cardId]) {
    throw new HttpError(409, "Ce choix est deja verrouille definitivement.");
  }

  state.votes[cardId] = {
    cardId,
    teamId: entry.team.id,
    teamName: entry.team.name,
    participantId: entry.card.participantId,
    participantName: entry.card.participantName,
    choice,
    submittedAt: new Date().toISOString()
  };

  const nextState = await writeState(state);
  return {
    vote: nextState.votes[cardId],
    updatedAt: nextState.updatedAt
  };
}

export async function createIntruderGuess(cardId, suspectIds) {
  if (!cardId || !Array.isArray(suspectIds) || suspectIds.length !== 2) {
    throw new HttpError(400, "Designation des intrus invalide.");
  }

  const cleanedIds = suspectIds.filter((value) => typeof value === "string" && value.trim());
  if (cleanedIds.length !== 2 || new Set(cleanedIds).size !== 2) {
    throw new HttpError(400, "Choisis deux intrus distincts.");
  }

  const state = await readState();
  if (!state.snapshot) {
    throw new HttpError(409, "Aucune session active.");
  }

  const entry = findCardEntry(state.snapshot, cardId);
  if (!entry) {
    throw new HttpError(404, "Carte introuvable.");
  }

  const participantIds = new Set(entry.team.participants.map((participant) => participant.id));
  if (!cleanedIds.every((suspectId) => participantIds.has(suspectId))) {
    throw new HttpError(400, "Les intrus designes doivent appartenir a ton equipe.");
  }

  if (cleanedIds.includes(entry.card.participantId)) {
    throw new HttpError(400, "Tu ne peux pas te designer toi-meme comme intrus.");
  }

  const suspects = cleanedIds.map((suspectId) =>
    entry.team.participants.find((participant) => participant.id === suspectId)
  );

  if (suspects.some((suspect) => !suspect)) {
    throw new HttpError(400, "Intrus impossible a identifier.");
  }

  state.guesses[cardId] = {
    cardId,
    teamId: entry.team.id,
    participantId: entry.card.participantId,
    participantName: entry.card.participantName,
    suspectIds: cleanedIds,
    suspectNames: suspects.map((suspect) => suspect.name),
    updatedAt: new Date().toISOString()
  };

  const nextState = await writeState(state);
  return {
    guess: nextState.guesses[cardId],
    updatedAt: nextState.updatedAt
  };
}

export async function clearVotes() {
  const state = await readState();
  return writeState({
    snapshot: state.snapshot,
    votes: {},
    guesses: {}
  });
}
