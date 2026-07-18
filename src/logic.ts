import type { Game, GamePlayer, GameRecord, Player, Settings, Visit } from './types';
import { MODES, CHECKOUTS, ATC_TARGETS, atcLabel } from './constants';
import { uid, todayKey } from './store';

export function createGame(modeKey: string, playerIds: string[], players: Player[], doubleOut: boolean, legsBestOf: number): Game {
  const mode = MODES[modeKey];
  const meta = (id: string) => players.find(p => p.id === id)!;
  const special = !!(mode.practice || mode.atc || mode.killer || mode.party);
  const basePlayers = playerIds.map((id, i) => {
    const gp: GamePlayer = { id, name: meta(id).name, color: meta(id).color, score: mode.start, legsWon: 0, visits: [], idx: 0, dartsThrown: 0, done: false };
    if (mode.killer) { gp.lives = 3; gp.eliminated = false; gp.killerNumber = KILLER_NUMBERS[i % KILLER_NUMBERS.length]; gp.killerHits = 0; gp.kills = []; }
    return gp;
  });
  return {
    id: uid(), mode: modeKey, date: new Date().toISOString(),
    doubleOut: special ? false : doubleOut,
    practice: !!mode.practice, atc: !!mode.atc,
    legsBestOf: special ? 1 : legsBestOf,
    players: basePlayers,
    turn: 0, leg: 1, finished: false, winner: null, checkedOutThisRound: [], roundStartTurn: 0, darts: [], mult: 1,
  };
}

const KILLER_NUMBERS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

export function recordFromGame(game: Game): GameRecord {
  return {
    id: game.id, date: game.date, mode: game.mode, practice: game.practice, atc: game.atc,
    doubleOut: game.doubleOut, legsBestOf: game.legsBestOf, winner: game.winner,
    tied: !!game.tied, tiedPlayers: game.tiedPlayers ?? null,
    players: game.players.map(pl => ({ id: pl.id, name: pl.name, color: pl.color, legsWon: pl.legsWon, dartsThrown: pl.dartsThrown || 0, visits: pl.visits })),
  };
}

export function checkoutHint(remaining: number | null, doubleOut: boolean, practice?: boolean): string {
  if (remaining == null || practice) return '';
  if (remaining < 0) return 'Bust!';
  if (remaining === 0) return 'Checked out!';
  if (remaining === 1) return doubleOut ? 'No checkout — bust risk' : 'Checkout: S1';
  if (remaining > 170) return 'No 3-dart checkout — score to get ≤ 170';
  // Straight out: any number finishes. Show the simplest single-dart route.
  if (!doubleOut) {
    if (remaining <= 20) return `Checkout: S${remaining}`;
    if (remaining === 25) return 'Checkout: 25 (outer bull)';
    if (remaining === 50) return 'Checkout: Bull';
    if (remaining <= 40) { const d = Math.ceil(remaining / 2); return `Checkout: S${remaining} or D${d}`; }
    return `Checkout: ${remaining}`;
  }
  const co = CHECKOUTS[remaining];
  if (co) return 'Checkout: ' + co.join('  ');
  return 'No checkout from ' + remaining;
}

export function leadTrailBadge(pl: GamePlayer, game: Game): string {
  if (game.practice || game.players.length < 2) return '';
  const scores = game.players.map(p => p.score);
  const leaderScore = Math.min(...scores);
  if (pl.score === leaderScore) {
    const next = scores.filter(s => s !== leaderScore).sort((a, b) => a - b)[0];
    const ahead = next != null ? next - leaderScore : 0;
    return ahead > 0 ? `+${ahead}` : '';
  }
  const behind = pl.score - leaderScore;
  return behind > 0 ? `-${behind}` : '';
}

export function visitAvg(pl: GamePlayer): number {
  if (!pl.visits.length) return 0;
  const total = pl.visits.reduce((a, v) => a + v.scored, 0);
  const darts = pl.visits.reduce((a, v) => a + v.darts.length, 0);
  return darts ? total / darts * 3 : 0;
}

export function visitAvgStatic(pl: { visits: Visit[] }): number {
  const s = (pl.visits || []).filter(v => !v.bust);
  const t = s.reduce((a, v) => a + v.scored, 0);
  const d = s.reduce((a, v) => a + v.darts.length, 0);
  return d ? t / d * 3 : 0;
}

