import type {
  ActiveEnemy,
  CampaignBattleState,
  CampaignDart,
  CampaignLevel,
  CoopPlayer,
  EnemyDatabase,
  ResolvedDart,
} from '../types';
import type { Player, Settings } from '../../types';
import { ENEMY_DATABASE } from '../enemyDatabase';
import { toCoopPlayer, partyMaxHpFor } from './party';
import { computePartyPassiveBonus, type PartyPassiveBonus } from './classes';
import { dartMatchesShield, describeShield, flatHpForShield } from './shields';

// ── Start a new battle ────────────────────────────────────────────────────────────

function startingChargeFor(players: Player[], settings: Settings): number {
  const cfg = settings.powerUpScaling;
  const map = cfg?.startingCharge;
  if (!map) return 0;
  for (const p of players) {
    const active = (p as any).powerUps?.coopActive;
    if (active && typeof active === 'string' && active in map) {
      return map[active];
    }
  }
  return 0;
}

function applyPassiveToPlayer(p: CoopPlayer, bonus: PartyPassiveBonus, settings: Settings): CoopPlayer {
  const cfg = settings.powerUpScaling;
  const powerMax = cfg?.powerMax ?? Number.MAX_SAFE_INTEGER;
  const armorMax = cfg?.armorMax ?? Number.MAX_SAFE_INTEGER;
  const critMax = cfg?.critMax ?? Number.MAX_SAFE_INTEGER;
  return {
    ...p,
    power: Math.min(powerMax, p.power + bonus.power),
    armor: Math.min(armorMax, p.armor + bonus.armor),
    crit: Math.min(critMax, p.crit + bonus.crit),
  };
}

export function startBattle(
  level: CampaignLevel,
  players: Player[],
  settings: Settings,
  db: EnemyDatabase = ENEMY_DATABASE,
  chapterId: string = 'crimson_vale',
  cardMode: boolean = false,
): CampaignBattleState {
  const startCharge = startingChargeFor(players, settings);
  const party = players.map(p => toCoopPlayer(p, settings, startCharge));
  const passiveBonus = computePartyPassiveBonus(players);
  const partyWithBonus = party.map(p => applyPassiveToPlayer(p, passiveBonus, settings));
  const baseAvg = partyMaxHpFor(players, settings);
  const partyMaxHp = Math.max(1, baseAvg + passiveBonus.health);
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
    players: partyWithBonus,
    playerTurnIdx: 0,
    phase: 'player',
    outcome: 'ongoing',
    darts: [],
    resolvedDarts: [],
    visitEnemiesSnapshot: enemies.map(e => ({ ...e })),
    pendingEnemyAttacks: [],
    appliedEnemyAttacks: [],
    frozenEnemiesThisRound: [],
    visitNumber: 1,
    awaitContinue: false,
    lastVisitLog: [],
    stats: { totalDamage: 0, partyHpLost: 0, enemiesDefeated: 0, dartsThrown: 0, visitsUsed: 0, damageDealt: 0, powerUpsUsed: 0 },
    cardMode,
    passiveBonus,
    powerUpCharge: startCharge,
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
  const { resolvedDart, newEnemies, newPlayers, chargeGained, partyHeal } = resolveDart(dart, state, settings);
  const darts = [...state.darts, dart];
  const resolvedDarts = [...state.resolvedDarts, resolvedDart];
  const chargeMax = settings?.powerUpScaling?.chargeMax ?? Number.MAX_SAFE_INTEGER;
  // In card mode, charge is granted per-card by the card battle hook, not
  // by dart value. Skip the legacy dart-value-based charge here.
  const effectiveCharge = state.cardMode ? 0 : chargeGained;
  const players = newPlayers.map((p, i) =>
    i === state.playerTurnIdx ? { ...p, powerUpCharge: Math.min(chargeMax, p.powerUpCharge + effectiveCharge) } : p,
  );
  const throwerCharge = players[state.playerTurnIdx]?.powerUpCharge ?? 0;
  const defeatedBefore = state.enemies.filter(e => e.defeated).length;
  const defeatedAfter = newEnemies.filter(e => e.defeated).length;
  const newlyDefeated = Math.max(0, defeatedAfter - defeatedBefore);
  const stats = {
    ...state.stats,
    totalDamage: state.stats.totalDamage + resolvedDart.damage,
    dartsThrown: state.stats.dartsThrown + 1,
    damageDealt: state.stats.damageDealt + resolvedDart.damage,
    enemiesDefeated: state.stats.enemiesDefeated + newlyDefeated,
  };
  const throwerIdx = state.playerTurnIdx;
  const playersWithStats = players.map((p, i) =>
    i === throwerIdx
      ? {
          ...p,
          kills: p.kills + newlyDefeated,
          damageDealt: p.damageDealt + resolvedDart.damage,
        }
      : p,
  );
  const allDefeated = newEnemies.every(e => e.defeated);
  const outcome = allDefeated ? ('victory' as const) : state.outcome;
  const healedPartyHp = Math.min(state.partyMaxHp, state.partyHp + partyHeal);
  // If the current target was defeated by this dart, auto-advance to the
  // next alive enemy so subsequent darts in the same visit do not hit a
  // dead target (which would silently miss and waste the throw).
  let targetIdx = state.targetIdx;
  if (newEnemies[targetIdx]?.defeated) {
    const nextAlive = newEnemies.findIndex((e, i) => i > targetIdx && !e.defeated);
    targetIdx = nextAlive >= 0 ? nextAlive : newEnemies.findIndex(e => !e.defeated);
    if (targetIdx < 0) targetIdx = state.targetIdx;
  }
  return {
    ...state,
    darts,
    resolvedDarts,
    enemies: newEnemies,
    players: playersWithStats,
    stats,
    outcome,
    powerUpCharge: throwerCharge,
    partyHp: healedPartyHp,
    targetIdx,
  };
}

