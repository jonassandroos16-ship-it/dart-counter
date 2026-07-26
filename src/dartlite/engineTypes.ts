import type { CampaignBattleState } from '../campaign/types';
import type { TrinketId } from './trinkets';
import type { PlayerCard } from '../cards/types';

// ── Round & boss schedule ──────────────────────────────────────────────

export function isMiniBossRound(round: number): boolean {
  return round > 0 && round % 5 === 0 && round % 10 !== 0;
}
export function isBossRound(round: number): boolean {
  return round > 0 && round % 10 === 0;
}

// ── Run state ─────────────────────────────────────────────────────────

export interface DartliteRunStats {
  roundsCleared: number;
  enemiesDefeated: number;
  miniBossesDefeated: number;
  bossesDefeated: number;
  damageDealt: number;
  xpGained: number;
  trinketsCollected: TrinketId[];
}

export interface DartlitePlayerRunStats {
  playerId: string;
  kills: number;
  damageDealt: number;
  rewards: ChoiceOption[];
  trinkets: TrinketId[];
}

export interface DartliteRun {
  round: number;
  playerIds: string[];
  runPlayers: DartliteRunPlayer[];
  trinkets: TrinketId[];
  pool: TrinketId[];
  stats: DartliteRunStats;
  playerStats: DartlitePlayerRunStats[];
  phase: 'setup' | 'battle' | 'choice' | 'reward' | 'boss_victory' | 'gameover';
  cardMode: boolean;
  battle: CampaignBattleState | null;
  pendingChoice: ChoiceOption[] | null;
  choicePlayerIdx: number;
  playerChoices: (ChoiceOption | null)[];
  lastUnlockedTrinket: TrinketId | null;
  bossVictory: { bossName: string; trinketOptions: TrinketId[]; chosenTrinket: TrinketId | null; claimedTrinket: TrinketId | null } | null;
  log: string[];
  // Flat HP granted by the party's equipped class passives (e.g. Priest's
  // +60 max HP). Computed once at run start — equipped passives don't change
  // mid-run — so the heal reward can show effective numbers without needing
  // the full Player[] at choice time.
  partyPassiveHealth: number;
  // Team HP pool — the single source of truth for the party's health in a
  // Dartlite run. All players share this pool. Damage hits the team; healing
  // and max-HP upgrades increase it. No per-player HP is tracked.
  teamHp: number;
  teamMaxHp: number;
}

export interface DartliteRunPlayer {
  id: string;
  name: string;
  color: string;
  baseHp: number;
  power: number;
  armor: number;
  crit: number;
  trinkets: TrinketId[];
  bonusHealth: number;
  bonusArmor: number;
  bonusPower: number;
  cards: PlayerCard[];
}

// ── Choices ───────────────────────────────────────────────────────────

export type ChoiceKind = 'heal' | 'stat' | 'trinket' | 'card_new' | 'card_upgrade' | 'deck_upgrade';

export interface ChoiceOption {
  kind: ChoiceKind;
  label: string;
  desc: string;
  icon: string;
  stat?: 'health' | 'armor' | 'power';
  amount?: number;
  trinketId?: TrinketId;
  cardId?: string;
  cardName?: string;
}

// ── XP rewards ─────────────────────────────────────────────────────────

export function xpForKill(enemyDifficulty: string): number {
  if (enemyDifficulty === 'Boss') return 100;
  if (enemyDifficulty === 'Hard') return 40;
  return 20;
}

export function xpForBattleWin(round: number): number {
  const scale = 1 + Math.floor(Math.max(0, round - 1) / 3) * 0.5;
  if (isBossRound(round)) return Math.round(200 * scale);
  if (isMiniBossRound(round)) return Math.round(100 * scale);
  return Math.round(50 * scale);
}
