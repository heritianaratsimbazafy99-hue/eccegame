import { type ChangeEvent, useMemo, useState } from "react";
import type {
  GameSnapshot,
  IntruderGuessRecord,
  RestitutionEntry,
  TeamGame,
  VoteRecord
} from "../types";
import {
  buildCardUrl,
  buildFacilitatorUrl,
  buildLiveBoardUrl,
  buildQrSheetUrl,
  buildRestitutionUrl,
  labelDecision,
  labelTruth
} from "../lib/utils";
import { toReadableFrench } from "../lib/readableFrench";

type AdminTab = "operation" | "responses" | "teams";

interface AdminDashboardProps {
  snapshot: GameSnapshot;
  baseUrl: string;
  error?: string;
  onBaseUrlChange: (value: string) => void;
  onUploadWorkbook: (file: File) => Promise<void>;
  onRegenerate: () => void;
  onResetToDefault: () => Promise<void>;
  onResetVotes: () => void;
  onOpenFacilitator: (teamId: string) => void;
  onOpenRestitution: (teamId: string) => void;
  onOpenQrSheet: () => void;
  onOpenLiveBoard: () => void;
  qrCodes: Record<string, string>;
  restitutionMap: Record<string, RestitutionEntry>;
  guesses: Record<string, IntruderGuessRecord>;
  votes: Record<string, VoteRecord>;
}

function CopyButton({ value }: { value: string }) {
  const [status, setStatus] = useState<"idle" | "done">("idle");

  async function handleCopy() {
    if (!navigator.clipboard) {
      return;
    }
    await navigator.clipboard.writeText(value);
    setStatus("done");
    window.setTimeout(() => setStatus("idle"), 1400);
  }

  return (
    <button className="mini-button" onClick={handleCopy} type="button">
      {status === "done" ? "Copié" : "Copier"}
    </button>
  );
}

