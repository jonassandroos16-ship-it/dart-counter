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
  canUndo: boolean;
  canPlayMore: boolean;
  onPlayCard: (handIdx: number) => void;
  onUndo: () => void;
  onEndVisit: () => void;
  showPlayedButton?: boolean;
  playedCount?: number;
  onShowPlayed?: () => void;
  visitNumber?: number;
  extraPower?: number;
}

export function CardHand({
  cardState: cs,
  playerName,
  isMyTurn,
  isBattle,
  canUndo,
  canPlayMore,
  onPlayCard,
  onUndo,
  onEndVisit,
  showPlayedButton = false,
  playedCount = 0,
  onShowPlayed,
  visitNumber,
  extraPower = 0,
}: CardHandProps) {
  const handEntries = cs.hand
    .map((pc, idx) => ({ def: resolveCardDef(pc), handIdx: idx }))
    .filter((e): e is { def: CardDef; handIdx: number } => e.def !== undefined);
  const handDefs = handEntries.map(e => e.def);

  const [selectedCardIdx, setSelectedCardIdx] = useState<number | null>(null);
  const [popupClosing, setPopupClosing] = useState(false);
  const [showDeck, setShowDeck] = useState(false);
  const [showGraveyard, setShowGraveyard] = useState(false);
  const [animatingOut, setAnimatingOut] = useState<number | null>(null);
  const prevHandLen = useRef<number>(handDefs.length);
  const prevVisitRef = useRef<number | undefined>(visitNumber);

  useEffect(() => {
    if (visitNumber !== prevVisitRef.current) {
      prevVisitRef.current = visitNumber;
      prevHandLen.current = handDefs.length;
      setAnimatingOut(null);
      return;
    }
    if (handDefs.length < prevHandLen.current) {
      const removedIdx = prevHandLen.current - handDefs.length;
      setAnimatingOut(removedIdx);
      const t = setTimeout(() => setAnimatingOut(null), 300);
      return () => clearTimeout(t);
    }
    prevHandLen.current = handDefs.length;
  }, [handDefs.length, visitNumber]);

  const selectedCard = selectedCardIdx !== null ? handDefs[selectedCardIdx] : null;

  const closePopup = () => {
    setPopupClosing(true);
    setTimeout(() => {
      setPopupClosing(false);
      setSelectedCardIdx(null);
    }, 200);
  };

  const handlePlay = () => {
    if (selectedCardIdx === null) return;
    onPlayCard(handEntries[selectedCardIdx].handIdx);
    setSelectedCardIdx(null);
  };

  const powerLabel = (card: CardDef) => {
    const base = cardDamage(card);
    return extraPower > 0 ? `${base + extraPower} (${base}+${extraPower})` : `${base}`;
  };

  return (
    <div className="card-hand">
      <div className="card-hand-header">
        <span className="card-hand-label">YOUR HAND — {playerName.toUpperCase()}</span>
        <div className="row" style={{ gap: 6 }}>
          <button className="btn sm ghost" onClick={() => setShowDeck(true)}>Deck</button>
          <button className="btn sm ghost" onClick={() => setShowGraveyard(true)}>Graveyard</button>
        </div>
      </div>

      <div className="card-hand-fan">
        {handDefs.map((card, idx) => {
          const tColor = cardTypeColor(card.type);
          const rColor = cardRarityColor(card.rarity);
          const isAnimating = animatingOut === idx;
          return (
            <div
              key={`${idx}-${card.id}`}
              className={`card-tile${isAnimating ? ' card-anim-out' : ''}`}
              style={{
                '--card-color': tColor,
                '--card-rarity': rColor,
                '--card-rot': `${(idx - (handDefs.length - 1) / 2) * 4}deg`,
                '--card-offset': `${Math.abs(idx - (handDefs.length - 1) / 2) * 6}px`,
                zIndex: handDefs.length - idx,
              } as React.CSSProperties}
              onClick={() => setSelectedCardIdx(idx)}
            >
              <div className="card-tile-inner">
                <div className="card-tile-top">
                  <span className="card-tile-icon">{card.icon}</span>
                  <EffectPill card={card} />
                </div>
                <div className="card-tile-name">{card.name}</div>
                <div className="card-tile-type">{card.type === 'damage' ? `${powerLabel(card)} dmg` : card.type}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="card-hand-actions">
        {isBattle && (
          <button
            className="btn sm"
            onClick={onUndo}
            disabled={!canUndo}
            style={{ opacity: canUndo ? 1 : 0.4 }}
          >
            ↩ Undo
          </button>
        )}
        <button
          className="btn primary"
          onClick={onEndVisit}
          disabled={!canPlayMore && !isBattle}
          style={{ opacity: canPlayMore || isBattle ? 1 : 0.4 }}
        >
          End Visit
        </button>
        {showPlayedButton && (
          <button className="btn sm ghost" onClick={onShowPlayed}>
            Played ({playedCount})
          </button>
        )}
      </div>

      {selectedCard && !popupClosing && (
        <div className="card-popup-overlay card-popup-overlay-center" onClick={closePopup}>
          <div
            className="card-popup-card"
            onClick={(e) => e.stopPropagation()}
            style={{
              '--card-color': cardTypeColor(selectedCard.type),
              '--card-rarity': cardRarityColor(selectedCard.rarity),
            } as React.CSSProperties}
          >
            <div className="card-popup-card-glow" />
            <div className="card-popup-card-header">
              <span className="card-popup-card-icon">{selectedCard.icon}</span>
              <span className="card-popup-card-name">{selectedCard.name}</span>
              <span className="card-popup-card-rarity">{selectedCard.rarity}</span>
            </div>
            <div className="card-popup-card-body">
              <div className="card-popup-card-type">{selectedCard.type}</div>
              {selectedCard.effect && (
                <div className="card-popup-card-effect">
                  <span className="card-popup-card-effect-icon">{selectedCard.icon}</span>
                  <span className="card-popup-card-effect-label">{selectedCard.effect}</span>
                </div>
              )}
              <div className="card-popup-card-desc">{selectedCard.desc}</div>
              {selectedCard.class && (
                <div className="card-popup-card-class">{selectedCard.class}</div>
              )}
              {selectedCard.type === 'damage' && (
                <div className="card-popup-card-desc" style={{ marginTop: 8, fontWeight: 800 }}>
                  Power: {powerLabel(selectedCard)}
                </div>
              )}
            </div>
            <div className="card-popup-card-actions">
              <button className="btn ghost" onClick={closePopup}>Cancel</button>
              <button
                className="btn primary"
                onClick={handlePlay}
                disabled={!isMyTurn || !canPlayMore}
                style={{ opacity: isMyTurn && canPlayMore ? 1 : 0.5 }}
              >
                Play
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeck && (
        <DeckPopup
          deck={cs.deck}
          onClose={() => setShowDeck(false)}
        />
      )}
      {showGraveyard && (
        <GraveyardPopup
          graveyard={cs.graveyard}
          onClose={() => setShowGraveyard(false)}
        />
      )}
    </div>
  );
}
