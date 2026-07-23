import { CardDef } from '../../cards/definitions';

export function CardPilePopup({ pile, onClose }: { pile: CardDef[]; onClose: () => void }) {
  return (
    <div className="popup-overlay" onClick={onClose}>
      <div className="popup" onClick={(e) => e.stopPropagation()}>
        <h3>Card Pile</h3>
        <div className="card-list">
          {pile.map((card, i) => (
            <div key={i} className="card-item">
              <span className="card-emoji">{card.emoji}</span>
              <span className="card-name">{card.name}</span>
            </div>
          ))}
        </div>
        <button onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

export function CardDetailPopup({ card, canPlay, onPlay, onCancel }: {
  card: CardDef; canPlay: boolean; onPlay: () => void; onCancel: () => void;
}) {
  return (
    <div className="popup-overlay" onClick={onCancel}>
      <div className="popup" onClick={(e) => e.stopPropagation()}>
        <h3>{card.emoji} {card.name}</h3>
        <p>{card.description}</p>
        <button onClick={onPlay} disabled={!canPlay}>Play</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
