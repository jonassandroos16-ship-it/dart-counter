import type {
  ActiveEnemy,
  CampaignBattleState,
  CampaignDart,
  CampaignLevel,
  CoopPlayer,
  EnemyDatabase,
  ResolvedDart,
  Settings,
} from '../types';
import type { Player } from '../../types';
import { ENEMY_DATABASE } from '../enemyDatabase';
import { toCoopPlayer, partyMaxHpFor } from './party';
import { computePartyPassiveBonus } from './classes';
import { dartMatchesShield, describeShield, flatHpForShield } from './shields';

// ── Start a new battle ────────────────────────────────────────────────────────────

export function startBattle(
  level: CampaignLevel,
  players: Player[],
  settings: Settings,
  db: EnemyDatabase = ENEMY_DATABASE,
  chapterId: string = 'crimson_vale',
  cardMode: boolean = false,
): CampaignBattleState {
  const party = players.map(toCoopPlayer);
  const passiveBonus = computePartyPassiveBonus(players);
  const baseAvg = partyMaxHpFor(players.length);
  const partyMaxHp = Math.max(1, baseAvg + passiveBonus.health);
  const powerUpCharge = party.length ? party[0].powerUpCharge : 0;
  const enemies: ActiveEnemy[] = level.enemies.map((defId) => {
    const def = db[defId];
    if (!def) throw new Error(`Unknown enemy id: ${defId}`);
    return {
      id: `${defId}_${Math.random().toString(36).slice(2, 8)}`,
      defId,
      name: def.name,
      hp: def.max_hp,
      maxHp: def.max_hp,
      armor: def.armor,
      accuracy: def.accuracy,
      precision: def.precision,
      shields: def.shields.map(s => ({ ...s, flatHp: cardMode ? flatHpForShield(s) : undefined })),
      defeated: false,
      vulnerableTurns: 0,
      weakenedTurns: 0,
      weakenAmount: 0,
      distractedTurns: 0,
      distractAmount: 0,
      frozenTurns: 0,
      buffs: [],
    };
  });
  return {
    levelId: level.level_id,
    chapterId,
    enemies,
    targetIdx: 0,
    partyHp: partyMaxHp,
    partyMaxHp,
    players: party,
    playerTurnIdx: 0,
    phase: 'player',
    outcome: 'ongoing',
    darts: [],
    resolvedDarts: [],
    visitEnemiesSnapshot: [],
    pendingEnemyAttacks: [],
    appliedEnemyAttacks: [],
    frozenEnemiesThisRound: [],
    visitNumber: 1,
    awaitContinue: false,
    lastVisitLog: [],
    stats: { totalDamage: 0, partyHpLost: 0, enemiesDefeated: 0, dartsThrown: 0 },
    cardMode,
  };
}

// ── Add a dart ────────────────────────────────────────────────────────────────────

export function addDart(
  state: CampaignBattleState,
  base: number,
  mult: number,
  labelOverride?: string,
  isBull?: boolean,
  settings?: Settings,
  maxDartsPerVisit?: number,
): CampaignBattleState {
  const dart = makeDartFromBase(base, mult, labelOverride, isBull);
  const max = maxDartsPerVisit ?? 3;
  if (state.darts.length >= max) return state;
  const { resolvedDart, newEnemies, newPlayers, chargeGained } = resolveDart(dart, state, settings);
  const darts = [...state.darts, dart];
  const resolvedDarts = [...state.resolvedDarts, resolvedDart];
  const players = newPlayers.map((p, i) =>
    i === state.playerTurnIdx ? { ...p, powerUpCharge: p.powerUpCharge + chargeGained } : p,
  );
  const stats = {
    ...state.stats,
    totalDamage: state.stats.totalDamage + resolvedDart.damage,
    dartsThrown: state.stats.dartsThrown + 1,
  };
  const allDefeated = newEnemies.every(e => e.defeated);
  const outcome = allDefeated ? ('victory' as const) : state.outcome;
  return {
    ...state,
    darts,
    resolvedDarts,
    enemies: newEnemies,
    players,
    stats,
    outcome,
  };
}

