import type { Player, Settings } from '../types';

// ── Campaign types ───────────────────────────────────────────────────────
//
// Type definitions for the campaign (co-op) mode. The campaign engine lives
// in ./engine/ and is re-exported from ./engine.ts.

export type ShieldType = 'span' | 'exact';
export type SpanTarget = 'TOP_HALF' | 'BOTTOM_HALF' | 'LEFT_HALF' | 'RIGHT_HALF';
export type ExactTarget = 'T20' | 'T19' | 'T18' | 'T17' | 'T16' | 'T15' | 'D20' | 'D19' | 'D18' | 'D17' | 'D16' | 'D15' | 'Bull' | '25';

export interface ShieldLayer {
  type: ShieldType;
  target_value: SpanTarget | ExactTarget;
  flatHp?: number;
}

export interface EnemyDatabase {
  [id: string]: {
    name: string;
    difficulty: 'Easy' | 'Medium' | 'Hard' | 'Boss';
    max_hp: number;
    armor: number;
    accuracy: number;
    precision: number;
    shields: ShieldLayer[];
  };
}

export interface CampaignLevel {
  level_id: number;
  name: string;
  is_boss: boolean;
  enemies: string[];
  reward_power_up: string;
  story_bit: string;
}

export interface CampaignChapter {
  id: string;
  name: string;
  description: string;
  levels: CampaignLevel[];
}

export interface CampaignDart {
  value: number;
  label: string;
  base: number;
  mult: number;
  isDouble: boolean;
  isBull: boolean;
}

export interface ActiveEnemy {
  id: string;
  defId: string;
  name: string;
  hp: number;
  maxHp: number;
  armor: number;
  accuracy: number;
  precision: number;
  shields: ShieldLayer[];
  defeated: boolean;
  vulnerableTurns: number;
  weakenedTurns: number;
  weakenAmount: number;
  distractedTurns: number;
  distractAmount: number;
  frozenTurns: number;
  buffs: { id: string; kind: string; amount: number; turnsLeft: number }[];
}

export interface CoopPlayer {
  id: string;
  name: string;
  power: number;
  crit: number;
  powerUpCharge: number;
  buffs: { id: string; kind: string; amount: number; turnsLeft: number; source?: string }[];
}

export type ResolvedDartKind = 'damage' | 'miss' | 'shield_break' | 'defeated';

export interface ResolvedDart {
  dart: CampaignDart;
  damage: number;
  kind: ResolvedDartKind;
  enemyId: string;
  enemyName: string;
  hpAfter: number;
  attackerPower?: number;
  targetArmor?: number;
  vulnerable?: boolean;
  crit?: boolean;
  critMult?: number;
  shieldTarget?: string;
}

export interface EnemyAttackStep {
  enemyId: string;
  enemyName: string;
  dart: CampaignDart;
  damage: number;
  partyHpAfter: number;
  weakenAmount?: number;
  distractAmount?: number;
}

export interface VisitLogEntry {
  kind: 'player_attack_step' | 'enemy_attack_step';
  step: EnemyAttackStep;
}

export interface CampaignBattleState {
  levelId: number;
  chapterId: string;
  enemies: ActiveEnemy[];
  targetIdx: number;
  partyHp: number;
  partyMaxHp: number;
  players: CoopPlayer[];
  playerTurnIdx: number;
  phase: 'player' | 'enemy';
  outcome: 'ongoing' | 'victory' | 'defeat';
  darts: CampaignDart[];
  resolvedDarts: ResolvedDart[];
  visitEnemiesSnapshot: ActiveEnemy[];
  pendingEnemyAttacks: EnemyAttackStep[];
  appliedEnemyAttacks: EnemyAttackStep[];
  frozenEnemiesThisRound: { id: string; name: string; frozenTurns: number }[];
  visitNumber: number;
  awaitContinue: boolean;
  lastVisitLog: VisitLogEntry[];
  stats: {
    totalDamage: number;
    partyHpLost: number;
    enemiesDefeated: number;
    dartsThrown: number;
  };
  cardMode?: boolean;
}

export interface CampaignProgress {
  highest_level_beaten: number;
  unlockedPowerUps: string[];
  chapters: { [chapterId: string]: number };
}

export interface CoopPowerUp {
  id: string;
  name: string;
  icon: string;
  desc: string;
  cost: number;
  tier: 'starter' | 'advanced';
}

export type CoopPowerUpId =
  | 'coop_shield'
  | 'coop_meteor'
  | 'coop_ressurect'
  | 'coop_frostbite'
  | 'coop_ice_lance'
  | 'coop_winter_veil'
  | 'coop_thorn_lance'
  | 'coop_verdant_bloom'
  | 'coop_heart_of_maw'
  | 'coop_glacial_doom';

export interface CoopClass {
  id: string;
  name: string;
  icon: string;
  desc: string;
  passives: string[];
}

export interface CoopPassive {
  id: string;
  name: string;
  icon: string;
  desc: string;
  bonus: { health?: number; power?: number; crit?: number };
  levelRequired: number;
}

export interface PartyPassiveBonus {
  health: number;
  power: number;
  crit: number;
}

export interface CoopClassXp {
  xp: number;
}

export interface CoopClassProgress {
  classId: string;
  xp: number;
}

export interface PlayerCampaignProgress {
  highest_level_beaten: number;
  unlockedPowerUps: string[];
  chapters: { [chapterId: string]: number };
  classProgress: CoopClassProgress[];
  equippedPassives: string[];
}
