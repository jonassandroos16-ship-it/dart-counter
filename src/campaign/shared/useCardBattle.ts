import { useState, useEffect, useCallback } from 'react';
import type { CampaignBattleState } from '../types';
import type { CardDef, CardPlayState, PlayerCard } from '../../cards/types';
import {
  initCardPlayState, endTurn, MAX_PLAYS_PER_TURN, resolveCardDef, playCardFromHand,
  getPlayerCards,
} from '../../cards/deck';
import { startTurnWithExtraDraws } from '../../cards/turnLogic';
import { applyCardEffect } from '../../cards/cardEffects';
import { addDart, undoDart, resolvePlayerVisit } from '../engine/playerTurn';
import type { Settings } from '../../types';
import { Sound } from '../../sound';

export interface RunPlayerLike {
  id: string;
  cards?: PlayerCard[];
}

export interface UseCardBattleParams {
  battle: CampaignBattleState | null;
  cardMode: boolean;
  /** Players in the run — either CoopPlayer[] (campaign) or run.runPlayers (dartlite) */
  runPlayers: RunPlayerLike[];
  /** Original Player objects for deck lookup */
  players: { id: string; cards?: unknown }[];
  settings: Settings;
  onStateChange: (updater: (prev: CampaignBattleState | null) => CampaignBattleState | null) => void;
}

export interface CardBattleApi {
  cardStates: Record<string, CardPlayState>;
  setCardStates: React.Dispatch<React.SetStateAction<Record<string, CardPlayState>>>;
  bonusSlots: number;
  setBonusSlots: React.Dispatch<React.SetStateAction<number>>;
  nextTurnDraws: Record<string, number>;
  setNextTurnDraws: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  nextTurnSlots: Record<string, number>;
  setNextTurnSlots: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  maxDartsPerVisit: number;
  totalCardsPlayed: number;
  /** Play a card from the hand by index */
  playCard: (handIdx: number) => void;
  /** Undo last action (card or dart) */
  onUndo: () => void;
  /** End the visit / resolve player turn */
  onEnter: () => void;
  /** Add a dart (non-card mode or damage card) */
  onAdd: (base: number, m: number, labelOverride?: string, isBull?: boolean) => void;
}

