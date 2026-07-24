import type { GameRecord, Player, CustomTitle } from '../types';
import { BUILTIN_TITLES, buildTitleCheck, type TitleCtx } from '../constants';
import { buildClassLevelsForPlayer } from './attributes';

export function computeUnlockedTitlesForPlayer(
  playerId: string,
  games: GameRecord[],
  customTitles: CustomTitle[] = [],
  campaignProgress: { highest_level_beaten: number } | null = null,
  classLevels: Record<string, number> = {},
): string[] {
  const playerGames = games.filter(g => g.players.some(p => p.id === playerId));
  const gamesWon = playerGames.filter(g => g.players.length >= 2 && g.winner === playerId).length;
  const gamesPlayed = playerGames.length;
  const lifetimeVisits: any[] = [];
  playerGames.forEach(g => {
    const pl = g.players.find(p => p.id === playerId);
    if (!pl) return;
    pl.visits.forEach(v => lifetimeVisits.push({ ...v, gameId: g.id, gameDate: g.date, practice: g.practice }));
  });
  const titles = [
    ...BUILTIN_TITLES,
    ...customTitles.map(t => ({ ...t, custom: true, check: buildTitleCheck(t) as any })),
  ];
  const unlocked = new Set<string>();
  const ctx: TitleCtx = { playerId, games: playerGames, gamesPlayed, gamesWon, lifetimeVisits, campaignProgress, classLevels };
  titles.forEach(t => {
    try { if (t.check(lifetimeVisits, [], null, ctx)) unlocked.add(t.id); } catch { /* ignore */ }
  });
  playerGames.forEach(g => {
    const pl = g.players.find(p => p.id === playerId);
    if (!pl) return;
    const gameVisits = pl.visits;
    const gameLike = { ...g, winner: g.winner, players: g.players, legsBestOf: g.legsBestOf };
    titles.forEach(t => {
      if (unlocked.has(t.id)) return;
      try { if (t.check(lifetimeVisits, gameVisits, gameLike, ctx)) unlocked.add(t.id); } catch { /* ignore */ }
    });
  });
  return Array.from(unlocked);
}

export function retroUnlockPlayerTitles(
  player: Player,
  games: GameRecord[],
  customTitles: CustomTitle[] = [],
  campaignProgress: { highest_level_beaten: number } | null = null,
): Player {
  const existing = new Set(player.unlockedTitles || []);
  const classLevels = buildClassLevelsForPlayer(player);
  const found = computeUnlockedTitlesForPlayer(player.id, games, customTitles, campaignProgress, classLevels);
  let changed = false;
  found.forEach(id => { if (!existing.has(id)) { existing.add(id); changed = true; } });
  return changed ? { ...player, unlockedTitles: Array.from(existing) } : player;
}

export function retroUnlockAll(
  players: Player[],
  games: GameRecord[],
  customTitles: CustomTitle[] = [],
  campaignProgress: { highest_level_beaten: number } | null = null,
): { players: Player[]; changed: boolean } {
  let changed = false;
  const next = players.map(p => {
    const updated = retroUnlockPlayerTitles(p, games, customTitles, campaignProgress);
    if (updated !== p) changed = true;
    return updated;
  });
  return { players: next, changed };
}