// ── Undo the last dart ─────────────────────────────────────────────────────────────

export function undoDart(state: CampaignBattleState, _settings?: Settings): CampaignBattleState {
  if (state.darts.length === 0) return state;
  const darts = state.darts.slice(0, -1);
  const resolvedDarts = state.resolvedDarts.slice(0, -1);
  const stats = {
    ...state.stats,
    totalDamage: state.stats.totalDamage - (state.resolvedDarts[state.resolvedDarts.length - 1]?.damage ?? 0),
    dartsThrown: Math.max(0, state.stats.dartsThrown - 1),
  };
  // Re-snapshot enemies from the visit start since we can't perfectly reverse
  // individual dart resolutions (crits, shields, etc.).
  const enemies = state.visitEnemiesSnapshot.length
    ? state.visitEnemiesSnapshot.map(e => ({ ...e }))
    : state.enemies;
  // Re-resolve all remaining darts against the snapshot.
  let working = { ...state, darts: [], resolvedDarts: [], enemies, stats: { ...state.stats, totalDamage: 0, dartsThrown: 0 } };
  for (const dart of darts) {
    working = addDart(working, dart.base, dart.mult, dart.label, dart.isBull);
  }
  return { ...working, darts, resolvedDarts: working.resolvedDarts, stats: working.stats };
}

// ── Resolve a single dart against the current state ─────────────────────────────────

function makeDartFromBase(base: number, mult: number, labelOverride?: string, isBull?: boolean): CampaignDart {
  if (base === 25) {
    return { value: mult === 2 ? 50 : 25, label: labelOverride ?? (mult === 2 ? 'Bull' : '25'), base: 25, mult: mult === 2 ? 2 : 1, isDouble: mult === 2, isBull: true };
  }
  if (base === 50) {
    return { value: 50, label: labelOverride ?? 'Bull', base: 50, mult: 2, isDouble: true, isBull: true };
  }
  if (base === 0) {
    return { value: 0, label: labelOverride ?? 'Miss', base: 0, mult: 1, isDouble: false };
  }
  const value = base * mult;
  const label = labelOverride ?? ((mult === 2 ? 'D' : mult === 3 ? 'T' : '') + base);
  return { value, label, base, mult, isDouble: mult === 2 };
}

function computeChargeGained(dart: CampaignDart, cfg?: Settings['powerUpScaling']): number {
  if (!cfg) return 0;
  const perPoint = cfg.chargePerDartPoint ?? 0;
  return Math.round(dart.value * perPoint);
}

