import type {
  CampaignBattleState,
  CampaignDart,
  CampaignLevel,
  ActiveEnemy,
  CoopPlayer,
  EnemyDatabase,
  ResolvedDart,
} from '../types';
import type { Player, Settings } from '../../types';
import { ENEMY_DATABASE } from '../enemyDatabase';
import { nextInstanceId } from './instanceIds';
import { computePartyPassiveBonus } from './classes';
import { toCoopPlayer } from './party';
import { dartMatchesShield, describeShield } from './shields';
import { effectiveAttributes } from '../../logic';

// ── Battle initialization ─────────────────────────────────────────────────────

export function startBattle(
  level: CampaignLevel,
  players: Player[],
  settings: Settings,
  db: EnemyDatabase = ENEMY_DATABASE,
  chapterId: string = 'crimson_vale',
): CampaignBattleState {
  const cfg = settings?.powerUpScaling;
  const chargeCap = Number.isFinite(cfg?.chargeMax) ? (cfg?.chargeMax as number) : 100;
  const startMap = (cfg && cfg.startingCharge) || {};
  const party = players.map(p => {
    const equippedId = p.powerUps?.coopActive ?? null;
    const startCharge = equippedId ? (startMap[equippedId] || 0) : 0;
    return toCoopPlayer(p, settings, Math.max(0, Math.min(chargeCap, startCharge)));
  });
  const passiveBonus = computePartyPassiveBonus(players);
  const healthMax = Number.isFinite(cfg?.healthMax) ? (cfg?.healthMax as number) : Number.MAX_SAFE_INTEGER;
  const startHealth = Number.isFinite(cfg?.attributeStartHealth) ? (cfg?.attributeStartHealth as number) : 0;
  const baseAvg = party.length
    ? Math.max(1, Math.min(healthMax, Math.round(players.reduce((s, p) => s + effectiveAttributes(p, settings).health + passiveBonus.health, startHealth) / players.length)))
    : 100;
  const partyMaxHp = Math.max(1, baseAvg + passiveBonus.health);
  const powerUpCharge = party.length ? party[0].powerUpCharge : 0;
  const enemies: ActiveEnemy[] = level.enemies.map((defId) => {
    const def = db[defId];
    if (!def) throw new Error(`Unknown enemy id: ${defId}`);
    return {
      id: nextInstanceId(defId),
      defId,
      name: def.name,
      hp: def.max_hp,
      maxHp: def.max_hp,
      armor: def.armor,
      accuracy: def.accuracy,
      precision: def.precision,
      shields: def.shields.map(s => ({ ...s })),
      defeated: false,
      frozenTurns: 0,
      vulnerableTurns: 0,
      distractedTurns: 0,
      distractAmount: 0,
      weakenedTurns: 0,
      weakenAmount: 0,
    };
  });
  return {
    levelId: level.level_id,
    levelName: level.name,
    isBoss: level.is_boss,
    partyHp: partyMaxHp,
    partyMaxHp,
    players: party,
    chapterId,
    stats: { visitsUsed: 0, dartsThrown: 0, damageDealt: 0, enemiesDefeated: 0, powerUpsUsed: 0, partyHpLost: 0 },
    playerTurnIdx: 0,
    darts: [],
    enemies,
    targetIdx: 0,
    phase: 'player',
    lastVisitLog: [],
    visitNumber: 1,
    outcome: 'ongoing',
    powerUpCharge,
    resolvedDarts: [],
    visitEnemiesSnapshot: [],
    pendingEnemyAttacks: [],
    appliedEnemyAttacks: [],
    awaitContinue: false,
    frozenEnemiesThisRound: [],
    passiveBonus,
  };
}

// ── Adding / undoing a dart ─────────────────────────────────────────────────────

export function addDart(
  state: CampaignBattleState,
  base: number,
  mult: number,
  labelOverride?: string,
  isBull?: boolean,
  settings?: Settings,
  maxDarts: number = 3,
): CampaignBattleState {
  if (state.phase !== 'player') return state;
  if (state.darts.length >= maxDarts) return state;
  const dart: CampaignDart = {
    value: base * mult,
    label: labelOverride || ((mult === 2 ? 'D' : mult === 3 ? 'T' : '') + base),
    base,
    mult,
    isDouble: mult === 2,
    isBull: !!isBull,
  };
  const newDarts = [...state.darts, dart];
  // Resolve this dart immediately against the targeted enemy.
  const { resolvedDart, newEnemies, newPlayers, chargeGained } = resolveDart(dart, state, settings);
  const newResolved = [...state.resolvedDarts, resolvedDart];
  const chargePerPlayer = chargeGained / Math.max(1, state.players.length);
  const cfg = settings?.powerUpScaling;
  const chargeCap = Number.isFinite(cfg?.chargeMax) ? (cfg?.chargeMax as number) : 100;
  const updatedPlayers = newPlayers.map(p => ({
    ...p,
    powerUpCharge: Math.min(chargeCap, p.powerUpCharge + chargePerPlayer),
    damageDealt: (p.damageDealt ?? 0) + (resolvedDart.damage > 0 && p.id === state.players[state.playerTurnIdx]?.id ? resolvedDart.damage : 0),
    kills: (p.kills ?? 0) + (resolvedDart.kind === 'defeated' && p.id === state.players[state.playerTurnIdx]?.id ? 1 : 0),
  }));
  const newStats = {
    ...state.stats,
    dartsThrown: state.stats.dartsThrown + 1,
    damageDealt: state.stats.damageDealt + resolvedDart.damage,
    enemiesDefeated: state.stats.enemiesDefeated + (resolvedDart.kind === 'defeated' ? 1 : 0),
  };
  // Check if all enemies are defeated
  const allDefeated = newEnemies.every(e => e.defeated);
  if (allDefeated) {
    return {
      ...state,
      darts: newDarts,
      enemies: newEnemies,
      players: updatedPlayers,
      resolvedDarts: newResolved,
      outcome: 'victory',
      stats: newStats,
    };
  }
  return {
    ...state,
    darts: newDarts,
    enemies: newEnemies,
    players: updatedPlayers,
    resolvedDarts: newResolved,
    stats: newStats,
  };
}

