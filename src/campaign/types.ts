
// ── Campaign types ───────────────────────────────────────────────────────
//
// Type definitions for the campaign (co-op) mode. The campaign engine lives
// in ./engine/ and is re-exported from ./engine.ts.

export type Difficulty = 'Easy' | 'Medium' | 'Hard' | 'Boss';

export type ShieldType = 'span' | 'exact';
export type SpanTarget = 'TOP_HALF' | 'BOTTOM_HALF' | 'LEFT_HALF' | 'RIGHT_HALF' | 'ANY_DOUBLE' | 'ANY_TRIPLE' | 'ANY_BULL';
export type ExactTarget = string;

export interface ShieldLayer {
  type: ShieldType;
  target_value: SpanTarget | ExactTarget;
  flatHp?: number;
}

export interface EnemyDef {
  name: string;
  difficulty: Difficulty;
  max_hp: number;
  armor: number;
  accuracy: number;
  precision: number;
  shields: ShieldLayer[];
}

export interface EnemyDatabase {
  [id: string]: EnemyDef;
}

export interface CampaignLevel {
  level_id: number;
  name: string;
  is_boss: boolean;
  enemies: string[];
  reward_power_up?: string;
  story_bit?: string;
}

export interface ChapterTheme {
  id: string;
  name: string;
  background: string;
  accent: string;
  cardTint: string;
}

export interface ChapterStory {
  intro: string;
  outro: string;
}

export interface CampaignChapter {
  id: string;
  name: string;
  subtitle: string;
  theme: ChapterTheme;
  story: ChapterStory;
  levels: CampaignLevel[];
}

export interface CampaignConfig {
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

export interface PlayerBuff {
  id: string;
  kind: 'power' | 'crit' | 'crit_guarantee' | 'crit_multiplier' | 'shield' | string;
  amount: number;
  turnsLeft: number;
  source?: string;
}

export interface CoopPlayer {
  id: string;
  name: string;
  color: string;
  hp: number;
  maxHp: number;
  power: number;
  armor: number;
  crit: number;
  powerUpCharge: number;
  buffs: PlayerBuff[];
  classId: string | null;
  kills: number;
  damageDealt: number;
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
  shielded?: number;
}

export interface VisitLogEntry {
  kind: 'player_attack_step' | 'enemy_attack_step';
  step: EnemyAttackStep;
}

export interface CampaignBattleStats {
  totalDamage: number;
  partyHpLost: number;
  enemiesDefeated: number;
  dartsThrown: number;
  visitsUsed: number;
  damageDealt: number;
  powerUpsUsed: number;
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
  stats: CampaignBattleStats;
  cardMode?: boolean;
  passiveBonus?: import('./engine/classes').PartyPassiveBonus;
  phantomDarts?: number;
  powerUpCharge?: number;
  trinkets?: string[];
}

export interface CampaignProgress {
  highest_level_beaten: number;
  unlockedPowerUps: string[];
  chapters: { [chapterId: string]: number };
}

// ── Coop class & passive types ───────────────────────────────────────────

export type CoopClassId = 'warrior' | 'priest' | 'rogue';

export interface CoopClassDef {
  id: CoopClassId;
  name: string;
  icon: string;
  desc: string;
  starterPassive: string;
}

export type CoopPassiveId = string;

export interface CoopPassiveDef {
  id: CoopPassiveId;
  classId: CoopClassId;
  tier: number;
  name: string;
  icon: string;
  desc: string;
  bonus: { health?: number; power?: number; armor?: number; crit?: number };
  levelRequired: number;
}

export interface PlayerCoopProgress {
  classId: CoopClassId | null;
  classXp?: Record<string, number>;
  unlockedPassives: CoopPassiveId[];
  equippedPassives: CoopPassiveId[];
}

// ── Coop power-up types ───────────────────────────────────────────────────

export type CoopPowerUpId =
  | 'coop_heal'
  | 'coop_buff_power'
  | 'coop_buff_acc'
  | 'coop_freeze'
  | 'coop_shield'
  | 'coop_meteor'
  | 'coop_phantom'
  | 'coop_time_warp'
  | 'coop_ressurect'
  | 'coop_apocalypse'
  | 'coop_blizzard'
  | 'coop_frostbite'
  | 'coop_ice_lance'
  | 'coop_winter_veil'
  | 'coop_glacial_doom'
  | 'coop_vine_grasp'
  | 'coop_spore_burst'
  | 'coop_thorn_lance'
  | 'coop_verdant_bloom'
  | 'coop_heart_of_maw';

export interface CoopPowerUpDef {
  id: CoopPowerUpId;
  name: string;
  icon: string;
  desc: string;
  cost: number;
  tier: 'starter' | 'advanced';
}

export interface CoopPassive {
  id: string;
  name: string;
  icon: string;
  desc: string;
  bonus: { health?: number; power?: number; crit?: number };
  levelRequired: number;
}

export interface CoopClass {
  id: string;
  name: string;
  icon: string;
  desc: string;
  passives: string[];
}

export interface PartyPassiveBonus {
  power: number;
  health: number;
  armor: number;
  crit: number;
  sources: { playerId: string; playerName: string; passiveName: string; icon: string; bonus: CoopPassiveDef['bonus'] }[];
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
  classProgress?: CoopClassProgress[];
  equippedPassives?: string[];
}
