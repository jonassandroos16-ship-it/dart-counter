import type { CampaignBattleState } from '../campaign/types';
import type { Player, Settings } from '../types';
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
}

export interface DartliteRunPlayer {
  id: string;
  name: string;
  color: string;
  hp: number;
  maxHp: number;
  power: number;
  armor: number;
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
  if (isBossRound(round)) return 200;
  if (isMiniBossRound(round)) return 100;
  return 50;
}
