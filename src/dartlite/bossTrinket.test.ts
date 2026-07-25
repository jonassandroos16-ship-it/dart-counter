import { describe, it, expect } from 'vitest';
import { startRun, beginRound, resolveBattle, applyBossTrinketChoice } from './engine';
import { defaultSettings } from '../constants';
import type { Player } from '../types';

function makePlayer(id: string): Player {
  return {
    id,
    name: id,
    color: '#ff0000',
    attributes: { health: 300, armor: 0, power: 0, crit: 5, pointsAvailable: 0 },
    coopProgress: { classId: 'warrior', unlockedPassives: [], equippedPassives: [] },
    classAttributes: {
      warrior: { health: 300, armor: 0, power: 0, crit: 5, pointsAvailable: 0 },
    },
  } as Player;
}

describe('boss trinket maxHp boost persists across rounds', () => {
  it('verdant seed +200 maxHp is active in the round after the boss is defeated', () => {
    const settings = defaultSettings();
    const players = [makePlayer('p1')];
    let run = startRun(players, settings, false);
    // Force a boss round (round 10).
    run = { ...run, round: 9 };
    run = beginRound(run, players, settings);
    expect(run.round).toBe(10);
    // Simulate winning the boss battle.
    run = resolveBattle({ ...run, battle: { ...run.battle!, outcome: 'ongoing' } } as any, true);
    expect(run.phase).toBe('boss_victory');
    // Choose the verdant seed boss trinket (+200 maxHp).
    run = applyBossTrinketChoice(run, 'trk_boss_verdant_seed' as any);
    expect(run.runPlayers[0].maxHp).toBe(500); // 300 + 200
    expect(run.runPlayers[0].bonusHealth).toBe(200);

    // Begin the next round (round 11). The boss trinket boost must still be active.
    let next = beginRound(run, players, settings);
    expect(next.round).toBe(11);
    expect(next.battle).not.toBeNull();
    // The shared party HP pool must reflect the +200 boost.
    expect(next.battle!.partyMaxHp).toBe(500);
    expect(next.battle!.partyHp).toBe(500);

    // Simulate taking damage during round 11, then winning. Damage taken
    // must persist (no full-heal between non-boss rounds); only the maxHp
    // boost should carry forward.
    next = { ...next, battle: { ...next.battle!, partyHp: 200 } };
    next = resolveBattle(next, true);
    expect(next.phase).toBe('choice');
    // After a non-boss round, maxHp must still be 500.
    expect(next.runPlayers[0].maxHp).toBe(500);
    // Damage taken (500 -> 200) must persist onto the run player.
    expect(next.runPlayers[0].hp).toBe(200);

    // Begin round 12 — boost must STILL be active. The party HP pool
    // starts at the player's current HP (200), not maxHp.
    const r12 = beginRound(next, players, settings);
    expect(r12.round).toBe(12);
    expect(r12.runPlayers[0].maxHp).toBe(500);
    expect(r12.battle!.partyMaxHp).toBe(200);
    expect(r12.battle!.partyHp).toBe(200);
  });
});
