import { describe, it, expect } from 'vitest';
import { generateCardRewardOptions, applyCardReward } from './cardRewards';
import { defaultPlayerCards, hasCard } from '../cards/deck';

describe('Dartlite Card Rewards', () => {
  it('generateCardRewardOptions returns 3 options', () => {
    const owned = defaultPlayerCards();
    const options = generateCardRewardOptions(owned, 'coop');
    expect(options).toHaveLength(3);
  });

  it('generateCardRewardOptions includes card_new or card_upgrade kinds', () => {
    const owned = defaultPlayerCards();
    const options = generateCardRewardOptions(owned, 'coop');
    expect(options.some(o => o.kind === 'card_new' || o.kind === 'card_upgrade')).toBe(true);
  });

  it('generateCardRewardOptions offers up to 2 new cards and 1 upgrade', () => {
    const owned = defaultPlayerCards();
    const options = generateCardRewardOptions(owned, 'coop');
    const newCount = options.filter(o => o.kind === 'card_new').length;
    const upgradeCount = options.filter(o => o.kind === 'card_upgrade').length;
    expect(newCount).toBeLessThanOrEqual(2);
    expect(upgradeCount).toBeLessThanOrEqual(1);
    expect(newCount + upgradeCount).toBeGreaterThan(0);
  });

  it('applyCardReward adds a new card', () => {
    const owned = defaultPlayerCards();
    const options = generateCardRewardOptions(owned, 'coop');
    const cardOption = options.find(o => o.kind === 'card_new' && o.cardId);
    if (cardOption) {
      const updated = applyCardReward(owned, cardOption);
      expect(hasCard(updated, cardOption.cardId!)).toBe(true);
    }
  });

  it('applyCardReward upgrades a card', () => {
    const owned = defaultPlayerCards();
    const options = generateCardRewardOptions(owned, 'coop');
    const upgradeOption = options.find(o => o.kind === 'card_upgrade' && o.cardId);
    if (upgradeOption) {
      const updated = applyCardReward(owned, upgradeOption);
      const card = updated.find(c => c.cardId === upgradeOption.cardId);
      expect(card?.upgraded).toBe(true);
    }
  });

  it('applyCardReward does not duplicate existing cards', () => {
    const owned = defaultPlayerCards();
    const options = generateCardRewardOptions(owned, 'coop');
    const cardOption = options.find(o => o.kind === 'card_new' && o.cardId);
    if (cardOption) {
      const once = applyCardReward(owned, cardOption);
      const twice = applyCardReward(once, cardOption);
      expect(twice.filter(c => c.cardId === cardOption.cardId)).toHaveLength(1);
    }
  });

  it('falls back to heal when no new cards or upgrades available', () => {
    // Own every card already upgraded — no new cards, no upgrades.
    const allCards = [
      'dmg_s20', 'dmg_s19', 'dmg_s18', 'dmg_d20', 'dmg_outer_bull',
      'dmg_t20', 'dmg_t19', 'dmg_t18', 'dmg_bull',
      'dmg_warrior_strike', 'dmg_priest_smite', 'dmg_rogue_backstab',
      'dmg_meteor', 'dmg_warrior_cleave', 'dmg_priest_judgment', 'dmg_rogue_assassinate',
      'dmg_apocalypse',
      'spell_bust_protect', 'spell_surge', 'spell_hot_streak',
      'spell_power_buff', 'spell_heal', 'spell_accuracy_buff', 'spell_enemy_debuff',
      'spell_freeze', 'spell_double_up',
      'util_reroll', 'util_draw', 'util_reserve', 'util_shield', 'util_extra_dart', 'util_revive',
    ].map(id => ({ cardId: id, upgraded: true }));
    const options = generateCardRewardOptions(allCards, 'coop');
    expect(options).toHaveLength(3);
    expect(options.every(o => o.kind === 'heal')).toBe(true);
  });
});