// ── Undo the last dart ─────────────────────────────────────────────────────────────

export function undoDart(state: CampaignBattleState, settings?: Settings): CampaignBattleState {
  if (state.darts.length === 0) return state;
  const darts = state.darts.slice(0, -1);
  const enemies = state.visitEnemiesSnapshot.length
    ? state.visitEnemiesSnapshot.map(e => ({ ...e }))
    : state.enemies;
  const defeatedAtVisitStart = state.visitEnemiesSnapshot.filter(e => e.defeated).length;
  const defeatedNow = state.enemies.filter(e => e.defeated).length;
  const killsThisVisit = Math.max(0, defeatedNow - defeatedAtVisitStart);
  const dmgThisVisit = state.resolvedDarts.reduce((a, r) => a + r.damage, 0);
  let working: CampaignBattleState = {
    ...state,
    darts: [],
    resolvedDarts: [],
    enemies,
    stats: {
      ...state.stats,
      totalDamage: 0,
      dartsThrown: 0,
      damageDealt: Math.max(0, state.stats.damageDealt - dmgThisVisit),
      enemiesDefeated: Math.max(0, state.stats.enemiesDefeated - killsThisVisit),
    },
    players: state.players.map((p, i) =>
      i === state.playerTurnIdx
        ? {
            ...p,
            powerUpCharge: state.cardMode ? p.powerUpCharge : 0,
            kills: Math.max(0, p.kills - killsThisVisit),
            damageDealt: Math.max(0, p.damageDealt - dmgThisVisit),
          }
        : p,
    ),
    powerUpCharge: state.cardMode ? state.powerUpCharge : 0,
  };
  for (const dart of darts) {
    working = addDart(working, dart.base, dart.mult, dart.label, dart.isBull, settings);
  }
  return { ...working, darts, resolvedDarts: working.resolvedDarts, stats: working.stats };
}

// ── Resolve a single dart against the current state ─────────────────────────────────

