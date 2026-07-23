// Coop Campaign type definitions.
//
// This module is the single source of truth for the shape of coop campaign
// runtime state, persisted progress, classes/passives, and power-ups. The
// engine module (`engine/index.ts`) re-exports the public engine API and the
// types it needs; components import types directly from here.

import type { CardDef } from '../cards/types';

// ── Power-ups ─────────────────────────────────────────────────────────

export type CoopPowerUpTier = 'starter' | 'advanced';

export interface CoopPowerUp {
  id: CoopPowerUpId;
  name: string;
  icon: string;
  desc: string;
  cost: number; // charge cost to activate
  tier: CoopPowerUpTier;
}

// A buff currently active on a player (e.g. +power for 2 more turns).
export interface PlayerBuff {
  id: string;
  kind:
    | 'power'
    | 'accuracy'
    | 'regen'
    | 'shield'
    | 'armor'
    | 'surge'
    | 'hot_streak'
    | 'bust_protect'
    | 'double_up'
    | 'extra_dart'
    | 'reflect';
  amount: number;
  turnsLeft: number;
  source: string; // player id who granted it
}

// ── Runtime combat state ──────────────────────────────────────────────

export interface ActiveEnemy {
  id: string;        // instance id (unique per battle)
  defId: string;     // key into EnemyDatabase
  name: string;
  hp: number;
  maxHp: number;
  armor: number;
  accuracy: number;
  precision: number;
  shields: ShieldLayer[]; // remaining shields (front = next to break)
  defeated: boolean;
  frozenTurns: number;  // when > 0 the enemy skips its next attack(s)
  vulnerableTurns: number; // when > 0, enemy takes +50% damage from all sources (Time Warp)
  // Focus Buff: when > 0, the enemy's accuracy and precision are reduced
  // by `distractAmount` (clamped to >= 0) during its attacks. Decremented
  // at the end of each enemy round alongside other timers.
  distractedTurns: number;
  distractAmount: number;
}

export interface CoopPlayer {
  id: string;       // matches Player.id
  name: string;
  color: string;
  hp: number;       // per-player current HP (for display)
  maxHp: number;    // per-player max HP (from their health attribute)
  power: number;    // per-player power (from their power attribute)
  armor: number;    // per-player armor (from their armor attribute)
  buffs: PlayerBuff[];
  // Per-player coop power-up charge (0..chargeMax). Each player fills their
  // own orb from their own darts and spends it on their own power-up.
  powerUpCharge: number;
  // Snapshot of the player's equipped class id (e.g. 'warrior') for this
  // battle. Used by the engine to apply class-based passive bonuses.
  classId?: CoopClassId | null;
  // Per-player cumulative kills and damage for this battle (for display in
  // Dartlite progress popups). Incremented in addDart as darts resolve.
  kills?: number;
  damageDealt?: number;
}

export interface CampaignDart {
  value: number;
  label: string;
  base: number;
  mult: number;
  isDouble: boolean;
  isBull?: boolean;
}

// A single dart's resolution against an enemy — used for the dart-by-dart
// animated overlay. damage = 0 means shield-break or miss.
export interface ResolvedDart {
  dart: CampaignDart;
  damage: number;
  kind: 'miss' | 'shield_break' | 'damage' | 'defeated';
  shieldTarget?: string;
  enemyId: string;
  enemyName: string;
  hpAfter: number;
  // Damage breakdown so the UI can show how the final damage was computed.
  attackerPower?: number;
  targetArmor?: number;
  vulnerable?: boolean;
}

// An enemy attack step (one dart) — used for the dart-by-dart enemy overlay.
export interface EnemyAttackStep {
  enemyId: string;
  enemyName: string;
  dart: CampaignDart;
  damage: number;
  partyHpAfter: number;
  targetPlayerId?: string; // which player the dart hit (for display)
}

export type VisitLogEntry =
  | { kind: 'shield_break'; dartLabel: string; shieldIndex: number; shieldTarget: string }
  | { kind: 'damage'; dartLabel: string; damage: number; enemyId: string }
  | { kind: 'enemy_defeated'; enemyId: string; enemyName: string }
  | { kind: 'enemy_attack'; enemyName: string; damage: number; dartLabel: string }
  | { kind: 'party_hit'; damage: number }
  | { kind: 'player_attack_step'; step: EnemyAttackStep }
  | { kind: 'player_resolved_dart'; step: ResolvedDart };

