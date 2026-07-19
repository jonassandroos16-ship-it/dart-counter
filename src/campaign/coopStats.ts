// Co-op Campaign power-up usage stats, persisted to localStorage so the
// badge system can surface them as context values. These are global (not
// per-player) since the campaign is a shared party experience.

const KEY = 'dc_coop_stats';

export interface CoopStats {
  healsUsed: number;
  freezesUsed: number;
  buffsUsed: number;
  shieldsUsed: number;
  levelsCleared: number;
}

const EMPTY: CoopStats = { healsUsed: 0, freezesUsed: 0, buffsUsed: 0, shieldsUsed: 0, levelsCleared: 0 };

export function loadCoopStats(): CoopStats {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY };
    const p = JSON.parse(raw) as Partial<CoopStats>;
    return {
      healsUsed: Math.max(0, p.healsUsed || 0),
      freezesUsed: Math.max(0, p.freezesUsed || 0),
      buffsUsed: Math.max(0, p.buffsUsed || 0),
      shieldsUsed: Math.max(0, p.shieldsUsed || 0),
      levelsCleared: Math.max(0, p.levelsCleared || 0),
    };
  } catch {
    return { ...EMPTY };
  }
}

export function saveCoopStats(stats: CoopStats): void {
  localStorage.setItem(KEY, JSON.stringify(stats));
}

export function bumpCoopStat(field: keyof CoopStats, by = 1): CoopStats {
  const next = loadCoopStats();
  (next[field] as number) = ((next[field] as number) || 0) + by;
  saveCoopStats(next);
  return next;
}
