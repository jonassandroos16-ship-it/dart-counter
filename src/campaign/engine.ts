import type {
  ActiveEnemy,
  CampaignBattleState,
  CampaignDart,
  CampaignLevel,
  CampaignProgress,
  CoopPlayer,
  CoopPowerUpDef,
  CoopPowerUpId,
  EnemyDef,
  EnemyDatabase,
  ExactTarget,
  PlayerBuff,
  ResolvedDart,
  ShieldLayer,
  SpanTarget,
  EnemyAttackStep,
  VisitLogEntry,
} from './types';
import { ENEMY_DATABASE } from './enemyDatabase';
import { CAMPAIGN_LEVELS } from './campaignLevels';
import type { Player, Settings } from '../types';

// How much the Focus Buff subtracts from each alive enemy's accuracy and
// precision while active. 0.2 mirrors the old "+20% accuracy" hint but now
// applies to the AI's throw, where it actually has an in-game effect.
const FOCUS_BUFF_DISTRACT_AMOUNT = 0.2;
const FOCUS_BUFF_TURNS = 3;

export const COOP_POWER_UPS: CoopPowerUpDef[] = [
  // ── Starter tier (always available) ───────────────────────────────
  { id: 'coop_heal', name: 'Heal', icon: '❤️', desc: 'Restore 80 party HP instantly.', cost: 100, tier: 'starter' },
  { id: 'coop_buff_power', name: 'Power Buff', icon: '⚡', desc: 'All players +10 power for 3 turns.', cost: 80, tier: 'starter' },
  { id: 'coop_buff_acc', name: 'Focus Buff', icon: '🎯', desc: 'Distract all enemies — -20% accuracy & precision for 3 turns.', cost: 80, tier: 'starter' },
  { id: 'coop_freeze', name: 'Freeze', icon: '❄️', desc: 'Freeze all enemies for 2 turns — they cannot attack.', cost: 100, tier: 'starter' },
  { id: 'coop_shield', name: 'Party Shield', icon: '🛡️', desc: 'Absorb the next 40 party damage from enemies.', cost: 70, tier: 'starter' },
  // ── Advanced tier (unlocked as level rewards) ──────────────────────
  // Each is stronger than the one before it. Apocalypse is the boss reward.
  { id: 'coop_meteor', name: 'Meteor Strike', icon: '☄️', desc: 'Rain fire on every enemy — 60 damage to each, ignoring shields.', cost: 90, tier: 'advanced' },
  { id: 'coop_phantom', name: 'Phantom Darts', icon: '👻', desc: 'Your next 3 darts auto-hit bullseye (50 each) on the targeted enemy.', cost: 80, tier: 'advanced' },
  { id: 'coop_time_warp', name: 'Time Warp', icon: '⏳', desc: 'Enemies take 50% more damage from all sources for 3 turns.', cost: 110, tier: 'advanced' },
  { id: 'coop_ressurect', name: 'Resurrection', icon: '✨', desc: 'Restore the party to full HP and clear all enemy shields.', cost: 130, tier: 'advanced' },
  { id: 'coop_apocalypse', name: 'Apocalypse', icon: '🔥', desc: 'BOSS REWARD: 150 damage to every enemy, freeze them for 2 turns, and fully heal the party.', cost: 150, tier: 'advanced' },
];

export function getCoopPowerUp(id: CoopPowerUpId): CoopPowerUpDef | undefined {
  return COOP_POWER_UPS.find(p => p.id === id);
}

// Starter power-ups are always available. Advanced power-ups unlock as level
// rewards. This helper returns the full list of ids a player can equip given
// their campaign progress.
export function unlockedCoopPowerUps(progress: CampaignProgress | undefined | null): string[] {
  const starter = COOP_POWER_UPS.filter(p => p.tier === 'starter').map(p => p.id);
  const advanced = (progress?.unlockedPowerUps || []) as string[];
  return [...starter, ...advanced];
}

