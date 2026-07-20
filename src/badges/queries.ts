import { BADGES } from './definitions';
import type { BadgeDef } from './types';

export function getBadgeInfo(badgeId: string | null | undefined): BadgeDef | undefined {
  if (!badgeId) return undefined;
  return BADGES.find((b) => b.id === badgeId);
}

export function getBadgeContext(
  badgeId: string | null | undefined,
  playerId: string,
  games: any[],
  ctx?: any,
): { value: number | string; label: string } | null {
  if (!badgeId) return null;
  const b = getBadgeInfo(badgeId);
  if (!b || !b.context) return null;
  try {
    const v = b.context(playerId, games || [], ctx);
    if (v == null) return null;
    if (typeof v === 'number' && v <= 0) return null;
    if (typeof v === 'string' && !v) return null;
    return { value: v, label: b.contextLabel || '' };
  } catch {
    return null;
  }
}

export function buildCoopBadgeCtx(): any {
  let campaignProgress: { highest_level_beaten: number } | null = null;
  let coopStats: any = null;
  try {
    const raw = localStorage.getItem('dc_campaign_progress');
    if (raw) campaignProgress = JSON.parse(raw);
  } catch { /* ignore */ }
  try {
    const raw = localStorage.getItem('dc_coop_stats');
    if (raw) coopStats = JSON.parse(raw);
  } catch { /* ignore */ }
  return { campaignProgress, coopStats };
}
