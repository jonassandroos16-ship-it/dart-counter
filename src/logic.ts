import type { CustomTitle, Game, GameRecord, Player, Settings, Visit } from './types';
import { ATC_TARGETS } from './constants';

export function createGame(modeKey: string, playerIds: string[], players: Player[], doubleOut: boolean, legsBestOf: number): Game {
  const mode = MODES_MAP[modeKey] || { start: 501 };
  const meta = (id: string) => players.find(p => p.id === id)!;
  const g: Game = {
    id: uid(), mode: modeKey, date: new Date().toISOString(),
    doubleOut, practice: !!mode.practice, atc: !!mode.atc, legsBestOf,
    players: playerIds.map((id, i) => {
      const p = meta(id);
      return { id, name: p.name, color: p.color, score: mode.start, legsWon: 0, visits: [], idx: i, dartsThrown: 0, done: false };
    }),
    turn: 0, leg: 1, finished: false, winner: null, tiedPlayers: null, tied: false,
    checkedOutThisRound: [], roundStartTurn: 0, darts: [], mult: 1,
  };
  return g;
}

const MODES_MAP: Record<string, { start: number; practice?: boolean; atc?: boolean }> = {
  '501': { start: 501 }, '301': { start: 301 }, '701': { start: 701 }, '101': { start: 101 },
  'atc': { start: 0, atc: true }, 'practice': { start: 0, practice: true },
};

export function recordFromGame(game: Game): GameRecord {
  return {
    id: game.id, date: game.date, mode: game.mode, practice: game.practice, atc: game.atc,
    doubleOut: game.doubleOut, legsBestOf: game.legsBestOf, winner: game.winner, tied: game.tied,
    tiedPlayers: game.tiedPlayers, players: game.players.map(p => ({
      id: p.id, name: p.name, color: p.color, legsWon: p.legsWon, dartsThrown: p.dartsThrown, visits: p.visits,
    })),
  };
}

export function checkoutHint(remaining: number | null, doubleOut: boolean, practice?: boolean): string {
  if (remaining == null || remaining < 0 || (doubleOut && remaining === 1)) return '';
  if (!doubleOut && !practice) return '';
  if (remaining <= 170) {
    const c = CHECKOUTS[remaining];
    if (c) return c.join(' ');
  }
  return '';
}

import { CHECKOUTS, MODES } from './constants';
import { uid } from './store';

export function leadTrailBadge(pl: GamePlayer, game: Game): string {
  const scores = game.players.map(p => p.score).sort((a, b) => b - a);
  const top = scores[0]; const bot = scores[scores.length - 1];
  if (pl.score === top && top !== bot) return 'lead';
  if (pl.score === bot && top !== bot) return 'trail';
  return '';
}

export function visitAvg(pl: GamePlayer): number {
  const visits = pl.visits.filter(v => !v.bust && !v.atc);
  if (!visits.length) return 0;
  return visits.reduce((a, v) => a + v.scored, 0) / visits.length;
}

export function visitAvgStatic(pl: { visits: Visit[] }): number {
  const visits = pl.visits.filter(v => !v.bust && !v.atc);
  if (!visits.length) return 0;
  return visits.reduce((a, v) => a + v.scored, 0) / visits.length;
}

export function levelFromXP(totalXP: number, settings: Settings) {
  const { baseLevelXp, levelMult } = settings.xpConfig;
  let level = 1; let need = baseLevelXp; let remaining = totalXP;
  while (remaining >= need && level < 999) { remaining -= need; level++; need = Math.round(need * levelMult); }
  return { level, xpIntoLevel: remaining, xpForNext: need };
}

export function getPlayerXP(player: Player | undefined) {
  if (!player) return 0;
  return player.xp || 0;
}

export function getPlayerXPById(playerId: string, players: Player[]) {
  return getPlayerXP(players.find(p => p.id === playerId));
}

