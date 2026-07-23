import type { CardDef, PlayerCard } from '../../cards/types';
import { cardDamage, cardRarityColor, cardTypeColor } from '../../cards/definitions';
import { resolveCardDef } from '../../cards/deck';

// ---------------------------------------------------------------------------
// Mini card tile — used in deck and graveyard pile popups
// ---------------------------------------------------------------------------

export function CardMiniTile({ pc }: { pc: PlayerCard }) {
  const def = resolveCardDef(pc);
  if (!def) return null;
  return (
    <div className="card-mini-tile" style={{ borderColor: cardRarityColor(def.rarity), background: `color-mix(in srgb, ${cardTypeColor(def.type)} 10%, var(--bg-3))` }}>
      <span style={{ fontSize: 20 }}>{def.icon}</span>
      <span style={{ fontSize: 10, fontWeight: 800 }}>{def.name}</span>
      <span className="muted" style={{ fontSize: 9 }}>{def.type === 'damage' ? `${cardDamage(def)} dmg` : def.type}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card pile popup — shared by deck viewer and graveyard viewer
// ---------------------------------------------------------------------------

export function CardPilePopup({ title, icon, cards, onClose }: {
  title: string; icon: string; cards: PlayerCard[]; onClose: () => void;
}) {
  return (
    <div className="card-popup-overlay" onClick={onClose}>
      <div className="card-pile-popup" onClick={e => e.stopPropagation()}>
        <div className="card-pile-popup-header">
          <h3>{icon} {title} ({cards.length})</h3>
          <button className="btn sm ghost" onClick={onClose}>Close</button>
        </div>
        {cards.length === 0 ? (
          <div className="muted small" style={{ padding: 20 }}>Empty.</div>
        ) : (
          <div className="card-pile-popup-grid">
            {cards.map((pc, idx) => <CardMiniTile key={idx} pc={pc} />)}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card detail popup — shown when a card in hand is selected
// ---------------------------------------------------------------------------

export function CardDetailPopup({ card, cardIdx, canPlay, onPlay, onCancel }: {
  card: CardDef; cardIdx: number; canPlay: boolean; onPlay: () => void; onCancel: () => void;
}) {
  return (
    <div className="card-popup-overlay" onClick={onCancel}>
      <div className="card-popup" onClick={e => e.stopPropagation()} style={{ '--card-color': cardTypeColor(card.type), '--card-rarity': cardRarityColor(card.rarity) } as React.CSSProperties}>
        <div className="card-popup-header">
          <span className="card-popup-icon">{card.icon}</span>
          <span className="card-popup-name">{card.name}</span>
          <span className="card-popup-rarity" style={{ color: cardRarityColor(card.rarity) }}>{card.rarity}</span>
        </div>
        <div className="card-popup-body">
          <div className="card-popup-type" style={{ color: cardTypeColor(card.type) }}>
            {card.type === 'damage' ? `Damage — ${cardDamage(card)} points` : card.type === 'spell' ? 'Spell' : 'Utility'}
          </div>
          <div className="card-popup-desc">{card.desc}</div>
          {card.class !== 'any' && <div className="card-popup-class">Class: {card.class}</div>}
        </div>
        <div className="card-popup-actions">
          <button className="btn block ghost" onClick={onCancel}>Cancel</button>
          <button
            className="btn block primary"
            disabled={card.type === 'damage' && !canPlay}
            onClick={onPlay}
          >
            {card.type === 'damage' ? 'Play' : 'Use'}
          </button>
        </div>
      </div>
    </div>
  );
}
