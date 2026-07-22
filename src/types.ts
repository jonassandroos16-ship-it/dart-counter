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

// Per-class attribute allocation. Each class tracks its own health, armor,
// power and unspent points independently. The active class's attributes are
// used in battle; switching classes swaps the active attribute set.
export interface ClassAttributes {
  health: number;
  armor: number;
  power: number;
  pointsAvailable: number;
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
  // Per-class attribute allocations, keyed by class id. Each class has its
  // own independent attribute pool tied to that class's level.
  classAttributes?: Record<string, ClassAttributes>;
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
  // Power-up state during a match (only present when game.powerUpsEnabled).
  powerUpCharge?: number;   // 0..100 — fills from doubles/triples/bullseyes
  powerUpUsed?: boolean;    // legacy: true once the equipped power up has been used this match (kept for migration)
  powerUpUses?: number;     // number of times the equipped power up has been activated this match
  powerUpId?: string | null; // snapshot of the equipped power up at game start
  // Battle mode state (only present when game.mode === 'battle').
  hp?: number;              // current health points (decreases when attacked)
  maxHp?: number;           // snapshot of max HP at game start
  armorPct?: number;        // snapshot of armor (percentage reduction per dart, 0..armorMax) at game start
  powerPct?: number;        // snapshot of power (flat bonus per dart) at game start
  defeated?: boolean;       // true when HP hits 0
  attacks?: { target: string; damage: number; visit: number; date: string }[];
  damageDealt?: number;     // total damage dealt this match
  damageTaken?: number;     // total damage taken this match
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
  powerUpsEnabled?: boolean;    // true when power ups are active for this match
  cardState?: Record<string, CardPlayState>; // per-player deck-builder state (card mode)
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
  powerUpsEnabled?: boolean;
  players: {
    id: string;
    name: string;
    color: string;
    legsWon: number;
    dartsThrown: number;
    visits: Visit[];
    team?: number;
    kills?: string[];
    defeated?: boolean;
    // Power-up activation flags — present only when game.powerUpsEnabled.
    // Used by post-game badges that reward the winner for using a power-up.
    usedPowerUp?: string | null;
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

export interface PowerUpScalingConfig {
  chargePerDouble: number;   // charge % granted per double hit
  chargePerTriple: number;   // charge % granted per triple hit
  chargePerBull: number;     // charge % granted per bull (25/50)
  chargePerScorePoint: number; // additional charge per scored point (scales with score)
  chargeMax: number;         // cap for charge
  pointsPerLevel: number;    // power-up unlock points granted per level gained
  startingPoints: number;    // points a brand-new player starts with
  attributePointsPerLevel: number; // attribute points per level
  attributeStartHealth: number;
  attributeStartArmor: number;
  attributeStartPower: number;
  healthPerPoint: number;   // HP gained per point spent on health
  armorPerPoint: number;     // armor % gained per point spent on armor (percentage reduction per dart)
  powerPerPoint: number;     // power gained per point spent on power (flat, per dart)
  armorMax: number;          // hard cap for armor (percentage reduction per dart)
  powerMax: number;          // hard cap for power (flat bonus per dart)
  healthMax: number;          // hard cap for HP at max level progression
  battleMinDamage: number;    // minimum damage on a successful hit (default 1)
  // Per-class starting stats. Each class begins with different base health,
  // armor and power, making classes feel distinct from level 1.
  classStartHealth: Record<string, number>;
  classStartArmor: Record<string, number>;
  classStartPower: Record<string, number>;
  // Per-class stat caps. Higher caps for the class's primary stat lets them
  // specialize further as they level.
  classHealthMax: Record<string, number>;
  classArmorMax: Record<string, number>;
  classPowerMax: Record<string, number>;
  // Starting charge (0..chargeMax) for specific power-ups at the start of a
  // match. Lets early-game power-ups like Surge begin partially charged.
  startingCharge: Record<string, number>;
  // Per-power-up activation threshold (0..chargeMax). When a power-up's
  // charge reaches this value it becomes ready to activate. Defaults to
  // `chargeMax` for any id not listed. Lets each power-up be balanced
  // independently — e.g. Surge could need 80 while Blocker needs 120.
  chargesNeeded: Record<string, number>;
}

export type HitSoundPackId = 'thud' | 'board' | 'punch' | 'arcade';
export type ClickSoundId = 'none' | 'tick' | 'pop' | 'tap';

export type GameMode = 'dartboard' | 'cards';

export interface Settings {
  theme: 'dark' | 'light';
  accent: string;
  gameMode: GameMode;
  confirmReset: boolean;
  sound: boolean;
  music: boolean;
  musicStartTrack: string;
  musicSetupTrack: string;
  musicMatchTrack: string;
  musicCoopTrack: string;
  sfxVolume: number;
  musicVolume: number;
  hitSoundPack: HitSoundPackId;
  clickSound: ClickSoundId;
  clickVolume: number;
  xpConfig: XPConfig;
  customTitles: CustomTitle[];
  popups: { scores: boolean; milestones: boolean; xp: boolean; titles: boolean };
  powerUpScaling: PowerUpScalingConfig;
}
