import { describe, it, expect } from 'vitest';
import { applyCardEffect } from './cardEffects';
import { getCard } from './definitions';
import { initCardPlayState } from './deck';
import type { CampaignBattleState } from '../campaign/types';

function makeBattle(): CampaignBattleState {
  return {
    levelId: 'test',
    playerTurnIdx: 0,
    visitNumber: 0,
    partyHp: 100,
    partyMaxHp: 100,
    players: [{ id: 'p1', name: 'Hero', hp: 100, maxHp: 100, buffs: [] } as any],
    enemies: [],
    darts: [],
  } as unknown as CampaignBattleState;
}

// Build a state where the target card is guaranteed to be in the opening hand.
function stateWithCardInHand(cardId: string) {
  const filler = Array.from({ length: 8 }, () => ({ cardId: 'dmg_s20', upgradeLevel: 0, upgraded: false }));
  let s = initCardPlayState([{ cardId, upgradeLevel: 0, upgraded: false }, ...filler]);
  if (!s.hand.some(pc => pc.cardId === cardId)) {
    // Swap the target card from the deck into the hand.
    const fromDeck = s.deck.findIndex(pc => pc.cardId === cardId);
    if (fromDeck >= 0) {
      s = {
        ...s,
        hand: [...s.hand.slice(0, 1), s.deck[fromDeck]],
        deck: [...s.deck.slice(0, fromDeck), ...s.deck.slice(fromDeck + 1), s.hand[0]],
      };
    }
  }
  return s;
}

describe('applyCardEffect heal_over_time extra draws', () => {
  it('queues extra draws for Divine Favor', () => {
    const def = getCard('spell_priest_divine_favor')!;
    const state = stateWithCardInHand(def.id);
    const handIdx = state.hand.findIndex(pc => pc.cardId === def.id);
    expect(handIdx).toBeGreaterThanOrEqual(0);

    let nextTurnDraws: Record<string, number> = {};
    let battle = makeBattle();
    const updated = applyCardEffect({
      card: def,
      handIdx,
      state,
      battleState: battle,
      throwerId: 'p1',
      bonusSlots: 0,
      setBonusSlots: () => {},
      setNextTurnSlots: () => {},
      setNextTurnDraws: (fn) => { nextTurnDraws = fn(nextTurnDraws); },
      setBattleState: (fn) => { battle = fn(battle) as CampaignBattleState; },
    });

    expect(updated.hand.length).toBeLessThan(state.hand.length);
    expect(nextTurnDraws['p1']).toBe(2);
  });

  it('queues extra draws for Divine Feast and applies regen buff', () => {
    const def = getCard('spell_priest_feast')!;
    const state = stateWithCardInHand(def.id);
    const handIdx = state.hand.findIndex(pc => pc.cardId === def.id);
    expect(handIdx).toBeGreaterThanOrEqual(0);

    let nextTurnDraws: Record<string, number> = {};
    let battle = makeBattle();
    applyCardEffect({
      card: def,
      handIdx,
      state,
      battleState: battle,
      throwerId: 'p1',
      bonusSlots: 0,
      setBonusSlots: () => {},
      setNextTurnSlots: () => {},
      setNextTurnDraws: (fn) => { nextTurnDraws = fn(nextTurnDraws); },
      setBattleState: (fn) => { battle = fn(battle) as CampaignBattleState; },
    });

    expect(nextTurnDraws['p1']).toBe(3);
    expect(battle.players[0].buffs.some(b => b.kind === 'regen')).toBe(true);
  });
});