function makeDartFromBase(base: number, mult: number, labelOverride?: string, _isBull?: boolean): CampaignDart {
  if (base === 25) {
    return { value: mult === 2 ? 50 : 25, label: labelOverride ?? (mult === 2 ? 'Bull' : '25'), base: 25, mult: mult === 2 ? 2 : 1, isDouble: mult === 2, isBull: true };
  }
  if (base === 50) {
    if (mult <= 1) return { value: 50, label: labelOverride ?? 'Bull', base: 50, mult: 2, isDouble: true, isBull: true };
    return { value: 50 * mult, label: labelOverride ?? 'Bull', base: 50, mult, isDouble: true, isBull: true };
  }
  if (base === 0) {
    return { value: 0, label: labelOverride ?? 'Miss', base: 0, mult: 1, isDouble: false, isBull: false };
  }
  const value = base * mult;
  const label = labelOverride ?? ((mult === 2 ? 'D' : mult === 3 ? 'T' : '') + base);
  return { value, label, base, mult, isDouble: mult === 2, isBull: false };
}

function computeChargeGained(dart: CampaignDart, cfg?: Settings['powerUpScaling'], trinkets?: string[]): number {
  if (!cfg) return 0;
  let charge = dart.value * (cfg.chargePerScorePoint ?? 0);
  if (dart.isDouble && !dart.isBull && cfg.chargePerDouble) charge += cfg.chargePerDouble;
  if (dart.mult === 3 && cfg.chargePerTriple) charge += cfg.chargePerTriple;
  if (dart.isBull && cfg.chargePerBull) charge += cfg.chargePerBull;
  if (trinkets?.includes('trk_lucky_penny')) charge *= 1.3;
  return charge;
}

