import type { CoopPlayer } from '../types';
import type { Player, Settings } from '../../types';
import { computePartyPassiveBonus, type PartyPassiveBonus } from './classes';
import { effectiveAttributes, classStartHealth, classStartArmor, classStartPower, classStartCrit, classHealthMax, classArmorMax, classPowerMax, classCritMax } from '../../logic';

// ── Party attribute aggregation ──────────────────────────────────────
//
// Party HP, armor and power are all averaged (sum / playerCount) so adding
// more players can't push any stat above the configured caps — they share
// the load. Each player still attacks with their own per-dart power (so
// high power players hit harder), but the shared party HP is what absorbs
// incoming enemy damage. Averaging HP (instead of summing) keeps the
// difficulty roughly constant regardless of party size: a 4-player party
// has the same HP pool as a solo player, so more players means more damage
// output but not more survivability.

export function partyMaxHpFor(players: Player[], settings: Settings): number {
  if (!players.length) return 1;
  const sum = players.reduce((acc, p) => {
    const attrs = effectiveAttributes(p, settings);
    const h = attrs.health;
    return acc + (typeof h === 'number' && Number.isFinite(h) ? Math.max(1, h) : 1);
  }, 0);
  const avg = sum / players.length;
  return Math.max(1, Math.round(avg));
}

export function partyArmorFor(players: Player[], settings: Settings): number {
  if (!players.length) return 0;
  const sum = players.reduce((acc, p) => {
    const attrs = effectiveAttributes(p, settings);
    const a = attrs.armor;
    return acc + (typeof a === 'number' && Number.isFinite(a) ? a : 0);
  }, 0);
  const avg = sum / players.length;
  return Math.max(0, avg);
}

export function partyPowerFor(players: Player[], settings: Settings): number {
  if (!players.length) return 0;
  const sum = players.reduce((acc, p) => {
    const attrs = effectiveAttributes(p, settings);
    const pw = attrs.power;
    return acc + (typeof pw === 'number' && Number.isFinite(pw) ? pw : 0);
  }, 0);
  const avg = sum / players.length;
  return Math.max(0, avg);
}

// Per-player snapshot used during a battle.
export function toCoopPlayer(p: Player, settings: Settings, startCharge: number): CoopPlayer {
  const cid = p.coopProgress?.classId;
  const healthMax = classHealthMax(cid, settings);
  const armorMax = classArmorMax(cid, settings);
  const powerMax = classPowerMax(cid, settings);
  const startHealth = classStartHealth(cid, settings);
  const startArmor = classStartArmor(cid, settings);
  const startPower = classStartPower(cid, settings);
  const startCrit = classStartCrit(cid, settings);
  const critMax = classCritMax(cid, settings);
  const attrs = effectiveAttributes(p, settings);
  const h = Number.isFinite(attrs.health) ? attrs.health : startHealth;
  const a = Number.isFinite(attrs.armor) ? attrs.armor : startArmor;
  const pw = Number.isFinite(attrs.power) ? attrs.power : startPower;
  const cr = Number.isFinite(attrs.crit) ? attrs.crit : startCrit;
  return {
    id: p.id,
    name: p.name,
    color: p.color,
    hp: Math.max(1, Math.min(healthMax, h)),
    maxHp: Math.max(1, Math.min(healthMax, h)),
    power: Math.max(0, Math.min(powerMax, pw)),
    armor: Math.max(0, Math.min(armorMax, a)),
    crit: Math.max(0, Math.min(critMax, cr)),
    buffs: [],
    powerUpCharge: Math.max(0, startCharge),
    classId: p.coopProgress?.classId ?? null,
    kills: 0,
    damageDealt: 0,
  };
}

export { computePartyPassiveBonus };
export type { PartyPassiveBonus };
