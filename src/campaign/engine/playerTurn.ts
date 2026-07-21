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

// ── Battle initialization ─────────────────────────────────────────────

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
  // Per-player starting charge: each player uses their own equipped coop
  // power-up's starting charge. This is the core fix for the bug where one
  // player could charge but another couldn't use their power-up.
  const party = players.map(p => {
    const equippedId = p.powerUps?.coopActive ?? null;
    const startCharge = equippedId ? (startMap[equippedId] || 0) : 0;
    return toCoopPlayer(p, settings, Math.max(0, Math.min(chargeCap, startCharge)));
  });
  // Apply team-wide passive bonuses (from each player's equipped passives)
  // to the party's stats. Power and armor bonuses raise the per-player stats
  // directly. The health bonus is applied to the SHARED party HP pool AFTER
  // averaging — adding it per-player before averaging would divide the
  // priest's contribution by the player count (a 2-player party with +120
  // priest HP would only get +60), and the per-player healthMax cap would
  // silently eat the bonus when base + bonus > cap. Applying it after
  // averaging means the full priest bonus is always granted.
  const passiveBonus = computePartyPassiveBonus(players);
  const healthMax = Number.isFinite(cfg?.healthMax) ? (cfg?.healthMax as number) : Number.MAX_SAFE_INTEGER;
  const armorMax = Number.isFinite(cfg?.armorMax) ? (cfg?.armorMax as number) : Number.MAX_SAFE_INTEGER;
  const powerMax = Number.isFinite(cfg?.powerMax) ? (cfg?.powerMax as number) : Number.MAX_SAFE_INTEGER;
  // Average of per-player BASE health (before passive bonus), capped at
  // healthMax. Computed from the original player attributes so the cap
  // can't eat the bonus before averaging.
  const startHealth = Number.isFinite(cfg?.attributeStartHealth) ? (cfg?.attributeStartHealth as number) : 0;
  const baseAvg = party.length
    ? Math.max(1, Math.min(healthMax, Math.round(players.reduce((acc, p) => {
        const h = p.attributes?.health;
        return acc + (typeof h === 'number' && Number.isFinite(h) ? Math.max(1, Math.min(healthMax, h)) : startHealth);
      }, 0) / players.length)))
    : 1;
  for (const cp of party) {
    // Per-player maxHp includes the passive bonus for display purposes, but
    // is NOT used to compute the shared party HP pool (see below).
    cp.maxHp = Math.min(healthMax, cp.maxHp + passiveBonus.health);
    cp.hp = cp.maxHp;
    cp.power = Math.min(powerMax, cp.power + passiveBonus.power);
    cp.armor = Math.min(armorMax, cp.armor + passiveBonus.armor);
  }
  // Party HP = average of per-player BASE health (before passive bonus),
  // then add the full team-wide passive health bonus on top. The bonus is
  // NOT subject to the base healthMax cap — priest passives are meant to
  // push the party past the normal cap (that's their whole point). This
  // keeps the averaging behavior (more players ≠ more base HP) while
  // ensuring the priest's contribution is not divided by the player count.
  const partyMaxHp = Math.max(1, baseAvg + passiveBonus.health);
  // Legacy shared charge kept for backwards-compat with old saves/tests.
  // Initialized to the first player's charge (mirrors old behavior).
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
    stats: {
      visitsUsed: 0,
      dartsThrown: 0,
      damageDealt: 0,
      enemiesDefeated: 0,
      powerUpsUsed: 0,
      partyHpLost: 0,
    },
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
    phantomDarts: 0,
    frozenEnemiesThisRound: [],
    passiveBonus,
  };
}

// ── Player turn ───────────────────────────────────────────────────────
//
// In Coop mode, each dart a player throws is resolved immediately against
// the targeted enemy — shields are checked, damage is applied, and the
// enemy may be defeated mid-visit. The thrower can keep throwing darts (up
// to 3) at any alive enemy. After the 3rd dart, the player taps "Continue"
// to see a summary of all darts thrown this visit (with per-dart target,
// damage, and resulting HP) and then advance to the next player or the
// enemy phase.
//
// `undoDart` reverts the most recent dart by restoring the enemy snapshot
// taken when the first dart of the visit was thrown.