export function resolveDart(
  dart: CampaignDart,
  state: CampaignBattleState,
  settings?: Settings,
): { resolvedDart: ResolvedDart; newEnemies: ActiveEnemy[]; newPlayers: CoopPlayer[]; chargeGained: number; partyHeal: number } {
  const cfg = settings?.powerUpScaling;
  const t = state.enemies[state.targetIdx];
  const thrower = state.players[state.playerTurnIdx];
  if (!t || t.defeated) {
    const step: ResolvedDart = { dart, damage: 0, kind: 'miss', enemyId: t?.id ?? '', enemyName: t?.name ?? '', hpAfter: t?.hp ?? 0 };
    return { resolvedDart: step, newEnemies: state.enemies, newPlayers: state.players, chargeGained: computeChargeGained(dart, cfg, state.trinkets), partyHeal: 0 };
  }

  const trinkets = state.trinkets ?? [];
  const powerMax = Number.isFinite(cfg?.powerMax) ? (cfg?.powerMax as number) : Number.MAX_SAFE_INTEGER;
  const basePower = thrower ? Math.min(powerMax, thrower.power + thrower.buffs.filter(b => b.kind === 'power').reduce((s, b) => s + b.amount, 0)) : 0;
  const power = basePower;

  if (t.shields.length > 0) {
    const shield = t.shields[0];
    if (shield.flatHp != null) {
      if (dart.value <= 0) {
        const step: ResolvedDart = { dart, damage: 0, kind: 'miss', enemyId: t.id, enemyName: t.name, hpAfter: t.hp, attackerPower: power, targetArmor: t.armor, vulnerable: t.vulnerableTurns > 0 };
        return { resolvedDart: step, newEnemies: state.enemies, newPlayers: state.players, chargeGained: 0, partyHeal: 0 };
      }
      const remaining = shield.flatHp - dart.value;
      if (remaining > 0) {
        const step: ResolvedDart = { dart, damage: 0, kind: 'shield_break', shieldTarget: `${shield.flatHp}HP shield`, enemyId: t.id, enemyName: t.name, hpAfter: t.hp, attackerPower: power, targetArmor: t.armor, vulnerable: t.vulnerableTurns > 0 };
        const newEnemies = state.enemies.map((e, i) => i === state.targetIdx ? { ...e, shields: [{ ...shield, flatHp: remaining }] } : e);
        return { resolvedDart: step, newEnemies, newPlayers: state.players, chargeGained: 0, partyHeal: 0 };
      }
      const overflow = -remaining;
      const newEnemies = state.enemies.map((e, i) => i === state.targetIdx ? { ...e, shields: e.shields.slice(1) } : e);
      if (overflow <= 0) {
        const step: ResolvedDart = { dart, damage: 0, kind: 'shield_break', shieldTarget: `${shield.flatHp}HP shield`, enemyId: t.id, enemyName: t.name, hpAfter: t.hp, attackerPower: power, targetArmor: t.armor, vulnerable: t.vulnerableTurns > 0 };
        return { resolvedDart: step, newEnemies, newPlayers: state.players, chargeGained: 0, partyHeal: 0 };
      }
      const armorMax2a = Number.isFinite(cfg?.armorMax) ? (cfg?.armorMax as number) : Number.MAX_SAFE_INTEGER;
      const armorA = Math.min(armorMax2a, t.armor);
      const postArmorA = Math.max(1, Math.round(overflow * (1 - armorA / 100)));
      const newHpA = Math.max(0, t.hp - postArmorA);
      const defeatedA = newHpA <= 0;
      const finalEnemiesA = newEnemies.map((e, i) => i === state.targetIdx ? { ...e, hp: newHpA, defeated: defeatedA } : e);
      const stepA: ResolvedDart = { dart, damage: postArmorA, kind: defeatedA ? 'defeated' : 'damage', enemyId: t.id, enemyName: t.name, hpAfter: newHpA, attackerPower: power, targetArmor: armorA, vulnerable: t.vulnerableTurns > 0 };
      return { resolvedDart: stepA, newEnemies: finalEnemiesA, newPlayers: state.players, chargeGained: computeChargeGained(dart, cfg, trinkets), partyHeal: 0 };
    }
    if (!dartMatchesShield(dart, shield)) {
      const step: ResolvedDart = { dart, damage: 0, kind: 'shield_break', shieldTarget: describeShield(shield), enemyId: t.id, enemyName: t.name, hpAfter: t.hp, attackerPower: power, targetArmor: t.armor, vulnerable: t.vulnerableTurns > 0 };
      return { resolvedDart: step, newEnemies: state.enemies, newPlayers: state.players, chargeGained: 0, partyHeal: 0 };
    }
    const step: ResolvedDart = { dart, damage: 0, kind: 'miss', enemyId: t.id, enemyName: t.name, hpAfter: t.hp, attackerPower: power, targetArmor: t.armor, vulnerable: t.vulnerableTurns > 0 };
    const newEnemies = state.enemies.map((e, i) => i === state.targetIdx ? { ...e, shields: e.shields.slice(1) } : e);
    return { resolvedDart: step, newEnemies, newPlayers: state.players, chargeGained: 0, partyHeal: 0 };
  }

  if (dart.value <= 0) {
    const step: ResolvedDart = { dart, damage: 0, kind: 'miss', enemyId: t.id, enemyName: t.name, hpAfter: t.hp };
    return { resolvedDart: step, newEnemies: state.enemies, newPlayers: state.players, chargeGained: 0, partyHeal: 0 };
  }

  const critBuff = thrower?.buffs.find(b => b.kind === 'crit');
  const critGuarantee = thrower?.buffs.find(b => b.kind === 'crit_guarantee');
  const critMultBuff = thrower?.buffs.find(b => b.kind === 'crit_multiplier');
  const critChance = (thrower ? thrower.crit : 0) + (critBuff ? critBuff.amount : 0);
  const isCrit = critGuarantee ? true : Math.random() * 100 < critChance;
  const critMult = critMultBuff ? critMultBuff.amount : 2;

  const rawDmg = dart.value + power;
  const armorMax2 = Number.isFinite(cfg?.armorMax) ? (cfg?.armorMax as number) : Number.MAX_SAFE_INTEGER;
  const armor = Math.min(armorMax2, t.armor);
  const postArmor = Math.max(1, Math.round(rawDmg * (1 - armor / 100)));
  let surgeDmg = isCrit ? Math.round(postArmor * critMult) : postArmor;

  if (trinkets.includes('trk_double_tap') && Math.random() < 0.2) surgeDmg *= 2;
  if (trinkets.includes('trk_executioner') && t.hp < t.maxHp * 0.25) surgeDmg = Math.round(surgeDmg * 1.5);

  const vulnerable = t.vulnerableTurns > 0;
  const finalDmg = vulnerable ? Math.round(surgeDmg * 1.5) : surgeDmg;

  const newHp = Math.max(0, t.hp - finalDmg);
  const defeated = newHp <= 0;
  let newEnemies = state.enemies.map((e, i) =>
    i === state.targetIdx ? { ...e, hp: newHp, defeated } : e
  );

  if (trinkets.includes('trk_chain_lightning') && finalDmg > 0) {
    const splash = Math.max(1, Math.round(finalDmg * 0.25));
    const splashTarget = newEnemies.find((e, i) => i !== state.targetIdx && !e.defeated && e.hp > 0);
    if (splashTarget) {
      const splashHp = Math.max(0, splashTarget.hp - splash);
      const splashDefeated = splashHp <= 0;
      newEnemies = newEnemies.map((e, i) =>
        i === newEnemies.indexOf(splashTarget) ? { ...e, hp: splashHp, defeated: splashDefeated } : e
      );
    }
  }

  if (trinkets.includes('trk_frozen_core') && !defeated && Math.random() < 0.25) {
    newEnemies = newEnemies.map((e, i) =>
      i === state.targetIdx ? { ...e, frozenTurns: Math.max(e.frozenTurns, 1) } : e
    );
  }

  const chargeGained = computeChargeGained(dart, cfg, trinkets);

  let newPlayers = state.players;
  if (isCrit && critGuarantee) {
    const remaining = critGuarantee.amount - 1;
    newPlayers = state.players.map((p, i) => {
      if (i !== state.playerTurnIdx) return p;
      const buffs = remaining > 0
        ? p.buffs.map(b => b === critGuarantee ? { ...b, amount: remaining } : b)
        : p.buffs.filter(b => b !== critGuarantee);
      return { ...p, buffs };
    });
  }

  const step: ResolvedDart = { dart, damage: finalDmg, kind: defeated ? 'defeated' : 'damage', enemyId: t.id, enemyName: t.name, hpAfter: newHp, attackerPower: power, targetArmor: armor, vulnerable, crit: isCrit, critMult: isCrit ? critMult : undefined };
  let partyHeal = 0;
  if (trinkets.includes('trk_vampiric') && dart.value > 0) partyHeal += 3;
  if (trinkets.includes('trk_second_wind') && defeated) partyHeal += 15;

  return { resolvedDart: step, newEnemies, newPlayers, chargeGained, partyHeal };
}

// ── Resolve the current player's visit ────────────────────────────────────────────

export function resolvePlayerVisit(state: CampaignBattleState, hasPlayedCards: boolean = false): CampaignBattleState {
  if (state.outcome !== 'ongoing') return state;
  if (state.outcome === 'victory' as any) return state;
  if (state.darts.length === 0 && !hasPlayedCards) return state;
  const isLastPlayer = state.playerTurnIdx >= state.players.length - 1;
  if (!isLastPlayer) {
    const next = (state.playerTurnIdx + 1) % state.players.length;
    return {
      ...state,
      playerTurnIdx: next,
      darts: [],
      resolvedDarts: [],
      visitEnemiesSnapshot: state.enemies.map(e => ({ ...e })),
    };
  }
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
