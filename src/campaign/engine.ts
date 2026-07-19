import type {
  ActiveEnemy,
  CampaignBattleState,
  CampaignDart,
  CampaignLevel,
  EnemyDef,
  EnemyDatabase,
  ExactTarget,
  ShieldLayer,
  SpanTarget,
  VisitLogEntry,
} from './types';
import { ENEMY_DATABASE } from './enemyDatabase';
import { CAMPAIGN_LEVELS } from './campaignLevels';

export const DEFAULT_PARTY_MAX_HP = 350;

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

// ── Battle initialization ─────────────────────────────────────────────

export function startBattle(
  level: CampaignLevel,
  partyHp: number,
  partyMaxHp: number,
  db: EnemyDatabase = ENEMY_DATABASE,
): CampaignBattleState {
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
    };
  });
  return {
    levelId: level.level_id,
    levelName: level.name,
    isBoss: level.is_boss,
    partyHp,
    partyMaxHp,
    enemies,
    targetIdx: 0,
    darts: [],
    phase: 'player',
    lastVisitLog: [],
    visitNumber: 1,
    outcome: 'ongoing',
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
// Left/right halves are approximated by board position index parity. The
// left half contains the odd-indexed sectors of DARTBOARD_ORDER.
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
    if (dart.base === 0) return false; // miss never matches a span
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
  // exact
  const t = shield.target_value as ExactTarget;
  return matchesExactTarget(dart, t);
}