export function resolveDart(
  dart: CampaignDart,
  state: CampaignBattleState,
  settings?: Settings,
): { resolvedDart: ResolvedDart; newEnemies: ActiveEnemy[]; newPlayers: CoopPlayer[]; chargeGained: number } {
  const cfg = settings?.powerUpScaling;
  const t = state.enemies[state.targetIdx];
  const thrower = state.players[state.playerTurnIdx];
  if (!t || t.defeated) {
    const step: ResolvedDart = { dart, damage: 0, kind: 'miss', enemyId: t?.id ?? '', enemyName: t?.name ?? '', hpAfter: t?.hp ?? 0 };
    return { resolvedDart: step, newEnemies: state.enemies, newPlayers: state.players, chargeGained: computeChargeGained(dart, cfg) };
  }

  // Compute attacker power (thrower's power + active power buffs)
  const powerMax = Number.isFinite(cfg?.powerMax) ? (cfg?.powerMax as number) : Number.MAX_SAFE_INTEGER;
  const basePower = thrower ? Math.min(powerMax, thrower.power + thrower.buffs.filter(b => b.kind === 'power').reduce((s, b) => s + b.amount, 0)) : 0;
  const power = basePower;

  // Shield check: if the enemy has shields, handle them.
  if (t.shields.length > 0) {
    const shield = t.shields[0];
    // Card mode: flat shields absorb damage until depleted.
    if (shield.flatHp != null) {
      if (dart.value <= 0) {
        const step: ResolvedDart = { dart, damage: 0, kind: 'miss', enemyId: t.id, enemyName: t.name, hpAfter: t.hp, attackerPower: power, targetArmor: t.armor, vulnerable: t.vulnerableTurns > 0 };
        return { resolvedDart: step, newEnemies: state.enemies, newPlayers: state.players, chargeGained: 0 };
      }
      const remaining = shield.flatHp - dart.value;
      if (remaining > 0) {
        // Shield absorbs all damage, flat HP reduced.
        const step: ResolvedDart = { dart, damage: 0, kind: 'shield_break', shieldTarget: `${shield.flatHp}HP shield`, enemyId: t.id, enemyName: t.name, hpAfter: t.hp, attackerPower: power, targetArmor: t.armor, vulnerable: t.vulnerableTurns > 0 };
        const newEnemies = state.enemies.map((e, i) => i === state.targetIdx ? { ...e, shields: [{ ...shield, flatHp: remaining }] } : e);
        return { resolvedDart: step, newEnemies, newPlayers: state.players, chargeGained: 0 };
      }
      // Shield broken — excess damage carries through.
      const overflow = -remaining;
      const newEnemies = state.enemies.map((e, i) => i === state.targetIdx ? { ...e, shields: e.shields.slice(1) } : e);
      if (overflow <= 0) {
        const step: ResolvedDart = { dart, damage: 0, kind: 'shield_break', shieldTarget: `${shield.flatHp}HP shield`, enemyId: t.id, enemyName: t.name, hpAfter: t.hp, attackerPower: power, targetArmor: t.armor, vulnerable: t.vulnerableTurns > 0 };
        return { resolvedDart: step, newEnemies, newPlayers: state.players, chargeGained: 0 };
      }
      // Apply overflow damage to HP.
      const armorMax2a = Number.isFinite(cfg?.armorMax) ? (cfg?.armorMax as number) : Number.MAX_SAFE_INTEGER;
      const armorA = Math.min(armorMax2a, t.armor);
      const postArmorA = Math.max(1, Math.round(overflow * (1 - armorA / 100)));
      const newHpA = Math.max(0, t.hp - postArmorA);
      const defeatedA = newHpA <= 0;
      const finalEnemiesA = newEnemies.map((e, i) => i === state.targetIdx ? { ...e, hp: newHpA, defeated: defeatedA } : e);
      const stepA: ResolvedDart = { dart, damage: postArmorA, kind: defeatedA ? 'defeated' : 'damage', enemyId: t.id, enemyName: t.name, hpAfter: newHpA, attackerPower: power, targetArmor: armorA, vulnerable: t.vulnerableTurns > 0 };
      return { resolvedDart: stepA, newEnemies: finalEnemiesA, newPlayers: state.players, chargeGained: computeChargeGained(dart, cfg) };
    }
    // Dartboard mode: segment-matching shields.
    if (!dartMatchesShield(dart, shield)) {
      const step: ResolvedDart = { dart, damage: 0, kind: 'shield_break', shieldTarget: describeShield(shield), enemyId: t.id, enemyName: t.name, hpAfter: t.hp, attackerPower: power, targetArmor: t.armor, vulnerable: t.vulnerableTurns > 0 };
      return { resolvedDart: step, newEnemies: state.enemies, newPlayers: state.players, chargeGained: 0 };
    }
    // Dart matches shield — break it, deal 0 damage.
    const step: ResolvedDart = { dart, damage: 0, kind: 'miss', enemyId: t.id, enemyName: t.name, hpAfter: t.hp, attackerPower: power, targetArmor: t.armor, vulnerable: t.vulnerableTurns > 0 };
    const newEnemies = state.enemies.map((e, i) => i === state.targetIdx ? { ...e, shields: e.shields.slice(1) } : e);
    return { resolvedDart: step, newEnemies, newPlayers: state.players, chargeGained: 0 };
  }

  if (dart.value <= 0) {
    const step: ResolvedDart = { dart, damage: 0, kind: 'miss', enemyId: t.id, enemyName: t.name, hpAfter: t.hp };
    return { resolvedDart: step, newEnemies: state.enemies, newPlayers: state.players, chargeGained: 0 };
  }

  // Compute crit
  const critBuff = thrower?.buffs.find(b => b.kind === 'crit');
  const critGuarantee = thrower?.buffs.find(b => b.kind === 'crit_guarantee');
  const critMultBuff = thrower?.buffs.find(b => b.kind === 'crit_multiplier');
  const critChance = (thrower ? thrower.crit : 0) + (critBuff ? critBuff.amount : 0);
  const isCrit = critGuarantee ? true : Math.random() * 100 < critChance;
  const critMult = critMultBuff ? critMultBuff.amount : 2;

  // Raw damage: dart value + attacker power
  const rawDmg = dart.value + power;
  const armorMax2 = Number.isFinite(cfg?.armorMax) ? (cfg?.armorMax as number) : Number.MAX_SAFE_INTEGER;
  const armor = Math.min(armorMax2, t.armor);
  const postArmor = Math.max(1, Math.round(rawDmg * (1 - armor / 100)));
  const surgeDmg = isCrit ? Math.round(postArmor * critMult) : postArmor;
  const vulnerable = t.vulnerableTurns > 0;
  const finalDmg = vulnerable ? Math.round(surgeDmg * 1.5) : surgeDmg;

  const newHp = Math.max(0, t.hp - finalDmg);
  const defeated = newHp <= 0;
  const newEnemies = state.enemies.map((e, i) =>
    i === state.targetIdx ? { ...e, hp: newHp, defeated } : e
  );

  let chargeGained = computeChargeGained(dart, cfg);

  const step: ResolvedDart = { dart, damage: finalDmg, kind: defeated ? 'defeated' : 'damage', enemyId: t.id, enemyName: t.name, hpAfter: newHp, attackerPower: power, targetArmor: armor, vulnerable, crit: isCrit, critMult: isCrit ? critMult : undefined };
  return { resolvedDart: step, newEnemies, newPlayers: state.players, chargeGained };
}

