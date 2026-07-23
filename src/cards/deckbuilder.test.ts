import { describe, it, expect } from 'vitest';
import {
  initCardPlayState, drawCards, startTurn, playCardFromHand, endTurn,
  redrawHand, recycleGraveyard,
} from './deck';
import { defaultPlayerCards } from './deck';
import { CARD_DEFS } from './definitions';

describe('Deck-builder logic', () => {
  it('initCardPlayState produces a deck of the right size', () => {
    const collection = defaultPlayerCards('warrior');
    const s = initCardPlayState(collection);
    expect(s.deck.length + s.hand.length + s.graveyard.length).toBe(collection.length);
  });

  it('drawCards fills the hand up to the requested count', () => {
    const collection = defaultPlayerCards('warrior');
    const s = initCardPlayState(collection);
    const drawn = drawCards(s, 5);
    expect(drawn.hand.length).toBe(5);
  });

  it('startTurn clears the previous hand/used into the graveyard and draws fresh', () => {
    const collection = defaultPlayerCards('warrior');
    const s = initCardPlayState(collection);
    const drawn = drawCards(s, 5);
    const started = startTurn(drawn);
    expect(started.hand.length).toBe(5);
    expect(started.used).toEqual([]);
  });

  it('playCardFromHand moves the chosen card to the used pile and removes it from hand', () => {
    const collection = defaultPlayerCards('warrior');
    const s = initCardPlayState(collection);
    const drawn = drawCards(s, 5);
    const played = playCardFromHand(drawn, 0)!;
    expect(played.hand.length).toBe(4);
    expect(played.used.length).toBe(1);
  });

  it('playCardFromHand returns null for an out-of-range index', () => {
    const collection = defaultPlayerCards('warrior');
    const s = initCardPlayState(collection);
    expect(playCardFromHand(s, 99)).toBeNull();
  });

  it('endTurn moves used and remaining hand cards into the graveyard', () => {
    const collection = defaultPlayerCards('warrior');
    const s = initCardPlayState(collection);
    const drawn = drawCards(s, 5);
    const played = playCardFromHand(drawn, 0)!;
    const ended = endTurn(played);
    expect(ended.hand).toEqual([]);
    expect(ended.used).toEqual([]);
    expect(ended.graveyard.length).toBe(1 + 4);
  });

  it('a card in the used pile cannot be replayed the same turn', () => {
    const collection = [
      ...defaultPlayerCards('warrior'),
      { cardId: 'dmg_bull', upgradeLevel: 0, upgraded: false },
    ];
    const s = initCardPlayState(collection);
    const drawn = drawCards(s, 5);
    const played = playCardFromHand(drawn, 0)!;
    const usedCard = played.used[0];
    const stillInHand = played.hand.some(c => c.cardId === usedCard.cardId && c.upgradeLevel === usedCard.upgradeLevel);
    expect(stillInHand).toBe(false);
  });

  it('redrawHand discards the current hand and draws the same number of fresh cards', () => {
    const collection = defaultPlayerCards('warrior');
    const s = initCardPlayState(collection);
    const drawn = drawCards(s, 5);
    const redrawn = redrawHand(drawn);
    expect(redrawn.hand.length).toBe(5);
  });

  it('recycleGraveyard shuffles the graveyard back into the deck', () => {
    const collection = defaultPlayerCards('warrior');
    const s = initCardPlayState(collection);
    const drawn = drawCards(s, 5);
    const played = playCardFromHand(drawn, 0)!;
    const ended = endTurn(played);
    const recycled = recycleGraveyard(ended);
    expect(recycled.graveyard).toEqual([]);
    expect(recycled.deck.length).toBeGreaterThan(0);
  });
});
