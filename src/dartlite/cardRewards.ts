import type { PlayerCard } from '../cards/types';
import { randomCardReward, randomCardUpgradeReward, hasCard, addCard, upgradeCard } from '../cards/deck';

// ── Dartlite card rewards ──────────────────────────────────────────────
//
// In card mode, dartlite rewards include card-related options alongside
// the standard heal/stat/trinket boons. After winning a round, the player
// can choose 1 of 3 randomly available cards. Cards can also be upgraded
// as a separate reward choice.

export interface CardRewardChoice {
  kind: 'card_new' | 'card_upgrade';
  label: string;
  desc: string;
  icon: string;
  cardId?: string;
  cardName?: string;
}

export function generateCardRewardOptions(
  ownedCards: PlayerCard[],
  mode: 'competitive' | 'coop',
): CardRewardChoice[] {
  const newCards = randomCardReward(ownedCards, mode, 3);
  const upgrades = randomCardUpgradeReward(ownedCards, 3);

  const options: CardRewardChoice[] = [];

  if (newCards.length > 0) {
    const pick = newCards[Math.floor(Math.random() * newCards.length)];
    options.push({
      kind: 'card_new',
      label: `New Card: ${pick.name}`,
      desc: pick.desc,
      icon: pick.icon,
      cardId: pick.id,
      cardName: pick.name,
    });
  }

  if (upgrades.length > 0) {
    const pick = upgrades[Math.floor(Math.random() * upgrades.length)];
    options.push({
      kind: 'card_upgrade',
      label: `Upgrade: ${pick.name}`,
      desc: `Upgrade ${pick.name} to improve its effect.`,
      icon: '⬆️',
      cardId: pick.cardId,
      cardName: pick.name,
    });
  }

  while (options.length < 3) {
    options.push({
      kind: 'card_new',
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
