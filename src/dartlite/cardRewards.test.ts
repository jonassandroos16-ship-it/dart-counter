import { describe, it, expect } from 'vitest';
import { generateCardRewardOptions, generateAddCardChoices, applyDeckUpgrade, autoUpgradeLevel, upgradePreview } from './cardRewards';
import { defaultPlayerCards, hasCard, maxUpgradeLevelInDeck } from '../cards/deck';

describe('Dartlite Card Rewards', () => {
  it('generateCardRewardOptions returns 3 options', () => {
    const owned = defaultPlayerCards('warrior');
    const options = generateCardRewardOptions(owned, 'coop');
    expect(options).toHaveLength(3);
  });

  it('generateCardRewardOptions includes deck_upgrade kind', () => {
    const owned = defaultPlayerCards('warrior');
    const options = generateCardRewardOptions(owned, 'coop');
    expect(options.some(o => o.kind === 'deck_upgrade')).toBe(true);
  });

  it('generateCardRewardOptions always offers deck_upgrade', () => {
    const owned = defaultPlayerCards('warrior');
    const options = generateCardRewardOptions(owned, 'coop');
    const upgradeCount = options.filter(o => o.kind === 'deck_upgrade').length;
    expect(upgradeCount).toBe(1);
  });

  it('applyDeckUpgrade upgrades a card', () => {
    const owned = defaultPlayerCards('warrior');
    const updated = applyDeckUpgrade(owned, 'upgrade_card', 'dmg_s20');
    const card = updated.find(c => c.cardId === 'dmg_s20');
    expect(card?.upgradeLevel).toBe(1);
    expect(card?.upgraded).toBe(true);
  });

  it('applyDeckUpgrade can upgrade a card multiple times', () => {
    const owned = defaultPlayerCards('warrior');
    const once = applyDeckUpgrade(owned, 'upgrade_card', 'dmg_s20');
    const twice = applyDeckUpgrade(once, 'upgrade_card', 'dmg_s20');
    const card = twice.find(c => c.cardId === 'dmg_s20');
    expect(card?.upgradeLevel).toBe(2);
  });

  it('applyDeckUpgrade removes a card', () => {
    const owned = defaultPlayerCards('warrior');
    const updated = applyDeckUpgrade(owned, 'remove_card', 'dmg_s20');
    expect(hasCard(updated, 'dmg_s20')).toBe(false);
  });

  it('applyDeckUpgrade adds a new card at the highest upgrade level in the deck', () => {
    const owned = defaultPlayerCards('warrior');
    // Upgrade one card to level 2
    const upgraded = applyDeckUpgrade(owned, 'upgrade_card', 'dmg_s20');
    const upgraded2 = applyDeckUpgrade(upgraded, 'upgrade_card', 'dmg_s20');
    // Now add a new card — it should auto-upgrade to level 2
    const withNew = applyDeckUpgrade(upgraded2, 'add_card', 'dmg_bull', 'warrior', 'coop');
    const newCard = withNew.find(c => c.cardId === 'dmg_bull');
    expect(newCard).toBeDefined();
    expect(newCard?.upgradeLevel).toBe(2);
    expect(newCard?.upgraded).toBe(true);
  });

  it('applyDeckUpgrade does not duplicate existing cards', () => {
    const owned = defaultPlayerCards('warrior');
    const once = applyDeckUpgrade(owned, 'add_card', 'dmg_s20', 'warrior', 'coop');
    // dmg_s20 already in deck — should not duplicate
    expect(once.filter(c => c.cardId === 'dmg_s20')).toHaveLength(1);
  });

  it('generateAddCardChoices returns up to 3 cards not in the deck', () => {
    const owned = defaultPlayerCards('warrior');
    const choices = generateAddCardChoices(owned, 'warrior', 'coop');
    expect(choices.length).toBeLessThanOrEqual(3);
    expect(choices.every(c => !hasCard(owned, c.id))).toBe(true);
  });

  it('autoUpgradeLevel returns the highest upgrade level in the deck', () => {
    const owned = defaultPlayerCards('warrior');
    expect(autoUpgradeLevel(owned)).toBe(0);
    const upgraded = applyDeckUpgrade(owned, 'upgrade_card', 'dmg_s20');
    expect(autoUpgradeLevel(upgraded)).toBe(1);
    const upgraded2 = applyDeckUpgrade(upgraded, 'upgrade_card', 'dmg_s20');
    expect(autoUpgradeLevel(upgraded2)).toBe(2);
  });

  it('upgradePreview shows current and next level', () => {
    const owned = defaultPlayerCards('warrior');
    const preview = upgradePreview(owned, 'dmg_s20');
    expect(preview.canUpgrade).toBe(true);
    expect(preview.current?.name).toBe('Single 20');
    expect(preview.next?.name).toBe('Single 20+');
  });

  it('upgradePreview returns canUpgrade=false at max level', () => {
    const owned = defaultPlayerCards('warrior');
    let updated = owned;
    for (let i = 0; i < 5; i++) {
      updated = applyDeckUpgrade(updated, 'upgrade_card', 'dmg_s20');
    }
    const preview = upgradePreview(updated, 'dmg_s20');
    expect(preview.canUpgrade).toBe(false);
  });

  it('maxUpgradeLevelInDeck returns 0 for starter deck', () => {
    const owned = defaultPlayerCards('warrior');
    expect(maxUpgradeLevelInDeck(owned)).toBe(0);
  });

  it('falls back to heal when no new cards or upgrades available', () => {
    // With deck_upgrade always offered, this test verifies the heal options
    // are still present alongside deck_upgrade
    const owned = defaultPlayerCards('warrior');
    const options = generateCardRewardOptions(owned, 'coop');
    expect(options).toHaveLength(3);
    expect(options.some(o => o.kind === 'deck_upgrade')).toBe(true);
    expect(options.some(o => o.kind === 'heal')).toBe(true);
  });
});
