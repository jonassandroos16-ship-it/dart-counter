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
    run = { ...run, round: 9 };
    run = beginRound(run, players, settings);
    expect(run.round).toBe(10);
    run = resolveBattle({ ...run, battle: { ...run.battle!, outcome: 'ongoing' } } as any, true);
    expect(run.phase).toBe('boss_victory');
    run = applyBossTrinketChoice(run, 'trk_boss_verdant_seed' as any);
    expect(run.teamMaxHp).toBe(680);
    expect(run.runPlayers[0].bonusHealth).toBe(380);

    let next = beginRound(run, players, settings);
    expect(next.round).toBe(11);
    expect(next.battle).not.toBeNull();
    expect(next.battle!.partyMaxHp).toBe(680);
    expect(next.battle!.partyHp).toBe(680);

    next = { ...next, battle: { ...next.battle!, partyHp: 200 } };
    next = resolveBattle(next, true);
    expect(next.phase).toBe('choice');
    expect(next.teamMaxHp).toBe(680);
    expect(next.teamHp).toBe(200);

    const r12 = beginRound(next, players, settings);
    expect(r12.round).toBe(12);
    expect(r12.teamMaxHp).toBe(680);
    expect(r12.battle!.partyMaxHp).toBe(680);
    expect(r12.battle!.partyHp).toBe(200);
  });
});
