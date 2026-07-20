import type { Player, Settings } from '../types';
import { levelFromXP } from '../logic';

// Resolve a player's effective level from XP (the source of truth) rather than
// the cached `player.level` field, which can be stale on older saves/imports.
export function effectiveLevel(player: Player, settings: Settings): number {
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
