import type { DartliteRun } from './engineTypes';
import type { TrinketId } from './trinkets';
import { getTrinket as getTrinketDef } from './trinkets';

export function hasTrinket(run: DartliteRun, id: TrinketId): boolean {
  return run.runPlayers.some(p => p.trinkets.includes(id));
}

export function partyPowerBonus(run: DartliteRun): number {
  let bonus = 0;
  for (const p of run.runPlayers) {
    if (p.trinkets.includes('trk_sharp_tip')) bonus += 5;
    if (p.trinkets.includes('trk_berserker') && p.hp < p.maxHp * 0.3) bonus += 15;
  }
  return bonus;
}

export function partyArmorBonus(run: DartliteRun): number {
  let bonus = 0;
  for (const p of run.runPlayers) {
    if (p.trinkets.includes('trk_thick_hide')) bonus += 8;
  }
  return bonus;
}

export function partyMaxHpBonus(run: DartliteRun): number {
  let bonus = 0;
  for (const p of run.runPlayers) {
    if (p.trinkets.includes('trk_vitality')) bonus += 60;
    if (p.trinkets.includes('trk_giants_belt')) bonus += Math.round(p.maxHp * 0.5);
  }
  return bonus;
}

export function enemyAccuracyMultiplier(run: DartliteRun): number {
  let mult = 1;
  for (const p of run.runPlayers) {
    if (p.trinkets.includes('trk_quick_reflex')) mult -= 0.1;
  }
  return Math.max(0, mult);
}

export function chargeGainMultiplier(run: DartliteRun): number {
  let mult = 1;
  for (const p of run.runPlayers) {
    if (p.trinkets.includes('trk_lucky_penny')) mult += 0.3;
  }
  return mult;
}

export function xpMultiplier(run: DartliteRun): number {
  let mult = 1;
  for (const p of run.runPlayers) {
    if (p.trinkets.includes('trk_soul_harvest')) mult += 0.5;
  }
  return mult;
}

export function shouldPhoenixRevive(run: DartliteRun): boolean {
  return hasTrinket(run, 'trk_phoenix_heart') && !run.stats.trinketsCollected.includes('trk_phoenix_heart_used' as TrinketId);
}

export function applyPhoenixRevive(run: DartliteRun): DartliteRun {
  const totalMax = run.runPlayers.reduce((a, p) => a + p.maxHp, 0);
  const reviveHp = Math.round(totalMax * 0.25);
  return {
    ...run,
    runPlayers: run.runPlayers.map(p => ({ ...p, hp: Math.max(p.hp, Math.round(reviveHp / run.runPlayers.length)) })),
    stats: { ...run.stats, trinketsCollected: [...run.stats.trinketsCollected, 'trk_phoenix_heart_used' as TrinketId] },
  };
}

export function applyBossTrinketChoice(run: DartliteRun, trinketId: TrinketId): DartliteRun {
  if (!run.bossVictory) return run;
  const def = getTrinketDef(trinketId);
  if (!def) return run;
  let runPlayers = run.runPlayers.map(rp => ({ ...rp, trinkets: [...rp.trinkets, trinketId] }));
  if (trinketId === 'trk_boss_warlords_crown') {
    runPlayers = runPlayers.map(rp => ({ ...rp, power: rp.power + 25, bonusPower: rp.bonusPower + 25 }));
  } else if (trinketId === 'trk_boss_ice_crystal') {
    runPlayers = runPlayers.map(rp => ({ ...rp, armor: rp.armor + 15, bonusArmor: rp.bonusArmor + 15 }));
  } else if (trinketId === 'trk_boss_verdant_seed') {
    runPlayers = runPlayers.map(rp => ({ ...rp, maxHp: rp.maxHp + 200, hp: rp.hp + 200, bonusHealth: rp.bonusHealth + 200 }));
  } else if (trinketId === 'trk_boss_dragon_heart') {
    runPlayers = runPlayers.map(rp => ({ ...rp, power: rp.power + 40, bonusPower: rp.bonusPower + 40 }));
  } else if (trinketId === 'trk_boss_frost_throne') {
    runPlayers = runPlayers.map(rp => ({ ...rp, armor: rp.armor + 25, bonusArmor: rp.bonusArmor + 25 }));
  } else if (trinketId === 'trk_boss_maw_jaw') {
    runPlayers = runPlayers.map(rp => ({ ...rp, maxHp: rp.maxHp + 400, hp: rp.hp + 400, bonusHealth: rp.bonusHealth + 400 }));
  } else if (trinketId === 'trk_boss_void_cloak') {
    runPlayers = runPlayers.map(rp => ({ ...rp, power: rp.power + 60, bonusPower: rp.bonusPower + 60 }));
  } else if (trinketId === 'trk_boss_eternal_flame') {
    runPlayers = runPlayers.map(rp => ({ ...rp, armor: rp.armor + 35, bonusArmor: rp.bonusArmor + 35 }));
  } else if (trinketId === 'trk_boss_titan_heart') {
    runPlayers = runPlayers.map(rp => ({ ...rp, maxHp: rp.maxHp + 600, hp: rp.hp + 600, bonusHealth: rp.bonusHealth + 600 }));
  } else if (trinketId === 'trk_boss_godhand') {
    runPlayers = runPlayers.map(rp => ({ ...rp, power: rp.power + 100, bonusPower: rp.bonusPower + 100 }));
  }
  const trinkets = [...run.trinkets, trinketId];
  const stats = { ...run.stats, trinketsCollected: [...run.stats.trinketsCollected, trinketId] };
  const playerStats = run.playerStats.map(ps => ({ ...ps, trinkets: [...ps.trinkets, trinketId] }));
  const log = [...run.log, `Boss trinket chosen: ${def.name}`];
  return {
    ...run,
    runPlayers,
    trinkets,
    stats,
    playerStats,
    bossVictory: { ...run.bossVictory, chosenTrinket: trinketId, claimedTrinket: trinketId },
    phase: 'reward',
    log,
  };
}