export interface CampaignBattleState {
  levelId: number;
  levelName: string;
  isBoss: boolean;
  partyHp: number;
  partyMaxHp: number;
  players: CoopPlayer[];
  // Chapter this battle belongs to. Used by the post-game screen to pick
  // the right theme/story and by the engine to scope level lookups.
  chapterId: string;
  // Cumulative battle stats shown on the post-game screen.
  stats: {
    visitsUsed: number;
    dartsThrown: number;
    damageDealt: number;
    enemiesDefeated: number;
    powerUpsUsed: number;
    partyHpLost: number;
  };
  // Whose turn within the party (index into `players`). After every player
  // has thrown once, the enemy phase begins.
  playerTurnIdx: number;
  // Per-player dart slots for the current visit (max 3 each).
  darts: CampaignDart[];
  enemies: ActiveEnemy[];
  // Index into `enemies` of the currently targeted enemy (player chooses).
  targetIdx: number;
  // Whose phase: 'player' | 'enemy'.
  phase: 'player' | 'enemy';
  // Per-visit shield-break log so the UI can show what happened.
  lastVisitLog: VisitLogEntry[];
  // Visit counter (starts at 1, increments after each full party round).
  visitNumber: number;
  // Outcome once the battle ends.
  outcome: 'ongoing' | 'victory' | 'defeat';
  // Party-shared power-up charge (0..100). Fills from doubles/triples/bulls.
  // DEPRECATED: kept for backwards-compat with old saves. Per-player charge
  // now lives on `CoopPlayer.powerUpCharge`. New code reads/writes the
  // per-player field; this is only used as a fallback when migrating.
  powerUpCharge: number;
  // Resolved darts for the current player's visit — each dart is resolved
  // immediately as it is thrown (damage applied to the targeted enemy).
  // After the 3rd dart, the UI shows a summary overlay listing all darts,
  // their targets, and the resulting HP / defeated status.
  resolvedDarts: ResolvedDart[];
  // Snapshot of the enemies array at the start of the current player's
  // visit, used to support undo of immediately-applied darts.
  visitEnemiesSnapshot: ActiveEnemy[];
  // Pending enemy attack steps — the UI animates through these one at a
  // time, applying damage to the party HP.
  pendingEnemyAttacks: EnemyAttackStep[];
  // Enemy attack steps already applied during the current enemy phase —
  // kept so the overlay can show all darts thrown so far (dart 1, 2, 3…)
  // cumulatively rather than only the current one.
  appliedEnemyAttacks: EnemyAttackStep[];
  // When true, the UI is expected to wait for the player to tap "Continue"
  // before advancing. Used by the dart-by-dart overlays.
  awaitContinue: boolean;
  // Phantom Darts power-up: when > 0, the next darts thrown by the current
  // player are auto-converted to bullseyes (50 each).
  phantomDarts: number;
  // Enemies that were frozen (skipped) during the current enemy phase. The
  // UI shows a "frozen" popup listing these enemies and their remaining
  // frozen turns, then advances to the player phase on Continue. Cleared
  // at the start of each enemy phase by `prepareEnemyTurn`.
  frozenEnemiesThisRound: { id: string; name: string; frozenTurns: number }[];
  // Snapshot of the team-wide passive bonus applied at battle start (from
  // each player's equipped class passives). Kept so the UI can show which
  // passives are active and their stat contributions.
  passiveBonus?: {
    power: number;
    health: number;
    armor: number;
    sources: { playerId: string; playerName: string; passiveName: string; icon: string; bonus: { power?: number; health?: number; armor?: number } }[];
  };
}

// ── Coop classes & passives ───────────────────────────────────────────
//
// Each player can pick one of three classes for Coop mode: Warrior, Priest,
// or Rogue. Each class has five tiers of passives (starter through tier 5),
// with three distinct passives per tier to choose from — fifteen passives
// per class total. Passives grant team-wide stat bonuses while the player is
// in the party. A player equips one passive at a time per class.

export type CoopClassId = 'warrior' | 'priest' | 'rogue';

export interface CoopClassDef {
  id: CoopClassId;
  name: string;
  icon: string;
  desc: string;
  // The starter passive id (always active for this class).
  starterPassive: CoopPassiveId;
}

