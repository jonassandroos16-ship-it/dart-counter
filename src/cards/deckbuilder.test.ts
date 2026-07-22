import { describe, it, expect } from 'vitest';
import {
  initCardPlayState, drawCards, startTurn, playCardFromHand, endTurn,
  shuffle, HAND_SIZE, MAX_PLAYS_PER_TURN,
} from './deck';
import { defaultPlayerCards } from './deck';

const collection = [
  ...defaultPlayerCards('warrior'),
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
  });

  it('drawCards reshuffles the graveyard into the deck when it runs out', () => {
    const s = initCardPlayState(collection);
    // Draw all cards into hand
    const drawn = drawCards(s, collection.length);
    expect(drawn.deck).toHaveLength(0);
    expect(drawn.hand).toHaveLength(collection.length);
    // Now move some to graveyard via endTurn-like state
    const played = playCardFromHand(drawn, 0)!;
    const played2 = playCardFromHand(played, 0)!;
    const ended = endTurn(played2);
    // Drawing again should reshuffle graveyard into deck
    const drawnAgain = drawCards(ended, 1);
    expect(drawnAgain.hand).toHaveLength(1);
    expect(drawnAgain.graveyard).toHaveLength(0);
  });

  it('startTurn clears the hand and used pile into the graveyard, then draws a fresh hand', () => {
    const s = initCardPlayState(collection);
    const drawn = drawCards(s, HAND_SIZE);
    const played = playCardFromHand(drawn, 0)!;
    const next = startTurn(played);
    expect(next.hand).toHaveLength(HAND_SIZE);
    expect(next.used).toHaveLength(0);
    expect(next.graveyard).toHaveLength(HAND_SIZE);
  });

  it('playCardFromHand moves the chosen card to the used pile and removes it from hand', () => {
    const s = initCardPlayState(collection);
    const drawn = drawCards(s, HAND_SIZE);
    const played = playCardFromHand(drawn, 0)!;
    expect(played.used).toHaveLength(1);
    expect(played.hand).toHaveLength(HAND_SIZE - 1);
  });

  it('playCardFromHand returns null for an out-of-range index', () => {
    const s = initCardPlayState(collection);
    expect(playCardFromHand(s, 99)).toBeNull();
  });

  it('endTurn moves used pile and remaining hand into the graveyard and clears both', () => {
    const s = initCardPlayState(collection);
    const drawn = drawCards(s, HAND_SIZE);
    const played = playCardFromHand(drawn, 0)!;
    const played2 = playCardFromHand(played, 0)!;
    expect(played2.used).toHaveLength(2);
    const ended = endTurn(played2);
    expect(ended.used).toHaveLength(0);
    expect(ended.hand).toHaveLength(0);
    // 2 used + 3 remaining hand = 5 in graveyard
    expect(ended.graveyard).toHaveLength(5);
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