// Returns the reward power-up id for a level, or null if none.
export function levelRewardPowerUp(levelId: number): string | null {
  const level = getLevel(levelId);
  if (!level || !level.reward_power_up) return null;
  return level.reward_power_up;
}

let instanceCounter = 0;
function nextInstanceId(prefix: string): string {
  instanceCounter += 1;
  return `${prefix}_${instanceCounter}_${Math.random().toString(36).slice(2, 6)}`;
}

export function getLevel(levelId: number): CampaignLevel | undefined {
  return CAMPAIGN_LEVELS.levels.find(l => l.level_id === levelId);
}

export function getEnemyDef(defId: string, db: EnemyDatabase = ENEMY_DATABASE): EnemyDef | undefined {
  return db[defId];
}

export function totalLevels(): number {
  return CAMPAIGN_LEVELS.levels.length;
}

// ── Party attribute aggregation ──────────────────────────────────────
//
// Party HP for a level = sum of each selected player's `health` attribute
// (NOT capped — the per-player `healthMax` cap applies to individuals, not
// to the party total). Armor and power are averaged (sum / playerCount) so
// adding more players can't push armor/power above the configured caps —
// they share the load. Each player still attacks with their own per-dart
// power (so high power players hit harder), but the shared armor is what
// mitigates incoming enemy damage.

export function partyMaxHpFor(players: Player[], settings: Settings): number {
  const cfg = settings.powerUpScaling;
  const startHealth = Number.isFinite(cfg.attributeStartHealth) ? cfg.attributeStartHealth : 0;
  const sum = players.reduce((acc, p) => {
    const h = p.attributes?.health;
    return acc + (typeof h === 'number' && Number.isFinite(h) ? Math.max(1, h) : startHealth);
  }, 0);
  return Math.max(1, sum);
}

export function partyArmorFor(players: Player[], settings: Settings): number {
  const cfg = settings.powerUpScaling;
  if (!players.length) return 0;
  const armorMax = Number.isFinite(cfg.armorMax) ? cfg.armorMax : Number.MAX_SAFE_INTEGER;
  const startArmor = Number.isFinite(cfg.attributeStartArmor) ? cfg.attributeStartArmor : 0;
  const sum = players.reduce((acc, p) => {
    const a = p.attributes?.armor;
    return acc + (typeof a === 'number' && Number.isFinite(a) ? a : startArmor);
  }, 0);
  // Divide by player count so the combined armor never exceeds the cap.
  const avg = sum / players.length;
  return Math.max(0, Math.min(armorMax, avg));
}

export function partyPowerFor(players: Player[], settings: Settings): number {
  const cfg = settings.powerUpScaling;
  if (!players.length) return 0;
  const powerMax = Number.isFinite(cfg.powerMax) ? cfg.powerMax : Number.MAX_SAFE_INTEGER;
  const startPower = Number.isFinite(cfg.attributeStartPower) ? cfg.attributeStartPower : 0;
  const sum = players.reduce((acc, p) => {
    const pw = p.attributes?.power;
    return acc + (typeof pw === 'number' && Number.isFinite(pw) ? pw : startPower);
  }, 0);
  const avg = sum / players.length;
  return Math.max(0, Math.min(powerMax, avg));
}

