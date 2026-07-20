import type {
  ActiveEnemy,
  CampaignBattleState,
  CampaignDart,
  EnemyAttackStep,
  VisitLogEntry,
} from '../types';
import { neighborsOf } from './shields';

const DARTBOARD_ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

// Effective accuracy/precision for an enemy, applying the Focus Buff
// distract debuff (clamped to >= 0).
export function effectiveAccuracy(enemy: ActiveEnemy): number {
  return enemy.distractedTurns > 0
    ? Math.max(0, enemy.accuracy - enemy.distractAmount)
    : enemy.accuracy;
}
export function effectivePrecision(enemy: ActiveEnemy): number {
  return enemy.distractedTurns > 0
    ? Math.max(0, enemy.precision - enemy.distractAmount)
    : enemy.precision;
}

export function simulateEnemyDart(enemy: ActiveEnemy, rng: () => number): CampaignDart {
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

export function makeDart(base: number, mult: number): CampaignDart {
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
// have their `frozenTurns` decremented. The list of frozen enemies is
// recorded in `frozenEnemiesThisRound` so the UI can show a "frozen" popup
// even when no attacks are produced (e.g. all enemies are frozen).
export function prepareEnemyTurn(state: CampaignBattleState, rng: () => number = Math.random): CampaignBattleState {
  if (state.phase !== 'enemy') return state;
  const steps: EnemyAttackStep[] = [];
  let partyHp = state.partyHp;
  const frozenEnemiesThisRound: { id: string; name: string; frozenTurns: number }[] = [];
  const enemies = state.enemies.map(e => ({ ...e }));
  for (const enemy of enemies) {
    if (enemy.defeated) continue;
    if (enemy.frozenTurns > 0) {
      frozenEnemiesThisRound.push({ id: enemy.id, name: enemy.name, frozenTurns: enemy.frozenTurns });
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
    frozenEnemiesThisRound,
    // Keep awaiting Continue even when all enemies were frozen so the UI
    // can show the frozen popup before returning to the player phase.
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
  const partyHpLost = state.stats.partyHpLost + (step.damage > 0 ? step.damage : 0);
  const next: CampaignBattleState = {
    ...state,
    partyHp: step.partyHpAfter,
    pendingEnemyAttacks: rest,
    appliedEnemyAttacks: [...state.appliedEnemyAttacks, step],
    lastVisitLog: log,
    awaitContinue: rest.length > 0,
    stats: { ...state.stats, partyHpLost },
  };
  if (next.partyHp <= 0) {
    return { ...next, outcome: 'defeat', phase: 'player', pendingEnemyAttacks: [], appliedEnemyAttacks: [], awaitContinue: false };
  }
  if (!rest.length) {
    return finishEnemyTurn({ ...next, awaitContinue: false });
  }
  return next;
}

export function finishEnemyTurn(state: CampaignBattleState): CampaignBattleState {
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
    frozenEnemiesThisRound: [],
    visitNumber: state.visitNumber + 1,
    awaitContinue: false,
  };
}
