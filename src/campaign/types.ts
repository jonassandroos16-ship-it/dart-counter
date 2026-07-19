// ── Co-op Campaign data model ─────────────────────────────────────────
//
// The campaign is fully JSON-driven. Static content (levels, enemy stats,
// shield definitions) lives in `campaign_levels.json` and
// `enemy_database.json`. Player progress is a single integer — the highest
// level beaten — plus the party's current HP, which is persisted between
// sessions. The combat engine in `engine.ts` is pure: it takes a campaign
// state and a player action and returns the next state, so the UI stays a
// thin shell.

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
}

export interface CampaignConfig {
  levels: CampaignLevel[];
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
}

export interface CampaignBattleState {
  levelId: number;
  levelName: string;
  isBoss: boolean;
  partyHp: number;
  partyMaxHp: number;
  enemies: ActiveEnemy[];
  // Index into `enemies` of the currently targeted enemy (player chooses).
  targetIdx: number;
  // Player turn: darts thrown so far this visit (max 3).
  darts: CampaignDart[];
  // Whose phase: 'player' | 'enemy'.
  phase: 'player' | 'enemy';
  // Per-visit shield-break log so the UI can show what happened.
  lastVisitLog: VisitLogEntry[];
  // Visit counter (starts at 1, increments after each player visit).
  visitNumber: number;
  // Outcome once the battle ends.
  outcome: 'ongoing' | 'victory' | 'defeat';
}

export interface CampaignDart {
  value: number;
  label: string;
  base: number;
  mult: number;
  isDouble: boolean;
  isBull?: boolean;
}

export type VisitLogEntry =
  | { kind: 'shield_break'; dartLabel: string; shieldIndex: number; shieldTarget: string }
  | { kind: 'damage'; dartLabel: string; damage: number; enemyId: string }
  | { kind: 'enemy_defeated'; enemyId: string; enemyName: string }
  | { kind: 'enemy_attack'; enemyName: string; damage: number; dartLabel: string }
  | { kind: 'party_hit'; damage: number };

// Persisted progress (also stored to localStorage + Supabase).
export interface CampaignProgress {
  highest_level_beaten: number;
  current_party_hp: number;
  party_max_hp: number;
}
