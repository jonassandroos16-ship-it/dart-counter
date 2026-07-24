import type { playerStats, getPlayerXP, levelFromXP } from '../logic';

export type StatKey =
  | 'avg' | 'first9' | 'games' | 'n180' | 'n140' | 'tons'
  | 'highScore' | 'highCheckout' | 'legsWon' | 'dartsThrown'
  | 'finishMin' | 'finishMax' | 'finishAvg' | 'legsFinished'
  | 'level' | 'xp' | 'titles' | 'kills' | 'defeated' | 'battleGames';

export interface StatMetaEntry {
  key: StatKey;
  label: string;
  better: 'higher' | 'lower' | null;
  format: (v: number) => string;
  empty?: string;
}

export const STAT_META: StatMetaEntry[] = [
  { key: 'avg', label: '3-dart avg', better: 'higher', format: v => v.toFixed(1) },
  { key: 'first9', label: 'First 9', better: 'higher', format: v => v.toFixed(1) },
  { key: 'games', label: 'Games', better: null, format: v => String(v) },
  { key: 'n180', label: '180s', better: 'higher', format: v => String(v) },
  { key: 'n140', label: '140+', better: 'higher', format: v => String(v) },
  { key: 'tons', label: '100+', better: 'higher', format: v => String(v) },
  { key: 'highScore', label: 'High score', better: 'higher', format: v => String(v) },
  { key: 'highCheckout', label: 'High checkout', better: 'higher', format: v => String(v) },
  { key: 'legsWon', label: 'Legs won', better: 'higher', format: v => String(v) },
  { key: 'dartsThrown', label: 'Darts thrown', better: 'higher', format: v => String(v) },
  { key: 'finishMin', label: 'Fastest finish', better: 'lower', format: v => String(v), empty: '—' },
  { key: 'finishMax', label: 'Slowest finish', better: 'higher', format: v => String(v), empty: '—' },
  { key: 'finishAvg', label: 'Avg finish', better: 'lower', format: v => v.toFixed(1), empty: '—' },
  { key: 'legsFinished', label: 'Legs finished', better: 'higher', format: v => String(v) },
  { key: 'level', label: 'Level', better: 'higher', format: v => String(v) },
  { key: 'xp', label: 'Class XP', better: 'higher', format: v => String(v) },
  { key: 'titles', label: 'Titles', better: 'higher', format: v => String(v) },
  { key: 'kills', label: 'Kills', better: 'higher', format: v => String(v) },
  { key: 'defeated', label: 'Times defeated', better: 'lower', format: v => String(v) },
  { key: 'battleGames', label: 'Battle games', better: 'higher', format: v => String(v) },
];

export function statValue(
  s: ReturnType<typeof playerStats>,
  xp: ReturnType<typeof getPlayerXP>,
  li: ReturnType<typeof levelFromXP>,
  key: StatKey,
): number {
  switch (key) {
    case 'avg': return s.avg;
    case 'first9': return s.first9;
    case 'games': return s.games;
    case 'n180': return s.n180;
    case 'n140': return s.n140;
    case 'tons': return s.tons;
    case 'highScore': return s.highScore;
    case 'highCheckout': return s.highCheckout;
    case 'legsWon': return s.legsWon;
    case 'dartsThrown': return s.dartsThrown;
    case 'finishMin': return s.finishMin;
    case 'finishMax': return s.finishMax;
    case 'finishAvg': return s.finishAvg;
    case 'legsFinished': return s.legsFinished;
    case 'level': return li.level;
    case 'xp': return xp.xp || 0;
    case 'titles': return xp.unlockedTitles.length;
    case 'kills': return s.kills || 0;
    case 'defeated': return s.defeatedCount || 0;
    case 'battleGames': return s.battleGames || 0;
  }
}
