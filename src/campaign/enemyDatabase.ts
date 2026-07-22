import type { EnemyDatabase } from './types';

// Static enemy definitions. Editable via the in-app Campaign Editor, which
// can export this exact shape as JSON for paste-back into this file.
//
// Rebalance pass (3 chapters):
//   Chapter 1 — Easy. Low HP, no armor, low accuracy/precision, shields only on boss.
//   Chapter 2 — Medium. Moderate HP/armor, shields on most enemies, tuned for okay players.
//   Chapter 3 — Hard. Heavy armor, high accuracy/precision, layered shields on every enemy.
export const ENEMY_DATABASE: EnemyDatabase = {
  // ── Chapter 1: Crimson Vale (Easy) ──────────────────────────────────
  goblin_scout: { name: 'Goblin Scout', difficulty: 'Easy', max_hp: 30, armor: 0, accuracy: 0.20, precision: 0.25, shields: [] },
  goblin_brute: { name: 'Goblin Brute', difficulty: 'Easy', max_hp: 50, armor: 0, accuracy: 0.25, precision: 0.20, shields: [] },
  orc_raider: { name: 'Orc Raider', difficulty: 'Easy', max_hp: 80, armor: 2, accuracy: 0.30, precision: 0.35, shields: [] },
  dark_mage: { name: 'Dark Mage', difficulty: 'Easy', max_hp: 70, armor: 0, accuracy: 0.35, precision: 0.40, shields: [] },
  royal_guard: { name: 'Royal Guard', difficulty: 'Easy', max_hp: 90, armor: 3, accuracy: 0.30, precision: 0.30, shields: [] },
  warlord_malakar: { name: 'Warlord Malakar', difficulty: 'Boss', max_hp: 180, armor: 4, accuracy: 0.45, precision: 0.50, shields: [{ type: 'span', target_value: 'TOP_HALF' }] },

  // ── Chapter 2: Frozen Throne (Medium) ───────────────────────────────
  ice_wolf: { name: 'Ice Wolf', difficulty: 'Easy', max_hp: 70, armor: 2, accuracy: 0.40, precision: 0.40, shields: [] },
  frost_archer: { name: 'Frost Archer', difficulty: 'Hard', max_hp: 100, armor: 3, accuracy: 0.50, precision: 0.52, shields: [{ type: 'span', target_value: 'BOTTOM_HALF' }] },
  frost_knight: { name: 'Frost Knight', difficulty: 'Hard', max_hp: 140, armor: 6, accuracy: 0.45, precision: 0.43, shields: [{ type: 'span', target_value: 'TOP_HALF' }, { type: 'exact', target_value: 'T20' }] },
  ice_queen: { name: 'The Ice Queen', difficulty: 'Boss', max_hp: 280, armor: 10, accuracy: 0.65, precision: 0.68, shields: [{ type: 'span', target_value: 'TOP_HALF' }, { type: 'exact', target_value: 'D20' }, { type: 'exact', target_value: 'Bull' }] },

  // ── Chapter 3: Verdant Maw (Hard) ───────────────────────────────────
  vine_lasher: { name: 'Vine Lasher', difficulty: 'Hard', max_hp: 120, armor: 4, accuracy: 0.60, precision: 0.60, shields: [{ type: 'span', target_value: 'TOP_HALF' }] },
  spore_bloom: { name: 'Spore Bloom', difficulty: 'Hard', max_hp: 180, armor: 6, accuracy: 0.68, precision: 0.65, shields: [{ type: 'span', target_value: 'TOP_HALF' }, { type: 'exact', target_value: 'D18' }] },
  thorn_spearman: { name: 'Thorn Spearman', difficulty: 'Hard', max_hp: 220, armor: 10, accuracy: 0.68, precision: 0.65, shields: [{ type: 'span', target_value: 'BOTTOM_HALF' }, { type: 'exact', target_value: 'T19' }] },
  bloom_warden: { name: 'Bloom Warden', difficulty: 'Hard', max_hp: 280, armor: 14, accuracy: 0.75, precision: 0.72, shields: [{ type: 'span', target_value: 'TOP_HALF' }, { type: 'exact', target_value: 'T20' }, { type: 'exact', target_value: 'D19' }] },
  the_verdant_maw: { name: 'The Verdant Maw', difficulty: 'Boss', max_hp: 500, armor: 20, accuracy: 0.82, precision: 0.82, shields: [{ type: 'span', target_value: 'TOP_HALF' }, { type: 'exact', target_value: 'D20' }, { type: 'exact', target_value: 'Bull' }, { type: 'exact', target_value: 'T20' }] },
};