export function addDart(
  state: CampaignBattleState,
  base: number,
  mult: number,
  labelOverride?: string,
  isBull?: boolean,
  settings?: Settings,
): CampaignBattleState {
  if (state.phase !== 'player') return state;
  if (state.darts.length >= 3) return state;
  let value: number, label: string;
  if (isBull) { value = 50; label = 'Bull'; }
  else if (base === 25) { value = mult === 2 ? 50 : 25; label = mult === 2 ? 'Bull' : '25'; }
  else if (base === 0) { value = 0; label = 'Miss'; }
  else { value = base * mult; label = (mult === 2 ? 'D' : mult === 3 ? 'T' : '') + base; }
  let dart: CampaignDart = {
    value,
    label: labelOverride || label,
    base,
    mult: isBull ? 2 : (base === 25 && value === 50 ? 2 : mult),
    isDouble: !!(isBull || (base === 25 && value === 50) || mult === 2),
    isBull: !!isBull || base === 25,
  };
  let phantomDarts = state.phantomDarts;
  // Phantom Darts power-up: convert thrown darts into bullseyes. Each
  // consumed dart decrements the counter. Misses (base 0) are not converted
  // so the player can still intentionally miss if they want.
  if (phantomDarts > 0 && base !== 0) {
    dart = { value: 50, label: '👻 Bull', base: 50, mult: 2, isDouble: true, isBull: true };
    phantomDarts = phantomDarts - 1;
  }

  // Power-up charge: every dart thrown contributes to the CURRENT THROWER's
  // coop power-up orb. This is per-player — other players' orbs are not
  // affected. Mirrors the competitive `addDartToGame` flow.
  const chargeCap = settings?.powerUpScaling?.chargeMax ?? 100;
  const gained = settings ? chargeFromDart(dart, settings) : 0;
  const throwerIdx = state.playerTurnIdx;
  const players = state.players.map((p, i) => i === throwerIdx
    ? { ...p, powerUpCharge: Math.min(chargeCap, p.powerUpCharge + gained) }
    : p);
  // Legacy shared charge kept in sync with the current thrower for backwards
  // compat with old code that reads state.powerUpCharge.
  const powerUpCharge = players[throwerIdx].powerUpCharge;

  // Snapshot enemies at the start of the visit so undo can restore them.
  const visitEnemiesSnapshot = state.darts.length === 0
    ? state.enemies.map(e => ({ ...e, shields: e.shields.map(s => ({ ...s })) }))
    : state.visitEnemiesSnapshot;

  // Resolve this dart immediately against the targeted enemy.
  const thrower = players[throwerIdx];
  if (!thrower) {
    return { ...state, players, darts: [...state.darts, dart], phantomDarts, visitEnemiesSnapshot, powerUpCharge };
  }
  const power = effectivePower(thrower);

  // Find a valid target (auto-pick first alive if the chosen one is dead).
  let targetIdx = state.targetIdx;
  let target = state.enemies[targetIdx];
  if (!target || target.defeated) {
    const firstAlive = state.enemies.findIndex(e => !e.defeated);
    if (firstAlive < 0) {
      // No alive enemies — just record the dart.
      return {
        ...state,
        players,
        darts: [...state.darts, dart],
        phantomDarts,
        visitEnemiesSnapshot,
        powerUpCharge,
      };
    }
    targetIdx = firstAlive;
    target = state.enemies[targetIdx];
  }

  const enemies = state.enemies.map(e => ({ ...e, shields: [...e.shields] }));
  const t = enemies[targetIdx];
  let step: ResolvedDart;
  if (t.shields.length > 0) {
    const shieldIdx = 0;
    const shield = t.shields[shieldIdx];
    if (dartMatchesShield(dart, shield)) {
      t.shields = t.shields.filter((_, i) => i !== shieldIdx);
      step = {
        dart, damage: 0, kind: 'shield_break',
        shieldTarget: describeShield(shield),
        enemyId: t.id, enemyName: t.name, hpAfter: t.hp,
        attackerPower: power, targetArmor: t.armor, vulnerable: t.vulnerableTurns > 0,
      };
    } else {
      step = {
        dart, damage: 0, kind: 'miss',
        enemyId: t.id, enemyName: t.name, hpAfter: t.hp,
        attackerPower: power, targetArmor: t.armor, vulnerable: t.vulnerableTurns > 0,
      };
    }
  } else {
    const dmg = computePlayerDartDamage(dart, power, t.armor);
    const vulnerable = t.vulnerableTurns > 0;
    const finalDmg = vulnerable ? Math.round(dmg * 1.5) : dmg;
    t.hp = Math.max(0, t.hp - finalDmg);
    const defeated = t.hp <= 0;
    if (defeated) t.defeated = true;
    step = {
      dart, damage: finalDmg, kind: defeated ? 'defeated' : 'damage',
      enemyId: t.id, enemyName: t.name, hpAfter: t.hp,
      attackerPower: power, targetArmor: t.armor, vulnerable,
    };
  }

  const anyAlive = enemies.some(e => !e.defeated);
  const outcome: CampaignBattleState['outcome'] = !anyAlive ? 'victory' : state.outcome;

  // Per-player kill/damage bookkeeping for the thrower (used by Dartlite
  // progress popups). Only counts real damage/defeats, not shield breaks or
  // misses.
  const dartDamage = step.kind === 'damage' || step.kind === 'defeated' ? step.damage : 0;
  const dartKill = step.kind === 'defeated' ? 1 : 0;
  const playersWithStats = players.map((p, i) => i === throwerIdx
    ? { ...p, kills: (p.kills ?? 0) + dartKill, damageDealt: (p.damageDealt ?? 0) + dartDamage }
    : p);

  return {
    ...state,
    players: playersWithStats,
    enemies,
    darts: [...state.darts, dart],
    resolvedDarts: [...state.resolvedDarts, step],
    targetIdx,
    phantomDarts,
    visitEnemiesSnapshot,
    outcome,
    powerUpCharge,
    stats: {
      ...state.stats,
      dartsThrown: state.stats.dartsThrown + 1,
      damageDealt: state.stats.damageDealt + dartDamage,
      enemiesDefeated: state.stats.enemiesDefeated + dartKill,
    },
  };
}