export type CoopPassiveId =
  // Warrior — party power bonuses (3 per tier: power, crit, lifesteal-style)
  | 'war_power_1' | 'war_crit_1' | 'war_fury_1'
  | 'war_power_2' | 'war_crit_2' | 'war_fury_2'
  | 'war_power_3' | 'war_crit_3' | 'war_fury_3'
  | 'war_power_4' | 'war_crit_4' | 'war_fury_4'
  | 'war_power_5' | 'war_crit_5' | 'war_fury_5'
  // Priest — party sustain/HP bonuses (3 per tier: hp, regen, shield)
  | 'pri_hp_1' | 'pri_regen_1' | 'pri_shield_1'
  | 'pri_hp_2' | 'pri_regen_2' | 'pri_shield_2'
  | 'pri_hp_3' | 'pri_regen_3' | 'pri_shield_3'
  | 'pri_hp_4' | 'pri_regen_4' | 'pri_shield_4'
  | 'pri_hp_5' | 'pri_regen_5' | 'pri_shield_5'
  // Rogue — party defense bonuses (3 per tier: armor, dodge, thorns)
  | 'rog_armor_1' | 'rog_dodge_1' | 'rog_thorns_1'
  | 'rog_armor_2' | 'rog_dodge_2' | 'rog_thorns_2'
  | 'rog_armor_3' | 'rog_dodge_3' | 'rog_thorns_3'
  | 'rog_armor_4' | 'rog_dodge_4' | 'rog_thorns_4'
  | 'rog_armor_5' | 'rog_dodge_5' | 'rog_thorns_5';

export interface CoopPassiveDef {
  id: CoopPassiveId;
  classId: CoopClassId;
  tier: 1 | 2 | 3 | 4 | 5; // 1 = starter, 2-5 = progression. 3 passives per tier per class.
  name: string;
  icon: string;
  desc: string;
  // Stat bonus applied to the whole party while this passive is active.
  // Each successive tier is strictly stronger.
  bonus: {
    power?: number;  // flat power added to every party member
    health?: number; // flat max HP added to every party member
    armor?: number;  // flat armor added to every party member
  };
  // Player level required to unlock this passive. Tier 1 is always 1 (starter).
  levelRequired: number;
}

// Persisted per-player Coop progression. Stored on the Player object.
// XP is now unified — see `Player.xp` / `Player.level`. This struct keeps
// class selection and passive equip state only.
export interface PlayerCoopProgress {
  classId: CoopClassId | null;          // currently selected class
  xp?: number;                          // DEPRECATED — kept for migration; use classXp
  unlockedPassives: CoopPassiveId[];   // passives unlocked (incl. starter)
  equippedPassives: CoopPassiveId[];   // passives currently equipped (active)
  // Per-class XP tracking. Each class maintains its own XP and level.
  // Migrated from the unified Player.xp system so switching classes
  // preserves each class's progression independently.
  classXp?: Record<string, number>;     // { warrior: 150, priest: 80, rogue: 0 }
}

// Per-player Co-op Campaign progress. Stored on the Player object as
// `campaignProgress`. Mirrors the shared `CampaignProgress` shape but is
// tracked per player so a level is only "beaten for everyone" when every
// party member has cleared it. `chapters` maps chapter id → highest cleared
// level index (0-based) within that chapter. `unlockedPowerUps` lists the
// reward power-up ids this player has personally unlocked.
export interface PlayerCampaignProgress {
  highest_level_beaten: number;
  unlockedPowerUps?: string[];
  chapters?: Record<string, number>;
}


//
// `highest_level_beaten` is kept for backwards compatibility with badges
// and titles that read it (it counts the cumulative number of levels
// cleared across all chapters). Per-chapter progress is tracked in
// `chapters`: a map of chapter id → highest level index cleared (0 = none,
// N = boss cleared). A chapter is "completed" when its boss index matches
// the number of levels in that chapter.
export interface CampaignProgress {
  highest_level_beaten: number;
  // Advanced coop power-up ids unlocked by clearing levels. Starter
  // power-ups are always available and not tracked here.
  unlockedPowerUps?: string[];
  // Per-chapter progress. Key is chapter id; value is the highest level
  // index (0-based, into the chapter's `levels` array) that has been
  // cleared. A value equal to `levels.length` means the chapter is done.
  chapters?: Record<string, number>;
}
