import type { CustomTitle, GameRecord, Player, Settings } from '../types';
import type { PlayerCard } from '../cards/types';
import { uid } from './format';

function mergeCards(
  a: Record<string, PlayerCard[]> | undefined,
  b: Record<string, PlayerCard[]> | undefined,
): Record<string, PlayerCard[]> | undefined {
  if (!a && !b) return undefined;
  const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  const out: Record<string, PlayerCard[]> = {};
  for (const k of keys) {
    const av = a?.[k] || [];
    const bv = b?.[k] || [];
    if (av.length === 0 && bv.length === 0) continue;
    const map = new Map<string, PlayerCard>();
    for (const c of [...av, ...bv]) {
      const existing = map.get(c.cardId);
      if (!existing) {
        map.set(c.cardId, { ...c });
      } else {
        const existingLevel = existing.upgradeLevel ?? (existing.upgraded ? 1 : 0);
        const incomingLevel = c.upgradeLevel ?? (c.upgraded ? 1 : 0);
        const maxLevel = Math.max(existingLevel, incomingLevel);
        map.set(c.cardId, { cardId: c.cardId, upgradeLevel: maxLevel, upgraded: maxLevel > 0 });
      }
    }
    out[k] = Array.from(map.values());
  }
  return Object.keys(out).length ? out : undefined;
}

export interface BackupShape {
  players?: Player[];
  games?: GameRecord[];
  settings?: Settings;
  exportedAt?: string;
}

function matchPlayerKey(p: Player): string {
  return `${(p.name || '').trim().toLowerCase()}|${(p.color || '').toLowerCase()}`;
}

function mergeBadgeCounts(a: Record<string, number> | undefined, b: Record<string, number> | undefined): Record<string, number> {
  const out: Record<string, number> = { ...(a || {}) };
  for (const [k, v] of Object.entries(b || {})) {
    out[k] = Math.max(out[k] || 0, v);
  }
  return out;
}

function mergePlayers(existing: Player[], incoming: Player[]): Player[] {
  const byId = new Map<string, Player>();
  const byKey = new Map<string, Player>();
  for (const p of existing) {
    byId.set(p.id, p);
    byKey.set(matchPlayerKey(p), p);
  }
  for (const p of incoming) {
    const idMatch = byId.get(p.id);
    if (idMatch) {
      byId.set(idMatch.id, {
        ...idMatch,
        ...p,
        xp: Math.max(idMatch.xp || 0, p.xp || 0) || idMatch.xp || p.xp || 0,
        level: Math.max(idMatch.level || 0, p.level || 0) || idMatch.level || p.level || 0,
        unlockedTitles: Array.from(new Set([...(idMatch.unlockedTitles || []), ...(p.unlockedTitles || [])])),
        unlockedBadges: Array.from(new Set([...(idMatch.unlockedBadges || []), ...(p.unlockedBadges || [])])),
        badgeCounts: mergeBadgeCounts(idMatch.badgeCounts, p.badgeCounts),
        cards: mergeCards(idMatch.cards, p.cards),
      });
      byKey.set(matchPlayerKey(p), byId.get(p.id)!);
      continue;
    }
    const keyMatch = byKey.get(matchPlayerKey(p));
    if (keyMatch) {
      byId.set(keyMatch.id, {
        ...keyMatch,
        ...p,
        id: keyMatch.id,
        xp: Math.max(keyMatch.xp || 0, p.xp || 0) || keyMatch.xp || p.xp || 0,
        level: Math.max(keyMatch.level || 0, p.level || 0) || keyMatch.level || p.level || 0,
        unlockedTitles: Array.from(new Set([...(keyMatch.unlockedTitles || []), ...(p.unlockedTitles || [])])),
        unlockedBadges: Array.from(new Set([...(keyMatch.unlockedBadges || []), ...(p.unlockedBadges || [])])),
        badgeCounts: mergeBadgeCounts(keyMatch.badgeCounts, p.badgeCounts),
        cards: mergeCards(keyMatch.cards, p.cards),
      });
      continue;
    }
    let id = p.id;
    while (byId.has(id)) id = id + '_' + uid();
    const placed = { ...p, id };
    byId.set(id, placed);
    byKey.set(matchPlayerKey(placed), placed);
  }
  return Array.from(byId.values());
}

function mergeGames(existing: GameRecord[], incoming: GameRecord[]): GameRecord[] {
  const byId = new Map<string, GameRecord>(existing.map(g => [g.id, g]));
  for (const g of incoming) {
    if (!byId.has(g.id)) byId.set(g.id, g);
  }
  return Array.from(byId.values());
}

function mergeSettings(existing: Settings, incoming?: Settings): Settings {
  if (!incoming) return existing;
  const customTitles = (() => {
    const byId = new Map<string, CustomTitle>();
    for (const t of [...existing.customTitles, ...(incoming.customTitles || [])]) byId.set(t.id, t);
    return Array.from(byId.values());
  })();
  return {
    ...existing,
    ...incoming,
    customTitles,
    powerUpScaling: { ...existing.powerUpScaling, ...(incoming.powerUpScaling || {}) },
  };
}

export function mergeBackup(
  existing: { players: Player[]; games: GameRecord[]; settings: Settings },
  backup: BackupShape,
): { players: Player[]; games: GameRecord[]; settings: Settings } {
  return {
    players: mergePlayers(existing.players, backup.players || []),
    games: mergeGames(existing.games, backup.games || []),
    settings: mergeSettings(existing.settings, backup.settings),
  };
}
