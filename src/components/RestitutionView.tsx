import type { RestitutionEntry, TeamGame } from "../types";
import { toReadableFrench } from "../lib/readableFrench";

interface RestitutionViewProps {
  team: TeamGame;
  value: RestitutionEntry;
  onChange: (patch: Partial<RestitutionEntry>) => void;
  onBack: () => void;
}

export default function RestitutionView({
  team,
  value,
  onChange,
  onBack
}: RestitutionViewProps) {
  return (
    <main className="view-shell">
      <div className="toolbar print-hidden">
        <button className="ghost-button" onClick={onBack} type="button">
          Retour mission control
        </button>
        <button className="ghost-button" onClick={() => window.print()} type="button">
          Imprimer / PDF
        </button>
      </div>

      <section className="panel">
        <div className="eyebrow">Debrief mission • {team.name}</div>
        <h1>{toReadableFrench(team.scenarioTitle)}</h1>
        <p className="muted-line">{team.mixSummary}</p>
        <p className="lead">{toReadableFrench(team.situation)}</p>

        <div className="decision-grid">
          {team.options.map((option) => (
            <article className="decision-card" key={option.id}>
              <div className="decision-tag">Décision {option.id}</div>
              <h3>{toReadableFrench(option.title)}</h3>
              <p>{toReadableFrench(option.description)}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel form-panel">
        <label className="field-block">
          <span>Decision finale de l&apos;equipe</span>
          <select
            value={value.decision}
            onChange={(event) => onChange({ decision: event.target.value })}
          >
            <option value="">Choisir</option>
            <option value="A">Décision A</option>
            <option value="B">Décision B</option>
          </select>
        </label>

        <label className="field-block">
          <span>Signaux jugés fiables</span>
          <textarea
            value={value.reliableSignals}
            onChange={(event) => onChange({ reliableSignals: event.target.value })}
            rows={4}
          />
        </label>

        <label className="field-block">
          <span>Signaux mis en doute</span>
          <textarea
            value={value.doubtfulSignals}
            onChange={(event) => onChange({ doubtfulSignals: event.target.value })}
            rows={4}
          />
        </label>

        <label className="field-block">
          <span>Logique de decision</span>
          <textarea
            value={value.decisionLogic}
            onChange={(event) => onChange({ decisionLogic: event.target.value })}
            rows={5}
          />
        </label>

        <label className="field-block">
          <span>Surprises et points de friction</span>
          <textarea
            value={value.disagreements}
            onChange={(event) => onChange({ disagreements: event.target.value })}
            rows={4}
          />
        </label>

        <label className="field-block">
          <span>Argumentaire final</span>
          <textarea
            value={value.justification}
            onChange={(event) => onChange({ justification: event.target.value })}
            rows={5}
          />
        </label>
      </section>
    </main>
  );
}
