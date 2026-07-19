import type { Settings } from '../types';

export function defaultSettings(): Settings {
  return {
    theme: 'dark', accent: '#22c55e', confirmReset: true, sound: true, music: true,
    musicStartTrack: 'start_bullseye_anthem', musicSetupTrack: 'setup_horizon', musicMatchTrack: 'match_drive',
    sfxVolume: 0.9, musicVolume: 0.9,
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
    },
  };
}
