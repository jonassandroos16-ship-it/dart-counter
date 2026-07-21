import type { EnemyDatabase } from './types';

// Static enemy definitions. Editable via the in-app Campaign Editor, which
// can export this exact shape as JSON for paste-back into this file.
//
// Rebalance pass (3 chapters):
//   Chapter 1 — Easy. Aimed at dart beginners. No power-ups or
//     triples/doubles needed for a 2-player game. Low HP, no armor, low
//     accuracy/precision, and shields only on the boss.
//   Chapter 2 — Medium. Aimed at okay players. Some lucky triples and
//     doubles are required to break shields. Assumes the party has added
//     points to health and armor, so enemies hit harder and have shields
//     on most levels.
//   Chapter 3 — Hard. Aimed at high-level parties with power-ups. Heavy
//     armor, high accuracy/precision, and layered shields on every enemy.
export const ENEMY_DATABASE: EnemyDatabase = {
  // ── Chapter 1: Crimson Vale (Easy) ──────────────────────────────────
  // Low HP, no armor, low accuracy/precision. Shields only on the boss.
  // A 2-player party of beginners can clear this with singles alone.
  goblin_scout: {
    name: 'Goblin Scout',
    difficulty: 'Easy',
    max_hp: 30,
    armor: 0,
    accuracy: 0.20,
    precision: 0.25,
    shields: [],
  },
  goblin_brute: {
    name: 'Goblin Brute',
    difficulty: 'Easy',
    max_hp: 50,
    armor: 0,
    accuracy: 0.25,
    precision: 0.20,
    shields: [],
  },
  orc_raider: {
    name: 'Orc Raider',
    difficulty: 'Easy',
    max_hp: 80,
    armor: 2,
    accuracy: 0.30,
    precision: 0.35,
    shields: [],
  },
  dark_mage: {
    name: 'Dark Mage',
    difficulty: 'Easy',
    max_hp: 70,
    armor: 0,
    accuracy: 0.35,
    precision: 0.40,
    shields: [],
  },
  royal_guard: {
    name: 'Royal Guard',
    difficulty: 'Easy',
    max_hp: 90,
    armor: 3,
    accuracy: 0.30,
    precision: 0.30,
    shields: [],
  },
  warlord_malakar: {
    name: 'Warlord Malakar',
    difficulty: 'Boss',
    max_hp: 180,
    armor: 4,
    accuracy: 0.45,
    precision: 0.50,
    shields: [
      { type: 'span', target_value: 'TOP_HALF' },
    ],
  },

  // ── Chapter 2: Frozen Throne (Medium) ───────────────────────────────
  // Moderate HP and armor. Most enemies carry one shield that requires a
  // double or triple to break. Accuracy/precision are tuned for okay
  // players who have added some points to health and armor.
  ice_wolf: {
    name: 'Ice Wolf',
    difficulty: 'Easy',
    max_hp: 70,
    armor: 2,
    accuracy: 0.40,
    precision: 0.40,
    shields: [],
  },
  frost_archer: {
    name: 'Frost Archer',
    difficulty: 'Hard',
    max_hp: 110,
    armor: 4,
    accuracy: 0.55,
    precision: 0.58,
    shields: [
      { type: 'span', target_value: 'BOTTOM_HALF' },
    ],
  },
  frost_knight: {
    name: 'Frost Knight',
    difficulty: 'Hard',
    max_hp: 160,
    armor: 8,
    accuracy: 0.50,
    precision: 0.48,
    shields: [
      { type: 'span', target_value: 'TOP_HALF' },
      { type: 'exact', target_value: 'T20' },
    ],
  },
  ice_queen: {
    name: 'The Ice Queen',
    difficulty: 'Boss',
    max_hp: 320,
    armor: 12,
    accuracy: 0.70,
    precision: 0.75,
    shields: [
      { type: 'span', target_value: 'TOP_HALF' },
      { type: 'exact', target_value: 'D20' },
      { type: 'exact', target_value: 'Bull' },
    ],
  },

  // ── Chapter 3: Verdant Maw (Hard) ───────────────────────────────────
  // High HP, heavy armor, high accuracy/precision. Every enemy has layered
  // shields requiring triples, doubles, and bulls to break. Built for
  // high-level parties with power-ups equipped.
  vine_lasher: {
    name: 'Vine Lasher',
    difficulty: 'Hard',
    max_hp: 120,
    armor: 4,
    accuracy: 0.60,
    precision: 0.60,
    shields: [
      { type: 'span', target_value: 'TOP_HALF' },
    ],
  },
  spore_bloom: {
    name: 'Spore Bloom',
    difficulty: 'Hard',
    max_hp: 180,
    armor: 6,
    accuracy: 0.68,
    precision: 0.65,
    shields: [
      { type: 'span', target_value: 'TOP_HALF' },
      { type: 'exact', target_value: 'D18' },
    ],
  },
  thorn_spearman: {
    name: 'Thorn Spearman',
    difficulty: 'Hard',
    max_hp: 240,
    armor: 12,
    accuracy: 0.72,
    precision: 0.70,
    shields: [
      { type: 'span', target_value: 'BOTTOM_HALF' },
      { type: 'exact', target_value: 'T19' },
    ],
  },
  bloom_warden: {
    name: 'Bloom Warden',
    difficulty: 'Hard',
    max_hp: 300,
    armor: 16,
    accuracy: 0.78,
    precision: 0.75,
    shields: [
      { type: 'span', target_value: 'TOP_HALF' },
      { type: 'exact', target_value: 'T20' },
      { type: 'exact', target_value: 'D19' },
    ],
  },
  the_verdant_maw: {
    name: 'The Verdant Maw',
    difficulty: 'Boss',
    max_hp: 600,
    armor: 22,
    accuracy: 0.85,
    precision: 0.88,
    shields: [
      { type: 'span', target_value: 'TOP_HALF' },
      { type: 'exact', target_value: 'D20' },
      { type: 'exact', target_value: 'Bull' },
      { type: 'exact', target_value: 'T20' },
    ],
  },
};