export function useCardBattle(params: UseCardBattleParams): CardBattleApi {
  const { battle, cardMode, runPlayers, players, settings, onStateChange } = params;

  const [cardStates, setCardStates] = useState<Record<string, CardPlayState>>(() => {
    if (!cardMode || !battle) return {};
    const cs: Record<string, CardPlayState> = {};
    for (const rp of runPlayers) {
      const playerData = players.find(p => p.id === rp.id);
      const collection: PlayerCard[] = rp.cards?.length ? rp.cards : (playerData ? getPlayerCards(playerData as any) : []);
      cs[rp.id] = initCardPlayState(collection);
    }
    return cs;
  });
  const [bonusSlots, setBonusSlots] = useState(0);
  const [nextTurnDraws, setNextTurnDraws] = useState<Record<string, number>>({});
  const [nextTurnSlots, setNextTurnSlots] = useState<Record<string, number>>({});

  // Re-init card states when battle changes
  useEffect(() => {
    if (!cardMode || !battle) return;
    const cs: Record<string, CardPlayState> = {};
    for (const rp of runPlayers) {
      const playerData = players.find(p => p.id === rp.id);
      const collection: PlayerCard[] = rp.cards?.length ? rp.cards : (playerData ? getPlayerCards(playerData as any) : []);
      cs[rp.id] = initCardPlayState(collection);
    }
    setCardStates(cs);
    setBonusSlots(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battle, cardMode]);

  // Auto-draw at start of each player's turn
  useEffect(() => {
    if (!cardMode || !battle || battle.phase !== 'player') return;
    const thrower = battle.players[battle.playerTurnIdx];
    if (!thrower) return;
    const cs = cardStates[thrower.id];
    if (!cs) return;
    if (cs.hand.length === 0 && cs.used.length === 0) {
      const extraDraw = nextTurnDraws[thrower.id] ?? 0;
      const extraSlot = nextTurnSlots[thrower.id] ?? 0;
      const next = startTurnWithExtraDraws(cs, extraDraw, extraSlot, (n) => setBonusSlots(b => b + n));
      setCardStates(prev => ({ ...prev, [thrower.id]: next }));
      setNextTurnDraws(prev => { const c = { ...prev }; delete c[thrower.id]; return c; });
      setNextTurnSlots(prev => { const c = { ...prev }; delete c[thrower.id]; return c; });
    }
  }, [battle?.phase, battle?.playerTurnIdx, cardMode, cardStates, battle, nextTurnDraws, nextTurnSlots]);

  const maxDartsPerVisit = cardMode ? MAX_PLAYS_PER_TURN + bonusSlots : 3;
  const thrower = battle?.players[battle.playerTurnIdx];
  const totalCardsPlayed = cardMode && thrower ? (cardStates[thrower.id]?.used.length ?? 0) : 0;

  const onAdd = useCallback((base: number, m: number, labelOverride?: string, isBull?: boolean) => {
    onStateChange(prev => prev ? addDart(prev, base, m, labelOverride, isBull, settings, maxDartsPerVisit) : prev);
    Sound.play('dart', { score: base * m }, settings);
    if (base > 0) Sound.play('impact', {}, settings);
  }, [onStateChange, settings, maxDartsPerVisit]);

  const playCard = useCallback((handIdx: number) => {
    if (!battle || !cardMode) return;
    const thrower = battle.players[battle.playerTurnIdx];
    if (!thrower) return;
    const cs = cardStates[thrower.id];
    if (!cs) return;
    const handDefs = cs.hand.map(pc => resolveCardDef(pc)).filter(Boolean) as CardDef[];
    const card = handDefs[handIdx];
    if (!card) return;
    const maxPlays = MAX_PLAYS_PER_TURN + bonusSlots;
    if (cs.used.length >= maxPlays) return;

    if (card.type !== 'damage') {
      const updated = applyCardEffect({
        card, handIdx, state: cs, battleState: battle, throwerId: thrower.id,
        bonusSlots, setBonusSlots, setNextTurnSlots, setNextTurnDraws,
        setBattleState: onStateChange as any,
      });
      Sound.play('powerup', {}, settings);
      setCardStates(prev => ({ ...prev, [thrower.id]: updated }));
      return;
    }

    if (totalCardsPlayed >= maxDartsPerVisit) return;
    const updated = playCardFromHand(cs, handIdx);
    if (!updated) return;
    const base = card.base ?? 0;
    const cardMult = card.mult ?? 1;
    const isBull = base === 50;
    setCardStates(prev => ({ ...prev, [thrower.id]: updated }));
    onAdd(base, isBull ? 2 : (base === 25 && cardMult === 2 ? 2 : cardMult), card.name, isBull);
  }, [battle, cardMode, cardStates, bonusSlots, totalCardsPlayed, maxDartsPerVisit, onStateChange, settings, onAdd]);

  const onUndo = useCallback(() => {
    if (!battle) return;
    if (cardMode) {
      const thrower = battle.players[battle.playerTurnIdx];
      if (thrower) {
        const cs = cardStates[thrower.id];
        if (cs && cs.used.length > 0) {
          const lastUsed = cs.used[cs.used.length - 1];
          const lastDef = resolveCardDef(lastUsed);
          // Non-damage card undo: return it to hand
          if (lastDef && lastDef.type !== 'damage') {
            const updated: CardPlayState = {
              deck: cs.deck,
              hand: [...cs.hand, lastUsed],
              used: cs.used.slice(0, -1),
              graveyard: cs.graveyard,
            };
            setCardStates(prev => ({ ...prev, [thrower.id]: updated }));
            return;
          }
          // Damage card undo: match the last dart to a used card
          if (battle.darts.length > 0) {
            const lastDart = battle.darts[battle.darts.length - 1];
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
              setCardStates(prev => ({ ...prev, [thrower.id]: updated }));
            }
          }
        }
      }
    }
    onStateChange(prev => prev ? undoDart(prev, settings) : prev);
  }, [battle, cardMode, cardStates, onStateChange, settings]);

  const onEnter = useCallback(() => {
    if (!battle) return;
    if (cardMode) {
      const thrower = battle.players[battle.playerTurnIdx];
      if (!thrower) return;
      const cs = cardStates[thrower.id];
      if (!cs || cs.used.length === 0) return;
      const endedState = endTurn(cs);
      setCardStates(prev => ({ ...prev, [thrower.id]: endedState }));
      setBonusSlots(0);
      onStateChange(prev => prev ? resolvePlayerVisit(prev, true) : prev);
      return;
    }
    if (!battle.darts.length) return;
    onStateChange(prev => prev ? resolvePlayerVisit(prev) : prev);
  }, [battle, cardMode, cardStates, onStateChange]);

  return {
    cardStates, setCardStates,
    bonusSlots, setBonusSlots,
    nextTurnDraws, setNextTurnDraws,
    nextTurnSlots, setNextTurnSlots,
    maxDartsPerVisit,
    totalCardsPlayed,
    playCard,
    onUndo,
    onEnter,
    onAdd,
  };
}
