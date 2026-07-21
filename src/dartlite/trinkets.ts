// ── Dartlite trinkets ─────────────────────────────────────────────────
//
// Trinkets are random buffs a player can acquire during a Dartlite run.
// They only last for the run — they do not carry over to new games.
// 20 trinkets exist in total. A run starts with 5 available in the pool;
// a new one is added to the pool after each mini-boss (round 5, 15, 25…)
// and boss (round 10, 20, 30…), shown via a popup so the player knows.

export type TrinketId =
  // Tier 1 — starter pool (5)
  | 'trk_sharp_tip'        // +power
  | 'trk_thick_hide'       // +armor
  | 'trk_vitality'         // +max HP
  | 'trk_lucky_penny'      // +charge gain
  | 'trk_quick_reflex'     // -enemy accuracy
  // Tier 2 — unlocked after mini-bosses (5)
  | 'trk_double_tap'       // chance for double damage
  | 'trk_vampiric'         // lifesteal on hit
  | 'trk_bulwark'          // flat damage reduction
  | 'trk_eagle_eye'        // +crit chance
  | 'trk_phantom_step'     // dodge chance
  // Tier 3 — unlocked after bosses (5)
  | 'trk_berserker'        // more power when low HP
  | 'trk_frozen_core'      // chance to freeze on hit
  | 'trk_overcharge'       // start with bonus charge
  | 'trk_executioner'      // bonus damage to low HP enemies
  | 'trk_second_wind'      // heal on enemy defeat
  // Tier 4 — late unlocks (5)
  | 'trk_giants_belt'      // +50% max HP
  | 'trk_soul_harvest'     // +XP per kill
  | 'trk_chain_lightning' // damage splashes to nearby enemy
  | 'trk_adamant'          // immune to first hit each round
  | 'trk_phoenix_heart'    // revive once at 25% HP
  // Boss trinkets — guaranteed reward after defeating a boss (10)
  // First boss (round 10): 3 options
  | 'trk_boss_warlords_crown'     // +25 power for the run
  | 'trk_boss_ice_crystal'        // +15% armor for the run
  | 'trk_boss_verdant_seed'       // +200 max HP for the run
  // Second boss (round 20): 3 options
  | 'trk_boss_dragon_heart'       // +40 power for the run
  | 'trk_boss_frost_throne'       // +25% armor for the run
  | 'trk_boss_maw_jaw'            // +400 max HP for the run
  // Remaining boss trinkets (4)
  | 'trk_boss_void_cloak'         // +60 power for the run
  | 'trk_boss_eternal_flame'      // +35% armor for the run
  | 'trk_boss_titan_heart'        // +600 max HP for the run
  | 'trk_boss_godhand'            // +100 power for the run;

export type TrinketTier = 1 | 2 | 3 | 4;

export interface TrinketDef {
  id: TrinketId;
  name: string;
  icon: string;
  tier: TrinketTier;
  desc: string;
}

// The 5 trinkets available at the start of every run.
export const STARTER_POOL: TrinketId[] = [
  'trk_sharp_tip',
  'trk_thick_hide',
  'trk_vitality',
  'trk_lucky_penny',
  'trk_quick_reflex',
];

// Trinkets added to the pool after mini-bosses (round 5, 15, 25…).
export const MINIBOSS_POOL: TrinketId[] = [
  'trk_double_tap',
  'trk_vampiric',
  'trk_bulwark',
  'trk_eagle_eye',
  'trk_phantom_step',
];

// Trinkets added to the pool after bosses (round 10, 20, 30…).
export const BOSS_POOL: TrinketId[] = [
  'trk_berserker',
  'trk_frozen_core',
  'trk_overcharge',
  'trk_executioner',
  'trk_second_wind',
  'trk_giants_belt',
  'trk_soul_harvest',
  'trk_chain_lightning',
  'trk_adamant',
  'trk_phoenix_heart',
];

