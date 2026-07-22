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
  const base: Record<string, PlayerCard[]> =
    existing && !Array.isArray(existing) ? { ...existing } : {};
  return { ...player, cards: { ...base, [key]: updatedCards } };
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

// ── Card play state ────────────────────────────────────────────────────

export const MAX_PLAYS_PER_TURN = 3;
const HAND_SIZE = 4;

export function initCardPlayState(deck: PlayerCard[]): CardPlayState {
  const shuffled = [...deck].sort(() => Math.random() - 0.5);
  return {
    deck: shuffled.slice(HAND_SIZE),
    hand: shuffled.slice(0, HAND_SIZE),
    used: [],
    graveyard: [],
  };
}

export function startTurn(state: CardPlayState): CardPlayState {
  let deck = [...state.deck];
  let graveyard = [...state.graveyard];
  if (deck.length === 0 && graveyard.length > 0) {
    deck = [...graveyard].sort(() => Math.random() - 0.5);
    graveyard = [];
  }
  const drawCount = Math.min(HAND_SIZE - state.hand.length, deck.length);
  const newHand = [...state.hand, ...deck.slice(0, drawCount)];
  const newDeck = deck.slice(drawCount);
  return { ...state, hand: newHand, deck: newDeck, graveyard };
}

export function playCardFromHand(state: CardPlayState, handIdx: number): CardPlayState | null {
  if (handIdx < 0 || handIdx >= state.hand.length) return null;
  const [played] = state.hand.splice(handIdx, 1);
  return {
    ...state,
    hand: [...state.hand],
    used: [...state.used, played],
    graveyard: [...state.graveyard, played],
  };
}

export function endTurn(state: CardPlayState): CardPlayState {
  return { ...state, used: [] };
}

export function resolveCardDef(pc: PlayerCard): CardDef | null {
  const def = getCard(pc.cardId);
  if (!def) return null;
  return pc.upgraded ? upgradedCardDef(def) : def;
}

// ── Level-up card rewards ─────────────────────────────────────────────

export function cardsForLevelUp(classId: string | null, level: number, mode: 'competitive' | 'coop', currentCards: PlayerCard[]): CardDef[] {
  const rewards: CardDef[] = [];
  const pool = cardsForClass(classId);
  const owned = new Set(currentCards.map(c => c.cardId));
  for (const def of pool) {
    if (rewards.length >= 1) break;
    if (!owned.has(def.id)) {
      rewards.push(def);
    }
  }
  return rewards;
}

export function cardsForLevelUpCompetitive(classId: string | null, level: number, currentCards: PlayerCard[]): CardDef[] {
  return cardsForLevelUp(classId, level, 'competitive', currentCards);
}
