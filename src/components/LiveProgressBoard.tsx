import type { CSSProperties } from "react";
import type { GameSnapshot, IntruderGuessRecord, VoteRecord } from "../types";

interface LiveProgressBoardProps {
  snapshot: GameSnapshot;
  guesses: Record<string, IntruderGuessRecord>;
  votes: Record<string, VoteRecord>;
  onBack: () => void;
}

function percent(value: number) {
  return `${Math.round(value)}%`;
}

export default function LiveProgressBoard({
  snapshot,
  guesses,
  votes,
  onBack
}: LiveProgressBoardProps) {
  const teams = snapshot.teams
    .map((team, index) => {
      const members = team.cards.map((card) => ({
        id: card.id,
        name: card.participantName,
        vote: votes[card.id]
      }));
      const completed = members.filter((member) => member.vote).length;
      const percentComplete = team.cards.length === 0 ? 0 : (completed / team.cards.length) * 100;
      const countA = members.filter((member) => member.vote?.choice === "A").length;
      const countB = members.filter((member) => member.vote?.choice === "B").length;
      const suspicions = team.cards.filter((card) => guesses[card.id]).length;

      return {
        team,
        index,
        members,
        completed,
        percentComplete,
        countA,
        countB,
        suspicions
      };
    })
    .sort((left, right) => {
      if (right.percentComplete !== left.percentComplete) {
        return right.percentComplete - left.percentComplete;
      }
      return left.index - right.index;
    });

  const totalParticipants = snapshot.participants.length;
  const totalVotes = Object.keys(votes).length;
  const totalCompletion = totalParticipants === 0 ? 0 : (totalVotes / totalParticipants) * 100;

  return (
    <main className="view-shell live-board-shell">
      <div className="toolbar print-hidden">
        <button className="ghost-button" onClick={onBack} type="button">
          Retour mission control
        </button>
      </div>

      <section className="hero-panel live-board-hero">
        <div className="eyebrow">Mur live • Avancement des equipes</div>
        <h1>Tableau de progression de l&apos;operation</h1>
        <p className="lead">
          Visualisation en direct des choix individuels, equipe par equipe, pour diffuser
          l&apos;avancee, la tension et l&apos;effet de surprise pendant tout le jeu.
        </p>

        <div className="live-board-summary">
          <article className="live-summary-card">
            <span>Progression globale</span>
            <strong>{percent(totalCompletion)}</strong>
            <p>
              {totalVotes}/{totalParticipants} choix verrouilles
            </p>
          </article>
          <article className="live-summary-card">
            <span>Equipes actives</span>
            <strong>{snapshot.teams.length}</strong>
              <p>Toutes les equipes visibles en direct</p>
          </article>
          <article className="live-summary-card">
            <span>Mise a jour</span>
            <strong>Live</strong>
            <p>Synchronisation automatique des votes</p>
          </article>
        </div>
      </section>

      <section className="live-board-grid">
        {teams.map(({ team, index, members, completed, percentComplete, countA, countB, suspicions }) => (
          <article className="live-team-card" key={team.id}>
            <div className="live-team-header">
              <div>
                <div className="eyebrow">Equipe {index + 1} • Cellule tactique</div>
                <h2>{team.name}</h2>
                <p className="muted-line">{team.mixSummary}</p>
              </div>
              <div className="live-rank-badge">#{index + 1}</div>
            </div>

            <div className="live-progress-strip">
              <div
                aria-hidden="true"
                className="live-progress-orb"
                style={
                  {
                    "--progress-value": `${percentComplete}%`
                  } as CSSProperties
                }
              >
                <div className="live-progress-core">
                  <span>{percent(percentComplete)}</span>
                </div>
              </div>

              <div className="live-progress-copy">
                <div className="live-progress-numbers">
                  <strong>
                    {completed}/{team.cards.length}
                  </strong>
                  <span>agents verrouilles</span>
                </div>

                <div className="live-vote-split">
                  <div className="vote-pill vote-A">A • {countA}</div>
                  <div className="vote-pill vote-B">B • {countB}</div>
                  <div className="vote-pill vote-pending">
                    En attente • {team.cards.length - completed}
                  </div>
                  <div className="vote-pill vote-pending">
                    Soupçons • {suspicions}/{team.cards.length}
                  </div>
                </div>
              </div>
            </div>

            <div className="live-member-grid">
              {members.map((member) => (
                <div
                  className={member.vote ? "live-member-chip done" : "live-member-chip"}
                  key={member.id}
                  title={member.vote ? `${member.name} • ${member.vote.choice}` : member.name}
                >
                  <span className="live-member-dot" />
                  <span className="live-member-name">{member.name}</span>
                  <span className={member.vote ? `live-member-choice ${member.vote.choice}` : "live-member-choice"}>
                    {member.vote ? member.vote.choice : "…"}
                  </span>
                </div>
              ))}
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
