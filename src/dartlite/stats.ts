// ── Dartlite persistent stats ─────────────────────────────────────────
//
// Per-player Dartlite stats that persist across runs (unlike trinkets and
// run-time attributes which are ephemeral). Stored on the Player object as
// `dartliteStats` so they show up in the Stats view and the Trinkets tab.
//
// Global stats (kills, battles, best round) are also tracked in localStorage
// for the badge system, mirroring the Coop campaign's `coopStats.ts`.

import type { Player } from '../types';
import type { DartliteRun } from './engine';
import type { TrinketId } from './trinkets';

const GLOBAL_KEY = 'dc_dartlite_stats';

export interface DartliteGlobalStats {
  totalKills: number;
  totalBattles: number;
  totalMiniBosses: number;
  totalBosses: number;
  bestRound: number;
  totalRuns: number;
  totalXp: number;
}

const EMPTY_GLOBAL: DartliteGlobalStats = {
  totalKills: 0,
  totalBattles: 0,
  totalMiniBosses: 0,
  totalBosses: 0,
  bestRound: 0,
  totalRuns: 0,
  totalXp: 0,
};

export function loadDartliteGlobalStats(): DartliteGlobalStats {
  try {
    const raw = localStorage.getItem(GLOBAL_KEY);
    if (!raw) return { ...EMPTY_GLOBAL };
    const p = JSON.parse(raw) as Partial<DartliteGlobalStats>;
    return {
      totalKills: Math.max(0, p.totalKills || 0),
      totalBattles: Math.max(0, p.totalBattles || 0),
      totalMiniBosses: Math.max(0, p.totalMiniBosses || 0),
      totalBosses: Math.max(0, p.totalBosses || 0),
      bestRound: Math.max(0, p.bestRound || 0),
      totalRuns: Math.max(0, p.totalRuns || 0),
      totalXp: Math.max(0, p.totalXp || 0),
    };
  } catch {
    return { ...EMPTY_GLOBAL };
  }
}

export function saveDartliteGlobalStats(stats: DartliteGlobalStats): void {
  localStorage.setItem(GLOBAL_KEY, JSON.stringify(stats));
}

export function bumpDartliteStat(field: keyof DartliteGlobalStats, by = 1): DartliteGlobalStats {
  const next = loadDartliteGlobalStats();
  (next[field] as number) = ((next[field] as number) || 0) + by;
  saveDartliteGlobalStats(next);
  return next;
}

// ── Per-player persistent stats ───────────────────────────────────────

export interface PlayerDartliteStats {
  kills: number;
  battles: number;
  miniBossesDefeated: number;
  bossesDefeated: number;
  bestRound: number;
  totalXp: number;
  runs: number;
  seenTrinkets: TrinketId[];
}

export function defaultDartliteStats(): PlayerDartliteStats {
  return {
    kills: 0,
    battles: 0,
    miniBossesDefeated: 0,
    bossesDefeated: 0,
    bestRound: 0,
    totalXp: 0,
    runs: 0,
    seenTrinkets: [],
  };
}

// Record a completed run: update per-player stats and global stats.
// Called once from DartliteGameOver.
export function recordDartliteRun(
  run: DartliteRun,
  setPlayers: (updater: (prev: Player[]) => Player[]) => void,
): void {
  const seenTrinkets = [...new Set(run.stats.trinketsCollected)] as TrinketId[];
  setPlayers((prev: Player[]) => prev.map(p => {
    if (!run.playerIds.includes(p.id)) return p;
    const cur = p.dartliteStats || defaultDartliteStats();
    const updated: PlayerDartliteStats = {
      kills: cur.kills + run.stats.enemiesDefeated,
      battles: cur.battles + run.stats.roundsCleared,
      miniBossesDefeated: cur.miniBossesDefeated + run.stats.miniBossesDefeated,
      bossesDefeated: cur.bossesDefeated + run.stats.bossesDefeated,
      bestRound: Math.max(cur.bestRound, run.round),
      totalXp: cur.totalXp + run.stats.xpGained,
      runs: cur.runs + 1,
      seenTrinkets: [...new Set([...cur.seenTrinkets, ...seenTrinkets])],
    };
    return { ...p, dartliteStats: updated };
  }));

  const g = loadDartliteGlobalStats();
  saveDartliteGlobalStats({
    totalKills: g.totalKills + run.stats.enemiesDefeated,
    totalBattles: g.totalBattles + run.stats.roundsCleared,
    totalMiniBosses: g.totalMiniBosses + run.stats.miniBossesDefeated,
    totalBosses: g.totalBosses + run.stats.bossesDefeated,
    bestRound: Math.max(g.bestRound, run.round),
    totalRuns: g.totalRuns + 1,
    totalXp: g.totalXp + run.stats.xpGained,
  });
}
