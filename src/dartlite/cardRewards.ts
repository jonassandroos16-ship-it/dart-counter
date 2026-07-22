import type { PlayerCard } from '../cards/types';
import type { CardDef } from '../cards/types';
import { cardsForClass } from '../cards/definitions';
import {
  hasCard, upgradeCard, removeCard,
  resolveCardDef, maxUpgradeLevelInDeck, addCardAtLevel,
  MAX_UPGRADE_LEVEL,
} from '../cards/deck';

// ── Dartlite card rewards ──────────────────────────────────────────────
//
// In card mode, the "upgrade card" reward is replaced by a "deck upgrade"
// reward. When chosen, it opens a popup with 3 options:
//   1. Upgrade a card — pick from the deck, each upgrade scales the card.
//   2. Remove a card — pick from the deck to remove it.
//   3. Add a new card — 3 random cards from the class pool, auto-upgraded to
//      the highest upgrade level in the deck to scale with rounds.

export type CardRewardKind = 'deck_upgrade' | 'heal' | 'stat';

export interface CardRewardChoice {
  kind: CardRewardKind;
  label: string;
  desc: string;
  icon: string;
}

export function generateCardRewardOptions(
  _ownedCards: PlayerCard[],
  _mode: 'competitive' | 'coop',
): CardRewardChoice[] {
  return [
    {
      kind: 'deck_upgrade',
      label: 'Deck Upgrade',
      desc: 'Upgrade a card, remove a card, or add a new card to your deck.',
      icon: '⬆️',
    },
    {
      kind: 'heal',
      label: 'Heal 20%',
      desc: 'Restore 20% of max HP.',
      icon: '❤️‍🩹',
    },
    {
      kind: 'stat',
      label: 'Gain a Stat',
      desc: '+20 HP, +3% armor, or +4 power (random).',
      icon: '📊',
    },
  ];
}

// ── Deck upgrade sub-actions ───────────────────────────────────────────

export type DeckUpgradeAction = 'upgrade_card' | 'remove_card' | 'add_card';

// Generate the 3 random card choices for the "add card" action. Each card
// is auto-upgraded to the highest upgrade level currently in the deck so new
// cards scale with round depth.
export function generateAddCardChoices(
  ownedCards: PlayerCard[],
  cls: string,
  _mode: 'competitive' | 'coop',
): CardDef[] {
  const pool = cardsForClass(cls as 'warrior' | 'priest' | 'rogue' | 'any', 'coop')
    .filter(c => !hasCard(ownedCards, c.id));
  if (pool.length === 0) return [];
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, Math.min(3, pool.length));
  return selected;
}

export function autoUpgradeLevel(ownedCards: PlayerCard[]): number {
  return maxUpgradeLevelInDeck(ownedCards);
}

// Apply a deck upgrade action and return the new card array.
export function applyDeckUpgrade(
  ownedCards: PlayerCard[],
  action: DeckUpgradeAction,
  cardId?: string,
  _cls?: string,
  _mode?: 'competitive' | 'coop',
): PlayerCard[] {
  if (action === 'upgrade_card' && cardId) {
    return upgradeCard(ownedCards, cardId);
  }
  if (action === 'remove_card' && cardId) {
    return removeCard(ownedCards, cardId);
  }
  if (action === 'add_card' && cardId) {
    const level = autoUpgradeLevel(ownedCards);
    return addCardAtLevel(ownedCards, cardId, level);
  }
  return ownedCards;
}

// Get upgrade preview info for a card: current def vs next-level def.
export function upgradePreview(ownedCards: PlayerCard[], cardId: string): {
  current: CardDef | undefined;
  next: CardDef | undefined;
  canUpgrade: boolean;
} {
  const pc = ownedCards.find(c => c.cardId === cardId);
  if (!pc) return { current: undefined, next: undefined, canUpgrade: false };
  const current = resolveCardDef(pc);
  const canUpgrade = pc.upgradeLevel < MAX_UPGRADE_LEVEL;
  const next = canUpgrade ? resolveCardDef({ ...pc, upgradeLevel: pc.upgradeLevel + 1, upgraded: true }) : undefined;
  return { current, next, canUpgrade };
}

// Get card info for display.
export function cardInfo(pc: PlayerCard): CardDef | undefined {
  return resolveCardDef(pc);
}

// Legacy compat: applyCardReward now only handles heal (deck_upgrade is
// handled by the UI flow calling applyDeckUpgrade directly).
export function applyCardReward(
  ownedCards: PlayerCard[],
  choice: CardRewardChoice,
): PlayerCard[] {
  void choice;
  return ownedCards;
}
