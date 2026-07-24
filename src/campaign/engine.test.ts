import { describe, it, expect } from 'vitest';
import {
  addDart, computePlayerDartDamage, dartMatchesShield, describeShield, getLevel,
  isLevelUnlocked, prepareEnemyTurn, applyNextEnemyAttack, resolvePlayerVisit,
  setTarget, startBattle, totalLevels, undoDart,
  COOP_POWER_UPS,
  canActivateCoopPowerUp, activateCoopPowerUp,
  isLevelUnlockedForParty, playerCampaignProgress, defaultPlayerCampaignProgress,
  partyAllClearedLevel, partyMissingClearForLevel, recordLevelClearForPlayer,
} from './engine';
import { ENEMY_DATABASE } from './enemyDatabase';
import { CAMPAIGN_LEVELS } from './campaignLevels';
import type { CampaignDart, CoopClassId, CoopPassiveId, ShieldLayer } from './types';
import type { Player } from '../types';
import { defaultSettings } from '../constants';

const dart = (base: number, mult: number): CampaignDart => ({
  value: base === 0 ? 0 : base === 25 ? (mult === 2 ? 50 : 25) : base === 50 ? 50 : base * mult,
  label: base === 0 ? 'Miss' : base === 50 ? 'Bull' : (mult === 2 ? 'D' : mult === 3 ? 'T' : '') + base,
  base,
  mult: base === 50 ? 2 : mult,
  isDouble: base === 50 || mult === 2,
  isBull: base === 25 || base === 50,
});

const makeDartMatching = (shield: ShieldLayer): CampaignDart => {
  if (shield.type === 'span') {
    switch (shield.target_value) {
      case 'TOP_HALF': return dart(20, 1);
      case 'BOTTOM_HALF': return dart(3, 1);
      case 'LEFT_HALF': return dart(11, 1);
      case 'RIGHT_HALF': return dart(6, 1);
      case 'ANY_DOUBLE': return dart(20, 2);
      case 'ANY_TRIPLE': return dart(20, 3);
      case 'ANY_BULL': return dart(25, 1);
    }
    return dart(20, 1);
  }
  const t = shield.target_value as string;
  if (t === 'Bull') return dart(50, 1);
  if (t === '25') return dart(25, 1);
  const m = /^([DT]?)(\d+)$/.exec(t);
  if (!m) return dart(20, 1);
  const mult = m[1] === 'D' ? 2 : m[1] === 'T' ? 3 : 1;
  return dart(Number(m[2]), mult);
};

const settings = defaultSettings();

const makePlayers = (n: number): Player[] => Array.from({ length: n }, (_, i) => ({
  id: `p${i + 1}`,
  name: `Player ${i + 1}`,
  color: '#22c55e',
  attributes: { health: 300, armor: 10, power: 10, crit: 5, pointsAvailable: 0 },
}));

