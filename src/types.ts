import type { PlayerCoopProgress, PlayerCampaignProgress } from './campaign/types';
import type { PlayerDartliteStats } from './dartlite/stats';
import type { PlayerCard, CardPlayState } from './cards/types';

export type PlayerSoundId = 'none' | 'hero' | 'villain' | 'cyborg' | 'mystic' | 'beast' | 'champion';

export interface PlayerAttributes {
  health: number;      // current max health (starts 400)
  armor: number;       // current armor % (starts 0, capped at armorMax — percentage damage reduction per dart)
  power: number;       // current power — flat bonus added to every dart that hits (starts 0)
  pointsAvailable: number; // unspent attribute points
}

export interface PlayerPowerUps {
  unlocked: string[];          // competitive power up ids the player has unlocked
  active: string | null;      // equipped competitive power up id (single slot)
  pointsAvailable: number;    // unspent power-up unlock points (competitive)
  coopUnlocked?: string[];     // coop power up ids the player has unlocked (always all of them)
  coopActive?: string | null;   // equipped coop power up id (single slot, used in Coop mode)
}

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
  showBadgeContext?: boolean;
  sound?: PlayerSoundId;
  attributes?: PlayerAttributes;
  powerUps?: PlayerPowerUps;
  developerMode?: boolean;
  showdownBg?: string;
  coopProgress?: PlayerCoopProgress;
  // Per-player Co-op Campaign progress. Each player tracks their own
  // cleared levels and unlocked power-up rewards, so a level is only
  // "beaten for everyone" when every party member has cleared it.
  campaignProgress?: PlayerCampaignProgress;
  // Per-player Dartlite (rogue-lite) stats. Persist across runs; trinkets
  // and run-time attributes do NOT carry over.
  dartliteStats?: PlayerDartliteStats;
  // Per-player card collection for card-based mode, keyed by class id.
  cards?: Record<string, PlayerCard[]>;
}

export interface Visit {
  darts: Dart[];
  scored: number;
  remaining: number;
  leg: number;
  bust?: boolean;
  atc?: boolean;
  practice?: boolean;
  date: string;
  checkout?: number;
  mode?: string;
  hits?: number;
  frozen?: boolean;
}

export interface Dart {
  value: number;
  label: string;
  base: number;
  mult: number;
  isDouble: boolean;
  isOuter: boolean;
}

export interface GamePlayer {
  id: string;
  name: string;
  color: string;
  score: number;
  visits: Visit[];
  legsWon: number;
  dartsThrown: number;
  team?: number;
  // Battle mode
  hp?: number;
  maxHp?: number;
  armorPct?: number;
  powerPct?: number;
  damageDealt?: number;
  damageTaken?: number;
  attacks?: { target: string; damage: number; visit: number; date: string }[];
  defeated?: boolean;
  // Killer mode
  killerNumber?: number;
  killerHits?: number;
  lives?: number;
  eliminated?: boolean;
  kills?: string[];
}

export interface Game {
  mode: string;
  players: GamePlayer[];
  turn: number;
  leg: number;
  legsBestOf: number;
  roundStartTurn: number;
  checkedOutThisRound: string[];
  thrownThisRound: string[];
  doubleOut: boolean;
  practice: boolean;
  teamMode: boolean;
  teamCount?: number;
  teamTurn?: number;
  teamPlayerCursor?: number[];
  teamLegsWon?: number[];
  winningTeam?: number;
  darts: Dart[];
  mult: number;
  date: string;
  finished: boolean;
  winner: string | null;
  tied: boolean;
  tiedPlayers: string[] | null;
  powerUpsEnabled: boolean;
  cardState?: Record<string, CardPlayState>;
}

export interface GameRecord {
  id: string;
  mode: string;
  players: GamePlayer[];
  winner: string | null;
  tied: boolean;
  tiedPlayers: string[] | null;
  winningTeam?: number;
  date: string;
  legsBestOf: number;
  doubleOut: boolean;
  practice: boolean;
  teamMode: boolean;
  teamCount?: number;
  powerUpsEnabled: boolean;
}

export interface Settings {
  startingScore: number;
  doubleOut: boolean;
  legsBestOf: number;
  xpConfig: {
    perDart: number;
    visit60: number;
    visit80: number;
    visit100: number;
    visit120: number;
    visit140: number;
    visit180: number;
    win: number;
  };
  popups: {
    scores: boolean;
    milestones: boolean;
    titles: boolean;
    xp: boolean;
  };
  customTitles: any[];
  powerUpScaling: any;
  gameMode: 'standard' | 'cards';
}