// ── Resolve the current player's visit ────────────────────────────────────────────

export function resolvePlayerVisit(state: CampaignBattleState, hasPlayedCards: boolean = false): CampaignBattleState {
  if (state.outcome !== 'ongoing') return state;
  if (state.outcome === 'victory' as any) return state;
  if (state.darts.length === 0 && !hasPlayedCards) return state;
  const isLastPlayer = state.playerTurnIdx >= state.players.length - 1;
  if (!isLastPlayer) {
    // More players to throw — advance playerTurnIdx, snapshot, reset darts.
    const next = (state.playerTurnIdx + 1) % state.players.length;
    return {
      ...state,
      playerTurnIdx: next,
      darts: [],
      resolvedDarts: [],
      visitEnemiesSnapshot: state.enemies.map(e => ({ ...e })),
    };
  }
  // All players have thrown — move to the enemy phase.
  return {
    ...state,
    phase: 'enemy',
    playerTurnIdx: 0,
    darts: [],
    resolvedDarts: [],
    visitEnemiesSnapshot: [],
  };
}

// ── Target selection ───────────────────────────────────────────────────────────

export function setTarget(state: CampaignBattleState, targetIdx: number): CampaignBattleState {
  if (targetIdx < 0 || targetIdx >= state.enemies.length) return state;
  if (state.enemies[targetIdx].defeated) return state;
  return { ...state, targetIdx };
}


// ── Utility helpers ────────────────────────────────────────────────────────────

export function computePlayerDartDamage(dart: CampaignDart, power: number, armor: number): number {
  const rawDmg = dart.value + power;
  const postArmor = Math.max(1, Math.round(rawDmg * (1 - armor / 100)));
  return postArmor;
}

export function effectivePower(player: CoopPlayer): number {
  return player.power + player.buffs.filter(b => b.kind === 'power').reduce((s, b) => s + b.amount, 0);
}
