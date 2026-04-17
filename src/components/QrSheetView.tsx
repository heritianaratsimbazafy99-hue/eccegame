import type { GameSnapshot } from "../types";
import { buildCardUrl } from "../lib/utils";

interface QrSheetViewProps {
  snapshot: GameSnapshot;
  baseUrl: string;
  qrCodes: Record<string, string>;
  onBack: () => void;
}

export default function QrSheetView({
  snapshot,
  baseUrl,
  qrCodes,
  onBack
}: QrSheetViewProps) {
  return (
    <main className="view-shell qr-sheet-shell">
      <div className="toolbar print-hidden">
        <button className="ghost-button" onClick={onBack} type="button">
          Retour mission control
        </button>
        <button className="ghost-button" onClick={() => window.print()} type="button">
          Imprimer / PDF
        </button>
      </div>

      <section className="panel">
        <div className="eyebrow">Matrice QR</div>
        <h1>Distribution des dossiers secrets</h1>
        <p className="lead">
          Chaque QR ouvre directement le dossier confidentiel d&apos;un participant sur smartphone.
        </p>
      </section>

      {snapshot.teams.map((team) => (
        <section className="panel qr-team-section" key={team.id}>
          <div className="section-title">
            {team.name} • {team.participants.length} participants
          </div>
          <div className="qr-grid">
            {team.cards.map((card) => (
              <article className="qr-tile" key={card.id}>
                <div className="eyebrow">{team.name}</div>
                <h3>{card.participantName}</h3>
                {qrCodes[card.id] ? (
                  <img alt={`QR ${card.participantName}`} className="qr-image" src={qrCodes[card.id]} />
                ) : (
                  <div className="qr-placeholder">QR en génération…</div>
                )}
                <p className="tiny">
                  {buildCardUrl(baseUrl, card.id).replace(/^https?:\/\//, "")}
                </p>
              </article>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
