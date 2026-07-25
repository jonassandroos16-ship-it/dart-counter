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

// Solo scaling: a single player has roughly half the party's combined
// damage and HP, so enemies tuned for 2 players become overwhelming after
// the mini-boss. These factors scale enemy stats down for solo play and
// gently back up as the party grows beyond 2.
const SOLO_HP_FACTOR = 0.6;
const SOLO_ACC_FACTOR = 0.85;
const SOLO_PREC_FACTOR = 0.85;

function partySizeFactor(playerCount: number): number {
  if (playerCount <= 1) return SOLO_HP_FACTOR;
  if (playerCount === 2) return 1.0;
  // Beyond 2 players, scale up slightly so larger parties stay challenging.
  return Math.min(1.4, 1.0 + (playerCount - 2) * 0.15);
}

function partyAccFactor(playerCount: number): number {
  if (playerCount <= 1) return SOLO_ACC_FACTOR;
  return 1.0;
}

function partyPrecFactor(playerCount: number): number {
  if (playerCount <= 1) return SOLO_PREC_FACTOR;
  return 1.0;
}

// Round scaling: enemies get harder as rounds progress.
export function enemyHpScale(round: number, playerCount: number = 2): number {
  const base = Math.min(5.0, 1 + Math.max(0, round - 1) * 0.10);
  return base * partySizeFactor(playerCount);
}
export function enemyAccScale(round: number, playerCount: number = 2): number {
  const base = Math.min(1.4, 1 + Math.max(0, round - 1) * 0.015);
  return base * partyAccFactor(playerCount);
}
export function enemyPrecScale(round: number, playerCount: number = 2): number {
  const base = Math.min(1.4, 1 + Math.max(0, round - 1) * 0.015);
  return base * partyPrecFactor(playerCount);
}

export function scaledEnemyDb(round: number, playerCount: number = 2): typeof ENEMY_DATABASE {
  const hpMult = enemyHpScale(round, playerCount);
  const accMult = enemyAccScale(round, playerCount);
  const precMult = enemyPrecScale(round, playerCount);
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

export function levelForRound(round: number, playerCount: number = 2): CampaignLevel {
  if (isBossRound(round)) {
    const bossPool = round <= 10 ? ['warlord_malakar'] : round <= 20 ? ['ice_queen', 'warlord_malakar'] : BOSS_IDS;
    return { level_id: round, name: `Boss — Round ${round}`, is_boss: true, enemies: [pick(bossPool)] };
  }
  if (isMiniBossRound(round)) {
    const miniPool = round <= 5 ? ['warlord_malakar'] : round <= 15 ? MINIBOSS_IDS : ['frost_knight', 'bloom_warden'];
    return { level_id: round, name: `Mini-Boss — Round ${round}`, is_boss: false, enemies: [pick(miniPool)] };
  }
  // Solo players face fewer enemies per round so the fight length stays
  // proportional to party damage output.
  const maxCount = playerCount <= 1 ? 2 : 3;
  const count = Math.min(maxCount, 1 + Math.floor(round / 3));
  const pool = round <= 4 ? EASY_IDS : round <= 9 ? [...EASY_IDS, ...HARD_IDS] : HARD_IDS;
  return { level_id: round, name: `Round ${round}`, is_boss: false, enemies: pickN(pool, count) };
}

export { pick, pickN };
