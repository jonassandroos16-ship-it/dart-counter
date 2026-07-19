import type {
  ActiveEnemy,
  CampaignBattleState,
  CampaignDart,
  CampaignLevel,
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

export const COOP_POWER_UPS: CoopPowerUpDef[] = [
  { id: 'coop_heal', name: 'Heal', icon: '❤️', desc: 'Restore 80 party HP instantly.', cost: 100 },
  { id: 'coop_buff_power', name: 'Power Buff', icon: '⚡', desc: 'All players +10 power for 3 turns.', cost: 80 },
  { id: 'coop_buff_acc', name: 'Focus Buff', icon: '🎯', desc: 'All players +20% accuracy for 3 turns (visual hint).', cost: 80 },
  { id: 'coop_freeze', name: 'Freeze', icon: '❄️', desc: 'Freeze all enemies for 2 turns — they cannot attack.', cost: 100 },
  { id: 'coop_shield', name: 'Party Shield', icon: '🛡️', desc: 'Absorb the next 40 party damage from enemies.', cost: 70 },
];

export function getCoopPowerUp(id: CoopPowerUpId): CoopPowerUpDef | undefined {
  return COOP_POWER_UPS.find(p => p.id === id);
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
// Party HP for a level = sum of each selected player's `health` attribute,
// capped by `healthMax`. Armor and power are averaged (sum / playerCount)
// so adding more players can't push armor/power above the configured caps
// — they share the load. Each player still attacks with their own per-dart
// power (so high power players hit harder), but the shared armor is what
// mitigates incoming enemy damage.

export function partyMaxHpFor(players: Player[], settings: Settings): number {
  const cfg = settings.powerUpScaling;
  const cap = cfg.healthMax;
  const sum = players.reduce((acc, p) => {
    const h = p.attributes?.health;
    return acc + (typeof h === 'number' && Number.isFinite(h) ? Math.max(1, h) : cfg.attributeStartHealth);
  }, 0);
  return Math.max(1, Math.min(cap, sum));
}

export function partyArmorFor(players: Player[], settings: Settings): number {
  const cfg = settings.powerUpScaling;
  if (!players.length) return 0;
  const sum = players.reduce((acc, p) => {
    const a = p.attributes?.armor;
    return acc + (typeof a === 'number' && Number.isFinite(a) ? a : cfg.attributeStartArmor);
  }, 0);
  // Divide by player count so the combined armor never exceeds the cap.
  const avg = sum / players.length;
  return Math.max(0, Math.min(cfg.armorMax, avg));
}

export function partyPowerFor(players: Player[], settings: Settings): number {
  const cfg = settings.powerUpScaling;
  if (!players.length) return 0;
  const sum = players.reduce((acc, p) => {
    const pw = p.attributes?.power;
    return acc + (typeof pw === 'number' && Number.isFinite(pw) ? pw : cfg.attributeStartPower);
  }, 0);
  const avg = sum / players.length;
  return Math.max(0, Math.min(cfg.powerMax, avg));
}

// Per-player snapshot used during a battle.
function toCoopPlayer(p: Player, settings: Settings): CoopPlayer {
  const cfg = settings.powerUpScaling;
  const h = Number.isFinite(p.attributes?.health) ? p.attributes!.health : cfg.attributeStartHealth;
  const a = Number.isFinite(p.attributes?.armor) ? p.attributes!.armor : cfg.attributeStartArmor;
  const pw = Number.isFinite(p.attributes?.power) ? p.attributes!.power : cfg.attributeStartPower;
  return {
    id: p.id,
    name: p.name,
    color: p.color,
    hp: Math.max(1, Math.min(cfg.healthMax, h)),
    maxHp: Math.max(1, Math.min(cfg.healthMax, h)),
    power: Math.max(0, Math.min(cfg.powerMax, pw)),
    armor: Math.max(0, Math.min(cfg.armorMax, a)),
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
    pendingPlayerDarts: [],
    pendingEnemyAttacks: [],
    awaitContinue: false,
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

export function addDart(
  state: CampaignBattleState,
  base: number,
  mult: number,
  labelOverride?: string,
  isBull?: boolean,
): CampaignBattleState {
  if (state.phase !== 'player') return state;
  if (state.darts.length >= 3) return state;
  let value: number, label: string;
  if (isBull) { value = 50; label = 'Bull'; }
  else if (base === 25) { value = mult === 2 ? 50 : 25; label = mult === 2 ? 'Bull' : '25'; }
  else if (base === 0) { value = 0; label = 'Miss'; }
  else { value = base * mult; label = (mult === 2 ? 'D' : mult === 3 ? 'T' : '') + base; }
  const dart: CampaignDart = {
    value,
    label: labelOverride || label,
    base,
    mult: isBull ? 2 : (base === 25 && value === 50 ? 2 : mult),
    isDouble: !!(isBull || (base === 25 && value === 50) || mult === 2),
    isBull: !!isBull || base === 25,
  };
  return { ...state, darts: [...state.darts, dart] };
}

export function undoDart(state: CampaignBattleState): CampaignBattleState {
  if (!state.darts.length) return state;
  return { ...state, darts: state.darts.slice(0, -1) };
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

// Resolve a player's visit dart-by-dart against the targeted enemy. Each
// dart is checked against the front shield first; a matching dart breaks
// the shield and deals 0 damage. Once shields are gone, each dart deals
// damage to the targeted enemy. If the targeted enemy is defeated mid-visit,
// remaining darts auto-target the next alive enemy (so a player can kill
// one enemy and damage another in the same visit). Returns a state with
// `pendingPlayerDarts` populated; the UI animates through them one at a
// time, calling `applyNextPlayerDart` to actually mutate enemy HP.
export function resolvePlayerVisit(state: CampaignBattleState): CampaignBattleState {
  if (state.phase !== 'player') return state;
  if (!state.darts.length) return state;

  const thrower = state.players[state.playerTurnIdx];
  if (!thrower) return state;

  // Find a valid target (auto-pick first alive if the chosen one is dead).
  let targetIdx = state.targetIdx;
  let target = state.enemies[targetIdx];
  if (!target || target.defeated) {
    const firstAlive = state.enemies.findIndex(e => !e.defeated);
    if (firstAlive < 0) return state;
    targetIdx = firstAlive;
    target = state.enemies[targetIdx];
  }

  const power = effectivePower(thrower);
  const steps: ResolvedDart[] = [];
  // Work on a deep copy so we can simulate HP changes locally.
  const enemies = state.enemies.map(e => ({ ...e, shields: [...e.shields] }));

  for (const dart of state.darts) {
    let t = enemies[targetIdx];
    if (t.defeated) {
      // Auto-retarget to the next alive enemy.
      const next = enemies.findIndex(e => !e.defeated);
      if (next < 0) break;
      targetIdx = next;
      t = enemies[targetIdx];
    }
    if (t.shields.length > 0) {
      const shieldIdx = 0;
      const shield = t.shields[shieldIdx];
      if (dartMatchesShield(dart, shield)) {
        t.shields = t.shields.filter((_, i) => i !== shieldIdx);
        steps.push({
          dart, damage: 0, kind: 'shield_break',
          shieldTarget: describeShield(shield),
          enemyId: t.id, enemyName: t.name, hpAfter: t.hp,
        });
        continue;
      }
      // Absorbed by shield — 0 damage.
      steps.push({
        dart, damage: 0, kind: 'miss',
        enemyId: t.id, enemyName: t.name, hpAfter: t.hp,
      });
      continue;
    }
    const dmg = computePlayerDartDamage(dart, power, t.armor);
    t.hp = Math.max(0, t.hp - dmg);
    const defeated = t.hp <= 0;
    if (defeated) t.defeated = true;
    steps.push({
      dart, damage: dmg, kind: defeated ? 'defeated' : 'damage',
      enemyId: t.id, enemyName: t.name, hpAfter: t.hp,
    });
    if (defeated) {
      // Continue to next dart (auto-retarget on next iteration).
      // But if no other alive enemy remains, stop.
      const anyAlive = enemies.some(e => !e.defeated);
      if (!anyAlive) break;
    }
  }

  return {
    ...state,
    enemies,
    darts: [],
    targetIdx,
    pendingPlayerDarts: steps,
    awaitContinue: true,
  };
}

// Apply the next pending player dart (called by the UI after each animation
// step). When the queue empties, advance to the next player or the enemy
// phase.
export function applyNextPlayerDart(state: CampaignBattleState): CampaignBattleState {
  if (!state.pendingPlayerDarts.length) {
    return advanceAfterPlayerVisit(state);
  }
  const [step, ...rest] = state.pendingPlayerDarts;
  const log: VisitLogEntry[] = [...state.lastVisitLog];
  if (step.kind === 'shield_break') {
    log.push({ kind: 'shield_break', dartLabel: step.dart.label, shieldIndex: 0, shieldTarget: step.shieldTarget || '' });
  } else if (step.kind === 'damage') {
    log.push({ kind: 'damage', dartLabel: step.dart.label, damage: step.damage, enemyId: step.enemyId });
  } else if (step.kind === 'defeated') {
    log.push({ kind: 'damage', dartLabel: step.dart.label, damage: step.damage, enemyId: step.enemyId });
    log.push({ kind: 'enemy_defeated', enemyId: step.enemyId, enemyName: step.enemyName });
  }
  const anyAlive = state.enemies.some(e => !e.defeated);
  const outcome: CampaignBattleState['outcome'] = !anyAlive ? 'victory' : state.outcome;
  const next: CampaignBattleState = {
    ...state,
    pendingPlayerDarts: rest,
    lastVisitLog: log,
    outcome,
    awaitContinue: rest.length > 0 && outcome === 'ongoing',
  };
  if (!rest.length) {
    return advanceAfterPlayerVisit({ ...next, awaitContinue: false });
  }
  return next;
}

// After a player's visit is fully animated, either pass to the next player
// or start the enemy phase.
function advanceAfterPlayerVisit(state: CampaignBattleState): CampaignBattleState {
  if (state.outcome === 'victory') {
    return { ...state, phase: 'player', awaitContinue: false };
  }
  const nextIdx = state.playerTurnIdx + 1;
  if (nextIdx < state.players.length) {
    return {
      ...state,
      playerTurnIdx: nextIdx,
      darts: [],
      awaitContinue: false,
    };
  }
  // All players have thrown — start the enemy phase.
  return {
    ...state,
    phase: 'enemy',
    darts: [],
    awaitContinue: false,
  };
}

// ── Enemy AI turn ─────────────────────────────────────────────────────

function simulateEnemyDart(enemy: ActiveEnemy, rng: () => number): CampaignDart {
  const intendedBase = 20;
  const intendedMult = 3;
  const hit = rng() < enemy.accuracy;
  let base = intendedBase;
  let mult = intendedMult;
  if (!hit) {
    if (rng() < enemy.precision) {
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
    awaitContinue: true,
  };
}

// Apply the next pending enemy attack step. When the queue empties, return
// to the player phase (or defeat if party HP is 0).
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
    lastVisitLog: log,
    awaitContinue: rest.length > 0,
  };
  if (next.partyHp <= 0) {
    return { ...next, outcome: 'defeat', phase: 'player', pendingEnemyAttacks: [], awaitContinue: false };
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
  return {
    ...state,
    players,
    phase: 'player',
    playerTurnIdx: 0,
    darts: [],
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
  if (id === 'coop_buff_power' || id === 'coop_buff_acc') {
    const kind: PlayerBuff['kind'] = id === 'coop_buff_power' ? 'power' : 'accuracy';
    const amount = id === 'coop_buff_power' ? 10 : 20;
    const buffId = `${kind}_${Date.now()}`;
    const players = state.players.map(p => ({
      ...p,
      buffs: [...p.buffs, { id: buffId, kind, amount, turnsLeft: 3, source: thrower.id }],
    }));
    return { ...state, players, powerUpCharge: charge };
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
