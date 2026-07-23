// Barrel re-export for backwards compatibility.
// The card definitions have been split into:
//   cardData.ts     — the raw CARD_DEFS array
//   cardHelpers.ts  — lookup and utility functions
//   cardUpgrades.ts — upgrade logic

export { CARD_DEFS } from './cardData';
export {
  getCard, cardsForMode, cardsForClass, cardMatchesMode,
  cardDamage, cardRarityColor, cardTypeColor,
  cardsByLevel, splitStarterAndLeveled,
} from './cardHelpers';
export { upgradedCardDef } from './cardUpgrades';
