import type { CampaignLevel } from '../campaign/types';
import type { EnemyDef } from '../campaign/types';
import { ENEMY_DATABASE } from '../campaign/enemyDatabase';
import { isMiniBossRound, isBossRound } from './engineTypes';

const EASY_IDS = ['goblin_scout', 'goblin_brute', 'orc_raider', 'dark_mage', 'royal_guard', 'ice_wolf'];
const HARD_IDS = ['frost_archer', 'frost_knight', 'vine_lasher', 'spore_bloom', 'thorn_spearman', 'bloom_warden'];
const MINIBOSS_IDS = ['warlord_malakar', 'frost_knight', 'bloom_warden'];
const BOSS_IDS = ['warlord_malakar', 'ice_queen', 'the_verdant_maw'];

function pick<T>(arr: T[], rng: () => number = Math.random): T {
  return arr[Math.floor(rng() * arr.length)];
}

function pickN<T>(arr: T[], n: number, rng: () => number = Math.random): T[] {
  const copy = [...arr];
  const out: T[] = [];
  for (let i = 0; i < n && copy.length; i++) {
    const idx = Math.floor(rng() * copy.length);
    out.push(copy.splice(idx, 1)[0]);
  }
  return out;
}

// Round scaling: enemies get harder as rounds progress.
export function enemyHpScale(round: number): number {
  return Math.min(5.0, 1 + Math.max(0, round - 1) * 0.10);
}
export function enemyAccScale(round: number): number {
  return Math.min(1.4, 1 + Math.max(0, round - 1) * 0.015);
}
export function enemyPrecScale(round: number): number {
  return Math.min(1.4, 1 + Math.max(0, round - 1) * 0.015);
}

export function scaledEnemyDb(round: number): typeof ENEMY_DATABASE {
  const hpMult = enemyHpScale(round);
  const accMult = enemyAccScale(round);
  const precMult = enemyPrecScale(round);
  const db: typeof ENEMY_DATABASE = {};
  for (const [id, def] of Object.entries(ENEMY_DATABASE)) {
    db[id] = {
      ...def,
      max_hp: Math.round(def.max_hp * hpMult),
      accuracy: Math.min(0.95, def.accuracy * accMult),
      precision: Math.min(0.95, def.precision * precMult),
    } as EnemyDef;
  }
  return db;
}

export function levelForRound(round: number): CampaignLevel {
  if (isBossRound(round)) {
    const bossPool = round <= 10 ? ['warlord_malakar'] : round <= 20 ? ['ice_queen', 'warlord_malakar'] : BOSS_IDS;
    return { level_id: round, name: `Boss — Round ${round}`, is_boss: true, enemies: [pick(bossPool)] };
  }
  if (isMiniBossRound(round)) {
    const miniPool = round <= 5 ? ['warlord_malakar'] : round <= 15 ? MINIBOSS_IDS : ['frost_knight', 'bloom_warden'];
    return { level_id: round, name: `Mini-Boss — Round ${round}`, is_boss: false, enemies: [pick(miniPool)] };
  }
  const count = Math.min(3, 1 + Math.floor(round / 3));
  const pool = round <= 4 ? EASY_IDS : round <= 9 ? [...EASY_IDS, ...HARD_IDS] : HARD_IDS;
  return { level_id: round, name: `Round ${round}`, is_boss: false, enemies: pickN(pool, count) };
}

export { pick, pickN };
