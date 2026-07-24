import type { Player, Settings, ClassAttributes, PlayerAttributes } from '../types';
import { POWER_UPS } from '../powerups';
import { COOP_CLASSES, classLevelFromXp } from '../campaign/engine/classes';
import type { CoopClassId } from '../campaign/types';
import { defaultSettings } from '../constants';
import { levelFromXP } from './xp';

export function numOr<T>(v: unknown, fallback: T): T | number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

export function defaultAttributes(settings: Settings) {
  const cfg = settings.powerUpScaling;
  return {
    health: numOr(cfg.attributeStartHealth, 0),
    armor: numOr(cfg.attributeStartArmor, 0),
    power: numOr(cfg.attributeStartPower, 0),
    crit: numOr(cfg.attributeStartCrit, 0),
    pointsAvailable: 0,
  };
}

export function defaultPowerUps(settings: Settings) {
  const firstPowerUpId = POWER_UPS[0]?.id || null;
  return {
    unlocked: firstPowerUpId ? [firstPowerUpId] : ([] as string[]),
    active: firstPowerUpId,
    pointsAvailable: settings.powerUpScaling.startingPoints,
    coopUnlocked: [] as string[],
    coopActive: null as string | null,
  };
}

export function totalAttributePointsForLevel(level: number, settings: Settings): number {
  return Math.max(0, (level - 1)) * settings.powerUpScaling.attributePointsPerLevel;
}

export function totalPowerUpPointsForLevel(level: number, settings: Settings): number {
  return settings.powerUpScaling.startingPoints + Math.max(0, (level - 1)) * settings.powerUpScaling.pointsPerLevel;
}

function safeSpent(current: number, start: number, perPoint: number): number {
  if (!Number.isFinite(current) || !Number.isFinite(start)) return 0;
  if (!Number.isFinite(perPoint) || perPoint <= 0) return 0;
  const diff = current - start;
  if (diff <= 0) return 0;
  return Math.round(diff / perPoint);
}