export function undoDart(state: CampaignBattleState, settings?: Settings): CampaignBattleState {
  if (!state.darts.length) return state;
  // Restore enemies from the visit snapshot (taken when the first dart was
  // thrown). If this was the first dart, clear the snapshot.
  const enemies = state.visitEnemiesSnapshot.length
    ? state.visitEnemiesSnapshot.map(e => ({ ...e, shields: e.shields.map(s => ({ ...s })) }))
    : state.enemies;
  const resolvedDarts = state.resolvedDarts.slice(0, -1);
  const darts = state.darts.slice(0, -1);
  const visitEnemiesSnapshot = darts.length === 0 ? [] : state.visitEnemiesSnapshot;
  // Recompute outcome — undoing a dart could un-defeat an enemy.
  const anyAlive = enemies.some(e => !e.defeated);
  const outcome: CampaignBattleState['outcome'] = !anyAlive ? 'victory' : 'ongoing';
  // Revert the power-up charge added by the undone dart from the CURRENT
  // THROWER's per-player orb (not the shared pool).
  const undoneDart = state.darts[state.darts.length - 1];
  const revert = settings ? chargeFromDart(undoneDart, settings) : 0;
  const throwerIdx = state.playerTurnIdx;
  const players = state.players.map((p, i) => i === throwerIdx
    ? { ...p, powerUpCharge: Math.max(0, p.powerUpCharge - revert) }
    : p);
  const powerUpCharge = Math.max(0, state.powerUpCharge - revert);
  return {
    ...state,
    players,
    enemies,
    darts,
    resolvedDarts,
    visitEnemiesSnapshot,
    outcome,
    powerUpCharge,
  };
}

