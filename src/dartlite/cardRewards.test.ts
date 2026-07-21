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
});
