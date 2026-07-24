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
  bonusSlots: (CardDef | null)[];
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
  const [bonusSlots, setBonusSlots] = useState<(CardDef | null)[]>([]);

  const thrower = battle?.players?.[battle.playerTurnIdx];
  const throwerId = thrower?.id;

  const maxDartsPerVisit = cardMode ? MAX_PLAYS_PER_TURN : 3;

  // Initialize card play state for each player at battle start / round transitions
  useEffect(() => {
    if (!cardMode || !battle) return;
    const next: Record<string, CardPlayState> = {};
    for (const rp of runPlayers) {
      const deck = getPlayerCards(rp.id, players);
      next[rp.id] = initCardPlayState(deck);
    }
    setCardStates(next);
    setBonusSlots([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardMode, battle?.visitNumber, battle?.round]);

  // Start of each player's turn: draw cards
  useEffect(() => {
    if (!cardMode || !battle || !throwerId) return;
    const cs = cardStates[throwerId];
    if (!cs) return;
    if (cs.turnStarted) return;
    const defIds = cs.deck.map(c => c.defId);
    const updated = startTurnWithExtraDraws(cs, defIds, 0);
    setCardStates(prev => ({ ...prev, [throwerId]: updated }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardMode, throwerId, battle?.playerTurnIdx]);

  const totalCardsPlayed = throwerId ? (cardStates[throwerId]?.used.length ?? 0) : 0;

  const playCard = useCallback((handIdx: number) => {
    if (!throwerId) return;
    const cs = cardStates[throwerId];
    if (!cs) return;
    const result = playCardFromHand(cs, handIdx);
    if (!result) return;
    const { state: newCs, card: playedCard } = result;
    setCardStates(prev => ({ ...prev, [throwerId]: newCs }));
    const def = resolveCardDef(playedCard);
    if (def) {
      setBonusSlots(prev => [...prev, def]);
      onStateChange(prev => prev ? applyCardEffect(prev, def, throwerId, settings) : prev);
      Sound.play('card', {}, settings);
    }
  }, [throwerId, cardStates, onStateChange, settings]);

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
        setBonusSlots(prev => prev.slice(0, -1));
        return;
      }
    }
    onStateChange(prev => prev ? undoDart(prev, settings) : prev);
  }, [battle, cardMode, cardStates, onStateChange, settings]);

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
