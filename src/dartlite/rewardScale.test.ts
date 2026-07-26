import { describe, it, expect } from 'vitest';
import { rewardScale, enemyHpScale } from './roundLogic';
import { startRun, beginRound, resolveBattle, applyBossTrinketChoice } from './engine';
import { applyPlayerChoice } from './choices';
import { defaultSettings } from '../constants';
import type { Player } from '../types';
import type { ChoiceOption } from './engineTypes';

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

describe('rewardScale', () => {
  it('is 1.0 at round 1', () => {
    expect(rewardScale(1)).toBe(1.0);
  });

  it('grows ~10% per round, matching the base enemy HP curve', () => {
    for (const round of [2, 3, 5, 10, 15, 20, 30]) {
      expect(rewardScale(round)).toBeCloseTo(enemyHpScale(round, 2), 5);
    }
  });

  it('caps at 5.0 like enemy HP scaling', () => {
    expect(rewardScale(100)).toBe(5.0);
    expect(rewardScale(1000)).toBe(5.0);
  });

  it('never decreases as rounds advance', () => {
    let prev = rewardScale(1);
    for (let r = 2; r <= 60; r++) {
      const cur = rewardScale(r);
      expect(cur).toBeGreaterThanOrEqual(prev);
      prev = cur;
    }
  });
});

describe('stat reward scales with round', () => {
  it('round-1 stat reward gives base amounts (20 HP / 3 armor / 4 power)', () => {
    const settings = defaultSettings();
    const players = [makePlayer('p1')];
    let run = startRun(players, settings, false);
    run = beginRound(run, players, settings);
    expect(run.round).toBe(1);
    run = resolveBattle({ ...run, battle: { ...run.battle!, outcome: 'ongoing' } } as any, true);
    expect(run.phase).toBe('choice');
    const statOpt = run.pendingChoice!.find((o: ChoiceOption) => o.kind === 'stat')!;
    expect(statOpt.desc).toContain('+20 HP');
    expect(statOpt.desc).toContain('+3% armor');
    expect(statOpt.desc).toContain('+4 power');
  });

  it('round-19 stat reward description reflects scaled amounts', () => {
    const settings = defaultSettings();
    const players = [makePlayer('p1')];
    let run = startRun(players, settings, false);
    run = { ...run, round: 18 };
    run = beginRound(run, players, settings);
    expect(run.round).toBe(19);
    run = resolveBattle({ ...run, battle: { ...run.battle!, outcome: 'ongoing' } } as any, true);
    expect(run.phase).toBe('choice');
    const statOpt = run.pendingChoice!.find((o: ChoiceOption) => o.kind === 'stat')!;
    expect(statOpt.desc).toContain('+56 HP');
    expect(statOpt.desc).toContain('+8% armor');
    expect(statOpt.desc).toContain('+11 power');
  });

  it('applyPlayerChoice applies scaled stat amount at round 19', () => {
    const settings = defaultSettings();
    const players = [makePlayer('p1')];
    let run = startRun(players, settings, false);
    run = { ...run, round: 18 };
    run = beginRound(run, players, settings);
    run = resolveBattle({ ...run, battle: { ...run.battle!, outcome: 'ongoing' } } as any, true);
    const before = run.teamMaxHp;
    const statOpt: ChoiceOption = { kind: 'stat', label: 'Gain a Stat', desc: '', icon: '📊' };
    const orig = Math.random;
    Math.random = () => 0.1;
    try {
      const after = applyPlayerChoice(run, statOpt);
      expect(after.teamMaxHp).toBe(before + 56);
      expect(after.runPlayers[0].bonusHealth).toBe(56);
    } finally {
      Math.random = orig;
    }
  });
});

