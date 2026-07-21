import { describe, it, expect } from 'vitest';
import {
  defaultPlayerCards, addCard, removeCard, upgradeCard, hasCard, canUpgradeCard,
  resolveCardDef, cardsForLevelUp, randomCardReward, randomCardUpgradeReward,
  deckSize, isDeckValid,
} from './deck';
import { CARD_DEFS } from './definitions';

describe('Deck Management', () => {
  it('defaultPlayerCards returns 4 starter cards', () => {
    const cards = defaultPlayerCards();
    expect(cards).toHaveLength(4);
    expect(hasCard(cards, 'dmg_t20')).toBe(true);
    expect(hasCard(cards, 'dmg_t19')).toBe(true);
    expect(hasCard(cards, 'dmg_s20')).toBe(true);
    expect(hasCard(cards, 'dmg_miss')).toBe(true);
  });

  it('does not include an Outer Bull card by default', () => {
    const cards = defaultPlayerCards();
    expect(hasCard(cards, 'dmg_outer_bull')).toBe(false);
  });

  it('addCard adds a new card without duplicating', () => {
    const cards = defaultPlayerCards();
    const updated = addCard(cards, 'dmg_bull');
    expect(hasCard(updated, 'dmg_bull')).toBe(true);
    expect(updated).toHaveLength(5);
    const duped = addCard(updated, 'dmg_bull');
    expect(duped).toHaveLength(5);
  });

  it('removeCard removes a card', () => {
    const cards = defaultPlayerCards();
    const updated = removeCard(cards, 'dmg_s20');
    expect(hasCard(updated, 'dmg_s20')).toBe(false);
    expect(updated).toHaveLength(3);
  });

  it('upgradeCard marks a card as upgraded', () => {
    const cards = defaultPlayerCards();
    const updated = upgradeCard(cards, 'dmg_s20');
    const s20 = updated.find(c => c.cardId === 'dmg_s20');
    expect(s20?.upgraded).toBe(true);
  });

  it('canUpgradeCard returns true for non-upgraded cards', () => {
    const cards = defaultPlayerCards();
    expect(canUpgradeCard(cards, 'dmg_s20')).toBe(true);
    const upgraded = upgradeCard(cards, 'dmg_s20');
    expect(canUpgradeCard(upgraded, 'dmg_s20')).toBe(false);
  });

  it('resolveCardDef returns upgraded def when upgraded', () => {
    const withT20 = addCard(defaultPlayerCards(), 'dmg_t20');
    const upgraded = upgradeCard(withT20, 'dmg_t20');
    const def = resolveCardDef(upgraded.find(c => c.cardId === 'dmg_t20')!);
    expect(def?.upgraded).toBe(true);
    expect(def?.name).toBe('Triple 20+');
  });

  it('resolveCardDef returns base def when not upgraded', () => {
    const cards = defaultPlayerCards();
    const def = resolveCardDef(cards.find(c => c.cardId === 'dmg_s20')!);
    expect(def?.upgraded).toBeUndefined();
    expect(def?.name).toBe('Single 20');
  });

  it('cardsForLevelUp returns cards available for level and class', () => {
    const owned = defaultPlayerCards();
    const available = cardsForLevelUp('warrior', 2, 'competitive', owned);
    expect(available.length).toBeGreaterThan(0);
    expect(available.every(c => !hasCard(owned, c.id))).toBe(true);
  });

  it('cardsForLevelUp filters by level requirement', () => {
    const owned = defaultPlayerCards();
    const lvl1 = cardsForLevelUp('warrior', 1, 'competitive', owned);
    const lvl5 = cardsForLevelUp('warrior', 5, 'competitive', owned);
    expect(lvl5.length).toBeGreaterThanOrEqual(lvl1.length);
  });

  it('randomCardReward returns up to 3 new cards', () => {
    const owned = defaultPlayerCards();
    const rewards = randomCardReward(owned, 'competitive', 3);
    expect(rewards.length).toBeLessThanOrEqual(3);
    expect(rewards.every(c => !hasCard(owned, c.id))).toBe(true);
  });

  it('randomCardReward returns empty when all cards owned', () => {
    const allOwned = CARD_DEFS.map(c => ({ cardId: c.id, upgraded: false }));
    const rewards = randomCardReward(allOwned, 'competitive', 3);
    expect(rewards).toHaveLength(0);
  });

  it('randomCardUpgradeReward returns upgradable cards', () => {
    const owned = defaultPlayerCards();
    const upgrades = randomCardUpgradeReward(owned, 3);
    expect(upgrades.length).toBeLessThanOrEqual(3);
    expect(upgrades.length).toBeGreaterThan(0);
  });

  it('randomCardUpgradeReward returns empty when all upgraded', () => {
    const owned = defaultPlayerCards().map(c => ({ ...c, upgraded: true }));
    const upgrades = randomCardUpgradeReward(owned, 3);
    expect(upgrades).toHaveLength(0);
  });

  it('deckSize returns correct count', () => {
    expect(deckSize(defaultPlayerCards())).toBe(4);
    expect(deckSize(addCard(defaultPlayerCards(), 'dmg_bull'))).toBe(5);
  });

  it('isDeckValid requires at least 4 cards', () => {
    expect(isDeckValid(defaultPlayerCards())).toBe(true);
    expect(isDeckValid([])).toBe(false);
    expect(isDeckValid([defaultPlayerCards()[0]])).toBe(false);
  });
});
