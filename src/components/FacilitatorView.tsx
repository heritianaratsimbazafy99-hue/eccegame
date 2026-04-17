import type { IntruderGuessRecord, TeamGame } from "../types";
import { buildCardUrl, labelDecision, labelTruth } from "../lib/utils";

interface FacilitatorViewProps {
  team: TeamGame;
  baseUrl: string;
  qrCodes: Record<string, string>;
  guesses: Record<string, IntruderGuessRecord>;
  onBack: () => void;
  onOpenRestitution: (teamId: string) => void;
}

export default function FacilitatorView({
  team,
  baseUrl,
  qrCodes,
  guesses,
  onBack,
  onOpenRestitution
}: FacilitatorViewProps) {
  const intruders = team.participants.filter((participant) =>
    team.intruderIds.includes(participant.id)
  );
  const suspicionLogs = team.cards
    .map((card) => guesses[card.id])
    .filter((guess): guess is IntruderGuessRecord => Boolean(guess))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

  return (
    <main className="view-shell facilitator-shell">
      <div className="toolbar print-hidden">
        <button className="ghost-button" onClick={onBack} type="button">
          Retour mission control
        </button>
        <button className="primary-button" onClick={() => onOpenRestitution(team.id)} type="button">
          Ouvrir le debrief mission
        </button>
        <button className="ghost-button" onClick={() => window.print()} type="button">
          Imprimer / PDF
        </button>
      </div>

      <section className="panel">
        <div className="eyebrow">Dossier animateur • {team.name}</div>
        <h1>{team.scenarioTitle}</h1>
        <p className="lead">{team.atmosphere}</p>
        <p className="muted-line">{team.mixSummary}</p>
        <p>{team.situation}</p>

        <div className="decision-grid">
          {team.options.map((option) => (
            <article className="decision-card" key={option.id}>
              <div className="decision-tag">Décision {option.id}</div>
              <h3>{option.title}</h3>
              <p>{option.description}</p>
            </article>
          ))}
        </div>

        <div className="admin-answer">
          <div>
            <span className="section-title">Lecture animateur</span>
            <h2>{labelDecision(team.correctDecision)}</h2>
          </div>
          <p>{team.rationale}</p>
        </div>

        <div className="intruder-admin-panel">
          <div className="section-title">Cellule d&apos;intrusion</div>
          <div className="chip-row">
            <span className="truth-chip truth-false">Intrus: {intruders.length}</span>
            <span className={`vote-pill vote-${team.sabotageDecision}`}>
              Mauvaise option a vendre: {team.sabotageDecision}
            </span>
            <span className="vote-pill vote-pending">
              Soupçons recus: {suspicionLogs.length}/{team.cards.length}
            </span>
          </div>
          <div className="member-list facilitator-intruder-list">
            {intruders.map((participant) => (
              <div className="member-pill intruder-pill" key={participant.id}>
                {participant.name} • {participant.service || participant.direction}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="panel">
          <div className="section-title">Repartition des signaux</div>
        <div className="chip-row">
          <span className="truth-chip truth-true">Vraies: {team.truthCounts.true}</span>
          <span className="truth-chip truth-partial">Partielles: {team.truthCounts.partial}</span>
          <span className="truth-chip truth-false">Faussées: {team.truthCounts.false}</span>
        </div>

        <div className="facilitator-card-grid">
          {team.cards.map((card) => (
            <article className="facilitator-card" key={card.id}>
              <div className="facilitator-card-header">
                <div>
                  <div className="eyebrow">{card.participantName}</div>
                  <h3>{card.headline}</h3>
                </div>
                <div className="chip-row compact-chip-row">
                  <span className={`truth-chip truth-${card.truthType}`}>{labelTruth(card.truthType)}</span>
                  {card.isIntruder ? <span className="truth-chip truth-false">Intrus</span> : null}
                </div>
              </div>
              <p>{card.body}</p>
              <div className="admin-callout">
                <strong>Lecture operateur:</strong> {card.adminTruth}
              </div>
              {card.isIntruder && card.sabotageBrief ? (
                <div className="admin-callout intruder-callout">
                  <strong>Brief clandestin:</strong> {card.sabotageBrief}
                </div>
              ) : null}
              {guesses[card.id] ? (
                <div className="admin-callout subtle">
                  <strong>Intrus designes par cet agent:</strong>{" "}
                  {guesses[card.id].suspectNames.join(" • ")}
                </div>
              ) : null}
              <div className="admin-callout subtle">
                <strong>Lien d'infiltration:</strong> {buildCardUrl(baseUrl, card.id)}
              </div>
              {qrCodes[card.id] ? (
                <img alt={`QR ${card.participantName}`} className="inline-qr" src={qrCodes[card.id]} />
              ) : (
                <div className="qr-placeholder">QR en génération…</div>
              )}
            </article>
          ))}
        </div>

        <div className="resti-snapshot accusation-panel">
          <div className="section-title">Journal des soupçons</div>
          {suspicionLogs.length === 0 ? (
            <p>Aucun agent n&apos;a encore designe ses 2 intrus.</p>
          ) : (
            <div className="response-log">
              {suspicionLogs.map((guess) => (
                <div className="response-row" key={guess.cardId}>
                  <div>
                    <strong>{guess.participantName}</strong>
                    <div className="tiny-link">
                      {new Date(guess.updatedAt).toLocaleTimeString("fr-FR", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit"
                      })}
                    </div>
                  </div>
                  <div className="accusation-inline-list">
                    {guess.suspectNames.map((suspectName) => (
                      <span className="member-pill accusation-pill" key={`${guess.cardId}-${suspectName}`}>
                        {suspectName}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