export function undoDart(state: CampaignBattleState, settings?: Settings): CampaignBattleState {
  if (!state.darts.length) return state;
  // Restore from the snapshot taken at the start of this visit
  const snapshot = state.visitEnemiesSnapshot;
  if (!snapshot.length) return state;
  const prev = state.darts.slice(0, -1);
  // Re-resolve all remaining darts from the snapshot
  let enemies = snapshot.map(e => ({ ...e }));
  let players = state.players.map(p => ({ ...p }));
  let resolvedDarts: ResolvedDart[] = [];
  let totalCharge = 0;
  const tempState = { ...state, enemies, players, darts: [], resolvedDarts: [] };
  for (const d of prev) {
    const { resolvedDart, newEnemies, newPlayers, chargeGained } = resolveDart(d, { ...tempState, enemies, players }, settings);
    enemies = newEnemies;
    players = newPlayers;
    resolvedDarts = [...resolvedDarts, resolvedDart];
    totalCharge += chargeGained;
  }
  const chargePerPlayer = totalCharge / Math.max(1, state.players.length);
  const cfg = settings?.powerUpScaling;
  const chargeCap = Number.isFinite(cfg?.chargeMax) ? (cfg?.chargeMax as number) : 100;
  players = players.map(p => ({
    ...p,
    powerUpCharge: Math.min(chargeCap, p.powerUpCharge + chargePerPlayer),
  }));
  const stats = {
    ...state.stats,
    dartsThrown: Math.max(0, state.stats.dartsThrown - 1),
    damageDealt: Math.max(0, state.stats.damageDealt - (state.resolvedDarts[state.resolvedDarts.length - 1]?.damage ?? 0)),
    enemiesDefeated: Math.max(0, state.stats.enemiesDefeated - (state.resolvedDarts[state.resolvedDarts.length - 1]?.kind === 'defeated' ? 1 : 0)),
  };
  return {
    ...state,
    darts: prev,
    enemies,
    players,
    resolvedDarts,
    stats,
  };
}

// ── Dart resolution ───────────────────────────────────────────────────────────

function resolveDart(
  dart: CampaignDart,
  state: CampaignBattleState,
  settings?: Settings,
): { resolvedDart: ResolvedDart; newEnemies: ActiveEnemy[]; newPlayers: CoopPlayer[]; chargeGained: number } {
  const t = state.enemies[state.targetIdx];
  const thrower = state.players[state.playerTurnIdx];
  if (!t || t.defeated) {
    const step: ResolvedDart = { dart, damage: 0, kind: 'miss', enemyId: t?.id ?? '', enemyName: t?.name ?? '', hpAfter: t?.hp ?? 0 };
    return { resolvedDart: step, newEnemies: state.enemies, newPlayers: state.players, chargeGained: 0 };
  }

  // Compute attacker power (thrower's power + active power buffs)
  const cfg = settings?.powerUpScaling;
  const powerMax = Number.isFinite(cfg?.powerMax) ? (cfg?.powerMax as number) : Number.MAX_SAFE_INTEGER;
  const basePower = thrower ? Math.min(powerMax, thrower.power + thrower.buffs.filter(b => b.kind === 'power').reduce((s, b) => s + b.amount, 0)) : 0;
  const power = basePower;

  // Shield check: if the dart doesn't break the next shield, record a shield-break or miss.
  if (t.shields.length > 0) {
    const shield = t.shields[0];
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
  const critMult = critMultBuff ? 1 + critMultBuff.amount / 100 : 2;

  // Raw damage: dart value + attacker power
  const rawDmg = dart.value + power;
  const armorMax2 = Number.isFinite(cfg?.armorMax) ? (cfg?.armorMax as number) : Number.MAX_SAFE_INTEGER;
  const armor = Math.min(armorMax2, t.armor);
  const postArmor = Math.max(0, rawDmg - armor);
  const surgeDmg = isCrit ? Math.round(postArmor * critMult) : postArmor;
  const vulnerable = t.vulnerableTurns > 0;
  const finalDmg = vulnerable ? Math.round(surgeDmg * 1.5) : surgeDmg;

  const newHp = Math.max(0, t.hp - finalDmg);
  const defeated = newHp <= 0;
  const newEnemies = state.enemies.map((e, i) =>
    i === state.targetIdx ? { ...e, hp: newHp, defeated } : e
  );

  let chargeGained = 0;
  if (dart.isDouble) chargeGained += 10;
  if (dart.isBull) chargeGained += 20;
  if (dart.mult === 3) chargeGained += 5;

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
