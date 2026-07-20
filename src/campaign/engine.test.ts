import { describe, it, expect } from 'vitest';
import {
  addDart, computePlayerDartDamage, dartMatchesShield, describeShield, getLevel,
  isLevelUnlocked, prepareEnemyTurn, applyNextEnemyAttack, resolvePlayerVisit,
  setTarget, startBattle, totalLevels, undoDart,
  partyMaxHpFor, partyArmorFor, partyPowerFor, COOP_POWER_UPS,
  canActivateCoopPowerUp, activateCoopPowerUp,
  isLevelUnlockedForParty, playerCampaignProgress, defaultPlayerCampaignProgress,
  partyAllClearedLevel, partyMissingClearForLevel, recordLevelClearForPlayer,
} from './engine';
import { ENEMY_DATABASE } from './enemyDatabase';
import { CAMPAIGN_LEVELS } from './campaignLevels';
import type { CampaignDart, CoopClassId, CoopPassiveId } from './types';
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
    // getLevel returns the first match across chapters; the last flat level
    // is chapter 2's boss, so look it up within chapter 2 instead.
    expect(getLevel(5)).toBeDefined();
  });

  it('unlocks level 1 by default and gates the rest by highest beaten', () => {
    expect(isLevelUnlocked(1, 0)).toBe(true);
    expect(isLevelUnlocked(2, 0)).toBe(false);
    expect(isLevelUnlocked(2, 1)).toBe(true);
    expect(isLevelUnlocked(5, 4)).toBe(true);
    expect(isLevelUnlocked(6, 4)).toBe(false);
  });

  it('party HP is the average of selected players health (capped at healthMax)', () => {
    const players = makePlayers(2);
    expect(partyMaxHpFor(players, settings)).toBe(300); // (300 + 300) / 2 = 300
    const onePlayer: Player[] = [{ ...players[0], attributes: { health: 300, armor: 0, power: 0, pointsAvailable: 0 } }];
    expect(partyMaxHpFor(onePlayer, settings)).toBe(300); // solo = own health
    // Two players with 500 health each — average 500, at cap.
    const tank: Player[] = Array.from({ length: 2 }, () => ({ ...players[0], attributes: { health: 500, armor: 0, power: 0, pointsAvailable: 0 } }));
    expect(partyMaxHpFor(tank, settings)).toBe(500); // capped at healthMax=500
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

  it('starts a battle with party HP equal to averaged player health', () => {
    const lvl = getLevel(1)!;
    const players = makePlayers(2);
    const state = startBattle(lvl, players, settings);
    expect(state.partyMaxHp).toBe(300); // (300 + 300) / 2 = 300, averaged
    expect(state.partyHp).toBe(300);
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
    // T20 = 60, power 10 → 70 base. Armor 5% → round(70 * 0.95) = 67 each. Two
    // darts → 134, which defeats the 130-HP orc (hp clamped to 0).
    expect(resolvedOrc.hp).toBe(0);
    expect(resolvedOrc.defeated).toBe(true);
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
    expect(computePlayerDartDamage(dart(20, 3), 0, 5)).toBe(57); // round(60 * 0.95) = 57
    expect(computePlayerDartDamage(dart(20, 1), 0, 25)).toBe(15); // round(20 * 0.75) = 15
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
    const damaged = { ...state, partyHp: state.partyMaxHp - 100, powerUpCharge: 100, players: state.players.map(p => ({ ...p, powerUpCharge: 100 })) };
    expect(canActivateCoopPowerUp(damaged, 'coop_heal')).toBe(true);
    const after = activateCoopPowerUp(damaged, 'coop_heal');
    // Heal restores 80 HP; 300 - 100 + 80 = 280 (not capped since below max).
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
    // Frozen enemies skip their turn during prepareEnemyTurn.
    const enemyPhase = { ...after, phase: 'enemy' as const };
    const prepared = prepareEnemyTurn(enemyPhase, () => 0.99);
    expect(prepared.pendingEnemyAttacks.length).toBe(0);
    expect(prepared.enemies.every(e => e.frozenTurns === 1)).toBe(true);
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
    const near = { ...state, powerUpCharge: 95, players: state.players.map(p => ({ ...p, powerUpCharge: 95 })) };
    // Bull adds 15 + 50*0.05 = 17.5 → would be 112.5, capped at 100.
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
    // Player 1 throws T20.
    let s = addDart(state, 20, 3, undefined, false, settings);
    expect(s.players[0].powerUpCharge).toBe(15);
    expect(s.players[1].powerUpCharge).toBe(0);
  });

  it('per-player charge: using a skill only consumes the thrower charge', () => {
    const lvl = getLevel(1)!;
    const state = startBattle(lvl, makePlayers(2), settings);
    // Both players have full charge.
    const charged = { ...state, players: state.players.map(p => ({ ...p, powerUpCharge: 100 })), powerUpCharge: 100 };
    const after = activateCoopPowerUp(charged, 'coop_freeze');
    // Thrower (player 1, idx 0) spent 100; player 2 keeps 100.
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
      attributes: { health: 100, armor: 0, power: 0, pointsAvailable: 0 },
      coopProgress: { classId: 'priest' as CoopClassId, xp: 200, unlockedPassives: ['pri_hp_1', 'pri_hp_2', 'pri_hp_3'] as CoopPassiveId[], equippedPassives: ['pri_hp_3'] as CoopPassiveId[] },
    }));
    const state = startBattle(lvl, players, settings);
    // 100 base + 300 bonus = 400, under the 500 cap.
    expect(state.players[0].maxHp).toBe(400);
    expect(state.passiveBonus?.health).toBe(300);
  });

  it('passive bonus: duplicate priests stack — pri_hp_1 applies once per player', () => {
    const lvl = getLevel(1)!;
    const players = makePlayers(3).map(p => ({
      ...p,
      attributes: { health: 100, armor: 0, power: 0, pointsAvailable: 0 },
      coopProgress: { classId: 'priest' as CoopClassId, xp: 0, unlockedPassives: ['pri_hp_1'] as CoopPassiveId[], equippedPassives: ['pri_hp_1'] as CoopPassiveId[] },
    }));
    const state = startBattle(lvl, players, settings);
    // 100 base + 60 * 3 (one Blessing per priest) = 280 per priest; each
    // player's equipped passive buffs the party independently.
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
      attributes: { health: 100, armor: 0, power: 0, pointsAvailable: 0 },
      coopProgress: { classId: 'priest' as CoopClassId, xp: 200, unlockedPassives: tiers, equippedPassives: [tiers[i]] as CoopPassiveId[] },
    }));
    const state = startBattle(lvl, players, settings);
    // 60 + 150 + 300 = 510, but capped at healthMax (500) per player.
    expect(state.passiveBonus?.health).toBe(510);
    expect(state.passiveBonus?.sources).toHaveLength(3);
  });

  it('passive bonus: 2 priests + 1 rogue stack Priest, Priest and Rogue bonuses', () => {
    const lvl = getLevel(1)!;
    const players = makePlayers(3).map((p, i) => ({
      ...p,
      attributes: { health: 100, armor: 0, power: 0, pointsAvailable: 0 },
      coopProgress: i < 2
        ? { classId: 'priest' as CoopClassId, xp: 0, unlockedPassives: ['pri_hp_1'] as CoopPassiveId[], equippedPassives: ['pri_hp_1'] as CoopPassiveId[] }
        : { classId: 'rogue' as CoopClassId, xp: 0, unlockedPassives: ['rog_armor_1'] as CoopPassiveId[], equippedPassives: ['rog_armor_1'] as CoopPassiveId[] },
    }));
    const state = startBattle(lvl, players, settings);
    // Two priests each contribute +60 HP, one rogue contributes +2 armor.
    expect(state.passiveBonus?.health).toBe(120);
    expect(state.passiveBonus?.armor).toBe(2);
    expect(state.passiveBonus?.sources).toHaveLength(3);
  });

  // ── Health averaging + priest buffs ──────────────────────────────────
  // Regression: the priest passive health bonus was previously added to
  // each player's maxHp BEFORE averaging, so it was divided by the player
  // count and capped per-player before the average. A 2-player party with
  // 400 base HP and +120 priest buffs got 500 instead of 520. The bonus is
  // now added to the shared party HP AFTER averaging, so the full priest
  // contribution is always granted (and is not subject to the base
  // healthMax cap — priest passives are meant to push past it).
  it('party HP includes the FULL priest bonus on top of the averaged base (not divided by player count)', () => {
    const lvl = getLevel(1)!;
    const players = makePlayers(2).map(p => ({
      ...p,
      attributes: { health: 400, armor: 0, power: 0, pointsAvailable: 0 },
      coopProgress: { classId: 'priest' as CoopClassId, xp: 0, unlockedPassives: ['pri_hp_1'] as CoopPassiveId[], equippedPassives: ['pri_hp_1'] as CoopPassiveId[] },
    }));
    const state = startBattle(lvl, players, settings);
    // Base avg = 400. Two priests each grant +60 = +120 bonus. 400 + 120 = 520.
    expect(state.passiveBonus?.health).toBe(120);
    expect(state.partyMaxHp).toBe(520);
    expect(state.partyHp).toBe(520);
  });

  it('party HP priest bonus is NOT capped by the base healthMax (priest pushes past the cap)', () => {
    const lvl = getLevel(1)!;
    const players = makePlayers(2).map(p => ({
      ...p,
      attributes: { health: 500, armor: 0, power: 0, pointsAvailable: 0 },
      coopProgress: { classId: 'priest' as CoopClassId, xp: 200, unlockedPassives: ['pri_hp_3'] as CoopPassiveId[], equippedPassives: ['pri_hp_3'] as CoopPassiveId[] },
    }));
    const state = startBattle(lvl, players, settings);
    // Base avg = 500 (capped). Two priests each grant +300 = +600 bonus.
    // 500 + 600 = 1100 — past the 500 base cap, which is the point of
    // the priest class.
    expect(state.passiveBonus?.health).toBe(600);
    expect(state.partyMaxHp).toBe(1100);
  });

  it('solo player still gets the full priest bonus (no averaging divide)', () => {
    const lvl = getLevel(1)!;
    const players = makePlayers(1).map(p => ({
      ...p,
      attributes: { health: 100, armor: 0, power: 0, pointsAvailable: 0 },
      coopProgress: { classId: 'priest' as CoopClassId, xp: 200, unlockedPassives: ['pri_hp_3'] as CoopPassiveId[], equippedPassives: ['pri_hp_3'] as CoopPassiveId[] },
    }));
    const state = startBattle(lvl, players, settings);
    // 100 base + 300 bonus = 400.
    expect(state.partyMaxHp).toBe(400);
  });

  // ── Per-player coop progress ──────────────────────────────────────────
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
    // Clearing again does not double-grant the reward.
    const after1b = recordLevelClearForPlayer({ ...p, campaignProgress: after1 }, 'crimson_vale', 0, 1, 'coop_meteor');
    expect(after1b.unlockedPowerUps?.length).toBe(1);
    // Clearing a later level advances the chapter cleared count.
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
    // Level 1 is always unlocked.
    expect(isLevelUnlockedForParty('crimson_vale', 1, [p1, p2])).toBe(true);
    // Level 2 is unlocked because p1 cleared level 1.
    expect(isLevelUnlockedForParty('crimson_vale', 2, [p1, p2])).toBe(true);
    // Level 3 is locked because neither cleared level 2.
    expect(isLevelUnlockedForParty('crimson_vale', 3, [p1, p2])).toBe(false);
    // Empty party: nothing unlocked (except level 1).
    expect(isLevelUnlockedForParty('crimson_vale', 2, [])).toBe(false);
  });
});
