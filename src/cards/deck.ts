import type { CardDef, PlayerCard, CardPlayState } from './types';
import { CARD_DEFS, cardsForClass, getCard, upgradedCardDef } from './definitions';
import type { CoopClassId } from '../campaign/types';
import type { Player } from '../types';

// ── Deck management ────────────────────────────────────────────────────
//
// In card mode, each player has a deck of cards they've collected. Cards
// are gained on level-up (based on class) and as dartlite rewards. Each
// card can be upgraded once.

// Starter deck: 10 cards per player.
//   4 class-specific (damage/spell mix)
//   3 shared attack (class 'any' damage)
//   2 shared utility (class 'any')
//   1 class utility
// If no class is selected, the 'any' cards plus neutral fallbacks are used.
const STARTER_SHARED_ATTACK = ['dmg_s20', 'dmg_d20', 'dmg_outer_bull'];
const STARTER_SHARED_UTILITY = ['util_reroll', 'util_reserve'];

const STARTER_CLASS_CARDS: Record<string, { specific: string[]; utility: string }> = {
  warrior: {
    specific: ['dmg_warrior_slam', 'dmg_warrior_cleave', 'spell_surge', 'spell_hot_streak'],
    utility: 'util_warrior_rage',
  },
  priest: {
    specific: ['dmg_priest_smite', 'dmg_priest_judgment', 'spell_heal', 'spell_accuracy_buff'],
    utility: 'util_priest_blessing',
  },
  rogue: {
    specific: ['dmg_rogue_backstab', 'dmg_rogue_poison', 'spell_enemy_debuff', 'spell_freeze'],
    utility: 'util_rogue_shadowstep',
  },
};

// Fallback for players without a class — extra shared cards fill the slots.
const STARTER_NO_CLASS_FALLBACK: string[] = [
  'dmg_s20', 'dmg_d20', 'dmg_outer_bull', 'dmg_s20',
  'util_reroll', 'util_reserve', 'util_reroll',
  'dmg_s20', 'dmg_d20', 'util_reserve',
];

export function defaultPlayerCards(classId?: string | null): PlayerCard[] {
  const cls = STARTER_CLASS_CARDS[classId || ''];
  if (!cls) {
    return STARTER_NO_CLASS_FALLBACK.map(cardId => ({ cardId, upgraded: false }));
  }
  return [
    ...cls.specific.map(cardId => ({ cardId, upgraded: false })),
    ...STARTER_SHARED_ATTACK.map(cardId => ({ cardId, upgraded: false })),
    ...STARTER_SHARED_UTILITY.map(cardId => ({ cardId, upgraded: false })),
    { cardId: cls.utility, upgraded: false },
  ];
}

export function cardFromDef(def: CardDef): PlayerCard {
  return { cardId: def.id, upgraded: false };
}

// ── Per-class deck storage ────────────────────────────────────────────
//
// Player.cards is a Record<string, PlayerCard[]> keyed by class id so each
// class maintains its own separate deck. These helpers handle the lookup,
// fallback to defaults, backward-compat for the old flat-array format, and
// writing updated decks back.

export function classKey(classId?: string | null): string {
  return classId || 'any';
}

export function getPlayerCards(player: Player): PlayerCard[] {
  const cards = player.cards;
  if (!cards) return defaultPlayerCards(player.coopProgress?.classId);
  // Backward compat: old format was a flat PlayerCard[] array
  if (Array.isArray(cards)) return cards as unknown as PlayerCard[];
  const key = classKey(player.coopProgress?.classId);
  const deck = cards[key];
  if (deck && deck.length > 0) return deck;
  return defaultPlayerCards(player.coopProgress?.classId);
}

export function setPlayerCards(player: Player, updatedCards: PlayerCard[]): Player {
  const key = classKey(player.coopProgress?.classId);
  const existing = player.cards;
  // Migrate old flat-array format to per-class record
  const record = Array.isArray(existing)
    ? {}
    : { ...(existing as Record<string, PlayerCard[]>) };
  record[key] = updatedCards;
  return { ...player, cards: record };
}

export function playerCardIds(cards: PlayerCard[]): string[] {
  return cards.map(c => c.cardId);
}

export function hasCard(cards: PlayerCard[], cardId: string): boolean {
  return cards.some(c => c.cardId === cardId);
}

export function addCard(cards: PlayerCard[], cardId: string): PlayerCard[] {
  if (hasCard(cards, cardId)) return cards;
  return [...cards, { cardId, upgraded: false }];
}

export function removeCard(cards: PlayerCard[], cardId: string): PlayerCard[] {
  return cards.filter(c => c.cardId !== cardId);
}

export function upgradeCard(cards: PlayerCard[], cardId: string): PlayerCard[] {
  return cards.map(c => c.cardId === cardId ? { ...c, upgraded: true } : c);
}

export function canUpgradeCard(cards: PlayerCard[], cardId: string): boolean {
  const pc = cards.find(c => c.cardId === cardId);
  return !!pc && !pc.upgraded;
}

export function resolveCardDef(pc: PlayerCard): CardDef | undefined {
  const def = getCard(pc.cardId);
  if (!def) return undefined;
  return pc.upgraded ? upgradedCardDef(def) : def;
}

