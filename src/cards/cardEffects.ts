import type { CampaignBattleState } from '../campaign/types';
import type { CardDef, CardPlayState } from './types';
import {
  playCardFromHand, redrawHand, recycleGraveyard,
} from './deck';

export interface CardEffectParams {
  card: CardDef;
  handIdx: number;
  state: CardPlayState;
  battleState: CampaignBattleState;
  throwerId: string;
  bonusSlots: number;
  setBonusSlots: (fn: (b: number) => number) => void;
  setNextTurnSlots: (fn: (prev: Record<string, number>) => Record<string, number>) => void;
  setNextTurnDraws: (fn: (prev: Record<string, number>) => Record<string, number>) => void;
  setBattleState: (fn: (prev: CampaignBattleState | null) => CampaignBattleState | null) => void;
}

export function applyCardEffect(params: CardEffectParams): CardPlayState {
  const { card, handIdx, state, throwerId, setBonusSlots, setNextTurnSlots, setNextTurnDraws, setBattleState } = params;
  const mag = card.magnitude ?? 0;
  const effect = card.effect ?? '';

  let updated = playCardFromHand(state, handIdx);
  if (!updated) return state;

  if (effect === 'redraw') {
    updated = redrawHand(updated);
  } else if (effect === 'recycle') {
    updated = recycleGraveyard(updated);
  } else if (effect === 'extra_dart') {
    setBonusSlots(b => b + 1);
  } else if (effect === 'extra_slot') {
    setNextTurnSlots(prev => ({ ...prev, [throwerId]: (prev[throwerId] ?? 0) + mag }));
  } else if (effect === 'draw') {
    setNextTurnDraws(prev => ({ ...prev, [throwerId]: (prev[throwerId] ?? 0) + mag }));
  } else if (effect === 'shadowstep') {
    setNextTurnDraws(prev => ({ ...prev, [throwerId]: (prev[throwerId] ?? 0) + mag }));
    if (updated.used.length > 0) {
      const swapBack = updated.used[updated.used.length - 1];
      updated = {
        ...updated,
        hand: [...updated.hand, swapBack],
        used: updated.used.slice(0, -1),
      };
    }
  } else if (effect === 'heal' || effect === 'blessing') {
    const heal = effect === 'blessing' ? Math.min(mag, 40) : mag;
    setBattleState(prev => prev ? { ...prev, partyHp: Math.min(prev.partyMaxHp, prev.partyHp + heal) } : prev);
    if (effect === 'blessing') {
      setNextTurnDraws(prev => ({ ...prev, [throwerId]: (prev[throwerId] ?? 0) + 1 }));
    }
  } else if (effect === 'heal_over_time') {
    const buffId = `regen_${Date.now()}`;
    setBattleState(prev => prev ? { ...prev, players: prev.players.map(p => ({ ...p, buffs: [...p.buffs, { id: buffId, kind: 'regen' as const, amount: mag, turnsLeft: 3, source: throwerId }] })) } : prev);
  } else if (effect === 'party_shield_flat' || effect === 'party_shield') {
    const buffId = `shield_${Date.now()}`;
    setBattleState(prev => prev ? { ...prev, players: prev.players.map(p => ({ ...p, buffs: [...p.buffs, { id: buffId, kind: 'shield' as const, amount: mag, turnsLeft: 2, source: throwerId }] })) } : prev);
  } else if (effect === 'enemy_debuff') {
    // Weaken: reduces enemy outgoing damage by mag% for 2 turns.
    const weakenFrac = mag / 100;
    setBattleState(prev => prev ? {
      ...prev,
      enemies: prev.enemies.map(e => e.defeated ? e : {
        ...e,
        weakenedTurns: Math.max(e.weakenedTurns, 2),
        weakenAmount: Math.max(e.weakenAmount, weakenFrac),
      }),
    } : prev);
  } else if (effect === 'enemy_curse' || effect === 'enemy_miss') {
    // Distract: reduces enemy accuracy/precision so they miss more.
    setBattleState(prev => prev ? { ...prev, enemies: prev.enemies.map(e => e.defeated ? e : { ...e, distractedTurns: Math.max(e.distractedTurns, 3), distractAmount: Math.max(e.distractAmount, mag / 100) }) } : prev);
  } else if (effect === 'crit_buff') {
    const buffId = `crit_${Date.now()}`;
    setBattleState(prev => prev ? { ...prev, players: prev.players.map(p => ({ ...p, buffs: [...p.buffs, { id: buffId, kind: 'crit' as const, amount: mag, turnsLeft: 3, source: throwerId }] })) } : prev);
  } else if (effect === 'crit_guarantee') {
    const buffId = `critguar_${Date.now()}`;
    setBattleState(prev => prev ? { ...prev, players: prev.players.map(p => ({ ...p, buffs: [...p.buffs, { id: buffId, kind: 'crit_guarantee' as const, amount: mag, turnsLeft: 3, source: throwerId }] })) } : prev);
  } else if (effect === 'crit_multiplier') {
    const buffId = `critmult_${Date.now()}`;
    setBattleState(prev => prev ? { ...prev, players: prev.players.map(p => ({ ...p, buffs: [...p.buffs, { id: buffId, kind: 'crit_multiplier' as const, amount: mag, turnsLeft: 3, source: throwerId }] })) } : prev);
  } else if (effect === 'bleed') {
    const buffId = `bleed_${Date.now()}`;
    setBattleState(prev => prev ? { ...prev, enemies: prev.enemies.map(e => e.defeated ? e : { ...e, buffs: [...(e as any).buffs, { id: buffId, kind: 'bleed', amount: mag, turnsLeft: 3 }] }) } : prev);
  } else if (effect === 'freeze') {
    setBattleState(prev => prev ? { ...prev, enemies: prev.enemies.map(e => e.defeated ? e : { ...e, frozenTurns: Math.max(e.frozenTurns, 1) }) } : prev);
  } else if (effect === 'power_buff') {
    const buffId = `power_${Date.now()}`;
    setBattleState(prev => prev ? { ...prev, players: prev.players.map(p => ({ ...p, buffs: [...p.buffs, { id: buffId, kind: 'power' as const, amount: mag, turnsLeft: 3, source: throwerId }] })) } : prev);
  } else if (effect === 'armor_buff') {
    const buffId = `armor_${Date.now()}`;
    setBattleState(prev => prev ? { ...prev, players: prev.players.map(p => ({ ...p, buffs: [...p.buffs, { id: buffId, kind: 'armor' as const, amount: mag, turnsLeft: 3, source: throwerId }] })) } : prev);
  } else if (effect === 'surge' || effect === 'hot_streak' || effect === 'bust_protect' || effect === 'double_up' || effect === 'reflect') {
    const buffId = `${effect}_${Date.now()}`;
    setBattleState(prev => prev ? { ...prev, players: prev.players.map(p => ({ ...p, buffs: [...p.buffs, { id: buffId, kind: effect as any, amount: mag, turnsLeft: 2, source: throwerId }] })) } : prev);
  } else if (effect === 'revive') {
    setBattleState(prev => prev ? { ...prev, partyHp: Math.max(prev.partyHp, Math.round(prev.partyMaxHp * 0.25)) } : prev);
  }

  return updated;
}
