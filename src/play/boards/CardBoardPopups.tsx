import type { PlayerCard } from '../../cards/types';
import { cardDamage, cardRarityColor, cardTypeColor } from '../../cards/definitions';
import { resolveCardDef } from '../../cards/deck';
import type { PlayedCard } from '../../types';

interface CardPlayAnim {
  cardId: string;
  upgradeLevel: number;
  playerName: string;
  playerColor: string;
}

function MiniTile({ pc, onClick }: { pc: PlayerCard; onClick?: () => void }) {
  const def = resolveCardDef(pc);
  if (!def) return null;
  return (
    <div
      className={`card-mini-tile${onClick ? ' clickable' : ''}`}
      style={{ borderColor: cardRarityColor(def.rarity), background: `color-mix(in srgb, ${cardTypeColor(def.type)} 10%, var(--bg-3))` }}
      onClick={onClick}
    >
      <span style={{ fontSize: 20 }}>{def.icon}</span>
      <span style={{ fontSize: 10, fontWeight: 800 }}>{def.name}</span>
      <span className="muted" style={{ fontSize: 9 }}>{def.type === 'damage' ? `${cardDamage(def)} dmg` : def.type}</span>
    </div>
  );
}

export function DeckPopup({
  deck,
  onClose,
}: {
  deck: PlayerCard[];
  onClose: () => void;
}) {
  return (
    <div className="card-popup-overlay" onClick={onClose}>
      <div className="card-pile-popup" onClick={e => e.stopPropagation()}>
        <div className="card-pile-popup-header">
          <h3>🂠 Deck ({deck.length})</h3>
          <button className="btn sm ghost" onClick={onClose}>Close</button>
        </div>
        {deck.length === 0 ? (
          <div className="muted small" style={{ padding: 20 }}>Deck is empty. Graveyard will be shuffled in on next draw.</div>
        ) : (
          <>
            <div style={{ marginBottom: 12 }}>
              <div className="muted small" style={{ fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.04em', fontSize: 10 }}>Starter Cards</div>
              <div className="card-pile-popup-grid">
                {deck.filter(pc => { const def = resolveCardDef(pc); return def && (def.levelRequired ?? 1) === 1; }).map((pc, idx) => (
                  <MiniTile key={idx} pc={pc} />
                ))}
              </div>
            </div>
            {Array.from(new Set(deck.map(pc => resolveCardDef(pc)?.levelRequired ?? 1).filter(lvl => lvl > 1))).sort((a, b) => a - b).map(lvl => {
              const levelCards = deck.filter(pc => { const def = resolveCardDef(pc); return def && (def.levelRequired ?? 1) === lvl; });
              if (levelCards.length === 0) return null;
              return (
                <div key={lvl} style={{ marginBottom: 12 }}>
                  <div className="muted small" style={{ fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.04em', fontSize: 10 }}>Level {lvl} Cards</div>
                  <div className="card-pile-popup-grid">
                    {levelCards.map((pc, idx) => (
                      <MiniTile key={idx} pc={pc} />
                    ))}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}

export function GraveyardPopup({
  graveyard,
  onClose,
}: {
  graveyard: PlayerCard[];
  onClose: () => void;
}) {
  return (
    <div className="card-popup-overlay" onClick={onClose}>
      <div className="card-pile-popup" onClick={e => e.stopPropagation()}>
        <div className="card-pile-popup-header">
          <h3>⚰️ Graveyard ({graveyard.length})</h3>
          <button className="btn sm ghost" onClick={onClose}>Close</button>
        </div>
        <div className="card-pile-popup-grid">
          {graveyard.length === 0 && <div className="muted small" style={{ padding: 20 }}>Graveyard is empty.</div>}
          {graveyard.map((pc, idx) => (
            <MiniTile key={idx} pc={pc} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function PlayedPopup({
  playedCards,
  onClose,
  onSelect,
}: {
  playedCards: PlayedCard[];
  onClose: () => void;
  onSelect: (pc: PlayedCard) => void;
}) {
  return (
    <div className="card-popup-overlay" onClick={onClose}>
      <div className="card-pile-popup" onClick={e => e.stopPropagation()}>
        <div className="card-pile-popup-header">
          <h3>📋 Played ({playedCards.length})</h3>
          <button className="btn sm ghost" onClick={onClose}>Close</button>
        </div>
        <div className="card-pile-popup-grid">
          {playedCards.length === 0 && <div className="muted small" style={{ padding: 20 }}>No cards played yet.</div>}
          {playedCards.map((pc, idx) => {
            const def = resolveCardDef({ cardId: pc.cardId, upgradeLevel: pc.upgradeLevel, upgraded: pc.upgradeLevel > 0 });
            if (!def) return null;
            return (
              <div
                key={idx}
                className="card-mini-tile clickable"
                style={{ borderColor: cardRarityColor(def.rarity), background: `color-mix(in srgb, ${cardTypeColor(def.type)} 10%, var(--bg-3))` }}
                onClick={() => onSelect(pc)}
              >
                <span style={{ fontSize: 20 }}>{def.icon}</span>
                <span style={{ fontSize: 10, fontWeight: 800 }}>{def.name}</span>
                <span className="muted" style={{ fontSize: 9 }}>{def.type === 'damage' ? `${cardDamage(def)} dmg` : def.type}</span>
                <span style={{ fontSize: 8, color: pc.playerColor, fontWeight: 700, marginTop: 2 }}>{pc.playerName}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function CardDetailPopup({
  playedCard,
  closing,
  onClose,
}: {
  playedCard: PlayedCard;
  closing: boolean;
  onClose: () => void;
}) {
  const def = resolveCardDef({ cardId: playedCard.cardId, upgradeLevel: playedCard.upgradeLevel, upgraded: playedCard.upgradeLevel > 0 });
  if (!def) return null;
  const tColor = cardTypeColor(def.type);
  const rColor = cardRarityColor(def.rarity);
  return (
    <div className="card-popup-overlay" onClick={onClose}>
      <div
        className={`card-detail-popup ${closing ? 'popup-closing' : ''}`}
        onClick={e => e.stopPropagation()}
        style={{ '--card-color': tColor, '--card-rarity': rColor } as React.CSSProperties}
      >
        <div className="card-detail-header">
          <span className="card-detail-icon">{def.icon}</span>
          <span className="card-detail-name">{def.name}</span>
          <button className="btn sm ghost" onClick={onClose}>Close</button>
        </div>
        <div className="card-detail-body">
          <div className="card-detail-type" style={{ color: tColor }}>{def.type}</div>
          <div className="card-detail-rarity" style={{ color: rColor }}>{def.rarity}</div>
          {def.type === 'damage' && <div className="card-detail-stat">Damage: {cardDamage(def)}</div>}
          <div className="card-detail-desc">{def.desc}</div>
          <div className="card-detail-player" style={{ color: playedCard.playerColor }}>
            Played by {playedCard.playerName}
          </div>
        </div>
      </div>
    </div>
  );
}

export function CardPlayAnimOverlay({ anim }: { anim: CardPlayAnim }) {
  const def = resolveCardDef({ cardId: anim.cardId, upgradeLevel: anim.upgradeLevel, upgraded: anim.upgradeLevel > 0 });
  if (!def) return null;
  const tColor = cardTypeColor(def.type);
  const rColor = cardRarityColor(def.rarity);
  return (
    <div className="card-play-anim-overlay">
      <div
        className="card-play-anim-card"
        style={{ '--card-color': tColor, '--card-rarity': rColor } as React.CSSProperties}
      >
        <div className="card-play-anim-icon">{def.icon}</div>
        <div className="card-play-anim-name">{def.name}</div>
        <div className="card-play-anim-type">{def.type === 'damage' ? `${cardDamage(def)} damage` : def.type}</div>
        <div className="card-play-anim-player" style={{ color: anim.playerColor }}>
          {anim.playerName}
        </div>
      </div>
    </div>
  );
}

export type { CardPlayAnim };
