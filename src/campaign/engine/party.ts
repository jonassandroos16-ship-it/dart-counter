import type { CoopPlayer } from '../types';
import type { Player, Settings } from '../../types';
import { computePartyPassiveBonus, type PartyPassiveBonus } from './classes';

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
  const cfg = settings.powerUpScaling;
  if (!players.length) return 1;
  const healthMax = Number.isFinite(cfg.healthMax) ? cfg.healthMax : Number.MAX_SAFE_INTEGER;
  const startHealth = Number.isFinite(cfg.attributeStartHealth) ? cfg.attributeStartHealth : 0;
  const sum = players.reduce((acc, p) => {
    const h = p.attributes?.health;
    return acc + (typeof h === 'number' && Number.isFinite(h) ? Math.max(1, h) : startHealth);
  }, 0);
  const avg = sum / players.length;
  return Math.max(1, Math.min(healthMax, Math.round(avg)));
}

export function partyArmorFor(players: Player[], settings: Settings): number {
  const cfg = settings.powerUpScaling;
  if (!players.length) return 0;
  const armorMax = Number.isFinite(cfg.armorMax) ? cfg.armorMax : Number.MAX_SAFE_INTEGER;
  const startArmor = Number.isFinite(cfg.attributeStartArmor) ? cfg.attributeStartArmor : 0;
  const sum = players.reduce((acc, p) => {
    const a = p.attributes?.armor;
    return acc + (typeof a === 'number' && Number.isFinite(a) ? a : startArmor);
  }, 0);
  // Divide by player count so the combined armor never exceeds the cap.
  const avg = sum / players.length;
  return Math.max(0, Math.min(armorMax, avg));
}

export function partyPowerFor(players: Player[], settings: Settings): number {
  const cfg = settings.powerUpScaling;
  if (!players.length) return 0;
  const powerMax = Number.isFinite(cfg.powerMax) ? cfg.powerMax : Number.MAX_SAFE_INTEGER;
  const startPower = Number.isFinite(cfg.attributeStartPower) ? cfg.attributeStartPower : 0;
  const sum = players.reduce((acc, p) => {
    const pw = p.attributes?.power;
    return acc + (typeof pw === 'number' && Number.isFinite(pw) ? pw : startPower);
  }, 0);
  const avg = sum / players.length;
  return Math.max(0, Math.min(powerMax, avg));
}

// Per-player snapshot used during a battle.
export function toCoopPlayer(p: Player, settings: Settings, startCharge: number): CoopPlayer {
  const cfg = settings.powerUpScaling;
  const healthMax = Number.isFinite(cfg.healthMax) ? cfg.healthMax : Number.MAX_SAFE_INTEGER;
  const armorMax = Number.isFinite(cfg.armorMax) ? cfg.armorMax : Number.MAX_SAFE_INTEGER;
  const powerMax = Number.isFinite(cfg.powerMax) ? cfg.powerMax : Number.MAX_SAFE_INTEGER;
  const startHealth = Number.isFinite(cfg.attributeStartHealth) ? cfg.attributeStartHealth : 0;
  const startArmor = Number.isFinite(cfg.attributeStartArmor) ? cfg.attributeStartArmor : 0;
  const startPower = Number.isFinite(cfg.attributeStartPower) ? cfg.attributeStartPower : 0;
  const h = Number.isFinite(p.attributes?.health) ? p.attributes!.health : startHealth;
  const a = Number.isFinite(p.attributes?.armor) ? p.attributes!.armor : startArmor;
  const pw = Number.isFinite(p.attributes?.power) ? p.attributes!.power : startPower;
  return {
    id: p.id,
    name: p.name,
    color: p.color,
    hp: Math.max(1, Math.min(healthMax, h)),
    maxHp: Math.max(1, Math.min(healthMax, h)),
    power: Math.max(0, Math.min(powerMax, pw)),
    armor: Math.max(0, Math.min(armorMax, a)),
    buffs: [],
    powerUpCharge: Math.max(0, startCharge),
    classId: p.coopProgress?.classId ?? null,
    kills: 0,
    damageDealt: 0,
  };
}

export { computePartyPassiveBonus };
export type { PartyPassiveBonus };
