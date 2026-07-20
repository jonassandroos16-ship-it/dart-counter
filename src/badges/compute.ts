import { BADGES } from './definitions';
import { getBadgeInfo } from './queries';

export function computeGameBadges(game: any): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const pl of game.players || []) {
    out[pl.id] = [];
  }
  if ((game?.players || []).length < 2) return out;
  const powerUpsOn = !!(game && game.powerUpsEnabled);
  for (const badge of BADGES) {
    if (badge.powerUpOnly && !powerUpsOn) continue;
    if (!badge.powerUpOnly && powerUpsOn) continue;
    if (badge.coopOnly) continue;
    if (badge.kind === 'in-game') {
      for (const pl of game.players || []) {
        try {
          if (badge.check && badge.check(pl.visits || [], game)) out[pl.id].push(badge.id);
        } catch { /* ignore */ }
      }
    } else if (badge.kind === 'post-game' && badge.pick) {
      try {
        const picked = badge.pick(game);
        if (!picked) continue;
        const ids = Array.isArray(picked) ? picked : [picked];
        for (const id of ids) {
          if (out[id]) out[id].push(badge.id);
        }
      } catch { /* ignore */ }
    }
  }
  return out;
}

export function computeLifetimeBadges(playerId: string, games: any[]): string[] {
  const earned = new Set<string>();
  for (const g of games) {
    if (!g || !g.players) continue;
    if (!g.players.some((p: any) => p.id === playerId)) continue;
    const map = computeGameBadges(g);
    (map[playerId] || []).forEach((id) => earned.add(id));
  }
  return Array.from(earned);
}

export function computeLifetimeBadgeCounts(playerId: string, games: any[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const g of games) {
    if (!g || !g.players) continue;
    if (!g.players.some((p: any) => p.id === playerId)) continue;
    const map = computeGameBadges(g);
    const unique = Array.from(new Set(map[playerId] || []));
    unique.forEach((id) => { counts[id] = (counts[id] || 0) + 1; });
  }
  return counts;
}

export { getBadgeInfo };
