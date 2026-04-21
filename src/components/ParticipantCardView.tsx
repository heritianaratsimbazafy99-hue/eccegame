import { useEffect, useMemo, useState } from "react";
import type {
  GeneratedCard,
  IntruderGuessRecord,
  TeamGame,
  VoteChoice
} from "../types";
import { toReadableFrench } from "../lib/readableFrench";

const LOCK_DELAY_SECONDS = 10;

interface ParticipantCardViewProps {
  team: TeamGame;
  card: GeneratedCard;
  currentVote?: VoteChoice;
  currentGuess?: IntruderGuessRecord;
  teamVoteCount: number;
  submittingGuess: boolean;
  submittingVote: boolean;
  onSubmitIntruderGuess: (suspectIds: string[]) => Promise<void>;
  onSubmitVote: (choice: VoteChoice) => Promise<void>;
}

export default function ParticipantCardView({
  team,
  card,
  currentVote,
  currentGuess,
  teamVoteCount,
  submittingGuess,
  submittingVote,
  onSubmitIntruderGuess,
  onSubmitVote
}: ParticipantCardViewProps) {
  const [pendingChoice, setPendingChoice] = useState<VoteChoice | null>(null);
  const [countdown, setCountdown] = useState<number>(0);
  const [hasTriggeredSubmit, setHasTriggeredSubmit] = useState(false);
  const [voteError, setVoteError] = useState("");
  const [suspectOne, setSuspectOne] = useState("");
  const [suspectTwo, setSuspectTwo] = useState("");
  const [guessError, setGuessError] = useState("");
  const [guessStatus, setGuessStatus] = useState("");

  const suspectOptions = useMemo(
    () => team.participants.filter((participant) => participant.id !== card.participantId),
    [card.participantId, team.participants]
  );

  useEffect(() => {
    if (!pendingChoice || countdown <= 0 || currentVote || hasTriggeredSubmit) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setCountdown((current) => current - 1);
    }, 1000);

    return () => window.clearTimeout(timeoutId);
  }, [countdown, currentVote, hasTriggeredSubmit, pendingChoice]);

  useEffect(() => {
    if (!pendingChoice || countdown !== 0 || currentVote || hasTriggeredSubmit) {
      return;
    }

    setHasTriggeredSubmit(true);
    setVoteError("");
    void onSubmitVote(pendingChoice)
      .catch((error: unknown) => {
        setVoteError(error instanceof Error ? error.message : "Le verrouillage a echoue.");
        setPendingChoice(null);
        setCountdown(0);
        setHasTriggeredSubmit(false);
      });
  }, [countdown, currentVote, hasTriggeredSubmit, onSubmitVote, pendingChoice]);

  useEffect(() => {
    if (!currentVote) {
      return;
    }

    setPendingChoice(null);
    setCountdown(0);
    setHasTriggeredSubmit(false);
    setVoteError("");
  }, [currentVote]);

  useEffect(() => {
    setSuspectOne(currentGuess?.suspectIds[0] ?? "");
    setSuspectTwo(currentGuess?.suspectIds[1] ?? "");
    if (currentGuess) {
      setGuessStatus("Signalement enregistre.");
    }
  }, [currentGuess]);

  function startLock(choice: VoteChoice) {
    if (currentVote || submittingVote) {
      return;
    }

    setVoteError("");
    setPendingChoice(choice);
    setCountdown(LOCK_DELAY_SECONDS);
    setHasTriggeredSubmit(false);
  }

  function cancelPendingLock() {
    if (hasTriggeredSubmit) {
      return;
    }

    setPendingChoice(null);
    setCountdown(0);
    setVoteError("");
  }

  async function handleGuessSubmit() {
    if (!suspectOne || !suspectTwo) {
      setGuessError("Choisis deux suspects avant d'envoyer ton signalement.");
      setGuessStatus("");
      return;
    }

    if (suspectOne === suspectTwo) {
      setGuessError("Il faut désigner deux intrus distincts.");
      setGuessStatus("");
      return;
    }

    try {
      setGuessError("");
      setGuessStatus("");
      await onSubmitIntruderGuess([suspectOne, suspectTwo]);
      setGuessStatus("Signalement transmis a mission control.");
    } catch (error: unknown) {
      setGuessError(
        error instanceof Error
          ? error.message
          : "Le signalement des intrus a echoue."
      );
      setGuessStatus("");
    }
  }

  const isPending = Boolean(pendingChoice);
  const lockBusy = submittingVote || hasTriggeredSubmit;
  const countdownProgress = pendingChoice ? Math.max(0, (countdown / LOCK_DELAY_SECONDS) * 100) : 0;

  return (
    <main className="view-shell card-shell">
      <section className="mobile-card">
        <div className="card-intel-header">
          <div className="eyebrow">Dossier agent • {team.name}</div>
          <h1>{card.participantName}</h1>
          <p className="lead">{toReadableFrench(team.atmosphere)}</p>
        </div>

        <div className="section-card">
          <div className="section-title">Contexte</div>
          <p>{toReadableFrench(team.situation)}</p>
        </div>

        <div className="section-card highlight-card">
          <div className="section-title">Ta carte</div>
          <h2>{toReadableFrench(card.headline)}</h2>
          <p>{toReadableFrench(card.body)}</p>
          <div className="share-callout">
            <strong>À dire dans le débat :</strong> {toReadableFrench(card.sharePrompt)}
          </div>
        </div>

        {card.isIntruder ? (
          <div className="section-card intruder-brief-card">
            <div className="section-title">Brief clandestin</div>
            <div className="chip-row">
              <span className="truth-chip truth-false intruder-chip">Intrus actif</span>
              {card.sabotageChoice ? (
                <span className={`vote-pill vote-${card.sabotageChoice}`}>
                  Pousser vers {card.sabotageChoice}
                </span>
              ) : null}
            </div>
            <p>{card.sabotageBrief ? toReadableFrench(card.sabotageBrief) : ""}</p>
            <div className="share-callout sabotage-callout">
              <strong>Objectif discret :</strong> fais paraitre l&apos;option {card.sabotageChoice} plus
              rassurante, plus cool ou plus heroique qu&apos;elle ne l&apos;est vraiment.
            </div>
          </div>
        ) : null}

        <div className="decision-grid">
          {team.options.map((option) => (
            <article className="decision-card" key={option.id}>
              <div className="decision-tag">Décision {option.id}</div>
              <h3>{toReadableFrench(option.title)}</h3>
              <p>{toReadableFrench(option.description)}</p>
            </article>
          ))}
        </div>

        <div className="section-card vote-lock-card">
          <div className="section-title">Ton choix final</div>
          <p>
            Choisis toi-meme. Quand le compte a rebours finit, ton choix part pour de bon et
            tu ne peux plus le changer.
          </p>

          {voteError ? <div className="warning-card inline-warning">{voteError}</div> : null}

          <div className="vote-button-grid">
            <button
              className={
                currentVote === "A" || pendingChoice === "A"
                  ? "vote-action active A"
                  : "vote-action A"
              }
              disabled={Boolean(currentVote) || isPending || lockBusy}
              onClick={() => startLock("A")}
              type="button"
            >
              <span className="vote-action-label">Option A</span>
              <strong>Verrouiller A</strong>
            </button>

            <button
              className={
                currentVote === "B" || pendingChoice === "B"
                  ? "vote-action active B"
                  : "vote-action B"
              }
              disabled={Boolean(currentVote) || isPending || lockBusy}
              onClick={() => startLock("B")}
              type="button"
            >
              <span className="vote-action-label">Option B</span>
              <strong>Verrouiller B</strong>
            </button>
          </div>

          <div className="vote-status-panel">
            {currentVote ? (
              <div className={`vote-pill vote-${currentVote}`}>
                Choix verrouille definitivement: {currentVote}
              </div>
            ) : pendingChoice ? (
              <div className="countdown-panel">
                <div className="countdown-visual">
                  <div className="hourglass-shell" aria-hidden="true">
                    <div className="hourglass-icon">
                      <div className="hourglass-sand top" />
                      <div className="hourglass-neck" />
                      <div className="hourglass-sand bottom" />
                    </div>
                  </div>
                  <div className="countdown-copy">
                    <div className="countdown-label">Sablier de confirmation</div>
                    <div className="countdown-value">{countdown}s</div>
                    <div className="countdown-meter">
                      <div
                        className="countdown-meter-fill"
                        style={{ width: `${countdownProgress}%` }}
                      />
                    </div>
                  </div>
                </div>
                <div className={`vote-pill vote-${pendingChoice}`}>
                  Transmission finale dans {countdown}s • Option {pendingChoice}
                </div>
                <p className="muted-line">
                  Si tu ne fais rien, mission control considerera que tu assumes totalement ce choix.
                </p>
                <button
                  className="ghost-button cancel-lock-button"
                  disabled={lockBusy}
                  onClick={cancelPendingLock}
                  type="button"
                >
                  Annuler le verrouillage
                </button>
              </div>
            ) : lockBusy ? (
              <div className="vote-pill vote-pending">Transmission en cours…</div>
            ) : (
              <div className="vote-pill vote-pending">Aucun choix verrouille pour l&apos;instant</div>
            )}

            <div className="team-progress-text">
              {teamVoteCount}/{team.participants.length} participants ont deja transmis leur avis.
            </div>
          </div>
        </div>

        <div className="section-card suspect-card">
          <div className="section-title">Chasse aux intrus</div>
          <p>
            Designe maintenant les 2 agents qui te paraissent les plus suspects. Tu peux te fier
            aux arguments trop parfaits, aux emballements trop rapides ou aux gens bizarrement
            amoureux de la mauvaise option.
          </p>

          {guessError ? <div className="warning-card inline-warning">{guessError}</div> : null}
          {guessStatus ? <div className="admin-callout subtle intruder-status">{guessStatus}</div> : null}

          <div className="suspect-grid">
            <label className="field-block">
              <span>Intrus suspect n°1</span>
              <select
                onChange={(event) => setSuspectOne(event.target.value)}
                value={suspectOne}
              >
                <option value="">Choisir un nom</option>
                {suspectOptions.map((participant) => (
                  <option key={participant.id} value={participant.id}>
                    {participant.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="field-block">
              <span>Intrus suspect n°2</span>
              <select
                onChange={(event) => setSuspectTwo(event.target.value)}
                value={suspectTwo}
              >
                <option value="">Choisir un nom</option>
                {suspectOptions.map((participant) => (
                  <option key={participant.id} value={participant.id}>
                    {participant.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="toolbar compact-toolbar">
            <button
              className="primary-button"
              disabled={submittingGuess}
              onClick={() => void handleGuessSubmit()}
              type="button"
            >
              {submittingGuess ? "Transmission..." : "Envoyer mes 2 suspects"}
            </button>
          </div>

          {currentGuess ? (
            <div className="share-callout suspect-summary">
              <strong>Dernier signalement:</strong> {currentGuess.suspectNames.join(" • ")}
            </div>
          ) : null}
        </div>

        <div className="section-card footer-note">
          <div className="section-title">Regle de survie</div>
          <p>
            Tu n&apos;as pas la vision complete. Certaines infos sont solides, d&apos;autres tres
            seduisantes mais fragiles. Le vrai plaisir est de separer le signal du piege sans
            te laisser impressionner par la personne qui raconte le mieux son histoire.
          </p>
        </div>
      </section>
    </main>
  );
}
