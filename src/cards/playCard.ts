import type { CampaignBattleState } from '../campaign/types';
import type { CardDef, CardPlayState } from './types';
import { playCardFromHand, resolveCardDef, MAX_PLAYS_PER_TURN } from './deck';
import { applyCardEffect } from './cardEffects';
import { Sound } from '../sound';
import type { Settings } from '../types';

export interface PlayCardContext {
  cardStates: Record<string, CardPlayState>;
  setCardStates: React.Dispatch<React.SetStateAction<Record<string, CardPlayState>>>;
  battleState: CampaignBattleState;
  setBattleState: React.Dispatch<React.SetStateAction<CampaignBattleState | null>>;
  bonusSlots: number;
  setBonusSlots: React.Dispatch<React.SetStateAction<number>>;
  setNextTurnSlots: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  setNextTurnDraws: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  settings: Settings;
}

export interface PlayCardResult {
  updated: CardPlayState;
  isDamage: boolean;
  base: number;
  mult: number;
  label: string;
  isBull: boolean;
}

export function playCardShared(
  handIdx: number,
  throwerId: string,
  ctx: PlayCardContext,
): PlayCardResult | null {
  const cs = ctx.cardStates[throwerId];
  if (!cs) return null;
  const handDefs = cs.hand.map(pc => resolveCardDef(pc)).filter(Boolean) as CardDef[];
  const card = handDefs[handIdx];
  if (!card) return null;
  const maxPlays = MAX_PLAYS_PER_TURN + ctx.bonusSlots;
  if (cs.used.length >= maxPlays) return null;

  if (card.type !== 'damage') {
    const updated = applyCardEffect({
      card,
      handIdx,
      state: cs,
      battleState: ctx.battleState,
      throwerId,
      bonusSlots: ctx.bonusSlots,
      setBonusSlots: ctx.setBonusSlots,
      setNextTurnSlots: ctx.setNextTurnSlots,
      setNextTurnDraws: ctx.setNextTurnDraws,
      setBattleState: ctx.setBattleState as any,
    });
    Sound.play('powerup', {}, ctx.settings);
    ctx.setCardStates(prev => ({ ...prev, [throwerId]: updated }));
    return { updated, isDamage: false, base: 0, mult: 1, label: '', isBull: false };
  }

  const updated = playCardFromHand(cs, handIdx);
  if (!updated) return null;
  const base = card.base ?? 0;
  const cardMult = card.mult ?? 1;
  const isBull = base === 50;
  const label = card.name;
  ctx.setCardStates(prev => ({ ...prev, [throwerId]: updated }));
  return { updated, isDamage: true, base, mult: isBull ? 2 : (base === 25 && cardMult === 2 ? 2 : cardMult), label, isBull };
}