export const TRINKETS: Record<TrinketId, TrinketDef> = {
  trk_sharp_tip: { id: 'trk_sharp_tip', name: 'Sharp Tip', icon: '🔪', tier: 1, desc: '+5 power for the run.' },
  trk_thick_hide: { id: 'trk_thick_hide', name: 'Thick Hide', icon: '🛡️', tier: 1, desc: '+8% armor for the run.' },
  trk_vitality: { id: 'trk_vitality', name: 'Vitality', icon: '❤️', tier: 1, desc: '+60 max HP for the run.' },
  trk_lucky_penny: { id: 'trk_lucky_penny', name: 'Lucky Penny', icon: '🪙', tier: 1, desc: '+30% power-up charge gain.' },
  trk_quick_reflex: { id: 'trk_quick_reflex', name: 'Quick Reflex', icon: '💨', tier: 1, desc: 'Enemies have -10% accuracy.' },

  trk_double_tap: { id: 'trk_double_tap', name: 'Double Tap', icon: '✌️', tier: 2, desc: '20% chance to deal double damage on a hit.' },
  trk_vampiric: { id: 'trk_vampiric', name: 'Vampiric', icon: '🩸', tier: 2, desc: 'Heal 3 HP for every dart that hits.' },
  trk_bulwark: { id: 'trk_bulwark', name: 'Bulwark', icon: '🏰', tier: 2, desc: 'Reduce every incoming hit by 5.' },
  trk_eagle_eye: { id: 'trk_eagle_eye', name: 'Eagle Eye', icon: '🦅', tier: 2, desc: '15% chance to crit for +50% damage.' },
  trk_phantom_step: { id: 'trk_phantom_step', name: 'Phantom Step', icon: '👻', tier: 2, desc: '12% chance to dodge an enemy dart.' },

  trk_berserker: { id: 'trk_berserker', name: 'Berserker', icon: '😤', tier: 3, desc: '+15 power while below 30% HP.' },
  trk_frozen_core: { id: 'trk_frozen_core', name: 'Frozen Core', icon: '❄️', tier: 3, desc: '25% chance to freeze an enemy for 1 turn on hit.' },
  trk_overcharge: { id: 'trk_overcharge', name: 'Overcharge', icon: '⚡', tier: 3, desc: 'Start every battle with 40% power-up charge.' },
  trk_executioner: { id: 'trk_executioner', name: 'Executioner', icon: '⚔️', tier: 3, desc: '+50% damage to enemies below 25% HP.' },
  trk_second_wind: { id: 'trk_second_wind', name: 'Second Wind', icon: '🌬️', tier: 3, desc: 'Heal 15 HP when you defeat an enemy.' },

  trk_giants_belt: { id: 'trk_giants_belt', name: "Giant's Belt", icon: '🏋️', tier: 4, desc: '+50% max HP for the run.' },
  trk_soul_harvest: { id: 'trk_soul_harvest', name: 'Soul Harvest', icon: '💀', tier: 4, desc: '+50% XP from kills.' },
  trk_chain_lightning: { id: 'trk_chain_lightning', name: 'Chain Lightning', icon: '🌩️', tier: 4, desc: 'Hits splash 25% damage to another enemy.' },
  trk_adamant: { id: 'trk_adamant', name: 'Adamant', icon: '💠', tier: 4, desc: 'Ignore the first enemy hit each round.' },
  trk_phoenix_heart: { id: 'trk_phoenix_heart', name: 'Phoenix Heart', icon: '🔥', tier: 4, desc: 'Revive once per run at 25% HP.' },

  // Boss trinkets — guaranteed reward after defeating a boss.
  trk_boss_warlords_crown: { id: 'trk_boss_warlords_crown', name: "Warlord's Crown", icon: '👑', tier: 4, desc: '+25 power for the run.' },
  trk_boss_ice_crystal: { id: 'trk_boss_ice_crystal', name: 'Ice Crystal', icon: '💎', tier: 4, desc: '+15% armor for the run.' },
  trk_boss_verdant_seed: { id: 'trk_boss_verdant_seed', name: 'Verdant Seed', icon: '🌱', tier: 4, desc: '+200 max HP for the run.' },
  trk_boss_dragon_heart: { id: 'trk_boss_dragon_heart', name: 'Dragon Heart', icon: '🐉', tier: 4, desc: '+40 power for the run.' },
  trk_boss_frost_throne: { id: 'trk_boss_frost_throne', name: 'Frost Throne', icon: '🪑', tier: 4, desc: '+25% armor for the run.' },
  trk_boss_maw_jaw: { id: 'trk_boss_maw_jaw', name: 'Maw Jaw', icon: '🦷', tier: 4, desc: '+400 max HP for the run.' },
  trk_boss_void_cloak: { id: 'trk_boss_void_cloak', name: 'Void Cloak', icon: '🌀', tier: 4, desc: '+60 power for the run.' },
  trk_boss_eternal_flame: { id: 'trk_boss_eternal_flame', name: 'Eternal Flame', icon: '🌋', tier: 4, desc: '+35% armor for the run.' },
  trk_boss_titan_heart: { id: 'trk_boss_titan_heart', name: 'Titan Heart', icon: '🗿', tier: 4, desc: '+600 max HP for the run.' },
  trk_boss_godhand: { id: 'trk_boss_godhand', name: 'Godhand', icon: '✋', tier: 4, desc: '+100 power for the run.' },
};

