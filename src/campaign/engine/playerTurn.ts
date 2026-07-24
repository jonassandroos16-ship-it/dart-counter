import type {
  CampaignBattleState,
  CampaignDart,
  CampaignLevel,
  ActiveEnemy,
  CoopPlayer,
  EnemyDatabase,
  PlayerBuff,
  ResolvedDart,
} from '../types';
import type { Player, Settings } from '../../types';
import { ENEMY_DATABASE } from '../enemyDatabase';
import { nextInstanceId } from './instanceIds';
import { computePartyPassiveBonus, type PartyPassiveBonus } from './classes';
import { toCoopPlayer } from './party';
import { dartMatchesShield, describeShield } from './shields';
import { finishEnemyTurn } from './enemyAi';
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
  const armorMax = Number.isFinite(cfg?.armorMax) ? (cfg?.armorMax as number) : Number.MAX_SAFE_INTEGER;
  const powerMax = Number.isFinite(cfg?.powerMax) ? (cfg?.powerMax as number) : Number.MAX_SAFE_INTEGER;
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
  const aliveEnemies = newEnemies.filter(e => !e.defeated);
  const allDefeated = aliveEnemies.length === 0;
  const newStats = {
    ...state.stats,
    dartsThrown: state.stats.dartsThrown + 1,
    damageDealt: state.stats.damageDealt + resolvedDart.damage,
    enemiesDefeated: state.stats.enemiesDefeated + (resolvedDart.kind === 'defeated' ? 1 : 0),
  };
  return {
    ...state,
    darts: newDarts,
    resolvedDarts: newResolved,
    enemies: newEnemies,
    players: updatedPlayers,
    stats: newStats,
    outcome: allDefeated ? 'victory' : state.outcome,
  };
}

export function undoDart(state: CampaignBattleState, settings?: Settings): CampaignBattleState {
  if (state.phase !== 'player') return state;
  if (state.darts.length === 0) return state;
  // Restore enemies from the snapshot taken at the start of this visit.
  // The snapshot was taken before any dart was thrown this visit, so we
  // re-apply all remaining darts to reconstruct the correct intermediate state.
  const snapshot = state.visitEnemiesSnapshot;
  if (!snapshot.length) return state;
  const newDarts = state.darts.slice(0, -1);
  // Re-resolve all remaining darts against the snapshot.
  let enemies = snapshot.map(e => ({ ...e }));
  let players = state.players.map(p => ({ ...p,
    damageDealt: 0,
    kills: 0,
  }));
  let totalDamage = 0;
  let totalKills = 0;
  const newResolved: ResolvedDart[] = [];
  for (const d of newDarts) {
    const mockState: CampaignBattleState = { ...state, enemies, players };
    const { resolvedDart, newEnemies, newPlayers } = resolveDart(d, mockState, settings);
    enemies = newEnemies;
    players = newPlayers.map(p => ({
      ...p,
      damageDealt: (p.damageDealt ?? 0) + (resolvedDart.damage > 0 && p.id === state.players[state.playerTurnIdx]?.id ? resolvedDart.damage : 0),
      kills: (p.kills ?? 0) + (resolvedDart.kind === 'defeated' && p.id === state.players[state.playerTurnIdx]?.id ? 1 : 0),
    }));
    totalDamage += resolvedDart.damage;
    if (resolvedDart.kind === 'defeated') totalKills++;
    newResolved.push(resolvedDart);
  }
  const newStats = {
    ...state.stats,
    dartsThrown: state.stats.dartsThrown - 1,
    damageDealt: state.stats.damageDealt - (state.resolvedDarts[state.resolvedDarts.length - 1]?.damage ?? 0),
    enemiesDefeated: state.stats.enemiesDefeated - (state.resolvedDarts[state.resolvedDarts.length - 1]?.kind === 'defeated' ? 1 : 0),
  };
  return {
    ...state,
    darts: newDarts,
    resolvedDarts: newResolved,
    enemies,
    players,
    stats: newStats,
    outcome: 'ongoing',
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
    // No valid target — find the first alive enemy.
    const fallback = state.enemies.find(e => !e.defeated);
    if (!fallback) {
      return {
        resolvedDart: { dart, damage: 0, kind: 'miss', enemyId: '', enemyName: 'None', hpAfter: 0 },
        newEnemies: state.enemies,
        newPlayers: state.players,
        chargeGained: 0,
      };
    }
  }
  const target = (!t || t.defeated) ? state.enemies.find(e => !e.defeated)! : t;

  // Compute attacker power (thrower's power + active power buffs)
  const cfg = settings?.powerUpScaling;
  const powerMax = Number.isFinite(cfg?.powerMax) ? (cfg?.powerMax as number) : Number.MAX_SAFE_INTEGER;
  const basePower = thrower ? Math.min(powerMax, thrower.power + thrower.buffs.filter(b => b.kind === 'power').reduce((s, b) => s + b.amount, 0)) : 0;
  const power = basePower;

  // Shield check: does this dart hit the frontmost shield?
  if (target.shields.length > 0) {
    const shield = target.shields[0];
    if (dartMatchesShield(dart, shield)) {
      const newShields = target.shields.slice(1);
      const newEnemies = state.enemies.map(e => e.id === target.id ? { ...e, shields: newShields } : e);
      const step: ResolvedDart = { dart, damage: 0, kind: 'shield_break', shieldTarget: describeShield(shield), enemyId: target.id, enemyName: target.name, hpAfter: target.hp, attackerPower: power, targetArmor: target.armor, vulnerable: target.vulnerableTurns > 0 };
      return { resolvedDart: step, newEnemies, newPlayers: state.players, chargeGained: 0 };
    } else {
      const step: ResolvedDart = { dart, damage: 0, kind: 'miss', enemyId: target.id, enemyName: target.name, hpAfter: target.hp, attackerPower: power, targetArmor: target.armor, vulnerable: target.vulnerableTurns > 0 };
      return { resolvedDart: step, newEnemies: state.enemies, newPlayers: state.players, chargeGained: 0 };
    }
  }

  // Crit check
  const critChance = thrower ? (thrower.crit + thrower.buffs.filter(b => b.kind === 'crit').reduce((s, b) => s + b.amount, 0)) : 0;
  const critGuarantee = thrower ? thrower.buffs.some(b => b.kind === 'crit_guarantee') : false;
  const isCrit = critGuarantee || (Math.random() * 100 < critChance);
  const critMult = isCrit
    ? (thrower ? 1 + thrower.buffs.filter(b => b.kind === 'crit_multiplier').reduce((s, b) => s + b.amount, 0) / 100 : 1) * 1.5
    : 1;

  // Raw damage: dart value + attacker power
  const rawDmg = dart.value + power;
  const armorMax = Number.isFinite(cfg?.armorMax) ? (cfg?.armorMax as number) : Number.MAX_SAFE_INTEGER;
  const armor = Math.min(armorMax, target.armor);
  const armorReduction = Math.floor(rawDmg * (armor / 100));
  const postArmor = Math.max(0, rawDmg - armorReduction);
  const vulnerable = target.vulnerableTurns > 0;
  const vulnMult = vulnerable ? 1.5 : 1;
  const finalDmg = Math.max(0, Math.round(postArmor * vulnMult * critMult));

  const newHp = Math.max(0, target.hp - finalDmg);
  const defeated = newHp <= 0;
  const newEnemies = state.enemies.map(e =>
    e.id === target.id ? { ...e, hp: newHp, defeated } : e,
  );

  // Charge gain: doubles, triples, and bulls each grant charge.
  const chargeGained = dart.isDouble || dart.isBull ? 20 : dart.mult === 3 ? 15 : 0;

  const step: ResolvedDart = { dart, damage: finalDmg, kind: defeated ? 'defeated' : 'damage', enemyId: target.id, enemyName: target.name, hpAfter: newHp, attackerPower: power, targetArmor: armor, vulnerable, crit: isCrit, critMult: isCrit ? critMult : undefined };
  return { resolvedDart: step, newEnemies, newPlayers: state.players, chargeGained };
}

