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
}

export interface CampaignConfig {
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
  // Advanced (unlocked as level rewards)
  | 'coop_meteor'      // L1: Massive AoE damage to every enemy
  | 'coop_phantom'    // L2: Next 3 darts auto-bullseye
  | 'coop_time_warp'  // L3: Enemies take 3 turns of double damage
  | 'coop_ressurect'  // L4: Full party HP + clear all debuffs
  | 'coop_apocalypse'; // L5 (boss): Devastating nuke + freeze + heal combo

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
  kind: 'power' | 'accuracy';
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
}

// Persisted progress (also stored to localStorage + Supabase).
export interface CampaignProgress {
  highest_level_beaten: number;
  // Advanced coop power-up ids unlocked by clearing levels. Starter
  // power-ups are always available and not tracked here.
  unlockedPowerUps?: string[];
}
