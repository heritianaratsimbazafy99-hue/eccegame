import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import AdminDashboard from "./components/AdminDashboard";
import FacilitatorView from "./components/FacilitatorView";
import LiveProgressBoard from "./components/LiveProgressBoard";
import ParticipantCardView from "./components/ParticipantCardView";
import QrSheetView from "./components/QrSheetView";
import RestitutionView from "./components/RestitutionView";
import { fetchSharedState, pushSnapshot, resetVotes, submitIntruderGuess, submitVote } from "./lib/api";
import { buildCardIndex, GAME_CONTENT_VERSION, generateGame } from "./lib/game";
import { isRealtimeConfigured, subscribeToSessionRealtime } from "./lib/realtime";
import { parseWorkbook } from "./lib/workbook";
import type {
  GameSnapshot,
  IntruderGuessRecord,
  RestitutionEntry,
  VoteChoice,
  VoteRecord
} from "./types";

const SESSION_STORAGE_KEY = "ecce-game-session-v4";
const RESTITUTION_STORAGE_KEY = "ecce-game-restitution-v1";
const BASE_URL_STORAGE_KEY = "ecce-game-base-url-v1";
const FALLBACK_POLL_INTERVAL_MS = 2500;

const EMPTY_RESTITUTION: RestitutionEntry = {
  decision: "",
  reliableSignals: "",
  doubtfulSignals: "",
  decisionLogic: "",
  disagreements: "",
  justification: ""
};

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }

  const raw = window.localStorage.getItem(key);
  if (!raw) {
    return fallback;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function currentOrigin(): string {
  if (typeof window === "undefined") {
    return "";
  }
  return window.location.origin;
}

function buildSearchParams(): URLSearchParams {
  if (typeof window === "undefined") {
    return new URLSearchParams();
  }
  return new URLSearchParams(window.location.search);
}

function hasCurrentContent(snapshot: GameSnapshot | null): boolean {
  return Boolean(snapshot && snapshot.contentVersion === GAME_CONTENT_VERSION);
}

export default function App() {
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(() =>
    readStorage<GameSnapshot | null>(SESSION_STORAGE_KEY, null)
  );
  const [votes, setVotes] = useState<Record<string, VoteRecord>>({});
  const [guesses, setGuesses] = useState<Record<string, IntruderGuessRecord>>({});
  const [restitutionMap, setRestitutionMap] = useState<Record<string, RestitutionEntry>>(() =>
    readStorage<Record<string, RestitutionEntry>>(RESTITUTION_STORAGE_KEY, {})
  );
  const [baseUrl, setBaseUrl] = useState<string>(() =>
    readStorage<string>(BASE_URL_STORAGE_KEY, currentOrigin())
  );
  const [searchParams, setSearchParams] = useState<URLSearchParams>(() => buildSearchParams());
  const [qrCodes, setQrCodes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [submittingVoteCardId, setSubmittingVoteCardId] = useState<string>("");
  const [submittingGuessCardId, setSubmittingGuessCardId] = useState<string>("");

  const cardIndex = useMemo(() => (snapshot ? buildCardIndex(snapshot) : {}), [snapshot]);
  const snapshotRef = useRef<GameSnapshot | null>(snapshot);
  const realtimeAvailable = isRealtimeConfigured();

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  useEffect(() => {
    function handlePopState() {
      setSearchParams(buildSearchParams());
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(RESTITUTION_STORAGE_KEY, JSON.stringify(restitutionMap));
  }, [restitutionMap]);

  useEffect(() => {
    window.localStorage.setItem(BASE_URL_STORAGE_KEY, JSON.stringify(baseUrl));
  }, [baseUrl]);

  useEffect(() => {
    void bootstrapSession();
  }, []);

  useEffect(() => {
    if (!snapshot || !baseUrl) {
      return;
    }

    const activeSnapshot = snapshot;
    let cancelled = false;

    async function generateQrs() {
      const entries = await Promise.all(
        activeSnapshot.teams.flatMap((team) =>
          team.cards.map(async (card) => {
            const dataUrl = await QRCode.toDataURL(
              `${baseUrl.replace(/\/$/, "")}/?card=${card.id}`,
              {
                width: 220,
                margin: 1,
                color: {
                  dark: "#09111a",
                  light: "#f3efe6"
                }
              }
            );
            return [card.id, dataUrl] as const;
          })
        )
      );

      if (!cancelled) {
        setQrCodes(Object.fromEntries(entries));
      }
    }

    void generateQrs();
    return () => {
      cancelled = true;
    };
  }, [baseUrl, snapshot]);

  useEffect(() => {
    if (realtimeAvailable) {
      return;
    }

    if (!snapshot) {
      return;
    }

    let disposed = false;

    async function syncSharedState() {
      try {
        const remoteState = await fetchSharedState();
        if (disposed) {
          return;
        }

        if (
          remoteState.snapshot &&
          (!snapshotRef.current ||
            remoteState.snapshot.generatedAt !== snapshotRef.current.generatedAt ||
            remoteState.snapshot.sourceName !== snapshotRef.current.sourceName ||
            remoteState.snapshot.contentVersion !== snapshotRef.current.contentVersion)
        ) {
          writeSnapshotLocally(remoteState.snapshot);
        }

        setVotes(remoteState.votes ?? {});
        setGuesses(remoteState.guesses ?? {});
      } catch {
        // Local fallback only. The app stays usable even if the sync endpoint is temporarily down.
      }
    }

    void syncSharedState();
    const intervalId = window.setInterval(() => {
      void syncSharedState();
    }, FALLBACK_POLL_INTERVAL_MS);

    return () => {
      disposed = true;
      window.clearInterval(intervalId);
    };
  }, [realtimeAvailable, snapshot?.generatedAt, snapshot?.sourceName]);

  useEffect(() => {
    if (!realtimeAvailable) {
      return;
    }

    return subscribeToSessionRealtime({
      onSnapshotReplaced: ({ snapshot: nextSnapshot, votes: nextVotes, guesses: nextGuesses }) => {
        if (nextSnapshot) {
          writeSnapshotLocally(nextSnapshot);
        }
        setVotes(nextVotes ?? {});
        setGuesses(nextGuesses ?? {});
      },
      onVoteSubmitted: ({ vote }) => {
        setVotes((current) => ({
          ...current,
          [vote.cardId]: vote
        }));
      },
      onIntruderGuessSubmitted: ({ guess }) => {
        setGuesses((current) => ({
          ...current,
          [guess.cardId]: guess
        }));
      },
      onVotesReset: () => {
        setVotes({});
        setGuesses({});
      }
    });
  }, [realtimeAvailable]);

  function writeSnapshotLocally(nextSnapshot: GameSnapshot) {
    setSnapshot(nextSnapshot);
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(nextSnapshot));
  }

  async function persistSnapshot(nextSnapshot: GameSnapshot, syncRemote = true) {
    writeSnapshotLocally(nextSnapshot);
    setError("");

    if (syncRemote) {
      const remoteState = await pushSnapshot(nextSnapshot);
      setVotes(remoteState.votes ?? {});
      setGuesses(remoteState.guesses ?? {});
    } else {
      setVotes({});
      setGuesses({});
    }
  }

  async function buildDefaultSnapshot(): Promise<GameSnapshot> {
      const cachedResponse = await fetch("/data/smilebox.participants.json");
      if (cachedResponse.ok) {
        const payload = (await cachedResponse.json()) as {
          sourceName: string;
          participants: GameSnapshot["participants"];
      };
      if (Array.isArray(payload.participants) && payload.participants.length > 0) {
        return generateGame(payload.participants, payload.sourceName);
      }
    }

    const response = await fetch("/data/smilebox.xlsx");
    if (!response.ok) {
      throw new Error("Impossible de charger le fichier Smilebox embarqué.");
    }

    const buffer = await response.arrayBuffer();
    const parsed = parseWorkbook(buffer, "Smilebox embarqué");
    return generateGame(parsed.participants, parsed.sourceLabel);
  }

  async function bootstrapSession() {
    try {
      setLoading(true);
      const remoteState = await fetchSharedState();

      if (remoteState.snapshot) {
        if (!hasCurrentContent(remoteState.snapshot)) {
          const regenerated = generateGame(
            remoteState.snapshot.participants,
            remoteState.snapshot.sourceName
          );
          await persistSnapshot(regenerated, true);
          return;
        }

        writeSnapshotLocally(remoteState.snapshot);
        setVotes(remoteState.votes ?? {});
        setGuesses(remoteState.guesses ?? {});
        setError("");
        return;
      }

      const generated = await buildDefaultSnapshot();
      await persistSnapshot(generated, true);
    } catch (caughtError) {
      try {
        const generated = await buildDefaultSnapshot();
        await persistSnapshot(generated, false);
      } catch {
        const message =
          caughtError instanceof Error
            ? caughtError.message
            : "Le chargement initial a échoué.";
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }

  async function loadDefaultWorkbook(syncRemote = true) {
    try {
      setLoading(true);
      const generated = await buildDefaultSnapshot();
      await persistSnapshot(generated, syncRemote);
      setError("");
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "Le chargement du fichier par défaut a échoué.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleUploadWorkbook(file: File) {
    try {
      setLoading(true);
      const buffer = await file.arrayBuffer();
      const parsed = parseWorkbook(buffer, file.name);
      const generated = generateGame(parsed.participants, parsed.sourceLabel);
      setRestitutionMap({});
      await persistSnapshot(generated, true);
      navigateTo({});
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "Import impossible: le fichier Excel n'a pas pu être lu.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  function navigateTo(next: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    Object.entries(next).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      }
    });
    const query = params.toString();
    const nextUrl = query ? `?${query}` : window.location.pathname;
    window.history.pushState({}, "", nextUrl);
    setSearchParams(new URLSearchParams(params));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function updateRestitution(teamId: string, patch: Partial<RestitutionEntry>) {
    setRestitutionMap((current) => ({
      ...current,
      [teamId]: {
        ...(current[teamId] ?? EMPTY_RESTITUTION),
        ...patch
      }
    }));
  }

  async function regenerateCurrentGame() {
    if (!snapshot) {
      return;
    }

    const regenerated = generateGame(snapshot.participants, snapshot.sourceName);
    setRestitutionMap({});
    await persistSnapshot(regenerated, true);
    navigateTo({});
  }

  async function resetToDefault() {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    window.localStorage.removeItem(RESTITUTION_STORAGE_KEY);
    setRestitutionMap({});
    await loadDefaultWorkbook(true);
    navigateTo({});
  }

  async function resetAllVotes() {
    try {
      const nextState = await resetVotes();
      setVotes(nextState.votes ?? {});
      setGuesses(nextState.guesses ?? {});
      setError("");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Impossible de remettre les votes et les soupçons à zéro."
      );
    }
  }

  async function handleSubmitVote(cardId: string, choice: VoteChoice) {
    try {
      setSubmittingVoteCardId(cardId);
      const result = await submitVote(cardId, choice);
      setVotes((current) => ({
        ...current,
        [cardId]: result.vote
      }));
      setError("");
    } catch (caughtError) {
      const nextError =
        caughtError instanceof Error
          ? caughtError
          : new Error("Le vote n'a pas pu etre enregistre.");
      setError(
        nextError.message
      );
      throw nextError;
    } finally {
      setSubmittingVoteCardId("");
    }
  }

  async function handleSubmitIntruderGuess(cardId: string, suspectIds: string[]) {
    try {
      setSubmittingGuessCardId(cardId);
      const result = await submitIntruderGuess(cardId, suspectIds);
      setGuesses((current) => ({
        ...current,
        [cardId]: result.guess
      }));
      setError("");
    } catch (caughtError) {
      const nextError =
        caughtError instanceof Error
          ? caughtError
          : new Error("La designation des intrus n'a pas pu etre enregistree.");
      setError(nextError.message);
      throw nextError;
    } finally {
      setSubmittingGuessCardId("");
    }
  }

  if (loading && !snapshot) {
    return (
      <main className="view-shell loading-shell">
        <section className="panel">
          <div className="eyebrow">Chargement</div>
          <h1>Preparation de l&apos;operation Smilebox</h1>
          <p>Equilibrage des equipes, synchronisation des votes et generation des dossiers…</p>
        </section>
      </main>
    );
  }

  if (!snapshot) {
    return (
      <main className="view-shell loading-shell">
          <section className="panel">
            <div className="eyebrow">Import requis</div>
            <h1>Impossible de lancer l&apos;operation sans fichier</h1>
            <p>{error || "Charge un fichier Excel pour generer l&apos;operation."}</p>
          <label className="primary-button file-label">
            Choisir un fichier Excel
            <input
              accept=".xlsx,.xls"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void handleUploadWorkbook(file);
                }
              }}
              type="file"
            />
          </label>
          <button className="ghost-button" onClick={() => void loadDefaultWorkbook(false)} type="button">
            Recharger le dossier Smilebox
          </button>
        </section>
      </main>
    );
  }

  const cardId = searchParams.get("card");
  const facilitatorId = searchParams.get("facilitator");
  const restitutionId = searchParams.get("restitution");
  const sheet = searchParams.get("sheet");
  const board = searchParams.get("board");

  if (cardId) {
    const cardEntry = cardIndex[cardId];
    if (!cardEntry) {
      return (
        <main className="view-shell loading-shell">
          <section className="panel">
            <div className="eyebrow">Carte introuvable</div>
            <h1>Ce lien ne correspond à aucune carte active</h1>
            <button className="ghost-button" onClick={() => navigateTo({})} type="button">
              Retour
            </button>
          </section>
        </main>
      );
    }

    const teamVoteCount = Object.values(votes).filter(
      (vote) => vote.teamId === cardEntry.team.id
    ).length;

    return (
      <ParticipantCardView
        card={cardEntry.card}
        currentGuess={guesses[cardId]}
        currentVote={votes[cardId]?.choice}
        onSubmitIntruderGuess={(suspectIds) => handleSubmitIntruderGuess(cardId, suspectIds)}
        onSubmitVote={(choice) => handleSubmitVote(cardId, choice)}
        submittingGuess={submittingGuessCardId === cardId}
        submittingVote={submittingVoteCardId === cardId}
        team={cardEntry.team}
        teamVoteCount={teamVoteCount}
      />
    );
  }

  if (facilitatorId) {
    const team = snapshot.teams.find((item) => item.id === facilitatorId);
    if (!team) {
      navigateTo({});
      return null;
    }

    return (
      <FacilitatorView
        baseUrl={baseUrl}
        guesses={guesses}
        onBack={() => navigateTo({})}
        onOpenRestitution={(teamId) => navigateTo({ restitution: teamId })}
        qrCodes={qrCodes}
        team={team}
      />
    );
  }

  if (restitutionId) {
    const team = snapshot.teams.find((item) => item.id === restitutionId);
    if (!team) {
      navigateTo({});
      return null;
    }

    return (
      <RestitutionView
        onBack={() => navigateTo({})}
        onChange={(patch) => updateRestitution(team.id, patch)}
        team={team}
        value={restitutionMap[team.id] ?? EMPTY_RESTITUTION}
      />
    );
  }

  if (sheet === "qrs") {
    return (
      <QrSheetView
        baseUrl={baseUrl}
        onBack={() => navigateTo({})}
        qrCodes={qrCodes}
        snapshot={snapshot}
      />
    );
  }

  if (board === "live") {
    return (
      <LiveProgressBoard
        guesses={guesses}
        onBack={() => navigateTo({})}
        snapshot={snapshot}
        votes={votes}
      />
    );
  }

  return (
    <AdminDashboard
      baseUrl={baseUrl}
      error={error}
      onBaseUrlChange={setBaseUrl}
      onOpenFacilitator={(teamId) => navigateTo({ facilitator: teamId })}
      onOpenLiveBoard={() => navigateTo({ board: "live" })}
      onOpenQrSheet={() => navigateTo({ sheet: "qrs" })}
      onOpenRestitution={(teamId) => navigateTo({ restitution: teamId })}
      onRegenerate={() => void regenerateCurrentGame()}
      onResetToDefault={() => resetToDefault()}
      onResetVotes={() => void resetAllVotes()}
      onUploadWorkbook={handleUploadWorkbook}
      qrCodes={qrCodes}
      restitutionMap={restitutionMap}
      snapshot={snapshot}
      guesses={guesses}
      votes={votes}
    />
  );
}
