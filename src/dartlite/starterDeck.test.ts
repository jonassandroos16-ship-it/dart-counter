import { describe, it, expect } from 'vitest';
import { startRun } from './engine';
import { defaultPlayerCards } from '../cards/deck';
import { defaultSettings } from '../constants';
import type { Player } from '../types';

function makePlayer(id: string, classId: 'warrior' | 'priest' | 'rogue'): Player {
  return {
    id,
    name: id,
    color: '#ff0000',
    attributes: { health: 300, armor: 0, power: 0, crit: 5, pointsAvailable: 0 },
    coopProgress: { classId, unlockedPassives: [], equippedPassives: [] },
    classAttributes: {
      [classId]: { health: 300, armor: 0, power: 0, crit: 5, pointsAvailable: 0 },
    },
  } as Player;
}

describe('Dartlite starter deck', () => {
  it('starts each run with the class starter deck, not the persistent collection', () => {
    const settings = defaultSettings();
    const players = [makePlayer('p1', 'warrior')];
    const run = startRun(players, settings, true);
    expect(run.cardMode).toBe(true);
    const starter = defaultPlayerCards('warrior');
    expect(run.runPlayers[0].cards).toEqual(starter);
  });

  it('does not pull cards from the player persistent collection', () => {
    const settings = defaultSettings();
    const players = [makePlayer('p1', 'priest')];
    // Simulate a player with an upgraded persistent deck.
    (players[0] as any).cards = {
      priest: defaultPlayerCards('priest').map(c => ({ ...c, upgradeLevel: 5, upgraded: true })),
    };
    const run = startRun(players, settings, true);
    const starter = defaultPlayerCards('priest');
    // Run deck should be the fresh starter, not the upgraded collection.
    expect(run.runPlayers[0].cards).toEqual(starter);
    expect(run.runPlayers[0].cards.every(c => c.upgradeLevel === 0)).toBe(true);
  });

  it('uses the correct starter deck per class', () => {
    const settings = defaultSettings();
    for (const cls of ['warrior', 'priest', 'rogue'] as const) {
      const players = [makePlayer('p1', cls)];
      const run = startRun(players, settings, true);
      expect(run.runPlayers[0].cards).toEqual(defaultPlayerCards(cls));
    }
  });

  it('has no cards in trinket mode', () => {
    const settings = defaultSettings();
    const players = [makePlayer('p1', 'warrior')];
    const run = startRun(players, settings, false);
    expect(run.cardMode).toBe(false);
    expect(run.runPlayers[0].cards).toEqual([]);
  });
});
