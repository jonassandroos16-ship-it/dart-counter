import { describe, it, expect } from 'vitest';
import { addDart, computePlayerDartDamage, dartMatchesShield, describeShield, getLevel, isLevelUnlocked, resolveEnemyTurn, resolvePlayerVisit, setTarget, startBattle, totalLevels } from './engine';
import { ENEMY_DATABASE } from './enemyDatabase';
import { CAMPAIGN_LEVELS } from './campaignLevels';
import type { CampaignDart } from './types';

const dart = (base: number, mult: number): CampaignDart => ({
  value: base === 0 ? 0 : base === 25 ? (mult === 2 ? 50 : 25) : base === 50 ? 50 : base * mult,
  label: base === 0 ? 'Miss' : base === 50 ? 'Bull' : (mult === 2 ? 'D' : mult === 3 ? 'T' : '') + base,
  base,
  mult: base === 50 ? 2 : mult,
  isDouble: base === 50 || mult === 2,
  isBull: base === 25 || base === 50,
});

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

  it('breaks a span shield with a top-half dart and deals 0 damage', () => {
    const lvl = getLevel(4)!; // Raider Crossing — orc_raider has TOP_HALF shield
    const state = startBattle(lvl, 350, 350);
    // orc_raider is the first enemy; it has a TOP_HALF shield.
    const orc = state.enemies.find(e => e.defId === 'orc_raider')!;
    const orcIdx = state.enemies.findIndex(e => e.id === orc.id);
    const targeted = setTarget(state, orc.id);
    expect(targeted.targetIdx).toBe(orcIdx);
    // Throw T20 (top half) — should break the shield, deal 0 damage.
    let s = addDart(targeted, 20, 3);
    s = addDart(s, 20, 3);
    s = addDart(s, 20, 3);
    const resolved = resolvePlayerVisit(s);
    const resolvedOrc = resolved.enemies.find(e => e.id === orc.id)!;
    expect(resolvedOrc.shields.length).toBe(0);
    // First dart broke the shield (0 dmg). The remaining two darts deal damage.
    // T20 = 60, armor 5 → 55 each. Two darts → 110.
    expect(resolvedOrc.hp).toBe(orc.maxHp - 110);
  });

  it('absorbs non-matching darts into the shield (0 damage)', () => {
    const lvl = getLevel(4)!;
    const state = startBattle(lvl, 350, 350);
    const orc = state.enemies.find(e => e.defId === 'orc_raider')!;
    const targeted = setTarget(state, orc.id);
    // Throw T10 (bottom half) three times — none match the TOP_HALF shield.
    let s = addDart(targeted, 10, 3);
    s = addDart(s, 10, 3);
    s = addDart(s, 10, 3);
    const resolved = resolvePlayerVisit(s);
    const resolvedOrc = resolved.enemies.find(e => e.id === orc.id)!;
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
    expect(computePlayerDartDamage(dart(20, 3), 5)).toBe(55); // 60 - 5
    expect(computePlayerDartDamage(dart(20, 1), 25)).toBe(1); // clamped to min 1
    expect(computePlayerDartDamage(dart(0, 1), 0)).toBe(0); // miss
  });

  it('runs the enemy turn and deducts party HP, then returns to player phase', () => {
    const lvl = getLevel(1)!;
    const state = startBattle(lvl, 350, 350);
    // Force into enemy phase.
    const enemyPhase = { ...state, phase: 'enemy' as const };
    // Use a seeded-ish rng that always hits to guarantee damage > 0.
    const rng = () => 0.99; // accuracy check passes (0.99 > 0.35), precision check passes
    const after = resolveEnemyTurn(enemyPhase, rng);
    expect(after.phase).toBe('player');
    expect(after.partyHp).toBeLessThan(350);
    expect(after.visitNumber).toBe(2);
  });

  it('marks the battle as defeat when party HP hits 0', () => {
    const lvl = getLevel(1)!;
    const state = startBattle(lvl, 5, 350); // tiny party HP
    const enemyPhase = { ...state, phase: 'enemy' as const };
    const rng = () => 0.99;
    const after = resolveEnemyTurn(enemyPhase, rng);
    expect(after.outcome).toBe('defeat');
    expect(after.partyHp).toBe(0);
  });

  it('enemy database ships with the boss warlord_malakar', () => {
    expect(ENEMY_DATABASE.warlord_malakar.difficulty).toBe('Boss');
    expect(ENEMY_DATABASE.warlord_malakar.shields.length).toBeGreaterThan(0);
  });
});