export function setTarget(state: CampaignBattleState, enemyId: string): CampaignBattleState {
  const idx = state.enemies.findIndex(e => e.id === enemyId);
  if (idx < 0) return state;
  return { ...state, targetIdx: idx };
}

// Effective power for the current thrower, including active buffs.
export function effectivePower(player: CoopPlayer): number {
  const buff = player.buffs.filter(b => b.kind === 'power').reduce((a, b) => a + b.amount, 0);
  return Math.max(0, player.power + buff);
}

// Per-dart damage = round((dartValue + power) * (1 − armor/100)), min 1 on a
// hit. Armor is a percentage (e.g. armor 10 reduces damage by 10%). Misses
// deal 0.
export function computePlayerDartDamage(dart: CampaignDart, attackerPower: number, targetArmor: number): number {
  if (dart.value <= 0) return 0;
  const base = Math.max(0, dart.value + attackerPower);
  const armorPct = Math.max(0, targetArmor);
  const mitigated = base * (1 - armorPct / 100);
  return Math.max(1, Math.round(mitigated));
}

// After a player has thrown all their darts (and the damage has already
// been applied dart-by-dart via `addDart`), `resolvePlayerVisit` finalizes
// the visit: it logs the visit, clears the dart slots, and advances to the
// next player or to the enemy phase. The UI shows a summary overlay of all
// darts thrown this visit before calling this.
export function resolvePlayerVisit(state: CampaignBattleState): CampaignBattleState {
  if (state.phase !== 'player') return state;
  if (!state.darts.length) return state;
  return advanceAfterPlayerVisit({
    ...state,
    darts: [],
    resolvedDarts: [],
    visitEnemiesSnapshot: [],
    stats: { ...state.stats, visitsUsed: state.stats.visitsUsed + 1 },
  });
}

// After a player's visit is fully animated, either pass to the next player
// or start the enemy phase.
function advanceAfterPlayerVisit(state: CampaignBattleState): CampaignBattleState {
  if (state.outcome === 'victory') {
    return {
      ...state,
      phase: 'player',
      darts: [],
      resolvedDarts: [],
      visitEnemiesSnapshot: [],
      awaitContinue: false,
    };
  }
  const nextIdx = state.playerTurnIdx + 1;
  if (nextIdx < state.players.length) {
    return {
      ...state,
      playerTurnIdx: nextIdx,
      darts: [],
      resolvedDarts: [],
      visitEnemiesSnapshot: [],
      awaitContinue: false,
    };
  }
  // All players have thrown — start the enemy phase.
  return {
    ...state,
    phase: 'enemy',
    darts: [],
    resolvedDarts: [],
    visitEnemiesSnapshot: [],
    awaitContinue: false,
  };
}

// Add power-up charge based on a dart just thrown (called from addDart flow
// in the UI, or rolled into resolvePlayerVisit). Returns the new charge.
export function chargeFromDart(dart: CampaignDart, settings: Settings): number {
  const cfg = settings.powerUpScaling;
  let c = 0;
  const isBull = dart.value === 50 || dart.value === 25;
  if (isBull) c += cfg.chargePerBull;
  else if (dart.mult === 3) c += cfg.chargePerTriple;
  else if (dart.mult === 2 || dart.isDouble) c += cfg.chargePerDouble;
  c += dart.value * cfg.chargePerScorePoint;
  return c;
}

// Re-exported for callers that combine player turn with enemy AI flow.
export { finishEnemyTurn };
export type { PlayerBuff, PartyPassiveBonus };