// ── Level-up card rewards ──────────────────────────────────────────────
//
// When a player levels up in card mode, they gain cards based on their class.
// The available card pool depends on class and level.

export function cardsForLevelUp(
  cls: CoopClassId | null | undefined,
  level: number,
  mode: 'competitive' | 'coop',
  ownedCards: PlayerCard[],
): CardDef[] {
  const classId = cls || 'any';
  const pool = cardsForClass(classId as 'warrior' | 'priest' | 'rogue' | 'any', mode);
  return pool.filter(c => (c.levelRequired ?? 1) <= level && !hasCard(ownedCards, c.id));
}

export function cardsForLevelUpCoop(
  cls: CoopClassId | null | undefined,
  level: number,
  ownedCards: PlayerCard[],
): CardDef[] {
  return cardsForLevelUp(cls, level, 'coop', ownedCards);
}

export function cardsForLevelUpCompetitive(
  cls: CoopClassId | null | undefined,
  level: number,
  ownedCards: PlayerCard[],
): CardDef[] {
  return cardsForLevelUp(cls, level, 'competitive', ownedCards);
}

// ── Dartlite card rewards ──────────────────────────────────────────────
//
// In dartlite mode, after winning a round, the player can choose 1 of 3
// randomly available cards. Cards can also be upgraded as a separate reward.

export function randomCardReward(
  ownedCards: PlayerCard[],
  mode: 'competitive' | 'coop',
  count: number = 3,
): CardDef[] {
  const pool = CARD_DEFS.filter(c => c.mode === mode && !hasCard(ownedCards, c.id));
  if (pool.length === 0) return [];
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, pool.length));
}

export function randomCardUpgradeReward(
  ownedCards: PlayerCard[],
  count: number = 3,
): { cardId: string; name: string; icon: string }[] {
  const upgradeable = ownedCards.filter(c => !c.upgraded);
  if (upgradeable.length === 0) return [];
  const shuffled = [...upgradeable].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, upgradeable.length)).map(c => {
    const def = getCard(c.cardId);
    return { cardId: c.cardId, name: def?.name ?? c.cardId, icon: def?.icon ?? '🃏' };
  });
}

// ── Deck validation ────────────────────────────────────────────────────

export function deckSize(cards: PlayerCard[]): number {
  return cards.length;
}

export function isDeckValid(cards: PlayerCard[]): boolean {
  return cards.length >= 4;
}

// ── Deck-builder logic ──────────────────────────────────────────────────
//
// Standard deck-builder flow: a player's collection forms the draw deck.
// Each turn 5 cards are drawn into a hand. Played cards go to a "used" pile
// and cannot be replayed that turn. At end of turn the used pile moves to
// the graveyard. When the deck can't satisfy a draw, the graveyard is
// shuffled into the deck to form a new one.

export const HAND_SIZE = 5;
export const MAX_PLAYS_PER_TURN = 3;

export function initCardPlayState(collection: PlayerCard[]): CardPlayState {
  const deck = shuffle([...collection]);
  return { deck, hand: [], used: [], graveyard: [] };
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Refill the deck from the graveyard if needed so at least `need` cards are
// available. Returns the updated deck and graveyard.
function ensureDeck(deck: PlayerCard[], graveyard: PlayerCard[], need: number): { deck: PlayerCard[]; graveyard: PlayerCard[] } {
  if (deck.length >= need || graveyard.length === 0) return { deck, graveyard };
  const recycled = shuffle(graveyard);
  return { deck: [...deck, ...recycled], graveyard: [] };
}

// Draw up to `count` cards from the deck into the hand, reshuffling the
// graveyard into the deck if it runs out.
export function drawCards(state: CardPlayState, count: number = HAND_SIZE): CardPlayState {
  let { deck, graveyard } = ensureDeck(state.deck, state.graveyard, count);
  const draw = Math.min(count, deck.length);
  const drawn = deck.slice(0, draw);
  deck = deck.slice(draw);
  return {
    deck,
    hand: [...state.hand, ...drawn],
    used: state.used,
    graveyard,
  };
}

// Start a new turn: clear the hand (any unplayed cards return to the
// graveyard), then draw a fresh hand of HAND_SIZE.
export function startTurn(state: CardPlayState): CardPlayState {
  const graveyard = [...state.graveyard, ...state.hand, ...state.used];
  const cleared: CardPlayState = { deck: state.deck, hand: [], used: [], graveyard };
  return drawCards(cleared, HAND_SIZE);
}

// Play a card from the hand by index: it moves to the used pile.
export function playCardFromHand(state: CardPlayState, handIdx: number): CardPlayState | null {
  const card = state.hand[handIdx];
  if (!card) return null;
  return {
    deck: state.deck,
    hand: state.hand.filter((_, i) => i !== handIdx),
    used: [...state.used, card],
    graveyard: state.graveyard,
  };
}

// End the turn: move both the used pile and any remaining hand cards into
// the graveyard. The next time this player's turn starts, startTurn() will
// draw a fresh hand from the deck (reshuffling the graveyard if needed).
export function endTurn(state: CardPlayState): CardPlayState {
  return {
    deck: state.deck,
    hand: [],
    used: [],
    graveyard: [...state.graveyard, ...state.used, ...state.hand],
  };
}
