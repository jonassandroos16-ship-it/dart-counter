import type { Settings } from '../types';

export function computeBattleDartDamage(dartValue: number, attackerPower: number, targetArmor: number, settings: Settings): number {
  const cfg = settings.powerUpScaling;
  const powerMax = Number.isFinite(cfg.powerMax) ? cfg.powerMax : Number.MAX_SAFE_INTEGER;
  const armorMax = Number.isFinite(cfg.armorMax) ? cfg.armorMax : Number.MAX_SAFE_INTEGER;
  const minDamage = Number.isFinite(cfg.battleMinDamage) && cfg.battleMinDamage > 0 ? cfg.battleMinDamage : 1;
  const power = Math.min(powerMax, Math.max(0, attackerPower));
  const armor = Math.min(armorMax, Math.max(0, targetArmor));
  if (dartValue <= 0) return 0;
  const raw = Math.max(0, dartValue + power) - armor;
  return Math.max(minDamage, raw);
}

export function computeBattleVisitDamage(dartValues: number[], attackerPower: number, targetArmor: number, settings: Settings): number {
  return dartValues.reduce((sum, v) => sum + computeBattleDartDamage(v, attackerPower, targetArmor, settings), 0);
}

export function computeBattleDamage(visitScore: number, attackerPower: number, targetArmor: number, settings: Settings): number {
  return computeBattleDartDamage(visitScore, attackerPower, targetArmor, settings);
}
