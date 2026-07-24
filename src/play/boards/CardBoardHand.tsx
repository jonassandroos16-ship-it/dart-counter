import type { CardDef } from '../../cards/types';
import { cardDamage, cardRarityColor, cardTypeColor } from '../../cards/definitions';
import { EffectPill } from '../../cards/EffectPill';
import { getEffectMeta } from '../../cards/effectMeta';

interface Props {
  handDefs: CardDef[];
  usedDefs: CardDef[];
  isMyTurn: boolean;
  animatingOut: number | null;
  isBattle: boolean;
  playerName: string;
  deckCount: number;
  graveyardCount: number;
  playedCount: number;
  onCardClick: (idx: number) => void;
  onShowDeck: () => void;
  onShowGraveyard: () => void;
  onShowPlayed: () => void;
  onUndo: () => void;
  onEnterVisit: () => void;
}

export function CardBoardHand({
  handDefs, usedDefs, isMyTurn, animatingOut, isBattle, playerName,
  deckCount, graveyardCount, playedCount,
  onCardClick, onShowDeck, onShowGraveyard, onShowPlayed, onUndo, onEnterVisit,
}: Props) {
  return (
    <div className="play-input">
      <div className="pad-card card-board-pad">
        <div className="card-pile-row">
          <button className="card-pile-btn" onClick={() => isMyTurn && onShowDeck()} title="View deck" disabled={!isMyTurn}>
            <span className="card-pile-icon">🂠</span>
            <span className="card-pile-label">Deck</span>
            <span className="card-pile-count">{isMyTurn ? deckCount : '—'}</span>
          </button>
          <div className="card-hand-label">{isMyTurn ? `Your Hand — ${playerName}` : `${playerName}'s turn`}</div>
          <button className="card-pile-btn" onClick={onShowPlayed} title="View played cards">
            <span className="card-pile-icon">📋</span>
            <span className="card-pile-label">Played</span>
            <span className="card-pile-count">{playedCount}</span>
          </button>
          <button className="card-pile-btn" onClick={onShowGraveyard} title="View graveyard">
            <span className="card-pile-icon">⚰️</span>
            <span className="card-pile-label">Graveyard</span>
            <span className="card-pile-count">{graveyardCount}</span>
          </button>
        </div>

        <div className="card-hand-fan">
          {handDefs.length === 0 && (
            <div className="muted small" style={{ padding: '20px 0', textAlign: 'center' }}>No cards in hand. End turn to draw new cards.</div>
          )}
          {isMyTurn ? (
            handDefs.map((card, idx) => {
              const tColor = cardTypeColor(card.type);
              const rColor = cardRarityColor(card.rarity);
              const isAnimatingOut = animatingOut === idx;
              return (
                <div
                  key={`${idx}-${card.id}`}
                  className={`card-tile ${isAnimatingOut ? 'card-anim-out' : 'card-anim-in'}`}
                  style={{
                    '--card-color': tColor,
                    '--card-rarity': rColor,
                    '--card-rot': `${(idx - (handDefs.length - 1) / 2) * 4}deg`,
                    '--card-offset': `${Math.abs(idx - (handDefs.length - 1) / 2) * 6}px`,
                  } as React.CSSProperties}
                  onClick={() => onCardClick(idx)}
                >
                  <div className="card-tile-inner">
                    <div className="card-tile-top">
                      <span className="card-tile-icon">{card.icon}</span>
                      <EffectPill card={card} />
                    </div>
                    <div className="card-tile-name">{card.name}</div>
                    <div className="card-tile-type">{card.type === 'damage' ? `${cardDamage(card)} dmg` : card.type}</div>
                  </div>
                </div>
              );
            })
          ) : (
            handDefs.map((_, idx) => (
              <div
                key={`back-${idx}`}
                className="card-tile card-back"
                style={{
                  '--card-rot': `${(idx - (handDefs.length - 1) / 2) * 4}deg`,
                  '--card-offset': `${Math.abs(idx - (handDefs.length - 1) / 2) * 6}px`,
                } as React.CSSProperties}
              >
                <div className="card-tile-inner card-back-inner">
                  <span className="card-back-icon">🂠</span>
                </div>
              </div>
            ))
          )}
        </div>

        {usedDefs.length > 0 && (
          <div className="card-used-row">
            <span className="muted small" style={{ fontWeight: 600 }}>Used:</span>
            {usedDefs.map((card, idx) => (
              <div key={idx} className="card-used-tile" style={{ borderColor: cardRarityColor(card.rarity) }}>
                <span style={{ fontSize: 16 }}>{card.icon}</span>
                <span style={{ fontSize: 10, fontWeight: 800 }}>{card.name}</span>
              </div>
            ))}
          </div>
        )}

        {isMyTurn && (
          <div className="row" style={{ gap: 8, marginTop: 8 }}>
            <button className="btn block ghost" onClick={onUndo}>↶ Undo card</button>
            <button className="btn block primary" onClick={onEnterVisit}>{isBattle ? 'Attack!' : 'Enter visit'}</button>
          </div>
        )}
      </div>
    </div>
  );
}

export function CardPopup({
  card,
  popupClosing,
  canPlayMore,
  onClose,
  onPlay,
}: {
  card: CardDef;
  popupClosing: boolean;
  canPlayMore: boolean;
  onClose: () => void;
  onPlay: () => void;
}) {
  const effectMeta = card.effect ? getEffectMeta(card.effect) : null;
  return (
    <div className="card-popup-overlay card-popup-overlay-center" onClick={onClose}>
      <div
        className={`card-popup-card${popupClosing ? ' closing' : ''}`}
        onClick={e => e.stopPropagation()}
        style={{ '--card-color': cardTypeColor(card.type), '--card-rarity': cardRarityColor(card.rarity) } as React.CSSProperties}
      >
        <div className="card-popup-card-glow" />
        <div className="card-popup-card-header">
          <span className="card-popup-card-icon">{card.icon}</span>
          <span className="card-popup-card-name">{card.name}</span>
          <span className="card-popup-card-rarity" style={{ color: cardRarityColor(card.rarity) }}>{card.rarity}</span>
        </div>
        <div className="card-popup-card-body">
          <div className="card-popup-card-type" style={{ color: cardTypeColor(card.type) }}>
            {card.type === 'damage' ? `Damage — ${cardDamage(card)} points` : card.type === 'spell' ? 'Spell' : 'Utility'}
          </div>
          {effectMeta && (
            <div className="card-popup-card-effect">
              <span className="card-popup-card-effect-icon" style={{ color: effectMeta.color }}>{effectMeta.icon}</span>
              <span className="card-popup-card-effect-label">{effectMeta.label}</span>
            </div>
          )}
          <div className="card-popup-card-desc">{card.desc}</div>
          {card.class !== 'any' && <div className="card-popup-card-class">Class: {card.class}</div>}
        </div>
        <div className="card-popup-card-actions">
          <button className="btn block ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn block primary"
            disabled={!canPlayMore}
            onClick={onPlay}
          >
            {card.type === 'damage' ? 'Play' : 'Use'}
          </button>
        </div>
      </div>
    </div>
  );
}
