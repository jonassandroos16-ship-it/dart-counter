import type { DartliteRun, DartliteRunPlayer } from './engineTypes';
import type { TrinketId } from './trinkets';
import { getTrinket as getTrinketDef } from './trinkets';
import { rewardScale } from './roundLogic';

export function hasTrinket(run: DartliteRun, id: TrinketId): boolean {
  return run.runPlayers.some(p => p.trinkets.includes(id));
}

export function partyPowerBonus(run: DartliteRun): number {
  let bonus = 0;
  for (const p of run.runPlayers) {
    for (const tid of p.trinkets) {
      if (tid === 'trk_power_core') bonus += 15;
      else if (tid === 'trk_ancient_blade') bonus += Math.round(p.power * 0.25);
    }
  }
  return bonus;
}

export function partyArmorBonus(run: DartliteRun): number {
  let bonus = 0;
  for (const p of run.runPlayers) {
    for (const tid of p.trinkets) {
      if (tid === 'trk_iron_plate') bonus += 10;
      else if (tid === 'trk_dwarven_shield') bonus += Math.round(p.armor * 0.5);
    }
  }
  return bonus;
}

export function partyMaxHpBonus(run: DartliteRun): number {
  let bonus = 0;
  for (const p of run.runPlayers) {
    for (const tid of p.trinkets) {
      if (tid === 'trk_vitality') bonus += Math.round(60 * rewardScale(run.round));
      else if (tid === 'trk_giants_belt') bonus += Math.round(p.maxHp * 0.5);
    }
  }
  return bonus;
}

// Effective max HP for a single run player, including trinket HP bonuses
// (trk_vitality, trk_giants_belt) and the party's flat passive HP bonus.
// Boss-trinket and stat-reward HP are already baked into rp.maxHp by
// applyBossTrinketChoice / applyPlayerChoice, so they're included automatically.
// Mirrors the per-player maxHp computation in beginRound so the heal reward
// shows the same numbers the player actually sees in battle.
export function effectiveRunPlayerMaxHp(rp: DartliteRunPlayer, run: DartliteRun): number {
  const scale = rewardScale(run.round);
  let maxHp = rp.maxHp;
  for (const tid of rp.trinkets) {
    if (tid === 'trk_vitality') maxHp += Math.round(60 * scale);
    else if (tid === 'trk_giants_belt') maxHp += Math.round(rp.maxHp * 0.5);
  }
  maxHp += run.partyPassiveHealth || 0;
  return maxHp;
}

export function enemyAccuracyMultiplier(run: DartliteRun): number {
  let mult = 1;
  for (const p of run.runPlayers) {
    for (const tid of p.trinkets) {
      if (tid === 'trk_eagle_eye') mult *= 1.1;
      else if (tid === 'trk_ancient_blade') mult *= 1.05;
    }
  }
  return mult;
}

export function chargeGainMultiplier(run: DartliteRun): number {
  let mult = 1;
  for (const p of run.runPlayers) {
    for (const tid of p.trinkets) {
      if (tid === 'trk_arcane_pendant') mult += 0.5;
    }
  }
  return mult;
}

export function xpMultiplier(run: DartliteRun): number {
  let mult = 1;
  for (const p of run.runPlayers) {
    for (const tid of p.trinkets) {
      if (tid === 'trk_tome_of_knowledge') mult += 0.25;
    }
  }
  return mult;
}

export function shouldPhoenixRevive(run: DartliteRun): boolean {
  return run.runPlayers.some(p => p.trinkets.includes('trk_phoenix_heart'));
}

export function applyPhoenixRevive(run: DartliteRun): DartliteRun {
  const runPlayers = run.runPlayers.map(p =>
    p.trinkets.includes('trk_phoenix_heart')
      ? { ...p, trinkets: p.trinkets.filter(t => t !== 'trk_phoenix_heart').concat('trk_phoenix_heart_used' as TrinketId), hp: Math.round(p.maxHp * 0.5) }
      : p
  );
  return { ...run, runPlayers };
}

export function applyBossTrinketChoice(run: DartliteRun, trinketId: TrinketId): DartliteRun {
  const runPlayers = run.runPlayers.map(p => {
    if (p.id !== run.bossVictory?.chosenPlayerId) return p;
    const next: DartliteRunPlayer = { ...p, trinkets: [...p.trinkets, trinketId] };
    if (trinketId === 'trk_vitality') {
      next.maxHp += Math.round(60 * rewardScale(run.round));
      next.hp = next.maxHp;
    } else if (trinketId === 'trk_giants_belt') {
      next.maxHp += Math.round(p.maxHp * 0.5);
      next.hp = next.maxHp;
    }
    return next;
  });
  return { ...run, runPlayers };
}

export function playerPowerInfo(rp: DartliteRunPlayer): { power: number; bonus: number } {
  let bonus = 0;
  for (const tid of rp.trinkets) {
    if (tid === 'trk_power_core') bonus += 15;
    else if (tid === 'trk_ancient_blade') bonus += Math.round(rp.power * 0.25);
  }
  return { power: rp.power + bonus, bonus };
}