export function getTrinket(id: TrinketId): TrinketDef {
  return TRINKETS[id];
}

export const ALL_TRINKET_IDS = Object.keys(TRINKETS) as TrinketId[];

// Boss trinkets — guaranteed reward after defeating a boss. 3 options for
// the first boss (round 10), 3 for the second boss (round 20), and 4 for the
// remaining bosses. The player picks one after each boss victory.
export const BOSS_TRINKET_POOL_1: TrinketId[] = [
  'trk_boss_warlords_crown',
  'trk_boss_ice_crystal',
  'trk_boss_verdant_seed',
];
export const BOSS_TRINKET_POOL_2: TrinketId[] = [
  'trk_boss_dragon_heart',
  'trk_boss_frost_throne',
  'trk_boss_maw_jaw',
];
export const BOSS_TRINKET_POOL_REST: TrinketId[] = [
  'trk_boss_void_cloak',
  'trk_boss_eternal_flame',
  'trk_boss_titan_heart',
  'trk_boss_godhand',
];

// Returns the set of boss trinkets offered as a reward for the Nth boss
// defeated (1-based). 3 for the first boss, 3 for the second, 4 for the rest.
export function bossTrinketOptions(bossNumber: number): TrinketId[] {
  if (bossNumber === 1) return [...BOSS_TRINKET_POOL_1];
  if (bossNumber === 2) return [...BOSS_TRINKET_POOL_2];
  return [...BOSS_TRINKET_POOL_REST];
}

// The order in which trinkets unlock into the pool. Index 0-4 are the starter
// pool; each mini-boss adds the next tier-2 trinket; each boss adds the next
// tier-3/4 trinket. This sequence drives the "new trinket available" popup.
export const UNLOCK_ORDER: TrinketId[] = [
  // starters (already in pool)
  ...STARTER_POOL,
  // mini-boss unlocks (one per mini-boss, in order)
  ...MINIBOSS_POOL,
  // boss unlocks (one per boss, in order)
  ...BOSS_POOL,
];

// Given how many mini-bosses and bosses have been defeated, return the full
// list of trinket ids currently in the available pool.
export function availablePool(miniBossesDefeated: number, bossesDefeated: number): TrinketId[] {
  const pool = [...STARTER_POOL];
  for (let i = 0; i < miniBossesDefeated && i < MINIBOSS_POOL.length; i++) pool.push(MINIBOSS_POOL[i]);
  for (let i = 0; i < bossesDefeated && i < BOSS_POOL.length; i++) pool.push(BOSS_POOL[i]);
  return pool;
}

// Returns the trinket id that was newly added to the pool by the most recent
// mini-boss or boss defeat, or null if the pool is exhausted.
export function newlyUnlockedTrinket(miniBossesDefeated: number, bossesDefeated: number): TrinketId | null {
  // Mini-boss unlocks come first (tier 2), then boss unlocks (tier 3 & 4).
  if (miniBossesDefeated > 0 && miniBossesDefeated <= MINIBOSS_POOL.length) {
    return MINIBOSS_POOL[miniBossesDefeated - 1];
  }
  if (bossesDefeated > 0 && bossesDefeated <= BOSS_POOL.length) {
    return BOSS_POOL[bossesDefeated - 1];
  }
  return null;
}
