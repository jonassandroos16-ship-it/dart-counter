import { useState, useEffect, useCallback } from 'react';
import type { CampaignBattleState } from '../types';
import type { CardPlayState, PlayerCard } from '../../cards/types';
import {
  initCardPlayState, endTurn, MAX_PLAYS_PER_TURN, resolveCardDef,
  getPlayerCards, playCardFromHand,
} from '../../cards/deck';
import { startTurnWithExtraDraws } from '../../cards/turnLogic';
import { applyCardEffect } from '../../cards/cardEffects';
import { addDart, undoDart, resolvePlayerVisit } from '../engine/playerTurn';
import type { Player, Settings } from '../../types';
import { Sound } from '../../sound';

export interface UseCardBattleArgs {
  throwerId: string | null;
  battle: CampaignBattleState | null;
  players: Player[];
  settings: Settings;
  onStateChange: React.Dispatch<React.SetStateAction<CampaignBattleState | null>>;
  maxDartsPerVisit?: number;
}

export function useCardBattle({
  throwerId,
  battle,
  players,
  settings,
  onStateChange,
  maxDartsPerVisit = 3,
}: UseCardBattleArgs) {
  const [cardStates, setCardStates] = useState<Record<string, CardPlayState>>({});
  const [bonusSlots, setBonusSlots] = useState(0);
  const [nextTurnSlots, setNextTurnSlots] = useState<Record<string, number>>({});
  const [nextTurnDraws, setNextTurnDraws] = useState<Record<string, number>>({});
  const [playedCardDefs, setPlayedCardDefs] = useState<Record<string, CardDef[]>>({});

  // Initialize card play state for each player when a battle starts.
  useEffect(() => {
    if (!battle) return;
    const states: Record<string, CardPlayState> = {};
    for (const p of battle.players) {
      const srcPlayer = players.find(sp => sp.id === p.id);
      const cards = srcPlayer ? getPlayerCards(srcPlayer) : [];
      states[p.id] = initCardPlayState(cards);
    }
    setCardStates(states);
    setBonusSlots(0);
    setNextTurnSlots({});
    setNextTurnDraws({});
    setPlayedCardDefs({});
  }, [battle?.levelId]); // eslint-disable-line react-hooks/exhaustive-deps

  const throwerCardState = throwerId ? cardStates[throwerId] : undefined;

  const playCard = useCallback((handIdx: number) => {
    if (!throwerId || !battle) return;
    const cs = cardStates[throwerId];
    if (!cs) return;
    const def = resolveCardDef(cs.hand[handIdx]);
    if (!def) return;

    if (def.type === 'damage') {
      const base = def.base ?? 0;
      const cardMult = def.mult ?? 1;
      const isBull = base === 50;
      const maxPlays = MAX_PLAYS_PER_TURN + bonusSlots;
      if (cs.used.length >= maxPlays) return;
      const updated = playCardFromHand(cs, handIdx);
      if (!updated) return;
      setCardStates(prev => ({ ...prev, [throwerId]: updated }));
      onStateChange(prev => prev
        ? addDart(prev, base, isBull ? 2 : cardMult, def.name, isBull, settings, maxDartsPerVisit)
        : prev);
      Sound.play('card', {}, settings);
      return;
    }

    const updated = applyCardEffect({
      card: def,
      handIdx,
      state: cs,
      battleState: battle,
      throwerId,
      bonusSlots,
      setBonusSlots,
      setNextTurnSlots,
      setNextTurnDraws,
      setBattleState: onStateChange,
    });
    setCardStates(prev => ({ ...prev, [throwerId]: updated }));
    Sound.play('card', {}, settings);
  }, [throwerId, battle, cardStates, bonusSlots, onStateChange, settings, maxDartsPerVisit]);

  const undoCard = useCallback(() => {
    if (!throwerId || !battle) return;
    const cs = cardStates[throwerId];
    if (!cs || cs.used.length === 0) return;
    // Move last used card back to hand
    const lastUsed = cs.used[cs.used.length - 1];
    const restored: CardPlayState = {
      ...cs,
      hand: [...cs.hand, lastUsed],
      used: cs.used.slice(0, -1),
    };
    setCardStates(prev => ({ ...prev, [throwerId]: restored }));
    // Also undo the last dart if one exists
    onStateChange(prev => prev ? undoDart(prev, settings) : prev);
  }, [throwerId, battle, cardStates, onStateChange, settings]);

  const endVisit = useCallback(() => {
    if (!throwerId || !battle) return;
    const cs = cardStates[throwerId];
    if (!cs) return;
    const hasPlayedCards = cs.used.length > 0;
    onStateChange(prev => prev ? resolvePlayerVisit(prev, hasPlayedCards) : prev);
    // Start next turn for this player: clear used, draw new hand
    const next = endTurn(cs);
    // Apply extra draws/slots for next turn
    const extraDraw = nextTurnDraws[throwerId] ?? 0;
    const extraSlot = nextTurnSlots[throwerId] ?? 0;
    const finalCs = startTurnWithExtraDraws(next, extraDraw, extraSlot, (n) => setBonusSlots(b => b + n));
    setCardStates(prev => ({ ...prev, [throwerId]: finalCs }));
    // Clear the extra draws/slots for this player
    setNextTurnDraws(prev => { const n = { ...prev }; delete n[throwerId]; return n; });
    setNextTurnSlots(prev => { const n = { ...prev }; delete n[throwerId]; return n; });
  }, [throwerId, battle, cardStates, onStateChange, nextTurnDraws, nextTurnSlots]);

  return {
    cardStates,
    playCard,
    undoCard,
    endVisit,
    bonusSlots,
    throwerCardState,
  };
}
