import type { Player, Settings } from '../types';
import { levelFromXP } from '../logic';
import { classLevelFromXp } from '../campaign/engine/classes';

// Resolve a player's effective level from their currently selected class's XP.
export function effectiveLevel(player: Player, settings: Settings): number {
  const classId = player.coopProgress?.classId;
  if (classId) {
    return classLevelFromXp(player.coopProgress, classId, settings).level;
  }
  // Fall back to legacy player.xp for players without a class
  return levelFromXP(player.xp ?? 0, settings).level;
}

export function spentOn(current: number, start: number, perPoint: number): number {
  if (!Number.isFinite(current) || !Number.isFinite(start)) return 0;
  if (!Number.isFinite(perPoint) || perPoint <= 0) return 0;
  const diff = current - start;
  if (diff <= 0) return 0;
  return Math.round(diff / perPoint);
}

export type { Player };
