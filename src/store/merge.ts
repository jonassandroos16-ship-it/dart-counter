import type { Player, PlayerCard } from '../types';

function mergeCards(a: PlayerCard[] | Record<string, PlayerCard[]> | undefined, b: PlayerCard[] | Record<string, PlayerCard[]> | undefined): Record<string, PlayerCard[]> | undefined {
  // Normalize old flat-array format to per-class record under 'any'
  const normalize = (v: typeof a): Record<string, PlayerCard[]> | undefined => {
    if (!v) return undefined;
    if (Array.isArray(v)) return { any: v };
    return v;
  };
  const ra = normalize(a);
  const rb = normalize(b);
  if (!ra && !rb) return undefined;
  const keys = new Set([...Object.keys(ra || {}), ...Object.keys(rb || {})]);
  const out: Record<string, PlayerCard[]> = {};
  for (const k of keys) {
    const av = ra?.[k] || [];
    const bv = rb?.[k] || [];
    if (av.length === 0 && bv.length === 0) continue;
    const map = new Map<string, PlayerCard>();
    for (const c of [...av, ...bv]) {
      const existing = map.get(c.cardId);
      if (!existing) {
        map.set(c.cardId, { ...c });
      } else {
        map.set(c.cardId, { cardId: c.cardId, upgraded: existing.upgraded || c.upgraded });
      }
    }
    out[k] = Array.from(map.values());
  }
  return Object.keys(out).length ? out : undefined;
}

export function mergePlayers(a: Player[], b: Player[]): Player[] {
  const map = new Map<string, Player>();
  for (const p of a) map.set(p.id, p);
  for (const p of b) {
    const existing = map.get(p.id);
    if (!existing) {
      map.set(p.id, p);
    } else {
      const merged: Player = { ...existing, ...p };
      // Merge cards per class
      const mergedCards = mergeCards(existing.cards, p.cards);
      if (mergedCards) merged.cards = mergedCards;
      // Merge unlocked titles
      const titles = new Set([...(existing.unlockedTitles || []), ...(p.unlockedTitles || [])]);
      merged.unlockedTitles = Array.from(titles);
      // Merge unlocked badges
      const badges = new Set([...(existing.unlockedBadges || []), ...(p.unlockedBadges || [])]);
      merged.unlockedBadges = Array.from(badges);
      // Merge badge counts (take max)
      const badgeCounts: Record<string, number> = { ...(existing.badgeCounts || {}) };
      for (const [k, v] of Object.entries(p.badgeCounts || {})) {
        badgeCounts[k] = Math.max(badgeCounts[k] || 0, v);
      }
      merged.badgeCounts = badgeCounts;
      // Merge XP (take max)
      merged.xp = Math.max(existing.xp || 0, p.xp || 0);
      merged.level = Math.max(existing.level || 1, p.level || 1);
      map.set(p.id, merged);
    }
  }
  return Array.from(map.values());
}
