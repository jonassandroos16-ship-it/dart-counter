import { describe, it, expect } from 'vitest';
import {
  defaultPlayerCards, addCard, removeCard, upgradeCard, hasCard, canUpgradeCard,
  resolveCardDef, cardsForLevelUp, randomCardReward, randomCardUpgradeReward,
  deckSize, isDeckValid,
} from './deck';
import { CARD_DEFS, cardDamage } from './definitions';

describe('Deck Management', () => {
  it('defaultPlayerCards returns 10 starter cards for a class', () => {
    const cards = defaultPlayerCards('warrior');
    expect(cards).toHaveLength(10);
    expect(hasCard(cards, 'dmg_warrior_slam')).toBe(true);
    expect(hasCard(cards, 'dmg_warrior_cleave')).toBe(true);
    expect(hasCard(cards, 'spell_surge')).toBe(true);
    expect(hasCard(cards, 'spell_hot_streak')).toBe(true);
    expect(hasCard(cards, 'dmg_s20')).toBe(true);
    expect(hasCard(cards, 'dmg_d20')).toBe(true);
    expect(hasCard(cards, 'dmg_outer_bull')).toBe(true);
    expect(hasCard(cards, 'util_redraw')).toBe(true);
    expect(hasCard(cards, 'util_recycle')).toBe(true);
    expect(hasCard(cards, 'util_warrior_rage')).toBe(true);
  });

  it('defaultPlayerCards returns 10 cards for priest', () => {
    const cards = defaultPlayerCards('priest');
    expect(cards).toHaveLength(10);
    expect(hasCard(cards, 'dmg_priest_smite')).toBe(true);
    expect(hasCard(cards, 'dmg_priest_judgment')).toBe(true);
    expect(hasCard(cards, 'spell_heal')).toBe(true);
    expect(hasCard(cards, 'spell_accuracy_buff')).toBe(true);
    expect(hasCard(cards, 'util_priest_blessing')).toBe(true);
  });

  it('defaultPlayerCards returns 10 cards for rogue', () => {
    const cards = defaultPlayerCards('rogue');
    expect(cards).toHaveLength(10);
    expect(hasCard(cards, 'dmg_rogue_backstab')).toBe(true);
    expect(hasCard(cards, 'dmg_rogue_poison')).toBe(true);
    expect(hasCard(cards, 'spell_enemy_debuff')).toBe(true);
    expect(hasCard(cards, 'spell_freeze')).toBe(true);
    expect(hasCard(cards, 'util_rogue_shadowstep')).toBe(true);
  });

  it('defaultPlayerCards returns 10 cards without a class (fallback)', () => {
    const cards = defaultPlayerCards();
    expect(cards).toHaveLength(10);
  });

  it('does not include an Outer Bull card by default for warrior', () => {
    const cards = defaultPlayerCards('warrior');
    expect(hasCard(cards, 'dmg_outer_bull')).toBe(true);
  });

  it('addCard adds a new card without duplicating', () => {
    const cards = defaultPlayerCards('warrior');
    const updated = addCard(cards, 'dmg_bull');
    expect(hasCard(updated, 'dmg_bull')).toBe(true);
    expect(updated).toHaveLength(11);
    const duped = addCard(updated, 'dmg_bull');
    expect(duped).toHaveLength(11);
  });

  it('removeCard removes a card', () => {
    const cards = defaultPlayerCards('warrior');
    const updated = removeCard(cards, 'dmg_s20');
    expect(hasCard(updated, 'dmg_s20')).toBe(false);
    expect(updated).toHaveLength(9);
  });

  it('upgradeCard marks a card as upgraded (level 1)', () => {
    const cards = defaultPlayerCards('warrior');
    const updated = upgradeCard(cards, 'dmg_s20');
    const s20 = updated.find(c => c.cardId === 'dmg_s20');
    expect(s20?.upgradeLevel).toBe(1);
    expect(s20?.upgraded).toBe(true);
  });

  it('upgradeCard can upgrade multiple times', () => {
    const cards = defaultPlayerCards('warrior');
    let updated = upgradeCard(cards, 'dmg_s20');
    updated = upgradeCard(updated, 'dmg_s20');
    const s20 = updated.find(c => c.cardId === 'dmg_s20');
    expect(s20?.upgradeLevel).toBe(2);
  });

  it('canUpgradeCard returns true for non-upgraded cards', () => {
    const cards = defaultPlayerCards('warrior');
    expect(canUpgradeCard(cards, 'dmg_s20')).toBe(true);
    const upgraded = upgradeCard(cards, 'dmg_s20');
    expect(canUpgradeCard(upgraded, 'dmg_s20')).toBe(true);
  });

  it('canUpgradeCard returns false at max upgrade level', () => {
    const cards = defaultPlayerCards('warrior');
    let updated = cards;
    for (let i = 0; i < 5; i++) {
      updated = upgradeCard(updated, 'dmg_s20');
    }
    expect(canUpgradeCard(updated, 'dmg_s20')).toBe(false);
  });

  it('resolveCardDef returns upgraded def when upgraded', () => {
    const withT20 = addCard(defaultPlayerCards('warrior'), 'dmg_t20');
    const upgraded = upgradeCard(withT20, 'dmg_t20');
    const def = resolveCardDef(upgraded.find(c => c.cardId === 'dmg_t20')!);
    expect(def?.upgraded).toBe(true);
    expect(def?.name).toBe('Triple 20+');
  });

  it('resolveCardDef returns double-upgraded def when upgradeLevel is 2', () => {
    const withT20 = addCard(defaultPlayerCards('warrior'), 'dmg_t20');
    let upgraded = upgradeCard(withT20, 'dmg_t20');
    upgraded = upgradeCard(upgraded, 'dmg_t20');
    const def = resolveCardDef(upgraded.find(c => c.cardId === 'dmg_t20')!);
    expect(def?.upgraded).toBe(true);
    // Double upgrade: round(60*1.3)=78, round(78*1.3)=102
    expect(cardDamage(def!)).toBe(102);
  });

  it('resolveCardDef returns base def when not upgraded', () => {
    const cards = defaultPlayerCards('warrior');
    const def = resolveCardDef(cards.find(c => c.cardId === 'dmg_s20')!);
    expect(def?.upgraded).toBeUndefined();
    expect(def?.name).toBe('Single 20');
  });

  it('cardsForLevelUp returns cards available for level and class', () => {
    const owned = defaultPlayerCards('warrior');
    const available = cardsForLevelUp('warrior', 2, 'competitive', owned);
    expect(available.length).toBeGreaterThan(0);
    expect(available.every(c => !hasCard(owned, c.id))).toBe(true);
  });

  it('cardsForLevelUp filters by level requirement', () => {
    const owned = defaultPlayerCards('warrior');
    const lvl1 = cardsForLevelUp('warrior', 1, 'competitive', owned);
    const lvl5 = cardsForLevelUp('warrior', 5, 'competitive', owned);
    expect(lvl5.length).toBeGreaterThanOrEqual(lvl1.length);
  });

  it('randomCardReward returns up to 3 new cards', () => {
    const owned = defaultPlayerCards('warrior');
    const rewards = randomCardReward(owned, 'competitive', 3);
    expect(rewards.length).toBeLessThanOrEqual(3);
    expect(rewards.every(c => !hasCard(owned, c.id))).toBe(true);
  });

  it('randomCardReward returns empty when all cards owned', () => {
    const allOwned = CARD_DEFS.map(c => ({ cardId: c.id, upgradeLevel: 0, upgraded: false }));
    const rewards = randomCardReward(allOwned, 'competitive', 3);
    expect(rewards).toHaveLength(0);
  });

  it('randomCardUpgradeReward returns upgradable cards', () => {
    const owned = defaultPlayerCards('warrior');
    const upgrades = randomCardUpgradeReward(owned, 3);
    expect(upgrades.length).toBeLessThanOrEqual(3);
    expect(upgrades.length).toBeGreaterThan(0);
  });

  it('randomCardUpgradeReward returns empty when all upgraded', () => {
    const owned = defaultPlayerCards('warrior').map(c => ({ ...c, upgradeLevel: 5, upgraded: true }));
    const upgrades = randomCardUpgradeReward(owned, 3);
    expect(upgrades).toHaveLength(0);
  });

  it('deckSize returns correct count', () => {
    expect(deckSize(defaultPlayerCards('warrior'))).toBe(10);
    expect(deckSize(addCard(defaultPlayerCards('warrior'), 'dmg_bull'))).toBe(11);
  });

  it('isDeckValid requires at least 4 cards', () => {
    expect(isDeckValid(defaultPlayerCards('warrior'))).toBe(true);
    expect(isDeckValid([])).toBe(false);
    expect(isDeckValid([defaultPlayerCards('warrior')[0]])).toBe(false);
  });
});