function matchesExactTarget(dart: CampaignDart, t: ExactTarget): boolean {
  if (t === 'Bull') return dart.base === 50;
  if (t === '25') return dart.base === 25 && !dart.isBull;
  // D<base>, T<base>, or bare <base>
  const m = /^([DT]?)(\d+)$/.exec(t);
  if (!m) return false;
  const mult = m[1] === 'D' ? 2 : m[1] === 'T' ? 3 : 1;
  const base = Number(m[2]);
  if (!Number.isFinite(base)) return false;
  if (dart.base !== base) return false;
  if (base === 25 || base === 50) return true; // bull handled above
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

// Resolve a player's visit. Shields are checked dart-by-dart in throw order.
// A dart that breaks a shield deals 0 damage. Darts thrown after all shields
// are gone deal damage (summed, then armor-mitigated) to the targeted enemy.
// Returns the post-visit state (still in 'player' phase, with a log). The
// caller then triggers the enemy phase separately.
export function resolvePlayerVisit(state: CampaignBattleState): CampaignBattleState {
  if (state.phase !== 'player') return state;
  if (!state.darts.length) return state;
  const target = state.enemies[state.targetIdx];
  if (!target || target.defeated) {
    // Auto-pick first alive enemy if the chosen target is invalid.
    const firstAliveIdx = state.enemies.findIndex(e => !e.defeated);
    if (firstAliveIdx < 0) return state;
    return resolvePlayerVisit({ ...state, targetIdx: firstAliveIdx });
  }

  const enemies = state.enemies.map(e => ({ ...e, shields: [...e.shields] }));
  const t = enemies[state.targetIdx];
  const log: VisitLogEntry[] = [];
  let damageSum = 0;

  for (const dart of state.darts) {
    if (t.defeated) break;
    if (t.shields.length > 0) {
      const shieldIdx = 0; // front shield is the next to break
      const shield = t.shields[shieldIdx];
      if (dartMatchesShield(dart, shield)) {
        t.shields = t.shields.filter((_, i) => i !== shieldIdx);
        log.push({ kind: 'shield_break', dartLabel: dart.label, shieldIndex: shieldIdx, shieldTarget: describeShield(shield) });
        continue; // shield-break dart deals 0 damage
      }
      // Dart didn't match the shield — it also deals 0 damage (absorbed by shield).
      continue;
    }
    // No shields left: this dart deals damage.
    const dmg = computePlayerDartDamage(dart, t.armor);
    damageSum += dmg;
    log.push({ kind: 'damage', dartLabel: dart.label, damage: dmg, enemyId: t.id });
    t.hp = Math.max(0, t.hp - dmg);
    if (t.hp <= 0) {
      t.defeated = true;
      log.push({ kind: 'enemy_defeated', enemyId: t.id, enemyName: t.name });
      break;
    }
  }

  const anyAlive = enemies.some(e => !e.defeated);
  const outcome: CampaignBattleState['outcome'] = !anyAlive ? 'victory' : state.outcome;
  return {
    ...state,
    enemies,
    darts: [],
    phase: outcome === 'victory' ? 'player' : 'enemy',
    lastVisitLog: log,
    visitNumber: state.visitNumber,
    outcome,
  };
}

// Per-dart damage = max(0, dartValue) − armor, min 1 on a hit. Misses deal 0.
export function computePlayerDartDamage(dart: CampaignDart, armor: number): number {
  if (dart.value <= 0) return 0;
  return Math.max(1, dart.value - armor);
}

// ── Enemy AI turn ─────────────────────────────────────────────────────

// Simulate one enemy's 3-dart visit. Each dart: with probability `accuracy`
// the enemy hits its intended sector (T20 — the highest-scoring triple);
// otherwise it misses. If it misses, with probability `precision` it lands
// on an adjacent number (1 or 5 for T20), otherwise it scatters to a random
// sector. Doubles/triples are sampled to determine the multiplier.
export function simulateEnemyVisit(enemy: ActiveEnemy, rng: () => number = Math.random): { darts: CampaignDart[]; totalDamage: number; log: VisitLogEntry[] } {
  const darts: CampaignDart[] = [];
  const log: VisitLogEntry[] = [];
  let totalDamage = 0;
  for (let i = 0; i < 3; i++) {
    const dart = simulateEnemyDart(enemy, rng);
    darts.push(dart);
    totalDamage += dart.value;
  }
  log.push({ kind: 'enemy_attack', enemyName: enemy.name, damage: totalDamage, dartLabel: darts.map(d => d.label).join(' + ') });
  return { darts, totalDamage, log };
}

function simulateEnemyDart(enemy: ActiveEnemy, rng: () => number): CampaignDart {
  const intendedBase = 20;
  const intendedMult = 3; // enemies aim for T20 by default
  const hit = rng() < enemy.accuracy;
  let base = intendedBase;
  let mult = intendedMult;
  if (!hit) {
    // Miss. High-precision enemies cluster to adjacent numbers; low-precision scatter.
    if (rng() < enemy.precision) {
      const neighbors = neighborsOf(intendedBase);
      base = neighbors[Math.floor(rng() * neighbors.length)] || intendedBase;
    } else {
      base = DARTBOARD_ORDER[Math.floor(rng() * DARTBOARD_ORDER.length)];
    }
    // Misses usually hit single segments.
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

// Run all alive enemies' turns, deduct damage from party HP, return next state
// (back to 'player' phase). If party HP hits 0, outcome becomes 'defeat'.
export function resolveEnemyTurn(state: CampaignBattleState, rng: () => number = Math.random): CampaignBattleState {
  if (state.phase !== 'enemy') return state;
  const log: VisitLogEntry[] = [];
  let partyHp = state.partyHp;
  const aliveEnemies = state.enemies.filter(e => !e.defeated);
  for (const enemy of aliveEnemies) {
    const { totalDamage, log: enemyLog } = simulateEnemyVisit(enemy, rng);
    log.push(...enemyLog);
    partyHp = Math.max(0, partyHp - totalDamage);
  }
  if (partyHp <= 0) {
    log.push({ kind: 'party_hit', damage: state.partyHp - partyHp });
    return { ...state, partyHp: 0, phase: 'player', lastVisitLog: log, outcome: 'defeat' };
  }
  log.push({ kind: 'party_hit', damage: state.partyHp - partyHp });
  return {
    ...state,
    partyHp,
    phase: 'player',
    lastVisitLog: log,
    visitNumber: state.visitNumber + 1,
  };
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