export function reconcilePlayerPoints(player: Player, settings: Settings): Player {
  let p = ensureClassAttributes(player, settings);
  const classId = p.coopProgress?.classId || 'warrior';
  const classXp = p.coopProgress?.classXp?.[classId] ?? 0;
  const level = levelFromXP(classXp || p.xp || 0, settings).level;
  const cfg = settings.powerUpScaling;
  const pwr = p.powerUps || defaultPowerUps(settings);
  const devBonus = p.developerMode ? 100 : 0;

  const classAttrs = { ...(p.classAttributes || {}) };
  let classChanged = false;
  for (const cls of COOP_CLASSES) {
    const ca = classAttrs[cls.id] || defaultClassAttributes(cls.id, settings);
    const cStartH = classStartHealth(cls.id, settings);
    const cStartA = classStartArmor(cls.id, settings);
    const cStartP = classStartPower(cls.id, settings);
    const cStartC = classStartCrit(cls.id, settings);
    const cHMax = classHealthMax(cls.id, settings);
    const cAMax = classArmorMax(cls.id, settings);
    const cPwMax = classPowerMax(cls.id, settings);
    const cCMax = classCritMax(cls.id, settings);
    const clsLevel = cls.id === classId ? level : levelFromXP(p.coopProgress?.classXp?.[cls.id] ?? 0, settings).level;
    const clsTotal = totalAttributePointsForLevel(clsLevel, settings) + devBonus;
    const normH = Number.isFinite(ca.health) ? ca.health : cStartH;
    const normA = Number.isFinite(ca.armor) ? ca.armor : cStartA;
    const normP = Number.isFinite(ca.power) ? ca.power : cStartP;
    const normC = Number.isFinite(ca.crit) ? ca.crit : cStartC;
    let hSpent = safeSpent(normH, cStartH, cfg.healthPerPoint);
    let aSpent = safeSpent(normA, cStartA, cfg.armorPerPoint);
    let pSpent = safeSpent(normP, cStartP, cfg.powerPerPoint);
    let cSpent = safeSpent(normC, cStartC, cfg.critPerPoint);
    let spent = hSpent + aSpent + pSpent + cSpent;
    let nH = normH, nA = normA, nP = normP, nC = normC;
    if (spent > clsTotal) {
      const overflow = spent - clsTotal;
      const cutC = Math.min(cSpent, overflow);
      if (cutC > 0) { cSpent -= cutC; nC = cStartC + cSpent * cfg.critPerPoint; }
      const remC = overflow - cutC;
      const cutP = Math.min(pSpent, remC);
      if (cutP > 0) { pSpent -= cutP; nP = cStartP + pSpent * cfg.powerPerPoint; }
      const remP = remC - cutP;
      const cutA = Math.min(aSpent, remP);
      if (cutA > 0) { aSpent -= cutA; nA = cStartA + aSpent * cfg.armorPerPoint; }
      const remA = remP - cutA;
      const cutH = Math.min(hSpent, remA);
      if (cutH > 0) { hSpent -= cutH; nH = cStartH + hSpent * cfg.healthPerPoint; }
      spent = hSpent + aSpent + pSpent + cSpent;
    }
    const avail = Math.max(0, clsTotal - spent);
    nH = Math.min(cHMax, nH);
    nA = Math.min(cAMax, nA);
    nP = Math.min(cPwMax, nP);
    nC = Math.min(cCMax, nC);
    if (ca.health !== nH || ca.armor !== nA || ca.power !== nP || ca.crit !== nC || ca.pointsAvailable !== avail) {
      classAttrs[cls.id] = { health: nH, armor: nA, power: nP, crit: nC, pointsAvailable: avail };
      classChanged = true;
    }
  }

  const activeAttrs = classAttrs[classId] || defaultClassAttributes(classId, settings);
  const nextAttrs = { ...activeAttrs };
  const pwrTotal = totalPowerUpPointsForLevel(level, settings) + devBonus;
  const pwrSpent = (pwr.unlocked || []).length;
  const pwrAvail = Math.max(0, pwrTotal - pwrSpent);
  const nextPwr = { ...pwr, pointsAvailable: pwrAvail };

  const changed = classChanged ||
    (p.attributes?.pointsAvailable !== nextAttrs.pointsAvailable) ||
    (p.attributes?.health !== nextAttrs.health) ||
    (p.attributes?.armor !== nextAttrs.armor) ||
    (p.attributes?.power !== nextAttrs.power) ||
    (pwr.pointsAvailable !== pwrAvail);
  if (!changed) return player;
  return { ...p, classAttributes: classAttrs, attributes: nextAttrs, powerUps: nextPwr };
}

export function reconcileAllPlayersPoints(players: Player[], settings: Settings): { players: Player[]; changed: boolean } {
  let changed = false;
  const next = players.map((p) => {
    const updated = reconcilePlayerPoints(p, settings);
    if (updated !== p) changed = true;
    return updated;
  });
  return { players: next, changed };
}

export function classStartHealth(classId: string | null | undefined, settings: Settings): number {
  if (classId && settings.powerUpScaling.classStartHealth) {
    const v = settings.powerUpScaling.classStartHealth[classId];
    if (Number.isFinite(v)) return v;
  }
  return numOr(settings.powerUpScaling.attributeStartHealth, 0);
}

export function classStartArmor(classId: string | null | undefined, settings: Settings): number {
  if (classId && settings.powerUpScaling.classStartArmor) {
    const v = settings.powerUpScaling.classStartArmor[classId];
    if (Number.isFinite(v)) return v;
  }
  return numOr(settings.powerUpScaling.attributeStartArmor, 0);
}

export function classStartPower(classId: string | null | undefined, settings: Settings): number {
  if (classId && settings.powerUpScaling.classStartPower) {
    const v = settings.powerUpScaling.classStartPower[classId];
    if (Number.isFinite(v)) return v;
  }
  return numOr(settings.powerUpScaling.attributeStartPower, 0);
}

export function classStartCrit(classId: string | null | undefined, settings: Settings): number {
  if (classId && settings.powerUpScaling.classStartCrit) {
    const v = settings.powerUpScaling.classStartCrit[classId];
    if (Number.isFinite(v)) return v;
  }
  return numOr(settings.powerUpScaling.attributeStartCrit, 0);
}

