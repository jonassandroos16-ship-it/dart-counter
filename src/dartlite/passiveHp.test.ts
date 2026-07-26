import { describe, it, expect } from 'vitest';
import { startRun, beginRound, resolveBattle } from './engine';
import { defaultSettings } from '../constants';
import type { Player } from '../types';

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
  it('team starts at full HP including the passive bonus', () => {
    const settings = defaultSettings();
    const players = [makePlayer('p1', ['pri_hp_1'])];
    let run = startRun(players, settings, false);
    run = beginRound(run, players, settings);
    expect(run.round).toBe(1);
    const battle = run.battle!;
    expect(run.teamMaxHp).toBe(360);
    expect(run.teamHp).toBe(run.teamMaxHp);
    expect(battle.partyMaxHp).toBe(360);
    expect(battle.partyHp).toBe(battle.partyMaxHp);
  });

  it('does not count the passive HP as damage taken after a no-damage round', () => {
    const settings = defaultSettings();
    const players = [makePlayer('p1', ['pri_hp_1'])];
    let run = startRun(players, settings, false);
    run = beginRound(run, players, settings);
    expect(run.battle!.partyHp).toBe(run.battle!.partyMaxHp);
    run = resolveBattle({ ...run, battle: { ...run.battle!, outcome: 'ongoing' } } as any, true);
    expect(run.teamHp).toBe(360);
    expect(run.teamMaxHp).toBe(360);
  });

  it('still deducts actual damage taken during the round', () => {
    const settings = defaultSettings();
    const players = [makePlayer('p1', ['pri_hp_1'])];
    let run = startRun(players, settings, false);
    run = beginRound(run, players, settings);
    run = {
      ...run,
      battle: { ...run.battle!, partyHp: run.battle!.partyHp - 60 },
    };
    run = resolveBattle(run, true);
    expect(run.teamHp).toBe(300);
  });
});
