import { describe, it, expect } from 'vitest';
import {
  addDart, computePlayerDartDamage, dartMatchesShield, describeShield, getLevel,
  isLevelUnlocked, prepareEnemyTurn, applyNextEnemyAttack, resolvePlayerVisit,
  setTarget, startBattle, totalLevels, undoDart,
  partyMaxHpFor, partyArmorFor, partyPowerFor, COOP_POWER_UPS,
  canActivateCoopPowerUp, activateCoopPowerUp,
} from './engine';
import { ENEMY_DATABASE } from './enemyDatabase';
import { CAMPAIGN_LEVELS } from './campaignLevels';
import type { CampaignDart } from './types';
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

const settings = defaultSettings();

const makePlayers = (n: number): Player[] => Array.from({ length: n }, (_, i) => ({
  id: `p${i + 1}`,
  name: `Player ${i + 1}`,
  color: '#22c55e',
  attributes: { health: 300, armor: 10, power: 10, pointsAvailable: 0 },
}));

describe('campaign engine', () => {
  it('exposes a linear campaign with a boss finale', () => {
    expect(totalLevels()).toBeGreaterThanOrEqual(5);
    const last = CAMPAIGN_LEVELS.levels[CAMPAIGN_LEVELS.levels.length - 1];
    expect(last.is_boss).toBe(true);
    expect(getLevel(last.level_id)).toBe(last);
  });

  it('unlocks level 1 by default and gates the rest by highest beaten', () => {
    expect(isLevelUnlocked(1, 0)).toBe(true);
    expect(isLevelUnlocked(2, 0)).toBe(false);
    expect(isLevelUnlocked(2, 1)).toBe(true);
    expect(isLevelUnlocked(5, 4)).toBe(true);
    expect(isLevelUnlocked(6, 4)).toBe(false);
  });

  it('party HP is the sum of selected players health (not capped)', () => {
    const players = makePlayers(2);
    expect(partyMaxHpFor(players, settings)).toBe(600); // 300 + 300, no cap
    const onePlayer: Player[] = [{ ...players[0], attributes: { health: 300, armor: 0, power: 0, pointsAvailable: 0 } }];
    expect(partyMaxHpFor(onePlayer, settings)).toBe(300);
  });

  it('party armor and power are averaged so adding players cannot exceed the cap', () => {
    const players = makePlayers(2); // each has armor 10, power 10
    expect(partyArmorFor(players, settings)).toBe(10); // (10+10)/2 = 10
    expect(partyPowerFor(players, settings)).toBe(10);
    // Three players with armor 25 each — average 25, at cap.
    const heavy: Player[] = Array.from({ length: 3 }, () => ({ ...players[0], attributes: { health: 300, armor: 25, power: 25, pointsAvailable: 0 } }));
    expect(partyArmorFor(heavy, settings)).toBe(25); // capped at armorMax=25
    expect(partyPowerFor(heavy, settings)).toBe(25); // capped at powerMax=30
  });

  it('starts a battle with party HP equal to combined player health', () => {
    const lvl = getLevel(1)!;
    const players = makePlayers(2);
    const state = startBattle(lvl, players, settings);
    expect(state.partyMaxHp).toBe(600); // 300 + 300, summed (no cap)
    expect(state.partyHp).toBe(600);
    expect(state.players.length).toBe(2);
    expect(state.playerTurnIdx).toBe(0);
    expect(state.phase).toBe('player');
  });

  it('breaks a span shield with a top-half dart and deals 0 damage', () => {
    const lvl = getLevel(4)!; // Raider Crossing — orc_raider has TOP_HALF shield
    const state = startBattle(lvl, makePlayers(1), settings);
    const orc = state.enemies.find(e => e.defId === 'orc_raider')!;
    const orcIdx = state.enemies.findIndex(e => e.id === orc.id);
    const targeted = setTarget(state, orc.id);
    expect(targeted.targetIdx).toBe(orcIdx);
    // Each dart is resolved immediately as it is thrown.
    let s = addDart(targeted, 20, 3);
    expect(s.resolvedDarts.length).toBe(1);
    expect(s.resolvedDarts[0].kind).toBe('shield_break');
    s = addDart(s, 20, 3);
    s = addDart(s, 20, 3);
    expect(s.resolvedDarts.length).toBe(3);
    const resolvedOrc = s.enemies.find(e => e.id === orc.id)!;
    expect(resolvedOrc.shields.length).toBe(0);
    // First dart broke the shield (0 dmg). The remaining two darts deal damage.
    // T20 = 60, power 10 → 70 - 5 armor = 65 each. Two darts → 130.
    expect(resolvedOrc.hp).toBe(orc.maxHp - 130);
  });

  it('absorbs non-matching darts into the shield (0 damage)', () => {
    const lvl = getLevel(4)!;
    const state = startBattle(lvl, makePlayers(1), settings);
    const orc = state.enemies.find(e => e.defId === 'orc_raider')!;
    const targeted = setTarget(state, orc.id);
    let s = addDart(targeted, 10, 3);
    s = addDart(s, 10, 3);
    s = addDart(s, 10, 3);
    const resolvedOrc = s.enemies.find(e => e.id === orc.id)!;
    expect(resolvedOrc.shields.length).toBe(1); // shield still up
    expect(resolvedOrc.hp).toBe(orc.maxHp); // no damage
  });

  it('matches exact shield targets like D20 and T15', () => {
    const shield = { type: 'exact' as const, target_value: 'D20' };
    expect(dartMatchesShield(dart(20, 2), shield)).toBe(true);
    expect(dartMatchesShield(dart(20, 1), shield)).toBe(false);
    expect(dartMatchesShield(dart(20, 3), shield)).toBe(false);
    const t15 = { type: 'exact' as const, target_value: 'T15' };
    expect(dartMatchesShield(dart(15, 3), t15)).toBe(true);
    expect(dartMatchesShield(dart(15, 2), t15)).toBe(false);
    const bull = { type: 'exact' as const, target_value: 'Bull' };
    expect(dartMatchesShield(dart(50, 2), bull)).toBe(true);
  });

  it('describes shields in human-readable form', () => {
    expect(describeShield({ type: 'span', target_value: 'TOP_HALF' })).toBe('Top Half');
    expect(describeShield({ type: 'span', target_value: 'ANY_DOUBLE' })).toBe('Any Double');
    expect(describeShield({ type: 'exact', target_value: 'D20' })).toBe('Double 20');
    expect(describeShield({ type: 'exact', target_value: 'T15' })).toBe('Triple 15');
    expect(describeShield({ type: 'exact', target_value: 'Bull' })).toBe('Bullseye');
  });

  it('computes player dart damage with armor mitigation and min 1 on hit', () => {
    expect(computePlayerDartDamage(dart(20, 3), 0, 5)).toBe(55); // 60 - 5
    expect(computePlayerDartDamage(dart(20, 1), 0, 25)).toBe(1); // clamped to min 1
    expect(computePlayerDartDamage(dart(0, 1), 0, 0)).toBe(0); // miss
  });

  it('runs the enemy turn dart-by-dart and deducts party HP', () => {
    const lvl = getLevel(1)!;
    const state = startBattle(lvl, makePlayers(1), settings);
    const enemyPhase = { ...state, phase: 'enemy' as const };
    const prepared = prepareEnemyTurn(enemyPhase, () => 0.99);
    expect(prepared.pendingEnemyAttacks.length).toBeGreaterThan(0);
    let applied = prepared;
    while (applied.pendingEnemyAttacks.length) applied = applyNextEnemyAttack(applied);
    expect(applied.phase).toBe('player');
    expect(applied.partyHp).toBeLessThan(applied.partyMaxHp);
    expect(applied.visitNumber).toBe(2);
  });

  it('marks the battle as defeat when party HP hits 0', () => {
    const lvl = getLevel(1)!;
    const state = startBattle(lvl, makePlayers(1), settings);
    const tiny = { ...state, partyHp: 5, partyMaxHp: 5 };
    const enemyPhase = { ...tiny, phase: 'enemy' as const };
    const prepared = prepareEnemyTurn(enemyPhase, () => 0.99);
    let applied = prepared;
    while (applied.pendingEnemyAttacks.length && applied.outcome === 'ongoing') {
      applied = applyNextEnemyAttack(applied);
    }
    expect(applied.outcome).toBe('defeat');
    expect(applied.partyHp).toBe(0);
  });

  it('all players throw before the enemy phase begins', () => {
    const lvl = getLevel(1)!;
    const players = makePlayers(3);
    const state = startBattle(lvl, players, settings);
    expect(state.playerTurnIdx).toBe(0);
    // Player 1 throws (misses so enemies survive and the turn passes).
    let s = addDart(state, 0, 1, '0');
    s = addDart(s, 0, 1, '0');
    s = addDart(s, 0, 1, '0');
    let resolved = resolvePlayerVisit(s);
    expect(resolved.playerTurnIdx).toBe(1);
    expect(resolved.phase).toBe('player');
    // Player 2 throws.
    let s2 = addDart(resolved, 0, 1, '0');
    s2 = addDart(s2, 0, 1, '0');
    s2 = addDart(s2, 0, 1, '0');
    let r2 = resolvePlayerVisit(s2);
    expect(r2.playerTurnIdx).toBe(2);
    expect(r2.phase).toBe('player');
    // Player 3 throws — should now transition to enemy phase.
    let s3 = addDart(r2, 0, 1, '0');
    s3 = addDart(s3, 0, 1, '0');
    s3 = addDart(s3, 0, 1, '0');
    let r3 = resolvePlayerVisit(s3);
    expect(r3.phase).toBe('enemy');
    expect(r3.playerTurnIdx).toBe(2); // unchanged until enemy turn finishes
  });

  it('coop power-ups: heal restores party HP and consumes charge', () => {
    const lvl = getLevel(1)!;
    const state = startBattle(lvl, makePlayers(1), settings);
    const damaged = { ...state, partyHp: state.partyMaxHp - 100, powerUpCharge: 100 };
    expect(canActivateCoopPowerUp(damaged, 'coop_heal')).toBe(true);
    const after = activateCoopPowerUp(damaged, 'coop_heal');
    // Heal restores 80 HP; 300 - 100 + 80 = 280 (not capped since below max).
    expect(after.partyHp).toBe(state.partyMaxHp - 100 + 80);
    expect(after.powerUpCharge).toBe(0);
  });

  it('coop power-ups: freeze sets frozenTurns on all alive enemies', () => {
    const lvl = getLevel(1)!;
    const state = startBattle(lvl, makePlayers(1), settings);
    const charged = { ...state, powerUpCharge: 100 };
    const after = activateCoopPowerUp(charged, 'coop_freeze');
    expect(after.enemies.every(e => e.defeated || e.frozenTurns === 2)).toBe(true);
    // Frozen enemies skip their turn during prepareEnemyTurn.
    const enemyPhase = { ...after, phase: 'enemy' as const };
    const prepared = prepareEnemyTurn(enemyPhase, () => 0.99);
    expect(prepared.pendingEnemyAttacks.length).toBe(0);
    expect(prepared.enemies.every(e => e.frozenTurns === 1)).toBe(true);
  });

  it('coop power-ups: buff_power adds a power buff to every player', () => {
    const lvl = getLevel(1)!;
    const state = startBattle(lvl, makePlayers(2), settings);
    const charged = { ...state, powerUpCharge: 80 };
    const after = activateCoopPowerUp(charged, 'coop_buff_power');
    expect(after.players.every(p => p.buffs.some(b => b.kind === 'power' && b.amount === 10 && b.turnsLeft === 3))).toBe(true);
  });

  it('coop power-ups: buff_acc distracts all alive enemies (-accuracy/-precision for 3 turns)', () => {
    const lvl = getLevel(1)!;
    const state = startBattle(lvl, makePlayers(1), settings);
    const charged = { ...state, powerUpCharge: 80 };
    const after = activateCoopPowerUp(charged, 'coop_buff_acc');
    // No player buff is granted — the effect targets enemies instead.
    expect(after.players.every(p => p.buffs.length === 0)).toBe(true);
    expect(after.enemies.every(e => e.defeated || (e.distractedTurns === 3 && e.distractAmount === 0.2))).toBe(true);
    // A distracted enemy with 0.35 accuracy misses on rng >= 0.15.
    const enemyPhase = { ...after, phase: 'enemy' as const };
    const prepared = prepareEnemyTurn(enemyPhase, () => 0.5);
    // With accuracy reduced to 0.15, rng=0.5 misses; precision reduced to
    // 0.20, rng=0.5 scatters randomly — but every dart still resolves.
    expect(prepared.pendingEnemyAttacks.length).toBeGreaterThan(0);
    // After the enemy turn finishes, the distract timer ticks down to 2.
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
    // T20: 12 (triple) + 60 * 0.05 = 15
    let s = addDart(state, 20, 3, undefined, false, settings);
    expect(s.powerUpCharge).toBe(15);
    // Bull: 15 + 50 * 0.05 = 17.5
    s = addDart(s, 50, 1, 'Bull', true, settings);
    expect(s.powerUpCharge).toBeCloseTo(32.5, 5);
    // Undo reverts the last dart's charge.
    s = undoDart(s, settings);
    expect(s.powerUpCharge).toBe(15);
  });

  it('coop power-up orb charge is capped at chargeMax', () => {
    const lvl = getLevel(1)!;
    const state = startBattle(lvl, makePlayers(1), settings);
    // Pre-charge close to the cap, then verify a dart can't push it past.
    const near = { ...state, powerUpCharge: 95 };
    // Bull adds 15 + 50*0.05 = 17.5 → would be 112.5, capped at 100.
    const s = addDart(near, 50, 1, 'Bull', true, settings);
    expect(s.powerUpCharge).toBe(settings.powerUpScaling.chargeMax);
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
});
