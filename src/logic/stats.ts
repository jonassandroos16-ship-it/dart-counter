import type { GameRecord } from '../types';
import { todayKey } from '../store';
import { levelFromXP } from './xp';

export interface DateFilter { start: string; end: string; }

export function filterGamesByDate(games: GameRecord[], filter: DateFilter | null): GameRecord[] {
  if (!filter) return games;
  const start = new Date(filter.start).getTime();
  const end = new Date(filter.end).getTime();
  return games.filter(g => {
    const t = new Date(g.date).getTime();
    return t >= start && t < end;
  });
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

export function playerStats(playerId: string, games: GameRecord[]) {
  const visits = allVisitsFor(playerId, games);
  const scoring = visits.filter((v: any) => !v.bust && !v.atc);
  const totalScore = scoring.reduce((a: number, v: any) => a + v.scored, 0);
  const totalDarts = scoring.reduce((a: number, v: any) => a + v.darts.length, 0);
  const playerGames = games.filter(g => g.players.some(p => p.id === playerId));
  const competitiveGames = playerGames.filter(g => g.players.length >= 2);
  const legsWon = competitiveGames.reduce((a, g) => a + (g.players.find(p => p.id === playerId)?.legsWon || 0), 0);
  const gamesWon = competitiveGames.filter(g => g.winner === playerId).length;
  const gamesTied = competitiveGames.filter(g => g.tied && g.tiedPlayers && g.tiedPlayers.includes(playerId)).length;
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
  const winRate = competitiveGames.length ? gamesWon / competitiveGames.length * 100 : 0;
  const tieRate = competitiveGames.length ? gamesTied / competitiveGames.length * 100 : 0;
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
  const battleGames = playerGames.filter(g => g.mode === 'battle');
  const kills = battleGames.reduce((a, g) => a + ((g.players.find(p => p.id === playerId)?.kills || []).length), 0);
  const defeatedCount = battleGames.filter(g => g.players.find(p => p.id === playerId)?.defeated).length;
  return { games: playerGames.length, competitiveGames: competitiveGames.length, gamesWon, gamesTied, legsWon, winRate, tieRate, avg: totalDarts ? totalScore / totalDarts * 3 : 0, first9, highScore, highCheckout, n180, n140, tons, visits, dartsThrown, finishMin, finishMax, finishAvg, legsFinished: finishDartsList.length, kills, defeatedCount, battleGames: battleGames.length };
}

export function headToHeadStats(playerId: string, opponentId: string, games: GameRecord[]) {
  const shared = games.filter(g =>
    g.players.length >= 2 &&
    g.players.some(p => p.id === playerId) &&
    g.players.some(p => p.id === opponentId)
  );
  const gamesWon = shared.filter(g => g.winner === playerId).length;
  const gamesTied = shared.filter(g => g.tied && g.tiedPlayers && g.tiedPlayers.includes(playerId)).length;
  const total = shared.length;
  const winRate = total ? gamesWon / total * 100 : 0;
  const tieRate = total ? gamesTied / total * 100 : 0;
  return { games: total, gamesWon, gamesTied, winRate, tieRate };
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

export { levelFromXP };
