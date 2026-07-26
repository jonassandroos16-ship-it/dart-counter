import { useEffect } from 'react';
import { supabase } from '../supabaseClient';
import type { Player } from '../types';
import type { DartliteRun } from './engine';
import type { TrinketId } from './trinkets';
import { addClassXp, classLevelFromXp, getCoopClass, reconcileCoopPassivesForPlayer } from '../campaign/engine/classes';
import type { Settings } from '../types';

const GLOBAL_KEY = 'dc_dartlite_stats';

export interface DartliteLevelUpInfo {
  playerId: string;
  playerName: string;
  classId: string;
  className: string;
  classIcon: string;
  oldLevel: number;
  newLevel: number;
  xpGained: number;
  leveledUp: boolean;
}

export interface DartliteGlobalStats {
  totalKills: number;
  totalBattles: number;
  totalRuns: number;
  totalXp: number;
  bestRound: number;
  trinketsCollected: string[];
  classesPlayed: Record<string, number>;
}

export function defaultDartliteStats() {
  return {
    totalKills: 0,
    totalBattles: 0,
    totalRuns: 0,
    totalXp: 0,
    bestRound: 0,
    trinketsCollected: [] as string[],
    classesPlayed: {} as Record<string, number>,
  };
}

function loadGlobal(): DartliteGlobalStats {
  try {
    const raw = localStorage.getItem(GLOBAL_KEY);
    if (raw) return { ...defaultDartliteStats(), ...JSON.parse(raw) };
  } catch {}
  return defaultDartliteStats();
}

function saveGlobal(g: DartliteGlobalStats) {
  try { localStorage.setItem(GLOBAL_KEY, JSON.stringify(g)); } catch {}
}

export function recordDartliteRun(
  run: DartliteRun,
  setPlayers: (updater: (prev: Player[]) => Player[]) => void,
  settings?: Settings,
  playersSnapshot?: Player[],
): DartliteLevelUpInfo[] {
  const seenTrinkets = ([...new Set(run.stats.trinketsCollected)] as TrinketId[])
    .filter(id => (id as string) !== 'trk_phoenix_heart_used');
  const xpToAward = run.stats.xpGained;

  // Compute level-up info from the pre-update snapshot so it's stable
  // regardless of how many times React runs the setPlayers updater.
  const levelUps: DartliteLevelUpInfo[] = [];
  const snapshotById = new Map((playersSnapshot || []).map(p => [p.id, p]));
  for (const pid of run.playerIds) {
    const p = snapshotById.get(pid);
    if (!p) continue;
    if (!settings || xpToAward <= 0) {
      const classId = p.coopProgress?.classId ?? null;
      const cls = getCoopClass(classId);
      const oldLevel = settings ? classLevelFromXp(p.coopProgress, classId, settings).level : 1;
      levelUps.push({
        playerId: p.id, playerName: p.name, classId: classId || '',
        className: cls?.name || 'Adventurer', classIcon: cls?.icon || '✨',
        oldLevel, newLevel: oldLevel, xpGained: xpToAward, leveledUp: false,
      });
      continue;
    }
    const classId = p.coopProgress?.classId ?? null;
    const oldLevel = classLevelFromXp(p.coopProgress, classId, settings).level;
    const updatedProg = addClassXp(p.coopProgress, classId, xpToAward);
    const li = classLevelFromXp(updatedProg, classId, settings);
    const cls = getCoopClass(classId);
    levelUps.push({
      playerId: p.id, playerName: p.name, classId: classId || '',
      className: cls?.name || 'Adventurer', classIcon: cls?.icon || '✨',
      oldLevel, newLevel: li.level, xpGained: xpToAward, leveledUp: li.level > oldLevel,
    });
  }

  setPlayers((prev: Player[]) => prev.map(p => {
    if (!run.playerIds.includes(p.id)) return p;
    const cur = p.dartliteStats || defaultDartliteStats();
    const updated = {
      ...cur,
      totalKills: cur.totalKills + run.stats.kills,
      totalBattles: cur.totalBattles + run.stats.battles,
      totalRuns: cur.totalRuns + 1,
      totalXp: cur.totalXp + run.stats.xpGained,
      bestRound: Math.max(cur.bestRound, run.stats.bestRound),
      trinketsCollected: [...new Set([...cur.trinketsCollected, ...seenTrinkets])],
      classesPlayed: {
        ...cur.classesPlayed,
        [p.coopProgress?.classId || 'adventurer']: (cur.classesPlayed[p.coopProgress?.classId || 'adventurer'] || 0) + 1,
      },
    };
    if (!settings || xpToAward <= 0) return { ...p, dartliteStats: updated };
    const classId = p.coopProgress?.classId ?? null;
    const oldLevel = classLevelFromXp(p.coopProgress, classId, settings).level;
    const updatedProg = addClassXp(p.coopProgress, classId, xpToAward);
    const li = classLevelFromXp(updatedProg, classId, settings);
    let next: Player = { ...p, dartliteStats: updated, coopProgress: updatedProg };
    if (li.level > oldLevel) {
      next = reconcileCoopPassivesForPlayer(next);
    }
    return next;
  }));

  const g = loadGlobal();
  saveGlobal({
    ...g,
    totalKills: g.totalKills + run.stats.kills,
    totalBattles: g.totalBattles + run.stats.battles,
    totalRuns: g.totalRuns + 1,
    totalXp: g.totalXp + run.stats.xpGained,
  });

  return levelUps;
}

export function useDartliteGlobalStats() {
  const [stats, setStats] = useState<DartliteGlobalStats>(loadGlobal);
  useEffect(() => {
    const handler = () => setStats(loadGlobal());
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);
  return stats;
}