function formatVoteTime(value: string) {
  return new Date(value).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function TeamDetails({
  team,
  teamLabel,
  baseUrl,
  qrCodes,
  restitution,
  guesses,
  votes,
  onOpenFacilitator,
  onOpenRestitution
}: {
  team: TeamGame;
  teamLabel: string;
  baseUrl: string;
  qrCodes: Record<string, string>;
  restitution?: RestitutionEntry;
  guesses: Record<string, IntruderGuessRecord>;
  votes: Record<string, VoteRecord>;
  onOpenFacilitator: (teamId: string) => void;
  onOpenRestitution: (teamId: string) => void;
}) {
  const teamVoteCount = team.cards.filter((card) => votes[card.id]).length;
  const teamGuesses = team.cards
    .map((card) => guesses[card.id])
    .filter((guess): guess is IntruderGuessRecord => Boolean(guess));
  const intruders = team.participants.filter((participant) => team.intruderIds.includes(participant.id));

  return (
    <details className="team-details" open={team.participants.length >= 10}>
      <summary>
        <div>
          <div className="eyebrow">
            {teamLabel} • {team.mixSummary}
          </div>
          <strong>{team.name}</strong>
        </div>
        <div className="summary-meta">
          <span>{team.participants.length} agents</span>
          <span>{teamVoteCount} votes</span>
          <span className="truth-chip truth-true">{team.truthCounts.true}</span>
          <span className="truth-chip truth-partial">{team.truthCounts.partial}</span>
          <span className="truth-chip truth-false">{team.truthCounts.false}</span>
        </div>
      </summary>

      <div className="team-details-body">
        <div className="section-card">
          <div className="section-title">Scenario d'operation</div>
          <h3>{toReadableFrench(team.scenarioTitle)}</h3>
          <p>{toReadableFrench(team.atmosphere)}</p>
          <p>{toReadableFrench(team.situation)}</p>
        </div>

        <div className="admin-callout subtle">
          <strong>Composition des agents:</strong> {team.mixSummary}
        </div>

        <div className="decision-grid">
          {team.options.map((option) => (
            <article className="decision-card" key={option.id}>
              <div className="decision-tag">Décision {option.id}</div>
              <h4>{toReadableFrench(option.title)}</h4>
              <p>{toReadableFrench(option.description)}</p>
            </article>
          ))}
        </div>

        <div className="admin-answer">
          <div>
            <span className="section-title">Lecture animateur</span>
            <h3>{labelDecision(team.correctDecision)}</h3>
          </div>
          <p>{toReadableFrench(team.rationale)}</p>
        </div>

        <div className="intruder-admin-panel">
          <div className="section-title">Cellule d&apos;intrusion</div>
          <div className="chip-row">
            <span className="truth-chip truth-false">Intrus: {intruders.length}</span>
            <span className={`vote-pill vote-${team.sabotageDecision}`}>
              Mauvaise option a pousser: {team.sabotageDecision}
            </span>
            <span className="vote-pill vote-pending">
              Soupçons recus: {teamGuesses.length}/{team.cards.length}
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

        <div className="toolbar compact-toolbar">
          <button className="primary-button" onClick={() => onOpenFacilitator(team.id)} type="button">
            Dossier animateur
          </button>
          <button className="ghost-button" onClick={() => onOpenRestitution(team.id)} type="button">
            Debrief mission
          </button>
          <span className="tiny-link">{buildFacilitatorUrl(baseUrl, team.id)}</span>
          <CopyButton value={buildFacilitatorUrl(baseUrl, team.id)} />
          <span className="tiny-link">{buildRestitutionUrl(baseUrl, team.id)}</span>
          <CopyButton value={buildRestitutionUrl(baseUrl, team.id)} />
        </div>

        <div className="resti-snapshot">
          <div className="section-title">Debrief en cours</div>
          <p>
            <strong>Décision:</strong> {restitution?.decision || "Non saisie"}
          </p>
          <p>
            <strong>Justification:</strong> {restitution?.justification || "Aucune encore"}
          </p>
        </div>

        <div className="participant-grid">
          {team.cards.map((card) => {
            const participant = team.participants.find((item) => item.id === card.participantId);

            return (
              <article className="participant-admin-card" key={card.id}>
                <div className="participant-admin-header">
                  <div>
                    <div className="eyebrow">{card.participantName}</div>
                    <h4>{toReadableFrench(card.headline)}</h4>
                    <p className="muted-line">{participant?.service || participant?.direction}</p>
                  </div>
                  <div className="chip-row compact-chip-row">
                    <span className={`truth-chip truth-${card.truthType}`}>{labelTruth(card.truthType)}</span>
                    {card.isIntruder ? <span className="truth-chip truth-false">Intrus</span> : null}
                  </div>
                </div>
                <p>{toReadableFrench(card.body)}</p>
                <div className="admin-callout">
                  <strong>Lecture operateur:</strong> {card.adminTruth}
                </div>
                {card.isIntruder && card.sabotageBrief ? (
                  <div className="admin-callout intruder-callout">
                    <strong>Brief clandestin:</strong> {toReadableFrench(card.sabotageBrief)}
                  </div>
                ) : null}
                {guesses[card.id] ? (
                  <div className="admin-callout subtle">
                    <strong>Intrus designes:</strong> {guesses[card.id].suspectNames.join(" • ")}
                  </div>
                ) : null}
                <div className="admin-callout subtle">
                  <strong>Lien d'infiltration:</strong> {buildCardUrl(baseUrl, card.id)}
                </div>
                <div className="vote-indicator-row">
                  {votes[card.id] ? (
                    <div className={`vote-pill vote-${votes[card.id].choice}`}>
                      Vote verrouille: {votes[card.id].choice}
                    </div>
                  ) : (
                      <div className="vote-pill vote-pending">Aucun vote remonte</div>
                  )}
                  <CopyButton value={buildCardUrl(baseUrl, card.id)} />
                </div>
                {qrCodes[card.id] ? (
                  <img alt={`QR ${card.participantName}`} className="inline-qr" src={qrCodes[card.id]} />
                ) : (
                  <div className="qr-placeholder">QR en génération…</div>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </details>
  );
}

function ResponsesPanel({
  snapshot,
  guesses,
  votes
}: {
  snapshot: GameSnapshot;
  guesses: Record<string, IntruderGuessRecord>;
  votes: Record<string, VoteRecord>;
}) {
  return (
    <section className="panel">
      <div className="section-title">Reponses individuelles en direct</div>

      <div className="responses-grid">
        {snapshot.teams.map((team, index) => {
          const teamVotes = team.cards
            .map((card) => votes[card.id])
            .filter((vote): vote is VoteRecord => Boolean(vote))
            .sort((left, right) => right.submittedAt.localeCompare(left.submittedAt));

          const countA = teamVotes.filter((vote) => vote.choice === "A").length;
          const countB = teamVotes.filter((vote) => vote.choice === "B").length;
          const pending = team.participants.length - teamVotes.length;
          const teamGuesses = team.cards
            .map((card) => guesses[card.id])
            .filter((guess): guess is IntruderGuessRecord => Boolean(guess));
          const suspicionScore = new Map<string, number>();

          teamGuesses.forEach((guess) => {
            guess.suspectNames.forEach((suspectName) => {
              suspicionScore.set(suspectName, (suspicionScore.get(suspectName) ?? 0) + 1);
            });
          });

          const topSuspects = Array.from(suspicionScore.entries())
            .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
            .slice(0, 3);

          return (
            <article className="response-team-card" key={team.id}>
              <div className="participant-admin-header">
                <div>
                    <div className="eyebrow">Equipe {index + 1}</div>
                  <h3>{team.name}</h3>
                </div>
                <div className="response-counter">{teamVotes.length}/{team.participants.length}</div>
              </div>

              <div className="chip-row">
                <span className="vote-pill vote-A">A • {countA}</span>
                <span className="vote-pill vote-B">B • {countB}</span>
                <span className="vote-pill vote-pending">En attente • {pending}</span>
                <span className="vote-pill vote-pending">
                  Soupçons • {teamGuesses.length}/{team.cards.length}
                </span>
              </div>

              <div className="admin-callout subtle">
                <strong>Intrus les plus suspects pour l&apos;instant:</strong>{" "}
                {topSuspects.length > 0
                  ? topSuspects.map(([name, count]) => `${name} x${count}`).join(" • ")
                  : "Aucun nom ne ressort encore"}
              </div>

              <div className="response-log">
                {teamVotes.length === 0 ? (
                  <p className="muted-line">Aucun agent n&apos;a encore verrouille son choix.</p>
                ) : (
                  teamVotes.map((vote) => (
                    <div className="response-row" key={vote.cardId}>
                      <div>
                        <strong>{vote.participantName}</strong>
                        <div className="tiny-link">{formatVoteTime(vote.submittedAt)}</div>
                      </div>
                      <div className={`vote-pill vote-${vote.choice}`}>Choix {vote.choice}</div>
                    </div>
                  ))
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function TeamsPanel({ snapshot }: { snapshot: GameSnapshot }) {
  return (
    <section className="panel">
      <div className="section-title">Constitution complete des equipes</div>
      <div className="responses-grid">
        {snapshot.teams.map((team, index) => (
          <article className="response-team-card" key={team.id}>
            <div className="eyebrow">Equipe {index + 1}</div>
            <h3>{team.name}</h3>
            <p className="muted-line">{team.mixSummary} • {team.participants.length} membres</p>
            <div className="member-list">
              {team.participants.map((participant) => (
                <div className="member-pill" key={participant.id}>
                  {participant.name} • {participant.service || participant.direction}
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default function AdminDashboard({
  snapshot,
  baseUrl,
  error,
  onBaseUrlChange,
  onUploadWorkbook,
  onRegenerate,
  onResetToDefault,
  onResetVotes,
  onOpenFacilitator,
  onOpenRestitution,
  onOpenQrSheet,
  onOpenLiveBoard,
  qrCodes,
  restitutionMap,
  guesses,
  votes
}: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>("operation");
  const isLocalHost = useMemo(() => /localhost|127\.0\.0\.1/.test(baseUrl), [baseUrl]);
  const totalVotes = Object.keys(votes).length;

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    await onUploadWorkbook(file);
    event.target.value = "";
  }

  return (
    <main className="view-shell">
      <section className="hero-panel mission-panel">
        <div className="eyebrow">Mission control • Jeu de decision collective</div>
        <h1>Mission Impossible prete a etre jouee</h1>
        <p className="lead">
          Equipes inter-metiers, cartes contradictoires, coups de bluff, votes live et arbitrages
          sous tension.
        </p>
        <div className="mission-stamp">Operation en cours</div>

        <div className="stats-grid">
          <div className="metric-card">
            <span>Agents</span>
            <strong>{snapshot.participants.length}</strong>
          </div>
          <div className="metric-card">
            <span>Equipes</span>
            <strong>{snapshot.teams.length}</strong>
          </div>
          <div className="metric-card">
            <span>Votes recus</span>
            <strong>{totalVotes}</strong>
          </div>
          <div className="metric-card">
            <span>Horodatage</span>
            <strong>{new Date(snapshot.generatedAt).toLocaleString("fr-FR")}</strong>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="section-title">Console de mission</div>

        {error ? <div className="warning-card">{error}</div> : null}

        <label className="field-block">
          <span>URL d'infiltration a injecter dans les QR codes</span>
          <input
            onChange={(event) => onBaseUrlChange(event.target.value)}
            placeholder="http://192.168.x.x:3000"
            type="text"
            value={baseUrl}
          />
        </label>

        {isLocalHost ? (
          <div className="warning-card">
            Tu es sur une URL locale. Pour les smartphones, recupere l&apos;URL reseau affichee
            par le serveur, puis colle-la ici avant le lancement de l&apos;operation.
          </div>
        ) : null}

        <div className="toolbar">
          <label className="primary-button file-label">
            Charger un autre roster local
            <input accept=".xlsx,.xls" hidden onChange={handleFileChange} type="file" />
          </label>
          <button className="ghost-button" onClick={onRegenerate} type="button">
            Reequilibrer les equipes
          </button>
          <button className="ghost-button" onClick={() => void onResetToDefault()} type="button">
            Recharger le dossier Smilebox
          </button>
          <button className="ghost-button" onClick={onResetVotes} type="button">
            Réinitialiser votes et soupçons
          </button>
          <button className="primary-button" onClick={onOpenQrSheet} type="button">
            Ouvrir le pack QR
          </button>
          <button className="primary-button" onClick={onOpenLiveBoard} type="button">
            Ouvrir le mur live
          </button>
          <span className="tiny-link">{buildQrSheetUrl(baseUrl)}</span>
          <CopyButton value={buildQrSheetUrl(baseUrl)} />
          <span className="tiny-link">{buildLiveBoardUrl(baseUrl)}</span>
          <CopyButton value={buildLiveBoardUrl(baseUrl)} />
        </div>
      </section>

      <section className="panel">
        <div className="admin-tabs">
          <button
            className={activeTab === "operation" ? "tab-button active" : "tab-button"}
            onClick={() => setActiveTab("operation")}
            type="button"
          >
            Operation
          </button>
          <button
            className={activeTab === "responses" ? "tab-button active" : "tab-button"}
            onClick={() => setActiveTab("responses")}
            type="button"
          >
            Reponses live
          </button>
          <button
            className={activeTab === "teams" ? "tab-button active" : "tab-button"}
            onClick={() => setActiveTab("teams")}
            type="button"
          >
            Constitution des equipes
          </button>
        </div>
      </section>

      {activeTab === "operation" ? (
        <section className="panel">
          <div className="section-title">Equipes actives et dossiers generes</div>
          <div className="team-list">
            {snapshot.teams.map((team, index) => (
              <TeamDetails
                baseUrl={baseUrl}
                guesses={guesses}
                key={team.id}
                onOpenFacilitator={onOpenFacilitator}
                onOpenRestitution={onOpenRestitution}
                qrCodes={qrCodes}
                restitution={restitutionMap[team.id]}
                team={team}
                teamLabel={`Équipe ${index + 1}`}
                votes={votes}
              />
            ))}
          </div>
        </section>
      ) : null}

      {activeTab === "responses" ? (
        <ResponsesPanel guesses={guesses} snapshot={snapshot} votes={votes} />
      ) : null}
      {activeTab === "teams" ? <TeamsPanel snapshot={snapshot} /> : null}
    </main>
  );
}