export function classHealthMax(classId: string | null | undefined, settings: Settings): number {
  if (classId && settings.powerUpScaling.classHealthMax) {
    const v = settings.powerUpScaling.classHealthMax[classId];
    if (Number.isFinite(v)) return v;
  }
  return Number.isFinite(settings.powerUpScaling.healthMax) ? settings.powerUpScaling.healthMax : Number.MAX_SAFE_INTEGER;
}

export function classArmorMax(classId: string | null | undefined, settings: Settings): number {
  if (classId && settings.powerUpScaling.classArmorMax) {
    const v = settings.powerUpScaling.classArmorMax[classId];
    if (Number.isFinite(v)) return v;
  }
  return Number.isFinite(settings.powerUpScaling.armorMax) ? settings.powerUpScaling.armorMax : Number.MAX_SAFE_INTEGER;
}

export function classPowerMax(classId: string | null | undefined, settings: Settings): number {
  if (classId && settings.powerUpScaling.classPowerMax) {
    const v = settings.powerUpScaling.classPowerMax[classId];
    if (Number.isFinite(v)) return v;
  }
  return Number.isFinite(settings.powerUpScaling.powerMax) ? settings.powerUpScaling.powerMax : Number.MAX_SAFE_INTEGER;
}

export function classCritMax(classId: string | null | undefined, settings: Settings): number {
  if (classId && settings.powerUpScaling.classCritMax) {
    const v = settings.powerUpScaling.classCritMax[classId];
    if (Number.isFinite(v)) return v;
  }
  return Number.isFinite(settings.powerUpScaling.critMax) ? settings.powerUpScaling.critMax : Number.MAX_SAFE_INTEGER;
}

export function defaultClassAttributes(classId: string | null | undefined, settings: Settings): ClassAttributes {
  return {
    health: classStartHealth(classId, settings),
    armor: classStartArmor(classId, settings),
    power: classStartPower(classId, settings),
    crit: classStartCrit(classId, settings),
    pointsAvailable: 0,
  };
}

export function effectiveAttributes(player: Player, settings: Settings): PlayerAttributes {
  const classId = player.coopProgress?.classId;
  if (classId && player.classAttributes && player.classAttributes[classId]) {
    const ca = player.classAttributes[classId];
    return {
      health: ca.health,
      armor: ca.armor,
      power: ca.power,
      crit: ca.crit,
      pointsAvailable: ca.pointsAvailable,
    };
  }
  return player.attributes || defaultAttributes(settings);
}

export function ensureClassAttributes(player: Player, settings: Settings): Player {
  const classId = player.coopProgress?.classId || 'warrior';
  const existing = player.classAttributes || {};
  const next = { ...existing };
  for (const cls of COOP_CLASSES) {
    if (!next[cls.id]) {
      if (cls.id === classId && player.attributes) {
        next[cls.id] = {
          health: Number.isFinite(player.attributes.health) ? player.attributes.health : classStartHealth(cls.id, settings),
          armor: Number.isFinite(player.attributes.armor) ? player.attributes.armor : classStartArmor(cls.id, settings),
          power: Number.isFinite(player.attributes.power) ? player.attributes.power : classStartPower(cls.id, settings),
          crit: Number.isFinite(player.attributes.crit) ? player.attributes.crit : classStartCrit(cls.id, settings),
          pointsAvailable: Number.isFinite(player.attributes.pointsAvailable) ? player.attributes.pointsAvailable : 0,
        };
      } else {
        next[cls.id] = defaultClassAttributes(cls.id, settings);
      }
    }
  }
  const activeAttrs = next[classId] || defaultClassAttributes(classId, settings);
  return {
    ...player,
    classAttributes: next,
    attributes: { ...activeAttrs },
  };
}

function buildClassLevelsForPlayer(player: Player): Record<string, number> {
  const prog = player.coopProgress;
  if (!prog) return {};
  const out: Record<string, number> = {};
  for (const cls of COOP_CLASSES) {
    out[cls.id] = classLevelFromXp(prog, cls.id as CoopClassId, defaultSettings()).level;
  }
  return out;
}

export { buildClassLevelsForPlayer };