export function allVisitsFor(playerId: string, games: GameRecord[]): any[] {
  const out: any[] = [];
  for (const g of games) {
    const pl = g.players.find(p => p.id === playerId);
    if (!pl) continue;
    pl.visits.forEach(v => out.push({ ...v, mode: g.mode, gameId: g.id, gameDate: g.date, practice: g.practice }));
  }
  return out;
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

import type { GamePlayer } from './types';
import type { DateFilter } from './CalendarPicker';

export function playerStats(playerId: string, games: GameRecord[]) {
  const playerGames = games.filter(g => g.players.some(p => p.id === playerId));
  const gamesPlayed = playerGames.length;
  const gamesWon = playerGames.filter(g => g.winner === playerId).length;
  const legsWon = playerGames.reduce((a, g) => a + (g.players.find(p => p.id === playerId)?.legsWon || 0), 0);
  const legsPlayed = playerGames.reduce((a, g) => a + g.legsBestOf, 0);

  const visits: any[] = [];
  let dartsThrown = 0;
  let highCheckout = 0;
  let first9Total = 0; let first9Count = 0;
  let maxScore = 0;

  for (const g of playerGames) {
    const pl = g.players.find(p => p.id === playerId); if (!pl) continue;
    dartsThrown += pl.dartsThrown;
    const scoringVisits = pl.visits.filter(v => !v.bust && !v.atc);
    const legs: Record<number, any[]> = {};
    scoringVisits.forEach(v => { (legs[v.leg] = legs[v.leg] || []).push(v); });
    Object.values(legs).forEach(arr => {
      if (arr.length >= 3) { first9Total += arr.slice(0, 3).reduce((a, v) => a + v.scored, 0); first9Count++; }
    });
    for (const v of scoringVisits) {
      if (v.scored > maxScore) maxScore = v.scored;
      if (v.remaining === 0 && v.checkout && v.checkout > highCheckout) highCheckout = v.checkout;
    }
    pl.visits.forEach(v => visits.push({ ...v, mode: g.mode, gameId: g.id, gameDate: g.date, practice: g.practice }));
  }

  const scoringVisits = visits.filter(v => !v.bust && !v.atc);
  const totalScore = scoringVisits.reduce((a, v) => a + v.scored, 0);
  const avg3 = scoringVisits.length ? totalScore / scoringVisits.length : 0;
  const first9Avg = first9Count ? first9Total / first9Count : 0;
  const count180 = scoringVisits.filter(v => v.scored === 180).length;
  const count140plus = scoringVisits.filter(v => v.scored >= 140 && v.scored < 180).length;
  const count120plus = scoringVisits.filter(v => v.scored >= 120 && v.scored < 140).count;
  const count100plus = scoringVisits.filter(v => v.scored >= 100 && v.scored < 120).length;
  const count80 = scoringVisits.filter(v => v.scored >= 80 && v.scored < 100).length;
  const count60 = scoringVisits.filter(v => v.scored >= 60 && v.scored < 80).length;
  const checkoutHits = visits.filter(v => v.remaining === 0).length;
  const checkoutChances = playerGames.length; // approx
  const winRate = gamesPlayed ? gamesWon / gamesPlayed : 0;

  return {
    gamesPlayed, gamesWon, legsWon, legsPlayed, dartsThrown, avg3, first9Avg,
    count180, count140plus, count120plus, count100plus, count80, count60,
    highCheckout, maxScore, checkoutHits, checkoutChances, winRate, visits,
  };
}

export function bucketAverages(visits: any[], period: string) {
  const buckets: Record<string, number[]> = {};
  for (const v of visits) {
    const d = new Date(v.gameDate || v.date);
    let key: string;
    if (period === 'Daily') key = todayKey(d);
    else if (period === 'Weekly') { const t = new Date(d); const day = (t.getDay() + 6) % 7; t.setDate(t.getDate() - day); key = todayKey(t); }
    else if (period === 'Monthly') key = d.toISOString().slice(0, 7);
    else key = String(d.getFullYear());
    (buckets[key] = buckets[key] || []).push(v.scored);
  }
  const sorted = Object.keys(buckets).sort();
  return sorted.map(k => {
    const arr = buckets[k];
    const avg = arr.reduce((a: number, x: number) => a + x, 0) / arr.length;
    const d = new Date(k); return d.getDate() + '/' + (d.getMonth() + 1);
  });
}

import { todayKey } from './store';
