import { describe, it, expect } from 'vitest';
import { startRun, beginRound, resolveBattle } from './engine';
import { defaultSettings } from '../constants';
import type { Player } from '../types';

// Regression test for the bug where a party passive granting flat HP (e.g.
// Priest's +60 max HP) inflated partyMaxHp but not the per-player current HP
// used to seed the battle. The party started below full (300/360) and
// resolveBattle treated the missing passive HP as damage already taken, so
// the next round the player lost HP they never actually spent.
function makePlayer(id: string, equippedPassives: string[]): Player {
  return {
    id,
    name: id,
    color: '#ff0000',
    attributes: { health: 300, armor: 0, power: 0, crit: 5, pointsAvailable: 0 },
    coopProgress: { classId: 'priest', unlockedPassives: equippedPassives, equippedPassives },
    classAttributes: {
      priest: { health: 300, armor: 0, power: 0, crit: 5, pointsAvailable: 0 },
    },
  } as Player;
}

describe('passive HP bonus is applied at round start', () => {
  it('party starts at full HP including the passive bonus', () => {
    const settings = defaultSettings();
    const players = [makePlayer('p1', ['pri_hp_1'])]; // +60 max HP
    let run = startRun(players, settings, false);
    run = beginRound(run, players, settings);
    expect(run.round).toBe(1);
    const battle = run.battle!;
    // partyMaxHp = base 300 + passive 60 = 360
    expect(battle.partyMaxHp).toBe(360);
    // partyHp should equal partyMaxHp at round start (full health)
    expect(battle.partyHp).toBe(battle.partyMaxHp);
    // Each battle player's hp should also be full
    expect(battle.players[0].hp).toBe(battle.players[0].maxHp);
    expect(battle.players[0].maxHp).toBe(360);
  });

  it('does not count the passive HP as damage taken after a no-damage round', () => {
    const settings = defaultSettings();
    const players = [makePlayer('p1', ['pri_hp_1'])]; // +60 max HP
    let run = startRun(players, settings, false);
    run = beginRound(run, players, settings);
    expect(run.battle!.partyHp).toBe(run.battle!.partyMaxHp);
    // Win the round without taking any damage.
    run = resolveBattle({ ...run, battle: { ...run.battle!, outcome: 'ongoing' } } as any, true);
    // The run player's HP should be unchanged (300) — the passive bonus must
    // not be deducted as "damage taken".
    expect(run.runPlayers[0].hp).toBe(300);
    expect(run.runPlayers[0].maxHp).toBe(300);
  });

  it('still deducts actual damage taken during the round', () => {
    const settings = defaultSettings();
    const players = [makePlayer('p1', ['pri_hp_1'])]; // +60 max HP
    let run = startRun(players, settings, false);
    run = beginRound(run, players, settings);
    // Simulate 60 damage taken during the battle.
    run = {
      ...run,
      battle: { ...run.battle!, partyHp: run.battle!.partyHp - 60 },
    };
    run = resolveBattle(run, true);
    // 60 actual damage should be deducted from the run player's 300 HP.
    expect(run.runPlayers[0].hp).toBe(240);
  });
});
