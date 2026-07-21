import type { Settings } from '../types';

export function defaultSettings(): Settings {
  return {
    theme: 'dark', accent: '#22c55e', confirmReset: true, sound: true, music: true,
    musicStartTrack: 'start_bullseye_anthem', musicSetupTrack: 'setup_horizon', musicMatchTrack: 'match_drive', musicCoopTrack: 'coop_siege',
    sfxVolume: 0.9, musicVolume: 0.9,
    hitSoundPack: 'thud', clickSound: 'tick', clickVolume: 0.6,
    xpConfig: { win: 50, visit60: 5, visit80: 10, visit100: 15, visit120: 20, visit140: 25, visit180: 50, checkout: 10, perDart: 1, levelMult: 1.5, baseLevelXp: 100 },
    customTitles: [],
    popups: { scores: true, milestones: true, xp: true, titles: true },
    powerUpScaling: {
      chargePerDouble: 8,
      chargePerTriple: 12,
      chargePerBull: 15,
      chargePerScorePoint: 0.05,
      chargeMax: 100,
      pointsPerLevel: 1,
      startingPoints: 1,
      attributePointsPerLevel: 5,
      attributeStartHealth: 300,
      attributeStartArmor: 0,
      attributeStartPower: 0,
      healthPerPoint: 25,
      armorPerPoint: 1,
      powerPerPoint: 1,
      armorMax: 25,
      powerMax: 30,
      healthMax: 500,
      battleMinDamage: 1,
      // Surge is an early-game power-up, so it starts partially charged.
      // Other power-ups start at 0 by default.
      startingCharge: { pu_surge: 40 },
      // Per-power-up activation threshold. Any id not listed defaults to
      // `chargeMax` (100). Balanced by impact: weak/self-buff power-ups cost
      // less, game-changing power-ups cost more.
      chargesNeeded: {
        pu_fourth_dart: 100,   // extra dart — strong
        pu_blocker: 100,       // opponents get 1 dart — strong
        pu_reroll: 80,         // replace lowest dart — medium
        pu_rethrow: 60,        // take back last dart — weak
        pu_surge: 90,          // next visit double — strong
        pu_cripple: 90,        // leader 50% — medium-strong
        pu_steal: 100,         // 30 points — strong
        pu_freeze: 110,        // leader misses — very strong
        pu_lucky_miss: 70,     // cancel bust — weak
        pu_bullseye_frenzy: 80, // bulls score double — medium
        pu_hot_streak: 90,     // compounding bonus — strong self-buff
        pu_swap: 110,          // steal leader's score — very strong
        pu_shield: 90,         // 2-turn protection — strong defensive
      },
    },
  };
}