// ── Resolve full player visit (after 3 darts) ─────────────────────────────────

export function resolvePlayerVisit(
  state: CampaignBattleState,
  isLastPlayer: boolean,
): CampaignBattleState {
  const allDefeated = state.enemies.every(e => e.defeated);
  if (allDefeated) {
    return { ...state, outcome: 'victory', phase: 'player' };
  }
  if (!isLastPlayer) {
    // Advance to the next player's turn within the same player phase.
    const nextIdx = state.playerTurnIdx + 1;
    return {
      ...state,
      playerTurnIdx: nextIdx,
      darts: [],
      resolvedDarts: [],
      visitEnemiesSnapshot: state.enemies.map(e => ({ ...e })),
      stats: { ...state.stats, visitsUsed: state.stats.visitsUsed + 1 },
    };
  }
  // Last player — transition to enemy phase.
  return {
    ...state,
    phase: 'enemy',
    playerTurnIdx: 0,
    darts: [],
    resolvedDarts: [],
    visitEnemiesSnapshot: [],
    stats: { ...state.stats, visitsUsed: state.stats.visitsUsed + 1 },
  };
}

// ── Target selection ───────────────────────────────────────────────────────────

export function setTarget(state: CampaignBattleState, targetIdx: number): CampaignBattleState {
  if (targetIdx < 0 || targetIdx >= state.enemies.length) return state;
  if (state.enemies[targetIdx].defeated) return state;
  return { ...state, targetIdx };
}

// ── Effective power helper ───────────────────────────────────────────────────
// Returns the effective attack power of a CoopPlayer, including active
// power buffs. Used by the UI to display the current effective power stat.
export function effectivePower(player: CoopPlayer): number {
  return player.power + player.buffs.filter(b => b.kind === 'power').reduce((s, b) => s + b.amount, 0);
}