describe('trinket flat bonuses scale with round', () => {
  it('Sharp Tip grants +5 power at round 1, more at round 20', () => {
    const settings = defaultSettings();
    const players = [makePlayer('p1')];
    let run = startRun(players, settings, false);
    run = { ...run, runPlayers: run.runPlayers.map(rp => ({ ...rp, trinkets: ['trk_sharp_tip'] })), round: 0 };
    run = beginRound(run, players, settings);
    expect(run.round).toBe(1);
    expect(run.battle!.players[0].power).toBe(5);

    run = { ...run, round: 19, runPlayers: run.runPlayers.map(rp => ({ ...rp, power: 0, bonusPower: 0, trinkets: ['trk_sharp_tip'] })) };
    run = beginRound(run, players, settings);
    expect(run.round).toBe(20);
    expect(run.battle!.players[0].power).toBe(Math.round(5 * rewardScale(20)));
  });
});

describe('boss trinket flat bonuses scale with round', () => {
  it('Verdant Seed +200 HP scales by the round the boss was defeated', () => {
    const settings = defaultSettings();
    const players = [makePlayer('p1')];
    let run = startRun(players, settings, false);
    run = { ...run, round: 9 };
    run = beginRound(run, players, settings);
    expect(run.round).toBe(10);
    run = resolveBattle({ ...run, battle: { ...run.battle!, outcome: 'ongoing' } } as any, true);
    expect(run.phase).toBe('boss_victory');
    const before = run.teamMaxHp;
    run = applyBossTrinketChoice(run, 'trk_boss_verdant_seed' as any);
    expect(run.teamMaxHp).toBe(before + Math.round(200 * rewardScale(10)));
  });
});

describe('heal reward includes trinket and passive HP bonuses', () => {
  it('heal amount and description reflect trk_vitality bonus', () => {
    const settings = defaultSettings();
    const players = [makePlayer('p1')];
    let run = startRun(players, settings, false);
    run = {
      ...run,
      runPlayers: run.runPlayers.map(rp => ({ ...rp, trinkets: ['trk_vitality'] })),
      round: 0,
    };
    run = beginRound(run, players, settings);
    expect(run.round).toBe(1);
    run = resolveBattle({ ...run, battle: { ...run.battle!, outcome: 'ongoing' } } as any, true);
    expect(run.phase).toBe('choice');
    const healOpt = run.pendingChoice!.find((o: ChoiceOption) => o.kind === 'heal')!;
    expect(healOpt.amount).toBe(72);
    expect(healOpt.desc).toContain('360');
    expect(healOpt.desc).toContain('72');
  });

  it('heal amount and description reflect party passive HP bonus', () => {
    const settings = defaultSettings();
    const players: Player[] = [{
      ...makePlayer('p1'),
      coopProgress: { classId: 'priest', unlockedPassives: ['pri_hp_1'], equippedPassives: ['pri_hp_1'] },
      classAttributes: { priest: { health: 300, armor: 0, power: 0, crit: 5, pointsAvailable: 0 } },
    } as Player];
    let run = startRun(players, settings, false);
    expect(run.partyPassiveHealth).toBe(60);
    run = beginRound(run, players, settings);
    expect(run.round).toBe(1);
    run = resolveBattle({ ...run, battle: { ...run.battle!, outcome: 'ongoing' } } as any, true);
    expect(run.phase).toBe('choice');
    const healOpt = run.pendingChoice!.find((o: ChoiceOption) => o.kind === 'heal')!;
    expect(healOpt.amount).toBe(72);
    expect(healOpt.desc).toContain('360');
  });

  it('applyPlayerChoice heals based on effective max HP including trinkets', () => {
    const settings = defaultSettings();
    const players = [makePlayer('p1')];
    let run = startRun(players, settings, false);
    run = {
      ...run,
      runPlayers: run.runPlayers.map(rp => ({ ...rp, trinkets: ['trk_vitality'] })),
      round: 0,
    };
    run = beginRound(run, players, settings);
    run = { ...run, teamHp: 100, battle: { ...run.battle!, partyHp: 100 } };
    run = resolveBattle(run, true);
    const healOpt = run.pendingChoice!.find((o: ChoiceOption) => o.kind === 'heal')!;
    const before = run.teamHp;
    const after = applyPlayerChoice(run, healOpt);
    expect(after.teamHp).toBe(before + 72);
  });
});
