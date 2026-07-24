// ── Co-op Campaign data model ─────────────────────────────────────────
//
// The campaign is JSON-driven. Static content (levels, enemy stats, shield
// definitions) lives in `campaignLevels.ts` and `enemyDatabase.ts`. Player
// progress is the highest level beaten. Party HP is now per-level — each
// level recomputes the party's max HP from the combined `health` attribute
// of the selected players, so adding more (or higher-level) players raises
// the party HP pool for that level only.
//
// The combat engine in `engine.ts` is pure: it takes a campaign state and a
// player action and returns the next state, so the UI stays a thin shell.

export type Difficulty = 'Easy' | 'Hard' | 'Boss';

// A shield layer is either a broad "span" (e.g. TOP_HALF of the board, or
// ANY_DOUBLE) or an "exact" segment (e.g. Single 20, Triple 15, Bull).
export type ShieldType = 'span' | 'exact';

export type SpanTarget =
  | 'TOP_HALF'
  | 'BOTTOM_HALF'
  | 'LEFT_HALF'
  | 'RIGHT_HALF'
  | 'ANY_DOUBLE'
  | 'ANY_TRIPLE'
  | 'ANY_BULL';

// Exact targets are encoded as a string of the form
//   "20"      — single 20
//   "D20"     — double 20
//   "T15"     — triple 15
//   "25"      — outer bull (25)
//   "Bull"    — bullseye (50)
export type ExactTarget = string;

export interface ShieldLayer {
  type: ShieldType;
  target_value: SpanTarget | ExactTarget;
}

export interface EnemyDef {
  name: string;
  difficulty: Difficulty;
  max_hp: number;
  armor: number;
  accuracy: number;   // 0..1 — chance the AI hits its intended sector
  precision: number;  // 0..1 — clustering; high → adjacent numbers, low → random scatter
  shields: ShieldLayer[];
}

export interface EnemyDatabase {
  [enemy_id: string]: EnemyDef;
}

export interface CampaignLevel {
  level_id: number;
  name: string;
  is_boss: boolean;
  enemies: string[]; // enemy ids into the EnemyDatabase
  // Coop power-up id unlocked the first time this level is beaten. The
  // boss level (last level) carries the strongest advanced power-up.
  reward_power_up?: string;
  // Short story beat shown on the post-game screen after this level is
  // cleared. Optional; falls back to the chapter's outro for the boss.
  story_bit?: string;
}

export interface CampaignConfig {
  levels: CampaignLevel[];
}

// ── Chapters ──────────────────────────────────────────────────────────
//
// The campaign is split into chapters. Each chapter has its own theme
// (background palette), story (intro shown on the chapter-select screen,
// outro shown after the boss is defeated), and a linear set of levels.
// Chapters unlock sequentially — chapter N requires chapter N-1's boss
// to be defeated (i.e. the previous chapter's last level cleared).

export type ChapterThemeId = 'crimson' | 'ice' | 'jungle';

export interface ChapterTheme {
  id: ChapterThemeId;
  name: string;
  // CSS background applied to the chapter's screens (map, battle, post-game).
  background: string;
  // Accent color used for headers, pills, and highlights.
  accent: string;
  // Soft tint used for card backgrounds.
  cardTint: string;
}

export interface CampaignChapter {
  id: string;
  name: string;
  subtitle: string;
  theme: ChapterTheme;
  // Short overall story for the chapter — intro shown on chapter select,
  // outro shown on the post-game screen after the boss is defeated.
  story: {
    intro: string;
    outro: string;
  };
  levels: CampaignLevel[];
}

// ── Coop power-ups ────────────────────────────────────────────────────
//
// Coop power-ups are single-use abilities the party can activate during a
// player's turn (before throwing). They cost one charge from the party's
// shared pool, which fills as the party lands doubles/triples/bulls.
//
// Power-ups come in two tiers:
//   - 'starter': the original five, available from the start of every game.
//   - 'advanced': five stronger, flashier power-ups unlocked as rewards for
//     clearing specific Coop campaign levels. The strongest sits on the
//     boss level. Each is more powerful than the one before it.
export type CoopPowerUpTier = 'starter' | 'advanced';

export type CoopPowerUpId =
  // Starter (always available)
  | 'coop_heal'        // Restore party HP
  | 'coop_buff_power'  // Give all players +power for N turns
  | 'coop_buff_acc'    // Distract enemies: -accuracy & -precision for N turns
  | 'coop_freeze'      // Freeze all enemies for N turns (skip their attacks)
  | 'coop_shield'      // Add a temporary shield that absorbs one enemy hit
  // Advanced — Chapter 1 (unlocked as level rewards)
  | 'coop_meteor'      // L1: Massive AoE damage to every enemy
  | 'coop_phantom'    // L2: Next 3 darts auto-bullseye
  | 'coop_time_warp'  // L3: Enemies take 3 turns of double damage
  | 'coop_ressurect'  // L4: Full party HP + clear all debuffs
  | 'coop_apocalypse' // L5 (boss): Devastating nuke + freeze + heal combo
  // Advanced — Chapter 2 (Frozen Throne rewards)
  | 'coop_blizzard'     // C2 L1: Damage + freeze all enemies for 1 turn
  | 'coop_frostbite'    // C2 L2: Enemies take -accuracy for 3 turns and 40 dmg
  | 'coop_ice_lance'    // C2 L3: 120 damage to a single targeted enemy, ignoring shields
  | 'coop_winter_veil'  // C2 L4: Party takes half damage for 3 turns (shield + heal)
  | 'coop_glacial_doom' // C2 L5 (boss): 180 dmg to all + freeze 3 turns + full heal
  // Advanced — Chapter 3 (Verdant Maw rewards)
  | 'coop_vine_grasp'    // C3 L1: Root all enemies — 50 dmg + freeze 1 turn
  | 'coop_spore_burst'   // C3 L2: 60 dmg + distract (-30% acc) for 3 turns
  | 'coop_thorn_lance'   // C3 L3: 160 dmg to one enemy, ignoring shields
  | 'coop_verdant_bloom' // C3 L4: Heal 100 + clear enemy shields + party +5 power 3 turns
  | 'coop_heart_of_maw'; // C3 L5 (boss): 220 dmg to all + freeze 3 + full heal + clear shields

export interface CoopPowerUpDef {
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
    | 'reflect'
    | 'crit'
    | 'crit_guarantee'
    | 'crit_multiplier';
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
  crit: number;     // per-player crit % (from their crit attribute)
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
  crit?: boolean;
  critMult?: number;
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
