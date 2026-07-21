import { describe, it, expect } from 'vitest';
import {
  initCardPlayState, drawCards, startTurn, playCardFromHand, endTurn,
  HAND_SIZE, MAX_PLAYS_PER_TURN, shuffle,
} from './deck';
import { defaultPlayerCards } from './deck';
import type { PlayerCard } from './types';

// A collection larger than HAND_SIZE so draws aren't capped by deck size.
const collection: PlayerCard[] = [
  ...defaultPlayerCards(),
  { cardId: 'dmg_bull', upgraded: false },
  { cardId: 'dmg_d20', upgraded: false },
  { cardId: 'dmg_outer_bull', upgraded: false },
];

describe('Deck-builder logic', () => {

  it('initCardPlayState shuffles the collection into the deck and leaves piles empty', () => {
    const s = initCardPlayState(collection);
    expect(s.deck).toHaveLength(collection.length);
    expect(s.hand).toHaveLength(0);
    expect(s.used).toHaveLength(0);
    expect(s.graveyard).toHaveLength(0);
  });

  it('drawCards moves up to HAND_SIZE cards from deck to hand', () => {
    const s = initCardPlayState(collection);
    const drawn = drawCards(s, HAND_SIZE);
    expect(drawn.hand).toHaveLength(HAND_SIZE);
    expect(drawn.deck).toHaveLength(collection.length - HAND_SIZE);
    expect(drawn.used).toHaveLength(0);
  });

  it('drawCards reshuffles the graveyard into the deck when it runs out', () => {
    const s = initCardPlayState(collection);
    const drawn = drawCards(s, collection.length); // empty the deck into the hand
    expect(drawn.deck).toHaveLength(0);
    expect(drawn.hand).toHaveLength(collection.length);
    // Move the hand into the graveyard to simulate cards used in prior turns.
    const withGraveyard: typeof drawn = { ...drawn, hand: [], graveyard: drawn.hand };
    const after = drawCards(withGraveyard, HAND_SIZE);
    expect(after.hand).toHaveLength(HAND_SIZE);
    expect(after.graveyard).toHaveLength(0);
    expect(after.deck.length).toBe(collection.length - HAND_SIZE);
  });

  it('startTurn clears the hand and used pile into the graveyard, then draws a fresh hand', () => {
    const s = initCardPlayState(collection);
    const drawn = drawCards(s, HAND_SIZE);
    const played = playCardFromHand(drawn, 0)!;
    expect(played.used).toHaveLength(1);
    expect(played.hand).toHaveLength(HAND_SIZE - 1);
    const next = startTurn(played);
    expect(next.hand).toHaveLength(HAND_SIZE);
    expect(next.used).toHaveLength(0);
    // Total cards across all piles is conserved.
    expect(next.deck.length + next.hand.length + next.used.length + next.graveyard.length).toBe(collection.length);
  });

  it('playCardFromHand moves the chosen card to the used pile and removes it from hand', () => {
    const s = initCardPlayState(collection);
    const drawn = drawCards(s, HAND_SIZE);
    const card = drawn.hand[2];
    const played = playCardFromHand(drawn, 2)!;
    expect(played.hand).not.toContain(card);
    expect(played.used).toContain(card);
    expect(played.hand).toHaveLength(HAND_SIZE - 1);
  });

  it('playCardFromHand returns null for an out-of-range index', () => {
    const s = initCardPlayState(collection);
    expect(playCardFromHand(s, 99)).toBeNull();
  });

  it('endTurn moves the used pile into the graveyard and clears used', () => {
    const s = initCardPlayState(collection);
    const drawn = drawCards(s, HAND_SIZE);
    const played = playCardFromHand(drawn, 0)!;
    const played2 = playCardFromHand(played, 0)!;
    expect(played2.used).toHaveLength(2);
    const ended = endTurn(played2);
    expect(ended.used).toHaveLength(0);
    expect(ended.graveyard).toHaveLength(2);
  });

  it('a card in the used pile cannot be replayed the same turn', () => {
    const s = initCardPlayState(collection);
    const drawn = drawCards(s, HAND_SIZE);
    const played = playCardFromHand(drawn, 0)!;
    const usedCard = played.used[0];
    const stillInHand = played.hand.some(c => c.cardId === usedCard.cardId && c.upgraded === usedCard.upgraded);
    expect(stillInHand).toBe(false);
  });

  it('respects MAX_PLAYS_PER_TURN of 3 and HAND_SIZE of 5', () => {
    expect(HAND_SIZE).toBe(5);
    expect(MAX_PLAYS_PER_TURN).toBe(3);
  });

  it('shuffle returns a new array with the same elements', () => {
    const arr = [1, 2, 3, 4, 5];
    const shuffled = shuffle(arr);
    expect(shuffled).not.toBe(arr);
    expect(shuffled.sort()).toEqual(arr);
  });
});