export function levelFromXP(totalXP: number, settings: Settings) {
  const xpForLevel = (level: number) => Math.round(settings.xpConfig.baseLevelXp * Math.pow(settings.xpConfig.levelMult, level - 1));
  let level = 1, remaining = totalXP;
  while (remaining >= xpForLevel(level)) { remaining -= xpForLevel(level); level++; }
  return { level, xpIntoLevel: remaining, xpNeeded: xpForLevel(level) };
}

export function getPlayerXP(player: Player | undefined) {
  if (!player) return { xp: 0, level: 1, unlockedTitles: [] as string[], selectedTitle: null as string | null };
  return { xp: player.xp ?? 0, level: player.level ?? 1, unlockedTitles: player.unlockedTitles ?? [], selectedTitle: player.selectedTitle ?? null };
}

export function getPlayerXPById(playerId: string, players: Player[]) {
  return getPlayerXP(players.find(p => p.id === playerId));
}

export function allVisitsFor(playerId: string, games: GameRecord[]): any[] {
  const out: any[] = [];
  games.forEach(g => {
    const pl = g.players.find(p => p.id === playerId);
    if (!pl) return;
    pl.visits.forEach(v => out.push({ ...v, mode: g.mode, gameId: g.id, gameDate: g.date, practice: g.practice }));
  });
  return out;
}

export interface DateFilter {
  start: string; // inclusive ISO
  end: string;   // exclusive ISO
}

export function filterGamesByDate(games: GameRecord[], filter: DateFilter | null): GameRecord[] {
  if (!filter) return games;
  const start = new Date(filter.start).getTime();
  const end = new Date(filter.end).getTime();
  return games.filter(g => {
    const t = new Date(g.date).getTime();
    return t >= start && t < end;
  });
}

export function playerStats(playerId: string, games: GameRecord[]) {
  const visits = allVisitsFor(playerId, games);
  const scoring = visits.filter((v: any) => !v.bust && !v.atc);
  const totalScore = scoring.reduce((a: number, v: any) => a + v.scored, 0);
  const totalDarts = scoring.reduce((a: number, v: any) => a + v.darts.length, 0);
  const playerGames = games.filter(g => g.players.some(p => p.id === playerId));
  const legsWon = playerGames.reduce((a, g) => a + (g.players.find(p => p.id === playerId)?.legsWon || 0), 0);
  const gamesWon = playerGames.filter(g => g.winner === playerId).length;
  const gamesTied = playerGames.filter(g => g.tied && g.tiedPlayers && g.tiedPlayers.includes(playerId)).length;
  const checkouts = scoring.filter((v: any) => v.remaining === 0);
  const highCheckout = Math.max(0, ...checkouts.map((v: any) => v.scored));
  const highScore = Math.max(0, ...scoring.map((v: any) => v.scored));
  const n180 = scoring.filter((v: any) => v.scored === 180).length;
  const n140 = scoring.filter((v: any) => v.scored >= 140 && v.scored < 180).length;
  const tons = scoring.filter((v: any) => v.scored >= 100 && v.scored < 140).length;
  const first9 = (() => {
    let s = 0, c = 0;
    playerGames.forEach(g => {
      const pl = g.players.find(p => p.id === playerId); if (!pl) return;
      const byLeg: Record<number, any[]> = {};
      pl.visits.forEach(v => { if (v.bust || v.atc) return; (byLeg[v.leg || 1] = byLeg[v.leg || 1] || []).push(v); });
      Object.values(byLeg).forEach(arr => { arr.slice(0, 3).forEach(v => { s += v.scored; c += v.darts.length; }); });
    });
    return c ? s / c * 3 : 0;
  })();
  const winRate = playerGames.length ? gamesWon / playerGames.length * 100 : 0;
  const tieRate = playerGames.length ? gamesTied / playerGames.length * 100 : 0;

  // Darts thrown (all visits, incl. bust/atc) and darts-to-finish per completed leg
  let dartsThrown = 0;
  const finishDartsList: number[] = [];
  playerGames.forEach(g => {
    const pl = g.players.find(p => p.id === playerId); if (!pl) return;
    const byLeg: Record<string, { darts: number; finished: boolean }> = {};
    pl.visits.forEach((v: any) => {
      dartsThrown += (v.darts?.length || 0);
      if (v.atc || g.practice) return;
      const k = String(v.leg || 1);
      const b = byLeg[k] = byLeg[k] || { darts: 0, finished: false };
      b.darts += (v.darts?.length || 0);
      if (v.remaining === 0) b.finished = true;
    });
    Object.values(byLeg).forEach(b => { if (b.finished) finishDartsList.push(b.darts); });
  });
  const finishMin = finishDartsList.length ? Math.min(...finishDartsList) : 0;
  const finishMax = finishDartsList.length ? Math.max(...finishDartsList) : 0;
  const finishAvg = finishDartsList.length ? finishDartsList.reduce((a, b) => a + b, 0) / finishDartsList.length : 0;

  return { games: playerGames.length, gamesWon, gamesTied, legsWon, winRate, tieRate, avg: totalDarts ? totalScore / totalDarts * 3 : 0, first9, highScore, highCheckout, n180, n140, tons, visits, dartsThrown, finishMin, finishMax, finishAvg, legsFinished: finishDartsList.length };
}

