import { useState, useEffect, useRef } from 'react';
import type { Player } from '../types';
import type { CampaignBattleState } from './types';
import type { PlayerCard, CardDef, CardPlayState } from '../cards/types';
import { cardDamage, cardRarityColor, cardTypeColor } from '../cards/definitions';
import {
  initCardPlayState,
  playCardFromHand, endTurn, MAX_PLAYS_PER_TURN, resolveCardDef,
  getPlayerCards, redrawHand, recycleGraveyard,
} from '../cards/deck';
import { DeckPopup, GraveyardPopup } from '../play/boards/CardBoardPopups';

export function CoopCardHand({
  thrower,
  players,
  state,
  cardState,
  setCardState,
  bonusSlots,
  setBonusSlots,
  onPlayCard,
  onPlayUtility,
  onEndVisit,
}: {
  thrower: Player | undefined;
  players: Player[];
  state: CampaignBattleState;
  cardState: CardPlayState | null;
  setCardState: (updater: (prev: CardPlayState) => CardPlayState) => void;
  bonusSlots: number;
  setBonusSlots: (updater: (prev: number) => number) => void;
  onPlayCard: (base: number, mult: number, label: string, isBull: boolean) => void;
  onPlayUtility: (card: CardDef) => void;
  onEndVisit: () => void;
}) {
  const playerData = players.find(p => p.id === thrower?.id);
  const collection: PlayerCard[] = playerData ? getPlayerCards(playerData) : [];
  const cs: CardPlayState = cardState ?? initCardPlayState(collection);

  const handDefs = cs.hand.map(pc => resolveCardDef(pc)).filter(Boolean) as CardDef[];
  const usedDefs = cs.used.map(pc => resolveCardDef(pc)).filter(Boolean) as CardDef[];
  const maxPlays = MAX_PLAYS_PER_TURN + bonusSlots;
  const totalCardsPlayed = cs.used.length;
  const canPlayMore = totalCardsPlayed < maxPlays;
  const [selectedCardIdx, setSelectedCardIdx] = useState<number | null>(null);
  const [popupClosing, setPopupClosing] = useState(false);
  const [showDeck, setShowDeck] = useState(false);
  const [showGraveyard, setShowGraveyard] = useState(false);
  const [animatingOut, setAnimatingOut] = useState<number | null>(null);
  const prevHandRef = useRef<number | null>(null);

  useEffect(() => {
    if (prevHandRef.current !== null && cs.hand.length < prevHandRef.current + 1) {
      setAnimatingOut(prevHandRef.current);
      const t = setTimeout(() => setAnimatingOut(null), 300);
      prevHandRef.current = null;
      return () => clearTimeout(t);
    }
  }, [cs.hand.length]);

  const closeCardPopup = () => {
    if (popupClosing) return;
    setPopupClosing(true);
    setTimeout(() => {
      setSelectedCardIdx(null);
      setPopupClosing(false);
    }, 200);
  };

  const playCard = (handIdx: number) => {
    const card = handDefs[handIdx];
    if (!card) return;
    if (totalCardsPlayed >= maxPlays) return;

    if (card.type !== 'damage') {
      let updated = playCardFromHand(cs, handIdx);
      if (!updated) return;
      if (card.effect === 'redraw') {
        updated = redrawHand(updated);
      } else if (card.effect === 'recycle') {
        updated = recycleGraveyard(updated);
      } else if (card.effect === 'extra_dart') {
        setBonusSlots(b => b + 1);
      }
      onPlayUtility(card);
      setSelectedCardIdx(null);
      setCardState(() => updated);
      return;
    }

    const updated = playCardFromHand(cs, handIdx);
    if (!updated) return;
    prevHandRef.current = handIdx;
    setSelectedCardIdx(null);
    setCardState(() => updated);
    const base = card.base ?? 0;
    const cardMult = card.mult ?? 1;
    const isBull = base === 50;
    onPlayCard(base, isBull ? 2 : (base === 25 && cardMult === 2 ? 2 : cardMult), card.name, isBull);
  };

  const undoCard = () => {
    if (cs.used.length === 0) return;
    const lastUsed = cs.used[cs.used.length - 1];
    const lastDef = resolveCardDef(lastUsed);
    if (lastDef && lastDef.type !== 'damage') {
      const updated: CardPlayState = {
        deck: cs.deck,
        hand: [...cs.hand, lastUsed],
        used: cs.used.slice(0, -1),
        graveyard: cs.graveyard,
      };
      setCardState(() => updated);
      return;
    }
    if (state.darts.length > 0) {
      const lastDart = state.darts[state.darts.length - 1];
      const usedIdx = [...cs.used].reverse().findIndex(pc => {
        const def = resolveCardDef(pc);
        return def?.name === lastDart.label;
      });
      if (usedIdx !== -1) {
        const realIdx = cs.used.length - 1 - usedIdx;
        const card = cs.used[realIdx];
        const updated: CardPlayState = {
          deck: cs.deck,
          hand: [...cs.hand, card],
          used: cs.used.filter((_, i) => i !== realIdx),
          graveyard: cs.graveyard,
        };
        setCardState(() => updated);
      }
    }
  };

  const endVisit = () => {
    if (cs.used.length === 0) return;
    const ended = endTurn(cs);
    setCardState(() => ended);
    onEndVisit();
  };

  const selectedCard = selectedCardIdx !== null ? handDefs[selectedCardIdx] : null;

  return (
    <div className="play-input">
      <div className="pad-card card-board-pad">
        <div className="card-pile-row">
          <button className="card-pile-btn" onClick={() => setShowDeck(true)} title="View deck">
            <span className="card-pile-icon">🂠</span>
            <span className="card-pile-label">Deck</span>
            <span className="card-pile-count">{cs.deck.length}</span>
          </button>
          <div className="card-hand-label">Your Hand — {playerData?.name || 'Player'}</div>
          <button className="card-pile-btn" onClick={() => setShowGraveyard(true)} title="View graveyard">
            <span className="card-pile-icon">⚰️</span>
            <span className="card-pile-label">Graveyard</span>
            <span className="card-pile-count">{cs.graveyard.length}</span>
          </button>
        </div>

        <div className="card-hand-fan">
          {handDefs.length === 0 && (
            <div className="muted small" style={{ padding: '20px 0', textAlign: 'center' }}>No cards in hand. End turn to draw new cards.</div>
          )}
          {handDefs.map((card, idx) => {
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
                  </div>
                  <div className="card-tile-name">{card.name}</div>
                  <div className="card-tile-type">{card.type === 'damage' ? `${cardDamage(card)} dmg` : card.type}</div>
                </div>
              </div>
            );
          })}
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

        <div className="row" style={{ gap: 8, marginTop: 8 }}>
          <button className="btn block ghost" onClick={undoCard} disabled={cs.used.length === 0 && state.darts.length === 0}>↶ Undo card</button>
          <button className="btn block primary" onClick={endVisit} disabled={cs.used.length === 0}>End visit</button>
        </div>
      </div>

      {selectedCard && (
        <div className="card-popup-overlay" onClick={closeCardPopup}>
          <div className={`card-popup${popupClosing ? ' closing' : ''}`} onClick={e => e.stopPropagation()} style={{ '--card-color': cardTypeColor(selectedCard.type), '--card-rarity': cardRarityColor(selectedCard.rarity) } as React.CSSProperties}>
            <div className="card-popup-header">
              <span className="card-popup-icon">{selectedCard.icon}</span>
              <span className="card-popup-name">{selectedCard.name}</span>
              <span className="card-popup-rarity" style={{ color: cardRarityColor(selectedCard.rarity) }}>{selectedCard.rarity}</span>
            </div>
            <div className="card-popup-body">
              <div className="card-popup-type" style={{ color: cardTypeColor(selectedCard.type) }}>
                {selectedCard.type === 'damage' ? `Damage — ${cardDamage(selectedCard)} points` : selectedCard.type === 'spell' ? 'Spell' : 'Utility'}
              </div>
              <div className="card-popup-desc">{selectedCard.desc}</div>
              {selectedCard.class !== 'any' && <div className="card-popup-class">Class: {selectedCard.class}</div>}
            </div>
            <div className="card-popup-actions">
              <button className="btn block ghost" onClick={closeCardPopup}>Cancel</button>
              <button
                className="btn block primary"
                disabled={selectedCard.type === 'damage' && !canPlayMore}
                onClick={() => playCard(selectedCardIdx!)}
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