// Per-player snapshot used during a battle.
function toCoopPlayer(p: Player, settings: Settings): CoopPlayer {
  const cfg = settings.powerUpScaling;
  const healthMax = Number.isFinite(cfg.healthMax) ? cfg.healthMax : Number.MAX_SAFE_INTEGER;
  const armorMax = Number.isFinite(cfg.armorMax) ? cfg.armorMax : Number.MAX_SAFE_INTEGER;
  const powerMax = Number.isFinite(cfg.powerMax) ? cfg.powerMax : Number.MAX_SAFE_INTEGER;
  const startHealth = Number.isFinite(cfg.attributeStartHealth) ? cfg.attributeStartHealth : 0;
  const startArmor = Number.isFinite(cfg.attributeStartArmor) ? cfg.attributeStartArmor : 0;
  const startPower = Number.isFinite(cfg.attributeStartPower) ? cfg.attributeStartPower : 0;
  const h = Number.isFinite(p.attributes?.health) ? p.attributes!.health : startHealth;
  const a = Number.isFinite(p.attributes?.armor) ? p.attributes!.armor : startArmor;
  const pw = Number.isFinite(p.attributes?.power) ? p.attributes!.power : startPower;
  return {
    id: p.id,
    name: p.name,
    color: p.color,
    hp: Math.max(1, Math.min(healthMax, h)),
    maxHp: Math.max(1, Math.min(healthMax, h)),
    power: Math.max(0, Math.min(powerMax, pw)),
    armor: Math.max(0, Math.min(armorMax, a)),
    buffs: [],
  };
}

// ── Battle initialization ─────────────────────────────────────────────

export function startBattle(
  level: CampaignLevel,
  players: Player[],
  settings: Settings,
  db: EnemyDatabase = ENEMY_DATABASE,
): CampaignBattleState {
  const party = players.map(p => toCoopPlayer(p, settings));
  const partyMaxHp = partyMaxHpFor(players, settings);
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
    playerTurnIdx: 0,
    darts: [],
    enemies,
    targetIdx: 0,
    phase: 'player',
    lastVisitLog: [],
    visitNumber: 1,
    outcome: 'ongoing',
    powerUpCharge: 0,
    resolvedDarts: [],
    visitEnemiesSnapshot: [],
    pendingEnemyAttacks: [],
    appliedEnemyAttacks: [],
    awaitContinue: false,
    phantomDarts: 0,
  };
}

// ── Shield matching ───────────────────────────────────────────────────

const DARTBOARD_ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

function neighborsOf(base: number): number[] {
  const i = DARTBOARD_ORDER.indexOf(base);
  if (i < 0) return [];
  const left = DARTBOARD_ORDER[(i - 1 + DARTBOARD_ORDER.length) % DARTBOARD_ORDER.length];
  const right = DARTBOARD_ORDER[(i + 1) % DARTBOARD_ORDER.length];
  return [left, right];
}

function isTopHalf(base: number): boolean {
  return base >= 11 && base <= 20;
}
function isBottomHalf(base: number): boolean {
  return base >= 1 && base <= 10;
}
function isLeftHalf(base: number): boolean {
  const i = DARTBOARD_ORDER.indexOf(base);
  return i % 2 === 0;
}
function isRightHalf(base: number): boolean {
  const i = DARTBOARD_ORDER.indexOf(base);
  return i % 2 === 1;
}

export function dartMatchesShield(dart: CampaignDart, shield: ShieldLayer): boolean {
  if (shield.type === 'span') {
    const target = shield.target_value as SpanTarget;
    if (dart.base === 0) return false;
    switch (target) {
      case 'TOP_HALF': return isTopHalf(dart.base);
      case 'BOTTOM_HALF': return isBottomHalf(dart.base);
      case 'LEFT_HALF': return isLeftHalf(dart.base);
      case 'RIGHT_HALF': return isRightHalf(dart.base);
      case 'ANY_DOUBLE': return dart.isDouble;
      case 'ANY_TRIPLE': return dart.mult === 3 && !dart.isBull;
      case 'ANY_BULL': return dart.base === 25 || dart.base === 50;
    }
    return false;
  }
  const t = shield.target_value as ExactTarget;
  return matchesExactTarget(dart, t);
}

function matchesExactTarget(dart: CampaignDart, t: ExactTarget): boolean {
  if (t === 'Bull') return dart.base === 50;
  if (t === '25') return dart.base === 25 && !dart.isBull;
  const m = /^([DT]?)(\d+)$/.exec(t);
  if (!m) return false;
  const mult = m[1] === 'D' ? 2 : m[1] === 'T' ? 3 : 1;
  const base = Number(m[2]);
  if (!Number.isFinite(base)) return false;
  if (dart.base !== base) return false;
  if (base === 25 || base === 50) return true;
  return dart.mult === mult;
}

