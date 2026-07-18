export interface Player {
  id: string;
  name: string;
  color: string;
  xp?: number;
  level?: number;
  unlockedTitles?: string[];
  selectedTitle?: string | null;
  unlockedBadges?: string[];
  badgeCounts?: Record<string, number>;
  selectedBadge?: string | null;
}

export interface Dart {
  value: number;
  label: string;
  base: number;
  mult: number;
  isDouble: boolean;
  isOuter?: boolean;
}

export interface Visit {
  darts: Dart[];
  scored: number;
  remaining?: number;
  leg?: number;
  bust?: boolean;
  checkout?: number;
  atc?: boolean;
  hits?: number;
  endIdx?: number;
  date: string;
  mode?: string;
  gameId?: string;
  gameDate?: string;
  practice?: boolean;
}

export interface GamePlayer {
  id: string;
  name: string;
  color: string;
  score: number;
  legsWon: number;
  visits: Visit[];
  idx: number;
  dartsThrown: number;
  done: boolean;
  lives?: number;
  eliminated?: boolean;
  killerNumber?: number;
  killerHits?: number;
  kills?: string[];
  team?: number; // 0-indexed team id when team mode is active
}

export interface Game {
  id: string;
  mode: string;
  date: string;
  doubleOut: boolean;
  practice: boolean;
  atc: boolean;
  legsBestOf: number;
  players: GamePlayer[];
  turn: number;
  leg: number;
  finished: boolean;
  winner: string | null;
  tiedPlayers?: string[] | null;
  tied?: boolean;
  checkedOutThisRound: string[];
  thrownThisRound: string[];
  roundStartTurn: number;
  darts: Dart[];
  mult: number;
  atcDarts?: { hit: boolean; target: string }[];
  teamMode?: boolean;            // true when playing team vs team
  teamCount?: number;           // number of teams
  teamLegsWon?: number[];       // legs won per team (parallel to team index)
  teamTurn?: number;            // current team whose turn it is (0-indexed)
  teamPlayerCursor?: number[];  // per-team index into its player rotation order
  winningTeam?: number | null;  // team that won (for team mode)
}

export interface GameRecord {
  id: string;
  date: string;
  mode: string;
  practice: boolean;
  atc: boolean;
  doubleOut: boolean;
  legsBestOf: number;
  winner: string | null;
  tied: boolean;
  tiedPlayers: string[] | null;
  teamMode?: boolean;
  teamCount?: number;
  winningTeam?: number | null;
  players: {
    id: string;
    name: string;
    color: string;
    legsWon: number;
    dartsThrown: number;
    visits: Visit[];
    team?: number;
  }[];
}

export interface CustomTitle {
  id: string;
  name: string;
  desc?: string;
  icon?: string;
  custom?: boolean;
  condition?: { type: 'sum'; value: number } | { type: 'combo'; base: number; mult: number; count: number } | { type: 'sequence'; darts: { base: number; mult: number }[] };
  base?: number;
  mult?: number;
  count?: number;
}

export interface XPConfig {
  win: number; visit60: number; visit80: number; visit100: number;
  visit120: number; visit140: number; visit180: number;
  checkout: number; perDart: number; levelMult: number; baseLevelXp: number;
}

export interface Settings {
  theme: 'dark' | 'light';
  accent: string;
  confirmReset: boolean;
  sound: boolean;
  music: boolean;
  musicSetupTrack: string;
  musicMatchTrack: string;
  xpConfig: XPConfig;
  customTitles: CustomTitle[];
  popups: { scores: boolean; milestones: boolean; xp: boolean; titles: boolean };
}
