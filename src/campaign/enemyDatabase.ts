import type { EnemyDatabase } from './types';

// Static enemy definitions. Editable via the in-app Campaign Editor, which
// can export this exact shape as JSON for paste-back into this file.
export const ENEMY_DATABASE: EnemyDatabase = {
  // ── Chapter 1: Crimson Vale ──────────────────────────────────────────
  goblin_scout: {
    name: 'Goblin Scout',
    difficulty: 'Easy',
    max_hp: 45,
    armor: 0,
    accuracy: 0.35,
    precision: 0.40,
    shields: [],
  },
  goblin_brute: {
    name: 'Goblin Brute',
    difficulty: 'Easy',
    max_hp: 70,
    armor: 2,
    accuracy: 0.40,
    precision: 0.35,
    shields: [],
  },
  orc_raider: {
    name: 'Orc Raider',
    difficulty: 'Hard',
    max_hp: 130,
    armor: 5,
    accuracy: 0.55,
    precision: 0.60,
    shields: [
      { type: 'span', target_value: 'TOP_HALF' },
    ],
  },
  dark_mage: {
    name: 'Dark Mage',
    difficulty: 'Hard',
    max_hp: 110,
    armor: 0,
    accuracy: 0.65,
    precision: 0.75,
    shields: [
      { type: 'exact', target_value: 'D20' },
    ],
  },
  royal_guard: {
    name: 'Royal Guard',
    difficulty: 'Hard',
    max_hp: 150,
    armor: 8,
    accuracy: 0.55,
    precision: 0.55,
    shields: [
      { type: 'span', target_value: 'BOTTOM_HALF' },
      { type: 'exact', target_value: 'T15' },
    ],
  },
  warlord_malakar: {
    name: 'Warlord Malakar',
    difficulty: 'Boss',
    max_hp: 300,
    armor: 12,
    accuracy: 0.85,
    precision: 0.90,
    shields: [
      { type: 'span', target_value: 'TOP_HALF' },
      { type: 'exact', target_value: '20' },
      { type: 'exact', target_value: 'D18' },
    ],
  },

  // ── Chapter 2: Frozen Throne ────────────────────────────────────────
  ice_wolf: {
    name: 'Ice Wolf',
    difficulty: 'Easy',
    max_hp: 60,
    armor: 1,
    accuracy: 0.45,
    precision: 0.45,
    shields: [],
  },
  frost_archer: {
    name: 'Frost Archer',
    difficulty: 'Hard',
    max_hp: 110,
    armor: 3,
    accuracy: 0.65,
    precision: 0.70,
    shields: [
      { type: 'span', target_value: 'BOTTOM_HALF' },
    ],
  },
  frost_knight: {
    name: 'Frost Knight',
    difficulty: 'Hard',
    max_hp: 180,
    armor: 10,
    accuracy: 0.60,
    precision: 0.55,
    shields: [
      { type: 'span', target_value: 'TOP_HALF' },
      { type: 'exact', target_value: 'T20' },
    ],
  },
  ice_queen: {
    name: 'The Ice Queen',
    difficulty: 'Boss',
    max_hp: 360,
    armor: 14,
    accuracy: 0.85,
    precision: 0.90,
    shields: [
      { type: 'span', target_value: 'TOP_HALF' },
      { type: 'exact', target_value: 'D20' },
      { type: 'exact', target_value: 'Bull' },
    ],
  },
};
