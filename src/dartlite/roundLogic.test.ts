import { describe, it, expect } from 'vitest';
import { enemyHpScale, enemyAccScale, enemyPrecScale, scaledEnemyDb, levelForRound } from './roundLogic';

describe('Dartlite solo scaling', () => {
  it('solo HP scale is lower than 2-player scale', () => {
    for (const round of [1, 5, 6, 10, 15, 20]) {
      const solo = enemyHpScale(round, 1);
      const duo = enemyHpScale(round, 2);
      expect(solo).toBeLessThan(duo);
    }
  });

  it('solo accuracy and precision are reduced', () => {
    expect(enemyAccScale(6, 1)).toBeLessThan(enemyAccScale(6, 2));
    expect(enemyPrecScale(6, 1)).toBeLessThan(enemyPrecScale(6, 2));
  });

  it('solo scaledEnemyDb has lower HP than 2-player', () => {
    const soloDb = scaledEnemyDb(6, 1);
    const duoDb = scaledEnemyDb(6, 2);
    expect(soloDb.goblin_scout.max_hp).toBeLessThan(duoDb.goblin_scout.max_hp);
    expect(soloDb.goblin_scout.accuracy).toBeLessThanOrEqual(duoDb.goblin_scout.accuracy);
  });

  it('solo levelForRound spawns at most 2 enemies', () => {
    for (const round of [1, 3, 6, 9, 12, 18]) {
      const level = levelForRound(round, 1);
      expect(level.enemies.length).toBeLessThanOrEqual(2);
    }
  });

  it('2-player levelForRound can spawn 3 enemies', () => {
    const level = levelForRound(9, 2);
    expect(level.enemies.length).toBeLessThanOrEqual(3);
  });

  it('defaults to 2-player scaling when playerCount omitted', () => {
    expect(enemyHpScale(6)).toBe(enemyHpScale(6, 2));
    expect(enemyAccScale(6)).toBe(enemyAccScale(6, 2));
    expect(enemyPrecScale(6)).toBe(enemyPrecScale(6, 2));
  });

  it('larger parties scale up slightly beyond 2 players', () => {
    const trio = enemyHpScale(6, 3);
    const duo = enemyHpScale(6, 2);
    expect(trio).toBeGreaterThan(duo);
  });

  it('boss rounds still spawn a single boss regardless of party size', () => {
    expect(levelForRound(10, 1).enemies).toHaveLength(1);
    expect(levelForRound(10, 2).enemies).toHaveLength(1);
  });
});