describe('campaign engine', () => {
  it('exposes a linear campaign with a boss finale', () => {
    expect(totalLevels()).toBeGreaterThanOrEqual(5);
    const last = CAMPAIGN_LEVELS.levels[CAMPAIGN_LEVELS.levels.length - 1];
    expect(last.is_boss).toBe(true);
    expect(getLevel(5)).toBeDefined();
  });

  it('unlocks level 1 by default and gates the rest by highest_level_beaten', () => {
    expect(isLevelUnlocked(1, 0)).toBe(true);
    expect(isLevelUnlocked(2, 0)).toBe(false);
    expect(isLevelUnlocked(2, 1)).toBe(true);
    expect(isLevelUnlocked(3, 1)).toBe(false);
    expect(isLevelUnlocked(3, 2)).toBe(true);
  });

  it('startBattle initializes enemies from the level definition', () => {
    const lvl = getLevel(1)!;
    const state = startBattle(lvl, makePlayers(1), settings);
    expect(state.enemies.length).toBe(lvl.enemies.length);
    expect(state.enemies[0].hp).toBe(ENEMY_DATABASE[lvl.enemies[0]].max_hp);
    expect(state.enemies[0].defeated).toBe(false);
    expect(state.phase).toBe('player');
    expect(state.outcome).toBe('ongoing');
  });

  it('addDart applies damage to the targeted enemy and can defeat it', () => {
    const lvl = getLevel(1)!;
    let state = startBattle(lvl, makePlayers(1), settings);
    state = setTarget(state, state.enemies[0].id);
    const enemyHp = state.enemies[0].hp;
    state = addDart(state, 20, 3, undefined, false, settings);
    expect(state.enemies[0].hp).toBe(Math.max(0, enemyHp - 60));
    expect(state.darts.length).toBe(1);
    expect(state.darts[0].label).toBe('T20');
  });

  it('addDart can defeat an enemy and set outcome to victory when all are dead', () => {
    const lvl = getLevel(1)!;
    let state = startBattle(lvl, makePlayers(1), settings);
    state = setTarget(state, state.enemies[0].id);
    state = addDart(state, 50, 1, 'Bull', true, settings);
    state = { ...state, enemies: state.enemies.map(e => ({ ...e, hp: 1 })) };
    state = setTarget(state, state.enemies[0].id);
    state = addDart(state, 20, 3, undefined, false, settings);
    expect(state.enemies.every(e => e.defeated)).toBe(true);
    expect(state.outcome).toBe('victory');
  });

  it('addDart with base 0 (miss) deals no damage and does not charge the orb', () => {
    const lvl = getLevel(1)!;
    let state = startBattle(lvl, makePlayers(1), settings);
    state = setTarget(state, state.enemies[0].id);
    const enemyHp = state.enemies[0].hp;
    state = addDart(state, 0, 1, '0', false, settings);
    expect(state.enemies[0].hp).toBe(enemyHp);
    expect(state.darts[0].label).toBe('0');
    expect(state.powerUpCharge).toBe(0);
  });

  it('undoDart reverts the last dart (damage, charge, dart list)', () => {
    const lvl = getLevel(1)!;
    let state = startBattle(lvl, makePlayers(1), settings);
    state = setTarget(state, state.enemies[0].id);
    const enemyHp = state.enemies[0].hp;
    state = addDart(state, 20, 3, undefined, false, settings);
    expect(state.enemies[0].hp).toBe(Math.max(0, enemyHp - 60));
    state = undoDart(state, settings);
    expect(state.enemies[0].hp).toBe(enemyHp);
    expect(state.darts.length).toBe(0);
  });

  it('undoDart on an empty visit is a no-op', () => {
    const lvl = getLevel(1)!;
    let state = startBattle(lvl, makePlayers(1), settings);
    const before = state;
    state = undoDart(state, settings);
    expect(state).toBe(before);
  });

  it('resolvePlayerVisit advances to the enemy phase', () => {
    const lvl = getLevel(1)!;
    let state = startBattle(lvl, makePlayers(1), settings);
    state = setTarget(state, state.enemies[0].id);
    state = addDart(state, 20, 3, undefined, false, settings);
    state = resolvePlayerVisit(state);
    expect(state.phase).toBe('enemy');
  });

  it('resolvePlayerVisit with no darts is a no-op', () => {
    const lvl = getLevel(1)!;
    let state = startBattle(lvl, makePlayers(1), settings);
    const before = state;
    state = resolvePlayerVisit(state);
    expect(state).toBe(before);
  });

  it('resolvePlayerVisit with hasPlayedCards=true advances even with no darts (utility/spell-only visit)', () => {
    const lvl = getLevel(1)!;
    let state = startBattle(lvl, makePlayers(1), settings);
    state = setTarget(state, state.enemies[0].id);
    state = resolvePlayerVisit(state, true);
    expect(state.phase).toBe('enemy');
  });

  it('resolvePlayerVisit rotates to the next player in a 2-player party', () => {
    const lvl = getLevel(1)!;
    let state = startBattle(lvl, makePlayers(2), settings);
    state = setTarget(state, state.enemies[0].id);
    state = addDart(state, 20, 3, undefined, false, settings);
    state = resolvePlayerVisit(state);
    expect(state.phase).toBe('player');
    expect(state.playerTurnIdx).toBe(1);
  });

  it('computePlayerDartDamage applies power bonus and armor reduction', () => {
    const lvl = getLevel(1)!;
    const state = startBattle(lvl, makePlayers(1), settings);
    const power = state.players[0].power;
    const enemyArmor = state.enemies[0].armor;
    const t20 = dart(20, 3);
    const expected = Math.max(1, Math.round((60 + power) * (1 - enemyArmor / 100)));
    expect(computePlayerDartDamage(t20, power, enemyArmor)).toBe(expected);
  });

  it('crit_guarantee buff forces a critical hit (double flat damage before armor)', () => {
    const lvl = getLevel(1)!;
    let state = startBattle(lvl, makePlayers(1), settings);
    state = setTarget(state, state.enemies[0].id);
    const enemyHp = state.enemies[0].hp;
    const power = state.players[0].power;
    const enemyArmor = state.enemies[0].armor;
    // Add a crit_guarantee buff with 2 charges
    state = {
      ...state,
      players: state.players.map(p => ({
        ...p,
        buffs: [...p.buffs, { id: 'test-crit-g', kind: 'crit_guarantee' as const, amount: 2, turnsLeft: 3, source: p.id }],
      })),
    };
    state = addDart(state, 20, 3, undefined, false, settings);
    const flatDmg = 60 * 2; // crit doubles flat damage
    const expectedDmg = Math.max(1, Math.round((flatDmg + power) * (1 - enemyArmor / 100)));
    expect(state.enemies[0].hp).toBe(Math.max(0, enemyHp - expectedDmg));
    expect(state.resolvedDarts[0].crit).toBe(true);
    expect(state.resolvedDarts[0].critMult).toBe(2);
    // One charge consumed
    const remainingGuarantee = state.players[0].buffs.find(b => b.kind === 'crit_guarantee');
    expect(remainingGuarantee?.amount).toBe(1);
  });

  it('crit_multiplier buff makes crits deal 3x damage instead of 2x', () => {
    const lvl = getLevel(1)!;
    let state = startBattle(lvl, makePlayers(1), settings);
    state = setTarget(state, state.enemies[0].id);
    const enemyHp = state.enemies[0].hp;
    const power = state.players[0].power;
    const enemyArmor = state.enemies[0].armor;
    // Add both crit_guarantee (to force crit) and crit_multiplier (3x)
    state = {
      ...state,
      players: state.players.map(p => ({
        ...p,
        buffs: [
          ...p.buffs,
          { id: 'test-crit-g', kind: 'crit_guarantee' as const, amount: 1, turnsLeft: 3, source: p.id },
          { id: 'test-crit-m', kind: 'crit_multiplier' as const, amount: 3, turnsLeft: 3, source: p.id },
        ],
      })),
    };
    state = addDart(state, 20, 3, undefined, false, settings);
    const flatDmg = 60 * 3; // 3x crit multiplier
    const expectedDmg = Math.max(1, Math.round((flatDmg + power) * (1 - enemyArmor / 100)));
    expect(state.enemies[0].hp).toBe(Math.max(0, enemyHp - expectedDmg));
    expect(state.resolvedDarts[0].crit).toBe(true);
    expect(state.resolvedDarts[0].critMult).toBe(3);
  });

  it('players have a crit attribute from class defaults (rogue > warrior = priest)', () => {
    const lvl = getLevel(1)!;
    const roguePlayers = makePlayers(1).map(p => ({
      ...p,
      coopProgress: { classId: 'rogue' as CoopClassId, xp: 0, unlockedPassives: [], equippedPassives: [] },
    }));
    const warriorPlayers = makePlayers(1).map(p => ({
      ...p,
      coopProgress: { classId: 'warrior' as CoopClassId, xp: 0, unlockedPassives: [], equippedPassives: [] },
    }));
    const priestPlayers = makePlayers(1).map(p => ({
      ...p,
      coopProgress: { classId: 'priest' as CoopClassId, xp: 0, unlockedPassives: [], equippedPassives: [] },
    }));
    const rogueState = startBattle(lvl, roguePlayers, settings);
    const warriorState = startBattle(lvl, warriorPlayers, settings);
    const priestState = startBattle(lvl, priestPlayers, settings);
    expect(rogueState.players[0].crit).toBeGreaterThan(warriorState.players[0].crit);
    expect(warriorState.players[0].crit).toBeGreaterThanOrEqual(priestState.players[0].crit);
  });

  it('dartMatchesShield returns true when the dart matches a shield segment', () => {
    const lvl = getLevel(1)!;
    const state = startBattle(lvl, makePlayers(1), settings);
    const enemy = state.enemies[0];
    if (enemy.shields.length === 0) return;
    const shield = enemy.shields[0];
    const d = makeDartMatching(shield);
    expect(dartMatchesShield(d, shield)).toBe(true);
  });

  it('describeShield returns a human-readable description of the shields', () => {
    const lvl = getLevel(1)!;
    const state = startBattle(lvl, makePlayers(1), settings);
    const shields = state.enemies[0].shields;
    if (shields.length === 0) return;
    const desc = describeShield(shields[0]);
    expect(typeof desc).toBe('string');
    expect(desc.length).toBeGreaterThan(0);
  });

  it('prepareEnemyTurn produces attack steps for each alive enemy', () => {
    const lvl = getLevel(1)!;
    let state = startBattle(lvl, makePlayers(1), settings);
    state = setTarget(state, state.enemies[0].id);
    state = addDart(state, 20, 3, undefined, false, settings);
    state = resolvePlayerVisit(state);
    const prepared = prepareEnemyTurn(state, () => 0.99);
    expect(prepared.pendingEnemyAttacks.length).toBeGreaterThan(0);
    expect(prepared.phase).toBe('enemy');
  });

  it('applyNextEnemyAttack applies damage and can defeat the party', () => {
    const lvl = getLevel(1)!;
    let state = startBattle(lvl, makePlayers(1), settings);
    state = setTarget(state, state.enemies[0].id);
    state = addDart(state, 20, 3, undefined, false, settings);
    state = resolvePlayerVisit(state);
    const prepared = prepareEnemyTurn(state, () => 0.99);
    let applied = prepared;
    while (applied.pendingEnemyAttacks.length) applied = applyNextEnemyAttack(applied);
    expect(applied.phase).toBe('player');
    expect(applied.outcome === 'ongoing' || applied.outcome === 'defeat').toBe(true);
  });

  it('enemy phase: party HP at 0 after attacks triggers defeat', () => {
    const lvl = getLevel(1)!;
    let state = startBattle(lvl, makePlayers(1), settings);
    state = { ...state, partyHp: 1 };
    state = setTarget(state, state.enemies[0].id);
    state = addDart(state, 20, 3, undefined, false, settings);
    state = resolvePlayerVisit(state);
    const prepared = prepareEnemyTurn(state, () => 0.99);
    let applied = prepared;
    while (applied.pendingEnemyAttacks.length && applied.outcome === 'ongoing') applied = applyNextEnemyAttack(applied);
    expect(applied.outcome).toBe('defeat');
  });

  it('coop power-ups: heal restores party HP and consumes charge', () => {
    const lvl = getLevel(1)!;
    const state = startBattle(lvl, makePlayers(1), settings);
    const damaged = { ...state, partyHp: state.partyMaxHp - 100, powerUpCharge: 100, players: state.players.map(p => ({ ...p, powerUpCharge: 100 })) };
    expect(canActivateCoopPowerUp(damaged, 'coop_heal')).toBe(true);
    const after = activateCoopPowerUp(damaged, 'coop_heal');
    expect(after.partyHp).toBe(state.partyMaxHp - 100 + 80);
    expect(after.powerUpCharge).toBe(0);
    expect(after.players[0].powerUpCharge).toBe(0);
  });

  it('coop power-ups: freeze sets frozenTurns on all alive enemies', () => {
    const lvl = getLevel(1)!;
    const state = startBattle(lvl, makePlayers(1), settings);
    const charged = { ...state, powerUpCharge: 100, players: state.players.map(p => ({ ...p, powerUpCharge: 100 })) };
    const after = activateCoopPowerUp(charged, 'coop_freeze');
    expect(after.enemies.every(e => e.defeated || e.frozenTurns === 2)).toBe(true);
    const enemyPhase = { ...after, phase: 'enemy' as const };
    const prepared = prepareEnemyTurn(enemyPhase, () => 0.99);
    expect(prepared.pendingEnemyAttacks.length).toBe(0);
    expect(prepared.enemies.every(e => e.frozenTurns === 1)).toBe(true);
  });

  it('coop power-ups: killing the last enemy with an ability ends the battle (victory)', () => {
    const lvl = getLevel(1)!;
    const state = startBattle(lvl, makePlayers(1), settings);
    const wounded = {
      ...state,
      enemies: state.enemies.map(e => ({ ...e, hp: 1 })),
      powerUpCharge: 100,
      players: state.players.map(p => ({ ...p, powerUpCharge: 100 })),
    };
    expect(canActivateCoopPowerUp(wounded, 'coop_meteor')).toBe(true);
    const after = activateCoopPowerUp(wounded, 'coop_meteor');
    expect(after.enemies.every(e => e.defeated)).toBe(true);
    expect(after.outcome).toBe('victory');
    expect(after.stats.enemiesDefeated).toBe(state.enemies.length);
  });

  it('coop power-ups: ice_lance killing the last targeted enemy ends the battle', () => {
    const lvl = getLevel(1)!;
    const state = startBattle(lvl, makePlayers(1), settings);
    const firstAliveIdx = state.enemies.findIndex(e => !e.defeated);
    const wounded = {
      ...state,
      enemies: state.enemies.map((e, i) => i === firstAliveIdx ? { ...e, hp: 1 } : { ...e, hp: 0, defeated: true }),
      targetIdx: firstAliveIdx,
      powerUpCharge: 100,
      players: state.players.map(p => ({ ...p, powerUpCharge: 100 })),
    };
    const after = activateCoopPowerUp(wounded, 'coop_ice_lance');
    expect(after.enemies.every(e => e.defeated)).toBe(true);
    expect(after.outcome).toBe('victory');
  });

  it('coop power-ups: buff_power adds a power buff to every player', () => {
    const lvl = getLevel(1)!;
    const state = startBattle(lvl, makePlayers(2), settings);
    const charged = { ...state, powerUpCharge: 80, players: state.players.map(p => ({ ...p, powerUpCharge: 80 })) };
    const after = activateCoopPowerUp(charged, 'coop_buff_power');
    expect(after.players.every(p => p.buffs.some(b => b.kind === 'power' && b.amount === 10 && b.turnsLeft === 3))).toBe(true);
  });

  it('coop power-ups: buff_acc distracts all alive enemies (-accuracy/-precision for 3 turns)', () => {
    const lvl = getLevel(1)!;
    const state = startBattle(lvl, makePlayers(1), settings);
    const charged = { ...state, powerUpCharge: 80, players: state.players.map(p => ({ ...p, powerUpCharge: 80 })) };
    const after = activateCoopPowerUp(charged, 'coop_buff_acc');
    expect(after.players.every(p => p.buffs.length === 0)).toBe(true);
    expect(after.enemies.every(e => e.defeated || (e.distractedTurns === 3 && e.distractAmount === 0.2))).toBe(true);
    const enemyPhase = { ...after, phase: 'enemy' as const };
    const prepared = prepareEnemyTurn(enemyPhase, () => 0.5);
    expect(prepared.pendingEnemyAttacks.length).toBeGreaterThan(0);
    let applied = prepared;
    while (applied.pendingEnemyAttacks.length) applied = applyNextEnemyAttack(applied);
    expect(applied.enemies.every(e => e.defeated || e.distractedTurns === 2)).toBe(true);
  });

  it('enemy database ships with the boss warlord_malakar', () => {
    expect(ENEMY_DATABASE.warlord_malakar.difficulty).toBe('Boss');
    expect(ENEMY_DATABASE.warlord_malakar.shields.length).toBeGreaterThan(0);
  });

  it('ships coop power-ups: heal, buff_power, buff_acc, freeze, shield', () => {
    const ids = COOP_POWER_UPS.map(p => p.id);
    expect(ids).toContain('coop_heal');
    expect(ids).toContain('coop_buff_power');
    expect(ids).toContain('coop_buff_acc');
    expect(ids).toContain('coop_freeze');
    expect(ids).toContain('coop_shield');
  });

  it('coop power-up orb charges as darts are thrown', () => {
    const lvl = getLevel(1)!;
    const state = startBattle(lvl, makePlayers(1), settings);
    expect(state.powerUpCharge).toBe(0);
    let s = addDart(state, 20, 3, undefined, false, settings);
    expect(s.powerUpCharge).toBe(15);
    s = addDart(s, 50, 1, 'Bull', true, settings);
    expect(s.powerUpCharge).toBeCloseTo(32.5, 5);
    s = undoDart(s, settings);
    expect(s.powerUpCharge).toBe(15);
  });

  it('coop power-up orb charge is capped at chargeMax', () => {
    const lvl = getLevel(1)!;
    const state = startBattle(lvl, makePlayers(1), settings);
    const near = { ...state, powerUpCharge: 95, players: state.players.map(p => ({ ...p, powerUpCharge: 95 })) };
    const s = addDart(near, 50, 1, 'Bull', true, settings);
    expect(s.powerUpCharge).toBe(settings.powerUpScaling.chargeMax);
    expect(s.players[0].powerUpCharge).toBe(settings.powerUpScaling.chargeMax);
  });

  it('coop power-up starts partially charged when configured for the equipped power-up', () => {
    const lvl = getLevel(1)!;
    const players = makePlayers(1).map(p => ({
      ...p,
      powerUps: { unlocked: [], active: null, pointsAvailable: 0, coopUnlocked: ['coop_heal'], coopActive: 'coop_heal' as any },
    }));
    const cfg = { ...settings, powerUpScaling: { ...settings.powerUpScaling, startingCharge: { coop_heal: 50 } } };
    const state = startBattle(lvl, players, cfg);
    expect(state.powerUpCharge).toBe(50);
  });

  it('coop power-up starts at 0 when no coop power-up is equipped', () => {
    const lvl = getLevel(1)!;
    const cfg = { ...settings, powerUpScaling: { ...settings.powerUpScaling, startingCharge: { coop_heal: 50 } } };
    const state = startBattle(lvl, makePlayers(1), cfg);
    expect(state.powerUpCharge).toBe(0);
  });

  it('per-player charge: dart thrown by player 1 does not charge player 2 orb', () => {
    const lvl = getLevel(1)!;
    const state = startBattle(lvl, makePlayers(2), settings);
    expect(state.players[0].powerUpCharge).toBe(0);
    expect(state.players[1].powerUpCharge).toBe(0);
    let s = addDart(state, 20, 3, undefined, false, settings);
    expect(s.players[0].powerUpCharge).toBe(15);
    expect(s.players[1].powerUpCharge).toBe(0);
  });

  it('per-player charge: using a skill only consumes the thrower charge', () => {
    const lvl = getLevel(1)!;
    const state = startBattle(lvl, makePlayers(2), settings);
    const charged = { ...state, players: state.players.map(p => ({ ...p, powerUpCharge: 100 })), powerUpCharge: 100 };
    const after = activateCoopPowerUp(charged, 'coop_freeze');
    expect(after.players[0].powerUpCharge).toBe(0);
    expect(after.players[1].powerUpCharge).toBe(100);
  });

  it('passive bonus: warrior starter grants party +3 power', () => {
    const lvl = getLevel(1)!;
    const players = makePlayers(1).map(p => ({
      ...p,
      coopProgress: { classId: 'warrior' as CoopClassId, xp: 0, unlockedPassives: ['war_power_1'] as CoopPassiveId[], equippedPassives: ['war_power_1'] as CoopPassiveId[] },
    }));
    const state = startBattle(lvl, players, settings);
    expect(state.players[0].power).toBe(10 + 3);
    expect(state.passiveBonus?.power).toBe(3);
  });

  it('passive bonus: priest tier 3 grants party +300 max HP (capped at healthMax)', () => {
    const lvl = getLevel(1)!;
    const players = makePlayers(1).map(p => ({
      ...p,
      attributes: { health: 100, armor: 0, power: 0, crit: 5, pointsAvailable: 0 },
      coopProgress: { classId: 'priest' as CoopClassId, xp: 200, unlockedPassives: ['pri_hp_1', 'pri_hp_2', 'pri_hp_3'] as CoopPassiveId[], equippedPassives: ['pri_hp_3'] as CoopPassiveId[] },
    }));
    const state = startBattle(lvl, players, settings);
    expect(state.players[0].maxHp).toBe(400);
    expect(state.passiveBonus?.health).toBe(300);
  });

  it('passive bonus: duplicate priests stack — pri_hp_1 applies once per player', () => {
    const lvl = getLevel(1)!;
    const players = makePlayers(3).map(p => ({
      ...p,
      attributes: { health: 100, armor: 0, power: 0, crit: 5, pointsAvailable: 0 },
      coopProgress: { classId: 'priest' as CoopClassId, xp: 0, unlockedPassives: ['pri_hp_1'] as CoopPassiveId[], equippedPassives: ['pri_hp_1'] as CoopPassiveId[] },
    }));
    const state = startBattle(lvl, players, settings);
    expect(state.passiveBonus?.health).toBe(180);
    expect(state.passiveBonus?.sources).toHaveLength(3);
    for (const p of state.players) {
      expect(p.maxHp).toBe(280);
    }
  });

  it('passive bonus: distinct priest tiers each apply once per player', () => {
    const lvl = getLevel(1)!;
    const tiers: CoopPassiveId[] = ['pri_hp_1', 'pri_hp_2', 'pri_hp_3'];
    const players = makePlayers(3).map((p, i) => ({
      ...p,
      attributes: { health: 100, armor: 0, power: 0, crit: 5, pointsAvailable: 0 },
      coopProgress: { classId: 'priest' as CoopClassId, xp: 200, unlockedPassives: tiers, equippedPassives: [tiers[i]] as CoopPassiveId[] },
    }));
    const state = startBattle(lvl, players, settings);
    expect(state.passiveBonus?.health).toBe(510);
    expect(state.passiveBonus?.sources).toHaveLength(3);
  });

  it('passive bonus: 2 priests + 1 rogue stack Priest, Priest and Rogue bonuses', () => {
    const lvl = getLevel(1)!;
    const players = makePlayers(3).map((p, i) => ({
      ...p,
      attributes: { health: 100, armor: 0, power: 0, crit: 5, pointsAvailable: 0 },
      coopProgress: i < 2
        ? { classId: 'priest' as CoopClassId, xp: 0, unlockedPassives: ['pri_hp_1'] as CoopPassiveId[], equippedPassives: ['pri_hp_1'] as CoopPassiveId[] }
        : { classId: 'rogue' as CoopClassId, xp: 0, unlockedPassives: ['rog_armor_1'] as CoopPassiveId[], equippedPassives: ['rog_armor_1'] as CoopPassiveId[] },
    }));
    const state = startBattle(lvl, players, settings);
    expect(state.passiveBonus?.health).toBe(120);
    expect(state.passiveBonus?.armor).toBe(2);
    expect(state.passiveBonus?.sources).toHaveLength(3);
  });

  it('party HP includes the FULL priest bonus on top of the averaged base (not divided by player count)', () => {
    const lvl = getLevel(1)!;
    const players = makePlayers(2).map(p => ({
      ...p,
      attributes: { health: 400, armor: 0, power: 0, crit: 5, pointsAvailable: 0 },
      coopProgress: { classId: 'priest' as CoopClassId, xp: 0, unlockedPassives: ['pri_hp_1'] as CoopPassiveId[], equippedPassives: ['pri_hp_1'] as CoopPassiveId[] },
    }));
    const state = startBattle(lvl, players, settings);
    expect(state.passiveBonus?.health).toBe(120);
    expect(state.partyMaxHp).toBe(520);
    expect(state.partyHp).toBe(520);
  });

  it('party HP priest bonus is NOT capped by the base healthMax (priest pushes past the cap)', () => {
    const lvl = getLevel(1)!;
    const players = makePlayers(2).map(p => ({
      ...p,
      attributes: { health: 1000, armor: 0, power: 0, crit: 5, pointsAvailable: 0 },
      coopProgress: { classId: 'priest' as CoopClassId, xp: 200, unlockedPassives: ['pri_hp_3'] as CoopPassiveId[], equippedPassives: ['pri_hp_3'] as CoopPassiveId[] },
    }));
    const state = startBattle(lvl, players, settings);
    expect(state.passiveBonus?.health).toBe(600);
    expect(state.partyMaxHp).toBe(1600);
  });

  it('solo player still gets the full priest bonus (no averaging divide)', () => {
    const lvl = getLevel(1)!;
    const players = makePlayers(1).map(p => ({
      ...p,
      attributes: { health: 100, armor: 0, power: 0, crit: 5, pointsAvailable: 0 },
      coopProgress: { classId: 'priest' as CoopClassId, xp: 200, unlockedPassives: ['pri_hp_3'] as CoopPassiveId[], equippedPassives: ['pri_hp_3'] as CoopPassiveId[] },
    }));
    const state = startBattle(lvl, players, settings);
    expect(state.partyMaxHp).toBe(400);
  });

  it('defaultPlayerCampaignProgress returns empty progress', () => {
    const p = defaultPlayerCampaignProgress();
    expect(p.highest_level_beaten).toBe(0);
    expect(p.unlockedPowerUps).toEqual([]);
    expect(p.chapters).toEqual({});
  });

  it('playerCampaignProgress falls back to defaults for a player with no progress', () => {
    const p: Player = { ...makePlayers(1)[0] };
    expect(playerCampaignProgress(p).highest_level_beaten).toBe(0);
    expect(playerCampaignProgress(null).chapters).toEqual({});
  });

  it('recordLevelClearForPlayer updates chapters and unlockedPowerUps per player', () => {
    const p: Player = { ...makePlayers(1)[0] };
    const after1 = recordLevelClearForPlayer(p, 'crimson_vale', 0, 1, 'coop_meteor');
    expect(after1.chapters?.crimson_vale).toBe(1);
    expect(after1.unlockedPowerUps).toContain('coop_meteor');
    expect(after1.highest_level_beaten).toBe(1);
    const after1b = recordLevelClearForPlayer({ ...p, campaignProgress: after1 }, 'crimson_vale', 0, 1, 'coop_meteor');
    expect(after1b.unlockedPowerUps?.length).toBe(1);
    const after2 = recordLevelClearForPlayer({ ...p, campaignProgress: after1 }, 'crimson_vale', 1, 2, 'coop_phantom');
    expect(after2.chapters?.crimson_vale).toBe(2);
    expect(after2.unlockedPowerUps).toContain('coop_phantom');
    expect(after2.highest_level_beaten).toBe(2);
  });

  it('partyAllClearedLevel is true only when every party member has cleared', () => {
    const base = makePlayers(2);
    const p1: Player = { ...base[0], campaignProgress: { highest_level_beaten: 1, unlockedPowerUps: [], chapters: { crimson_vale: 1 } } };
    const p2: Player = { ...base[1], campaignProgress: { highest_level_beaten: 0, unlockedPowerUps: [], chapters: {} } };
    expect(partyAllClearedLevel([p1], 'crimson_vale', 0)).toBe(true);
    expect(partyAllClearedLevel([p1, p2], 'crimson_vale', 0)).toBe(false);
    const p2Cleared: Player = { ...p2, campaignProgress: { highest_level_beaten: 1, unlockedPowerUps: [], chapters: { crimson_vale: 1 } } };
    expect(partyAllClearedLevel([p1, p2Cleared], 'crimson_vale', 0)).toBe(true);
  });

  it('partyMissingClearForLevel lists names of members who have not cleared', () => {
    const base = makePlayers(2);
    const p1: Player = { ...base[0], name: 'Alice', campaignProgress: { highest_level_beaten: 1, unlockedPowerUps: [], chapters: { crimson_vale: 1 } } };
    const p2: Player = { ...base[1], name: 'Bob', campaignProgress: { highest_level_beaten: 0, unlockedPowerUps: [], chapters: {} } };
    expect(partyMissingClearForLevel([p1, p2], 'crimson_vale', 0)).toEqual(['Bob']);
    expect(partyMissingClearForLevel([p1], 'crimson_vale', 0)).toEqual([]);
  });

  it('isLevelUnlockedForParty unlocks if ANY party member has cleared the previous level', () => {
    const base = makePlayers(2);
    const p1: Player = { ...base[0], campaignProgress: { highest_level_beaten: 1, unlockedPowerUps: [], chapters: { crimson_vale: 1 } } };
    const p2: Player = { ...base[1], campaignProgress: { highest_level_beaten: 0, unlockedPowerUps: [], chapters: {} } };
    expect(isLevelUnlockedForParty('crimson_vale', 1, [p1, p2])).toBe(true);
    expect(isLevelUnlockedForParty('crimson_vale', 2, [p1, p2])).toBe(true);
    expect(isLevelUnlockedForParty('crimson_vale', 3, [p1, p2])).toBe(false);
    expect(isLevelUnlockedForParty('crimson_vale', 2, [])).toBe(false);
  });
});
