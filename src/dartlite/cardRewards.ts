import type { PlayerCard } from '../cards/types';
import { randomCardReward, randomCardUpgradeReward, hasCard, addCard, upgradeCard } from '../cards/deck';

// ── Dartlite card rewards ──────────────────────────────────────────────
//
// In card mode, dartlite rewards include card-related options alongside
// the standard heal/stat/trinket boons. After winning a round, the player
// can choose 1 of 3 randomly available cards. Cards can also be upgraded
// as a separate reward choice.

export type CardRewardKind = 'card_new' | 'card_upgrade' | 'heal';

export interface CardRewardChoice {
  kind: CardRewardKind;
  label: string;
  desc: string;
  icon: string;
  cardId?: string;
  cardName?: string;
}

// Generate 3 reward options for card mode: up to 2 new cards and 1 upgrade,
// falling back to a heal when the new-card pool or upgradeable cards are
// exhausted so the player always has 3 choices.
export function generateCardRewardOptions(
  ownedCards: PlayerCard[],
  mode: 'competitive' | 'coop',
): CardRewardChoice[] {
  const newCards = randomCardReward(ownedCards, mode, 2);
  const upgrades = randomCardUpgradeReward(ownedCards, 1);

  const options: CardRewardChoice[] = [];

  for (const c of newCards) {
    options.push({
      kind: 'card_new',
      label: `New Card: ${c.name}`,
      desc: c.desc,
      icon: c.icon,
      cardId: c.id,
      cardName: c.name,
    });
  }

  for (const u of upgrades) {
    options.push({
      kind: 'card_upgrade',
      label: `Upgrade: ${u.name}`,
      desc: `Improve ${u.name}'s effect.`,
      icon: '⬆️',
      cardId: u.cardId,
      cardName: u.name,
    });
  }

  while (options.length < 3) {
    options.push({
      kind: 'heal',
      label: 'Heal 20%',
      desc: 'Restore 20% of max HP.',
      icon: '❤️‍🩹',
    });
  }

  return options.slice(0, 3);
}

export function applyCardReward(
  ownedCards: PlayerCard[],
  choice: CardRewardChoice,
): PlayerCard[] {
  if (choice.kind === 'card_new' && choice.cardId) {
    if (!hasCard(ownedCards, choice.cardId)) {
      return addCard(ownedCards, choice.cardId);
    }
  }
  if (choice.kind === 'card_upgrade' && choice.cardId) {
    return upgradeCard(ownedCards, choice.cardId);
  }
  return ownedCards;
}
