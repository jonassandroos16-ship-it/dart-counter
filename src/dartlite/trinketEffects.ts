import type { DartliteRun } from './engineTypes';
import type { TrinketId } from './trinkets';
import { getTrinket as getTrinketDef } from './trinkets';
import { rewardScale } from './roundLogic';

export function hasTrinket(run: DartliteRun, id: TrinketId): boolean {
  return run.runPlayers.some(p => p.trinkets.includes(id));
}

export function partyPowerBonus(run: DartliteRun): number {
  return run.runPlayers.reduce((sum, p) => sum + playerPowerInfo(run, p.id).extra, 0);
}

export function playerPowerInfo(run: DartliteRun, playerId: string): { total: number; extra: number } {
  const rp = run.runPlayers.find(p => p.id === playerId);
  if (!rp) return { total: 0, extra: 0 };
  const scale = rewardScale(run.round);
  let extra = 0;
  for (const tid of rp.trinkets) {
    if (tid === 'trk_sharp_tip') extra += Math.round(5 * scale);
    else if (tid === 'trk_berserker' && run.teamHp < run.teamMaxHp * 0.3) extra += Math.round(15 * scale);
  }
  return { total: rp.power + extra, extra };
}

export function partyArmorBonus(run: DartliteRun): number {
  const scale = rewardScale(run.round);
  let bonus = 0;
  for (const p of run.runPlayers) {
    if (p.trinkets.includes('trk_thick_hide')) bonus += Math.round(8 * scale);
  }
  return bonus;
}

export function partyMaxHpBonus(run: DartliteRun): number {
  const scale = rewardScale(run.round);
  let bonus = 0;
  for (const p of run.runPlayers) {
    if (p.trinkets.includes('trk_vitality')) bonus += Math.round(60 * scale);
    if (p.trinkets.includes('trk_giants_belt')) bonus += Math.round(p.baseHp * 0.5);
  }
  return bonus;
}

export function effectiveTeamMaxHp(run: DartliteRun): number {
  return run.teamMaxHp;
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
  const reviveHp = Math.round(run.teamMaxHp * 0.25);
  return {
    ...run,
    teamHp: reviveHp,
    stats: { ...run.stats, trinketsCollected: [...run.stats.trinketsCollected, 'trk_phoenix_heart_used' as TrinketId] },
  };
}

export function applyBossTrinketChoice(run: DartliteRun, trinketId: TrinketId): DartliteRun {
  if (!run.bossVictory) return run;
  const def = getTrinketDef(trinketId);
  if (!def) return run;
  const scale = rewardScale(run.round);
  const s = (n: number) => Math.round(n * scale);
  let runPlayers = run.runPlayers.map(rp => ({ ...rp, trinkets: [...rp.trinkets, trinketId] }));
  let teamMaxHpBonus = 0;
  if (trinketId === 'trk_boss_warlords_crown') {
    runPlayers = runPlayers.map(rp => ({ ...rp, power: rp.power + s(25), bonusPower: rp.bonusPower + s(25) }));
  } else if (trinketId === 'trk_boss_ice_crystal') {
    runPlayers = runPlayers.map(rp => ({ ...rp, armor: rp.armor + s(15), bonusArmor: rp.bonusArmor + s(15) }));
  } else if (trinketId === 'trk_boss_verdant_seed') {
    runPlayers = runPlayers.map(rp => ({ ...rp, bonusHealth: rp.bonusHealth + s(200) }));
    teamMaxHpBonus += s(200);
  } else if (trinketId === 'trk_boss_dragon_heart') {
    runPlayers = runPlayers.map(rp => ({ ...rp, power: rp.power + s(40), bonusPower: rp.bonusPower + s(40) }));
  } else if (trinketId === 'trk_boss_frost_throne') {
    runPlayers = runPlayers.map(rp => ({ ...rp, armor: rp.armor + s(25), bonusArmor: rp.bonusArmor + s(25) }));
  } else if (trinketId === 'trk_boss_maw_jaw') {
    runPlayers = runPlayers.map(rp => ({ ...rp, bonusHealth: rp.bonusHealth + s(400) }));
    teamMaxHpBonus += s(400);
  } else if (trinketId === 'trk_boss_void_cloak') {
    runPlayers = runPlayers.map(rp => ({ ...rp, power: rp.power + s(60), bonusPower: rp.bonusPower + s(60) }));
  } else if (trinketId === 'trk_boss_eternal_flame') {
    runPlayers = runPlayers.map(rp => ({ ...rp, armor: rp.armor + s(35), bonusArmor: rp.bonusArmor + s(35) }));
  } else if (trinketId === 'trk_boss_titan_heart') {
    runPlayers = runPlayers.map(rp => ({ ...rp, bonusHealth: rp.bonusHealth + s(600) }));
    teamMaxHpBonus += s(600);
  } else if (trinketId === 'trk_boss_godhand') {
    runPlayers = runPlayers.map(rp => ({ ...rp, power: rp.power + s(100), bonusPower: rp.bonusPower + s(100) }));
  }
  const trinkets = [...run.trinkets, trinketId];
  const stats = { ...run.stats, trinketsCollected: [...run.stats.trinketsCollected, trinketId] };
  const playerStats = run.playerStats.map(ps => ({ ...ps, trinkets: [...ps.trinkets, trinketId] }));
  const log = [...run.log, `Boss trinket chosen: ${def.name}`];
  const newTeamMaxHp = run.teamMaxHp + teamMaxHpBonus;
  return {
    ...run,
    runPlayers,
    trinkets,
    stats,
    playerStats,
    bossVictory: { ...run.bossVictory, chosenTrinket: trinketId, claimedTrinket: trinketId },
    phase: 'reward',
    log,
    teamMaxHp: newTeamMaxHp,
    teamHp: Math.min(newTeamMaxHp, run.teamHp + teamMaxHpBonus),
  };
}