export function describeShield(shield: ShieldLayer): string {
  if (shield.type === 'span') {
    const map: Record<SpanTarget, string> = {
      TOP_HALF: 'Top Half',
      BOTTOM_HALF: 'Bottom Half',
      LEFT_HALF: 'Left Half',
      RIGHT_HALF: 'Right Half',
      ANY_DOUBLE: 'Any Double',
      ANY_TRIPLE: 'Any Triple',
      ANY_BULL: 'Any Bull',
    };
    return map[shield.target_value as SpanTarget] || String(shield.target_value);
  }
  const t = shield.target_value as ExactTarget;
  if (t === 'Bull') return 'Bullseye';
  if (t === '25') return '25 (outer bull)';
  const m = /^([DT]?)(\d+)$/.exec(t);
  if (!m) return t;
  const prefix = m[1] === 'D' ? 'Double ' : m[1] === 'T' ? 'Triple ' : 'Single ';
  return prefix + m[2];
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

  // Power-up charge: every dart thrown contributes to the party's shared
  // coop power-up orb. Mirrors the competitive `addDartToGame` flow, which
  // calls `chargeFromDart` per dart. Without this, the coop orb never
  // charges (it stayed at 0% forever).
  const chargeCap = settings?.powerUpScaling?.chargeMax ?? 100;
  const gained = settings ? chargeFromDart(dart, settings) : 0;
  const powerUpCharge = Math.min(chargeCap, state.powerUpCharge + gained);

  // Snapshot enemies at the start of the visit so undo can restore them.
  const visitEnemiesSnapshot = state.darts.length === 0
    ? state.enemies.map(e => ({ ...e, shields: e.shields.map(s => ({ ...s })) }))
    : state.visitEnemiesSnapshot;

  // Resolve this dart immediately against the targeted enemy.
  const thrower = state.players[state.playerTurnIdx];
  if (!thrower) {
    return { ...state, darts: [...state.darts, dart], phantomDarts, visitEnemiesSnapshot, powerUpCharge };
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
      };
    } else {
      step = {
        dart, damage: 0, kind: 'miss',
        enemyId: t.id, enemyName: t.name, hpAfter: t.hp,
      };
    }
  } else {
    const dmg = computePlayerDartDamage(dart, power, t.armor);
    const finalDmg = t.vulnerableTurns > 0 ? Math.round(dmg * 1.5) : dmg;
    t.hp = Math.max(0, t.hp - finalDmg);
    const defeated = t.hp <= 0;
    if (defeated) t.defeated = true;
    step = {
      dart, damage: finalDmg, kind: defeated ? 'defeated' : 'damage',
      enemyId: t.id, enemyName: t.name, hpAfter: t.hp,
    };
  }

  const anyAlive = enemies.some(e => !e.defeated);
  const outcome: CampaignBattleState['outcome'] = !anyAlive ? 'victory' : state.outcome;

  return {
    ...state,
    enemies,
    darts: [...state.darts, dart],
    resolvedDarts: [...state.resolvedDarts, step],
    targetIdx,
    phantomDarts,
    visitEnemiesSnapshot,
    outcome,
    powerUpCharge,
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
  // Revert the power-up charge added by the undone dart so the orb reflects
  // only darts still on the board.
  const undoneDart = state.darts[state.darts.length - 1];
  const revert = settings ? chargeFromDart(undoneDart, settings) : 0;
  const powerUpCharge = Math.max(0, state.powerUpCharge - revert);
  return {
    ...state,
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
function effectivePower(player: CoopPlayer): number {
  const buff = player.buffs.filter(b => b.kind === 'power').reduce((a, b) => a + b.amount, 0);
  return Math.max(0, player.power + buff);
}

// Per-dart damage = max(0, dartValue + power) − armor, min 1 on a hit. Misses deal 0.
export function computePlayerDartDamage(dart: CampaignDart, attackerPower: number, targetArmor: number): number {
  if (dart.value <= 0) return 0;
  const raw = Math.max(0, dart.value + attackerPower) - Math.max(0, targetArmor);
  return Math.max(1, raw);
}

// After a player has thrown all their darts (and the damage has already
// been applied dart-by-dart via `addDart`), `resolvePlayerVisit` finalizes
// the visit: it logs the visit, clears the dart slots, and advances to the
// next player or to the enemy phase. The UI shows a summary overlay of all
// darts thrown this visit before calling this.
export function resolvePlayerVisit(state: CampaignBattleState): CampaignBattleState {
  if (state.phase !== 'player') return state;
  if (!state.darts.length) return state;
  return advanceAfterPlayerVisit({ ...state, darts: [], resolvedDarts: [], visitEnemiesSnapshot: [] });
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

// ── Enemy AI turn ─────────────────────────────────────────────────────

// Effective accuracy/precision for an enemy, applying the Focus Buff
// distract debuff (clamped to >= 0).
function effectiveAccuracy(enemy: ActiveEnemy): number {
  return enemy.distractedTurns > 0
    ? Math.max(0, enemy.accuracy - enemy.distractAmount)
    : enemy.accuracy;
}
function effectivePrecision(enemy: ActiveEnemy): number {
  return enemy.distractedTurns > 0
    ? Math.max(0, enemy.precision - enemy.distractAmount)
    : enemy.precision;
}

function simulateEnemyDart(enemy: ActiveEnemy, rng: () => number): CampaignDart {
  const intendedBase = 20;
  const intendedMult = 3;
  const hit = rng() < effectiveAccuracy(enemy);
  let base = intendedBase;
  let mult = intendedMult;
  if (!hit) {
    if (rng() < effectivePrecision(enemy)) {
      const neighbors = neighborsOf(intendedBase);
      base = neighbors[Math.floor(rng() * neighbors.length)] || intendedBase;
    } else {
      base = DARTBOARD_ORDER[Math.floor(rng() * DARTBOARD_ORDER.length)];
    }
    const r = rng();
    mult = r < 0.1 ? 3 : r < 0.25 ? 2 : 1;
  }
  return makeDart(base, mult);
}

function makeDart(base: number, mult: number): CampaignDart {
  if (base === 25) {
    return { value: mult === 2 ? 50 : 25, label: mult === 2 ? 'Bull' : '25', base: 25, mult: mult === 2 ? 2 : 1, isDouble: mult === 2, isBull: true };
  }
  if (base === 50) {
    return { value: 50, label: 'Bull', base: 50, mult: 2, isDouble: true, isBull: true };
  }
  if (base === 0) {
    return { value: 0, label: 'Miss', base: 0, mult: 1, isDouble: false };
  }
  const value = base * mult;
  const label = (mult === 2 ? 'D' : mult === 3 ? 'T' : '') + base;
  return { value, label, base, mult, isDouble: mult === 2, isBull: false };
}

// Build the list of enemy attack steps for the upcoming enemy phase. Each
// alive (and non-frozen) enemy throws 3 darts; each dart is one step so the
// UI can animate them one at a time. Frozen enemies skip their turn and
// have their `frozenTurns` decremented.
export function prepareEnemyTurn(state: CampaignBattleState, rng: () => number = Math.random): CampaignBattleState {
  if (state.phase !== 'enemy') return state;
  const steps: EnemyAttackStep[] = [];
  let partyHp = state.partyHp;
  const enemies = state.enemies.map(e => ({ ...e }));
  for (const enemy of enemies) {
    if (enemy.defeated) continue;
    if (enemy.frozenTurns > 0) {
      enemy.frozenTurns -= 1;
      continue;
    }
    for (let i = 0; i < 3; i++) {
      const dart = simulateEnemyDart(enemy, rng);
      const dmg = Math.max(0, dart.value); // enemy damage = dart value, no armor reduction for simplicity
      partyHp = Math.max(0, partyHp - dmg);
      steps.push({
        enemyId: enemy.id,
        enemyName: enemy.name,
        dart,
        damage: dmg,
        partyHpAfter: partyHp,
      });
    }
  }
  return {
    ...state,
    enemies,
    pendingEnemyAttacks: steps,
    appliedEnemyAttacks: [],
    awaitContinue: true,
  };
}

// Apply the next pending enemy attack step. When the queue empties, return
// to the player phase (or defeat if party HP is 0). Each applied step is
// moved to `appliedEnemyAttacks` so the overlay can show all darts thrown
// so far cumulatively (dart 1, 2, 3…) rather than only the current one.
export function applyNextEnemyAttack(state: CampaignBattleState): CampaignBattleState {
  if (!state.pendingEnemyAttacks.length) {
    return finishEnemyTurn(state);
  }
  const [step, ...rest] = state.pendingEnemyAttacks;
  const log: VisitLogEntry[] = [...state.lastVisitLog, { kind: 'player_attack_step', step }];
  const next: CampaignBattleState = {
    ...state,
    partyHp: step.partyHpAfter,
    pendingEnemyAttacks: rest,
    appliedEnemyAttacks: [...state.appliedEnemyAttacks, step],
    lastVisitLog: log,
    awaitContinue: rest.length > 0,
  };
  if (next.partyHp <= 0) {
    return { ...next, outcome: 'defeat', phase: 'player', pendingEnemyAttacks: [], appliedEnemyAttacks: [], awaitContinue: false };
  }
  if (!rest.length) {
    return finishEnemyTurn({ ...next, awaitContinue: false });
  }
  return next;
}

function finishEnemyTurn(state: CampaignBattleState): CampaignBattleState {
  if (state.partyHp <= 0) {
    return { ...state, outcome: 'defeat', phase: 'player', awaitContinue: false };
  }
  // Decrement player buff timers at the end of the round.
  const players = state.players.map(p => ({
    ...p,
    buffs: p.buffs
      .map(b => ({ ...b, turnsLeft: b.turnsLeft - 1 }))
      .filter(b => b.turnsLeft > 0),
  }));
  // Decrement enemy vulnerability timers (Time Warp) and Focus Buff
  // distract timers.
  const enemies = state.enemies.map(e => ({
    ...e,
    vulnerableTurns: Math.max(0, e.vulnerableTurns - 1),
    distractedTurns: Math.max(0, e.distractedTurns - 1),
    distractAmount: e.distractedTurns - 1 > 0 ? e.distractAmount : 0,
  }));
  return {
    ...state,
    players,
    enemies,
    phase: 'player',
    playerTurnIdx: 0,
    darts: [],
    resolvedDarts: [],
    visitEnemiesSnapshot: [],
    pendingEnemyAttacks: [],
    appliedEnemyAttacks: [],
    visitNumber: state.visitNumber + 1,
    awaitContinue: false,
  };
}

// ── Coop power-ups ────────────────────────────────────────────────────

export function canActivateCoopPowerUp(state: CampaignBattleState, id: CoopPowerUpId): boolean {
  if (state.phase !== 'player') return false;
  if (state.darts.length > 0) return false; // only before throwing
  const def = getCoopPowerUp(id);
  if (!def) return false;
  return state.powerUpCharge >= def.cost;
}

export function activateCoopPowerUp(state: CampaignBattleState, id: CoopPowerUpId): CampaignBattleState {
  if (!canActivateCoopPowerUp(state, id)) return state;
  const def = getCoopPowerUp(id)!;
  const thrower = state.players[state.playerTurnIdx];
  const charge = state.powerUpCharge - def.cost;
  if (id === 'coop_heal') {
    const healed = Math.min(state.partyMaxHp, state.partyHp + 80);
    return { ...state, partyHp: healed, powerUpCharge: charge };
  }
  if (id === 'coop_buff_power') {
    const kind: PlayerBuff['kind'] = 'power';
    const amount = 10;
    const buffId = `${kind}_${Date.now()}`;
    const players = state.players.map(p => ({
      ...p,
      buffs: [...p.buffs, { id: buffId, kind, amount, turnsLeft: 3, source: thrower.id }],
    }));
    return { ...state, players, powerUpCharge: charge };
  }
  if (id === 'coop_buff_acc') {
    // Focus Buff: distract every alive enemy. Reduce their accuracy and
    // precision for 3 turns. This is the in-game effect — darts are
    // user-tapped, so a player accuracy buff has no real-life effect.
    const enemies = state.enemies.map(e => e.defeated ? e : {
      ...e,
      distractedTurns: FOCUS_BUFF_TURNS,
      distractAmount: FOCUS_BUFF_DISTRACT_AMOUNT,
    });
    return { ...state, enemies, powerUpCharge: charge };
  }
  if (id === 'coop_freeze') {
    const enemies = state.enemies.map(e => e.defeated ? e : { ...e, frozenTurns: 2 });
    return { ...state, enemies, powerUpCharge: charge };
  }
  if (id === 'coop_shield') {
    // Represented as a buff on every player with kind 'shield' — the engine
    // doesn't reduce enemy damage directly, but we add a flat 40-HP party
    // shield by raising partyHp temporarily via a special buff. Simpler:
    // just heal 40 (acts as absorbtion).
    const healed = Math.min(state.partyMaxHp, state.partyHp + 40);
    return { ...state, partyHp: healed, powerUpCharge: charge };
  }
  // ── Advanced tier ───────────────────────────────────────────────────
  if (id === 'coop_meteor') {
    // 60 damage to every alive enemy, ignoring shields (shields are not
    // consumed since the meteor strikes directly).
    const enemies = state.enemies.map(e => {
      if (e.defeated) return e;
      const hp = Math.max(0, e.hp - 60);
      return { ...e, hp, defeated: hp <= 0 };
    });
    return { ...state, enemies, powerUpCharge: charge };
  }
  if (id === 'coop_phantom') {
    // The next 3 darts thrown by the current player auto-bullseye.
    return { ...state, phantomDarts: 3, powerUpCharge: charge };
  }
  if (id === 'coop_time_warp') {
    // All alive enemies take +50% damage for 3 rounds.
    const enemies = state.enemies.map(e => e.defeated ? e : { ...e, vulnerableTurns: 3 });
    return { ...state, enemies, powerUpCharge: charge };
  }
  if (id === 'coop_ressurect') {
    // Full party HP and clear all enemy shields.
    const enemies = state.enemies.map(e => ({ ...e, shields: [] }));
    return { ...state, partyHp: state.partyMaxHp, enemies, powerUpCharge: charge };
  }
  if (id === 'coop_apocalypse') {
    // Boss reward: 150 dmg to every alive enemy + freeze 2 turns + full heal.
    const enemies = state.enemies.map(e => {
      if (e.defeated) return e;
      const hp = Math.max(0, e.hp - 150);
      return { ...e, hp, defeated: hp <= 0, frozenTurns: 2, shields: [] };
    });
    return { ...state, enemies, partyHp: state.partyMaxHp, powerUpCharge: charge };
  }
  return state;
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

// ── Progress helpers ──────────────────────────────────────────────────

export function isLevelUnlocked(levelId: number, highestBeaten: number): boolean {
  if (levelId <= 1) return true;
  return levelId <= highestBeaten + 1;
}

export function nextLevelId(levelId: number): number | null {
  const idx = CAMPAIGN_LEVELS.levels.findIndex(l => l.level_id === levelId);
  if (idx < 0 || idx + 1 >= CAMPAIGN_LEVELS.levels.length) return null;
  return CAMPAIGN_LEVELS.levels[idx + 1].level_id;
}