export function bucketAverages(visits: any[], period: string) {
  if (!visits.length) return { labels: [], values: [] };
  const key = (d: string) => {
    const dt = new Date(d);
    if (period === 'Daily') return todayKey(dt);
    if (period === 'Weekly') { const t = new Date(dt); const day = (t.getDay() + 6) % 7; t.setDate(t.getDate() - day); return todayKey(t); }
    if (period === 'Monthly') return dt.toISOString().slice(0, 7);
    if (period === 'Yearly') return String(dt.getFullYear());
    return todayKey(dt);
  };
  const map: Record<string, { s: number; d: number }> = {};
  visits.forEach(v => { const k = key(v.date || v.gameDate); (map[k] = map[k] || { s: 0, d: 0 }); map[k].s += v.scored; map[k].d += v.darts.length; });
  const keys = Object.keys(map).sort();
  const trimmed = period === 'Overall' ? keys.slice(-30) : keys.slice(-14);
  const shortLabel = (k: string) => {
    if (period === 'Monthly') { const [, m] = k.split('-'); return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+m - 1]; }
    if (period === 'Yearly') return k;
    const d = new Date(k); return d.getDate() + '/' + (d.getMonth() + 1);
  };
  return { labels: trimmed.map(shortLabel), values: trimmed.map(k => map[k].d ? map[k].s / map[k].d * 3 : 0) };
}

export { ATC_TARGETS, atcLabel };

// ============ Title backfill (backwards-compatible retro unlock) ============
// Scans full match history for a player and returns any built-in title ids
// they've already earned but haven't been credited for yet.
import { BUILTIN_TITLES, buildTitleCheck, type TitleCtx } from './constants';
import type { CustomTitle } from './types';

export function computeUnlockedTitlesForPlayer(
  playerId: string,
  games: GameRecord[],
  customTitles: CustomTitle[] = [],
): string[] {
  const playerGames = games.filter(g => g.players.some(p => p.id === playerId));
  const gamesWon = playerGames.filter(g => g.winner === playerId).length;
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

  const ctx: TitleCtx = { playerId, games: playerGames, gamesPlayed, gamesWon, lifetimeVisits };

  // Lifetime titles: single pass with the full ctx.
  titles.forEach(t => {
    try { if (t.check(lifetimeVisits, [], null, ctx)) unlocked.add(t.id); } catch { /* ignore */ }
  });

  // Per-game titles: replay each historical game with its own gameVisits.
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

// Merges retro-unlocked ids into a Player's existing unlockedTitles (idempotent).
export function retroUnlockPlayerTitles(
  player: Player,
  games: GameRecord[],
  customTitles: CustomTitle[] = [],
): Player {
  const existing = new Set(player.unlockedTitles || []);
  const found = computeUnlockedTitlesForPlayer(player.id, games, customTitles);
  let changed = false;
  found.forEach(id => { if (!existing.has(id)) { existing.add(id); changed = true; } });
  return changed ? { ...player, unlockedTitles: Array.from(existing) } : player;
}

// Backfills all players. Idempotent — safe to run on every app load.
export function retroUnlockAll(
  players: Player[],
  games: GameRecord[],
  customTitles: CustomTitle[] = [],
): { players: Player[]; changed: boolean } {
  let changed = false;
  const next = players.map(p => {
    const updated = retroUnlockPlayerTitles(p, games, customTitles);
    if (updated !== p) changed = true;
    return updated;
  });
  return { players: next, changed };
}
