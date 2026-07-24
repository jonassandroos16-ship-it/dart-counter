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
  bonusSlots: number;
  maxDartsPerVisit: number;
  totalCardsPlayed: number;
  playCard: (handIdx: number) => void;
  onAdd: (base: number, m: number, labelOverride?: string, isBull?: boolean) => void;
  onUndo: () => void;
  onEnter: () => void;
}

export function useCardBattle(params: UseCardBattleParams): CardBattleApi {
  const { battle, cardMode, runPlayers, players, settings, onStateChange } = params;

  const [cardStates, setCardStates] = useState<Record<string, CardPlayState>>({});
  const [bonusSlots, setBonusSlots] = useState(0);
  const [nextTurnSlots, setNextTurnSlots] = useState<Record<string, number>>({});
  const [nextTurnDraws, setNextTurnDraws] = useState<Record<string, number>>({});

  const thrower = battle?.players?.[battle.playerTurnIdx];
  const throwerId = thrower?.id;

  const maxDartsPerVisit = cardMode ? MAX_PLAYS_PER_TURN + bonusSlots : 3;

  // Initialize card play state for each player at battle start / visit transitions
  useEffect(() => {
    if (!cardMode || !battle) return;
    const next: Record<string, CardPlayState> = {};
    for (const rp of runPlayers) {
      const player = players.find(p => p.id === rp.id) as Player | undefined;
      const deck = player ? getPlayerCards(player) : (rp.cards ?? []);
      next[rp.id] = initCardPlayState(deck);
    }
    setCardStates(next);
    setBonusSlots(0);
    setNextTurnSlots({});
    setNextTurnDraws({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardMode, battle?.visitNumber]);

  // Reset bonus slots at the start of each player's turn so they don't leak
  // from one player to the next within the same visit.
  useEffect(() => {
    if (!cardMode || !battle) return;
    setBonusSlots(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardMode, battle?.playerTurnIdx]);

  // Start of each player's turn: draw cards if none drawn yet this turn
  useEffect(() => {
    if (!cardMode || !battle || !throwerId) return;
    const cs = cardStates[throwerId];
    if (!cs) return;
    if (cs.hand.length > 0 || cs.used.length > 0) return;
    const extraDraw = nextTurnDraws[throwerId] ?? 0;
    const extraSlot = nextTurnSlots[throwerId] ?? 0;
    const updated = startTurnWithExtraDraws(cs, extraDraw, extraSlot, (n) => {
      setBonusSlots(b => b + n);
    });
    setCardStates(prev => ({ ...prev, [throwerId]: updated }));
    if (extraDraw > 0) setNextTurnDraws(prev => { const n = { ...prev }; delete n[throwerId]; return n; });
    if (extraSlot > 0) setNextTurnSlots(prev => { const n = { ...prev }; delete n[throwerId]; return n; });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardMode, throwerId, battle?.playerTurnIdx]);

  const totalCardsPlayed = throwerId ? (cardStates[throwerId]?.used.length ?? 0) : 0;

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

  const onAdd = useCallback((base: number, m: number, labelOverride?: string, isBull?: boolean) => {
    onStateChange(prev => prev ? addDart(prev, base, m, labelOverride, isBull, settings, maxDartsPerVisit) : prev);
  }, [onStateChange, settings, maxDartsPerVisit]);

  const onUndo = useCallback(() => {
    // Undo last card play if in card mode and no darts thrown yet
    if (cardMode && battle && throwerId) {
      const cs = cardStates[throwerId];
      if (cs && cs.used.length > 0 && battle.darts.length === 0) {
        const newCs = { ...cs, used: cs.used.slice(0, -1), hand: [...cs.hand, cs.used[cs.used.length - 1]] };
        setCardStates(prev => ({ ...prev, [throwerId]: newCs }));
        setBonusSlots(b => Math.max(0, b - 1));
        return;
      }
    }
    onStateChange(prev => prev ? undoDart(prev, settings) : prev);
  }, [battle, cardMode, cardStates, throwerId, onStateChange, settings]);

  const onEnter = useCallback(() => {
    if (cardMode && battle && throwerId) {
      const cs = cardStates[throwerId];
      if (cs) {
        const ended = endTurn(cs);
        setCardStates(prev => ({ ...prev, [throwerId]: ended }));
      }
    }
    onStateChange(prev => prev ? resolvePlayerVisit(prev, true) : prev);
  }, [battle, cardMode, cardStates, throwerId, onStateChange]);

  return {
    cardStates,
    bonusSlots,
    maxDartsPerVisit,
    totalCardsPlayed,
    playCard,
    onAdd,
    onUndo,
    onEnter,
  };
}
