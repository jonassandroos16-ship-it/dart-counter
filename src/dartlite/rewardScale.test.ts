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
      // rewardScale tracks the base enemy HP scale (2-player party factor is 1.0).
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
    // Round 1 -> win -> choice phase.
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
    // Jump to round 18 so beginRound advances to 19 (a normal, non-boss round).
    run = { ...run, round: 18 };
    run = beginRound(run, players, settings);
    expect(run.round).toBe(19);
    run = resolveBattle({ ...run, battle: { ...run.battle!, outcome: 'ongoing' } } as any, true);
    expect(run.phase).toBe('choice');
    const statOpt = run.pendingChoice!.find((o: ChoiceOption) => o.kind === 'stat')!;
    // rewardScale(19) = 1 + 18*0.10 = 2.8 -> HP 56, armor 8, power 11 (rounded).
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
    const before = run.runPlayers[0];
    // Force a health stat roll by constructing the option and applying it.
    const statOpt: ChoiceOption = { kind: 'stat', label: 'Gain a Stat', desc: '', icon: '📊' };
    // Stub Math.random to pick health (< 0.4).
    const orig = Math.random;
    Math.random = () => 0.1;
    try {
      const after = applyPlayerChoice(run, statOpt);
      const p = after.runPlayers[0];
      // +56 max HP at round 19 (scale 2.8 -> 56).
      expect(p.maxHp).toBe(before.maxHp + 56);
      expect(p.bonusHealth).toBe(before.bonusHealth + 56);
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
    // Give the player a Sharp Tip trinket.
    run = { ...run, runPlayers: run.runPlayers.map(rp => ({ ...rp, trinkets: ['trk_sharp_tip'] })), round: 0 };
    run = beginRound(run, players, settings);
    expect(run.round).toBe(1);
    // beginRound bakes trinket bonuses into the battle players (pseudoPlayers),
    // not into run.runPlayers. Check the battle player's power.
    expect(run.battle!.players[0].power).toBe(5);

    // Advance to round 20.
    run = { ...run, round: 19, runPlayers: run.runPlayers.map(rp => ({ ...rp, power: 0, bonusPower: 0, trinkets: ['trk_sharp_tip'] })) };
    run = beginRound(run, players, settings);
    expect(run.round).toBe(20);
    // rewardScale(20) = 2.9 -> Math.round(5 * 2.9) = 15 (rounded).
    expect(run.battle!.players[0].power).toBe(Math.round(5 * rewardScale(20)));
  });
});

describe('boss trinket flat bonuses scale with round', () => {
  it('Verdant Seed +200 HP scales by the round the boss was defeated', () => {
    const settings = defaultSettings();
    const players = [makePlayer('p1')];
    let run = startRun(players, settings, false);
    // Force a boss round (round 10).
    run = { ...run, round: 9 };
    run = beginRound(run, players, settings);
    expect(run.round).toBe(10);
    run = resolveBattle({ ...run, battle: { ...run.battle!, outcome: 'ongoing' } } as any, true);
    expect(run.phase).toBe('boss_victory');
    const before = run.runPlayers[0].maxHp;
    run = applyBossTrinketChoice(run, 'trk_boss_verdant_seed' as any);
    // rewardScale(10) = 1 + 9*0.10 = 1.9 -> Math.round(200 * 1.9) = 380.
    expect(run.runPlayers[0].maxHp).toBe(before + Math.round(200 * rewardScale(10)));
  });
});

describe('heal reward includes trinket and passive HP bonuses', () => {
  it('heal amount and description reflect trk_vitality bonus', () => {
    const settings = defaultSettings();
    const players = [makePlayer('p1')];
    let run = startRun(players, settings, false);
    // Give the player a Vitality trinket (+60 max HP at round 1).
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
    // Base 300 + vitality 60 = 360 effective max HP. 20% = 72.
    expect(healOpt.amount).toBe(72);
    expect(healOpt.desc).toContain('360');
    expect(healOpt.desc).toContain('72');
  });

  it('heal amount and description reflect party passive HP bonus', () => {
    const settings = defaultSettings();
    // Priest's pri_hp_1 passive grants +60 max HP.
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
    // Base 300 + passive 60 = 360 effective max HP. 20% = 72.
    expect(healOpt.amount).toBe(72);
    expect(healOpt.desc).toContain('360');
  });

  it('applyPlayerChoice heals based on effective max HP including trinkets', () => {
    const settings = defaultSettings();
    const players = [makePlayer('p1')];
    let run = startRun(players, settings, false);
    run = {
      ...run,
      runPlayers: run.runPlayers.map(rp => ({ ...rp, trinkets: ['trk_vitality'], hp: 100 })),
      round: 0,
    };
    run = beginRound(run, players, settings);
    run = resolveBattle({ ...run, battle: { ...run.battle!, outcome: 'ongoing' } } as any, true);
    const healOpt = run.pendingChoice!.find((o: ChoiceOption) => o.kind === 'heal')!;
    const before = run.runPlayers[0].hp;
    const after = applyPlayerChoice(run, healOpt);
    // 360 effective max * 0.2 = 72 heal, capped at 360.
    expect(after.runPlayers[0].hp).toBe(before + 72);
  });
});
