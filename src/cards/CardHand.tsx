import { useState, useEffect, useRef } from 'react';
import type { CardDef, CardPlayState } from './types';
import { cardDamage, cardRarityColor, cardTypeColor } from './definitions';
import { resolveCardDef } from './deck';
import { DeckPopup, GraveyardPopup } from '../play/boards/CardBoardPopups';
import { EffectPill } from './EffectPill';

export interface CardHandProps {
  cardState: CardPlayState;
  playerName: string;
  isMyTurn: boolean;
  isBattle: boolean;
  canEndVisit: boolean;
  canUndo: boolean;
  canPlayMore: boolean;
  onPlayCard: (handIdx: number) => void;
  onUndo: () => void;
  onEndVisit: () => void;
  showPlayedButton?: boolean;
  playedCount?: number;
  onShowPlayed?: () => void;
}

export function CardHand({
  cardState: cs,
  playerName,
  isMyTurn,
  isBattle,
  canEndVisit,
  canUndo,
  canPlayMore,
  onPlayCard,
  onUndo,
  onEndVisit,
  showPlayedButton = false,
  playedCount = 0,
  onShowPlayed,
}: CardHandProps) {
  const handDefs = cs.hand.map(pc => resolveCardDef(pc)).filter(Boolean) as CardDef[];
  const usedDefs = cs.used.map(pc => resolveCardDef(pc)).filter(Boolean) as CardDef[];

  const [selectedCardIdx, setSelectedCardIdx] = useState<number | null>(null);
  const [popupClosing, setPopupClosing] = useState(false);
  const [showDeck, setShowDeck] = useState(false);
  const [showGraveyard, setShowGraveyard] = useState(false);
  const [animatingOut, setAnimatingOut] = useState<number | null>(null);
  const prevHandLen = useRef<number>(handDefs.length);

  useEffect(() => {
    if (handDefs.length < prevHandLen.current) {
      const removedIdx = prevHandLen.current - 1;
      setAnimatingOut(removedIdx);
      const t = setTimeout(() => setAnimatingOut(null), 300);
      prevHandLen.current = handDefs.length;
      return () => clearTimeout(t);
    }
    prevHandLen.current = handDefs.length;
  }, [handDefs.length]);

  const closeCardPopup = () => {
    if (popupClosing) return;
    setPopupClosing(true);
    setTimeout(() => {
      setSelectedCardIdx(null);
      setPopupClosing(false);
    }, 200);
  };

  const handlePlay = () => {
    if (selectedCardIdx === null) return;
    onPlayCard(selectedCardIdx);
    setSelectedCardIdx(null);
  };

  const selectedCard = selectedCardIdx !== null ? handDefs[selectedCardIdx] : null;

  return (
    <div className="play-input">
      <div className="pad-card card-board-pad">
        <div className="card-pile-row">
          <button className="card-pile-btn" onClick={() => setShowDeck(true)} title="View deck" disabled={!isMyTurn}>
            <span className="card-pile-icon">🂠</span>
            <span className="card-pile-label">Deck</span>
            <span className="card-pile-count">{isMyTurn ? cs.deck.length : '—'}</span>
          </button>
          <div className="card-hand-label">{isMyTurn ? `Your Hand — ${playerName}` : `${playerName}'s turn`}</div>
          {showPlayedButton && onShowPlayed && (
            <button className="card-pile-btn" onClick={onShowPlayed} title="View played cards">
              <span className="card-pile-icon">📋</span>
              <span className="card-pile-label">Played</span>
              <span className="card-pile-count">{playedCount}</span>
            </button>
          )}
          <button className="card-pile-btn" onClick={() => setShowGraveyard(true)} title="View graveyard" disabled={!isMyTurn}>
            <span className="card-pile-icon">⚰️</span>
            <span className="card-pile-label">Graveyard</span>
            <span className="card-pile-count">{isMyTurn ? cs.graveyard.length : '—'}</span>
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
                  onClick={() => setSelectedCardIdx(idx)}
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
            <button className="btn block ghost" onClick={onUndo} disabled={!canUndo}>↶ Undo card</button>
            <button className="btn block primary" onClick={onEndVisit} disabled={!canEndVisit}>{isBattle ? 'Attack!' : 'Enter visit'}</button>
          </div>
        )}
      </div>

      {selectedCard && (
        <div className="card-popup-overlay card-popup-overlay-center" onClick={closeCardPopup}>
          <div className={`card-popup-card${popupClosing ? ' closing' : ''}`} onClick={e => e.stopPropagation()} style={{ '--card-color': cardTypeColor(selectedCard.type), '--card-rarity': cardRarityColor(selectedCard.rarity) } as React.CSSProperties}>
            <div className="card-popup-card-glow" />
            <div className="card-popup-card-header">
              <span className="card-popup-card-icon">{selectedCard.icon}</span>
              <span className="card-popup-card-name">{selectedCard.name}</span>
              <span className="card-popup-card-rarity" style={{ color: cardRarityColor(selectedCard.rarity) }}>{selectedCard.rarity}</span>
            </div>
            <div className="card-popup-card-body">
              <div className="card-popup-card-type" style={{ color: cardTypeColor(selectedCard.type) }}>
                {selectedCard.type === 'damage' ? `Damage — ${cardDamage(selectedCard)} points` : selectedCard.type === 'spell' ? 'Spell' : 'Utility'}
              </div>
              <div className="card-popup-card-desc">{selectedCard.desc}</div>
              {selectedCard.class !== 'any' && <div className="card-popup-card-class">Class: {selectedCard.class}</div>}
            </div>
            <div className="card-popup-card-actions">
              <button className="btn block ghost" onClick={closeCardPopup}>Cancel</button>
              <button
                className="btn block primary"
                disabled={selectedCard.type === 'damage' && !canPlayMore}
                onClick={handlePlay}
              >
                {selectedCard.type === 'damage' ? 'Play' : 'Use'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeck && (
        <DeckPopup deck={cs.deck} onClose={() => setShowDeck(false)} />
      )}

      {showGraveyard && (
        <GraveyardPopup graveyard={cs.graveyard} onClose={() => setShowGraveyard(false)} />
      )}
    </div>
  );
}
