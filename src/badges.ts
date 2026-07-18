// Badge system — medals earned during play.
//
// Badges come in two flavours:
//   - 'in-game': earned by an individual player based on their own visits.
//   - 'post-game': awarded by comparing all players after the game ends
//     (e.g. most busts, highest score). Only one player can earn each
//     post-game badge per match (ties award both).

export interface BadgeDef {
  id: string;
  name: string;
  desc: string;
  icon: string;
  kind: 'in-game' | 'post-game';
  check?: (playerVisits: any[], game: any) => boolean;
  pick?: (game: any) => string | string[] | null;
}

const dartsOf = (visits: any[]) => visits.flatMap((v: any) => v.darts || []);

const isBull = (d: any) => d.value === 50 || d.value === 25;
const isMiss = (d: any) => d.value === 0;

export const BADGES: BadgeDef[] = [
  // ============ In-game (per player) ============
  { id: 'b_hit_bull', name: 'Hit Bull', desc: 'Hit any bull (25 or 50) during the game', icon: '🎯', kind: 'in-game',
    check: (v) => dartsOf(v).some(isBull) },
  { id: 'b_hit_20', name: 'Hit 20', desc: 'Hit a 20 segment during the game', icon: '💥', kind: 'in-game',
    check: (v) => dartsOf(v).some((d: any) => d.base === 20) },
  { id: 'b_classic_26', name: 'Classic 26', desc: 'Score a 26 with 20, 1, 5 in a single visit', icon: '🃏', kind: 'in-game',
    check: (v) => v.some((visit: any) => {
      if (visit.bust || visit.atc) return false;
      const darts = visit.darts || [];
      if (darts.length !== 3) return false;
      const bases = darts.map((d: any) => d.base).sort((a: number, b: number) => a - b);
      return bases[0] === 1 && bases[1] === 5 && bases[2] === 20 && visit.scored === 26;
    }) },
  { id: 'b_ton', name: 'Ton', desc: 'Score 100+ in a single visit', icon: '💯', kind: 'in-game',
    check: (v) => v.some((visit: any) => !visit.bust && !visit.atc && visit.scored >= 100) },
  { id: 'b_ton40', name: 'Big Ton', desc: 'Score 140+ in a single visit', icon: '🔥', kind: 'in-game',
    check: (v) => v.some((visit: any) => !visit.bust && !visit.atc && visit.scored >= 140) },
  { id: 'b_ton80', name: 'Maximum', desc: 'Score a 180', icon: '💥', kind: 'in-game',
    check: (v) => v.some((visit: any) => !visit.bust && !visit.atc && visit.scored === 180) },
  { id: 'b_hat_trick', name: 'Hat Trick', desc: 'Hit 3 bulls in one visit', icon: '🎩', kind: 'in-game',
    check: (v) => v.some((visit: any) => (visit.darts || []).filter(isBull).length >= 3) },
  { id: 'b_triple_triple', name: 'Triple Triple', desc: 'Land 3 triples in one visit', icon: '🥞', kind: 'in-game',
    check: (v) => v.some((visit: any) => (visit.darts || []).filter((d: any) => d.mult === 3).length >= 3) },
  { id: 'b_double_dip', name: 'Double Dip', desc: 'Land 3 doubles in one visit', icon: '💠', kind: 'in-game',
    check: (v) => v.some((visit: any) => (visit.darts || []).filter((d: any) => d.mult === 2).length >= 3) },
  { id: 'b_buster', name: 'Buster', desc: 'Bust at least once', icon: '😵', kind: 'in-game',
    check: (v) => v.some((visit: any) => visit.bust) },
  { id: 'b_shark', name: 'Shark', desc: 'Hit 5+ triples in the game', icon: '🦈', kind: 'in-game',
    check: (v) => dartsOf(v).filter((d: any) => d.mult === 3).length >= 5 },
  { id: 'b_first_blood', name: 'First Blood', desc: 'Be the first player to check out a leg', icon: '🩸', kind: 'in-game',
    check: (_v, game) => {
      if (!game || game.practice || game.atc) return false;
      let earliest: { pid: string; date: number } | null = null;
      for (const pl of game.players || []) {
        for (const visit of pl.visits || []) {
          if (visit.remaining === 0 && !visit.bust) {
            const t = new Date(visit.date || 0).getTime();
            if (!earliest || t < earliest.date) earliest = { pid: pl.id, date: t };
          }
        }
      }
      return !!earliest;
    } },

  // ============ Post-game (comparative — one winner per badge) ============
  { id: 'b_most_misses', name: 'Wild Throw', desc: 'Missed the most darts in the game', icon: '🌪️', kind: 'post-game',
    pick: (game) => pickExtreme(game, (pl) => dartsOf(pl.visits || []).filter(isMiss).length, 'max') },
  { id: 'b_most_busts', name: 'Bust Master', desc: 'Busted the most times in the game', icon: '🚫', kind: 'post-game',
    pick: (game) => pickExtreme(game, (pl) => (pl.visits || []).filter((v: any) => v.bust).length, 'max') },
  { id: 'b_highest_score', name: 'Top Scorer', desc: 'Had the highest single-visit score', icon: '📈', kind: 'post-game',
    pick: (game) => pickExtreme(game, (pl) => Math.max(0, ...(pl.visits || []).filter((v: any) => !v.bust && !v.atc).map((v: any) => v.scored || 0)), 'max') },
  { id: 'b_most_darts', name: 'Marathon', desc: 'Threw the most darts in the game', icon: '🏃', kind: 'post-game',
    pick: (game) => pickExtreme(game, (pl) => dartsOf(pl.visits || []).length, 'max') },
  { id: 'b_best_comeback', name: 'Comeback Kid', desc: 'Won after trailing by 50+, or threw a 150+ visit to level the scores', icon: '🔄', kind: 'post-game',
    pick: (game) => {
      if (!game || game.practice || game.atc) return null;
      if (!game.winner) return null;
      const winner = (game.players || []).find((p: any) => p.id === game.winner);
      if (!winner) return null;
      const hadBigVisit = (winner.visits || []).some((v: any) => !v.bust && !v.atc && v.scored >= 150);
      const players = game.players || [];
      let trailedBy50 = false;
      const totals: Record<string, number> = {};
      players.forEach((p: any) => (totals[p.id] = 0));
      const timeline: { pid: string; date: number; scored: number; bust: boolean; atc: boolean }[] = [];
      players.forEach((p: any) => (p.visits || []).forEach((v: any) => timeline.push({ pid: p.id, date: new Date(v.date || 0).getTime(), scored: v.scored || 0, bust: !!v.bust, atc: !!v.atc })));
      timeline.sort((a, b) => a.date - b.date);
      let winnerScored = 0;
      for (const ev of timeline) {
        if (ev.bust || ev.atc) continue;
        const leaderScored = Math.max(...players.map((p: any) => totals[p.id] || 0));
        if (ev.pid === winner.id && winnerScored + 50 <= leaderScored) trailedBy50 = true;
        totals[ev.pid] = (totals[ev.pid] || 0) + ev.scored;
        if (ev.pid === winner.id) winnerScored += ev.scored;
      }
      if (hadBigVisit || trailedBy50) return winner.id;
      return null;
    } },
  { id: 'b_clutch', name: 'Clutch', desc: 'Checked out the winning leg from 100+ remaining', icon: '🏆', kind: 'post-game',
    pick: (game) => {
      if (!game || game.practice || game.atc) return null;
      if (!game.winner) return null;
      const winner = (game.players || []).find((p: any) => p.id === game.winner);
      if (!winner) return null;
      const checkout = (winner.visits || []).find((v: any) => v.remaining === 0 && !v.bust);
      if (checkout && (checkout.checkout || 0) >= 100) return winner.id;
      return null;
    } },
];

function pickExtreme(game: any, score: (pl: any) => number, mode: 'max' | 'min'): string | string[] | null {
  const players = (game?.players || []).filter((p: any) => (p.visits || []).length > 0);
  if (players.length < 2) return null;
  const scored = players.map((p: any) => ({ id: p.id, n: score(p) }));
  if (mode === 'max') {
    const max = Math.max(...scored.map((s) => s.n));
    if (max <= 0) return null;
    const winners = scored.filter((s) => s.n === max);
    return winners.length === 1 ? winners[0].id : winners.map((w) => w.id);
  }
  const min = Math.min(...scored.map((s) => s.n));
  const winners = scored.filter((s) => s.n === min);
  return winners.length === 1 ? winners[0].id : winners.map((w) => w.id);
}

export function getBadgeInfo(badgeId: string | null | undefined): BadgeDef | undefined {
  if (!badgeId) return undefined;
  return BADGES.find((b) => b.id === badgeId);
}

export function computeGameBadges(game: any): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const pl of game.players || []) {
    out[pl.id] = [];
  }
  // Solo games (playing against yourself) don't earn badges — there's no
  // opponent to compete against, so comparative awards are meaningless.
  if ((game?.players || []).length < 2) return out;
  for (const badge of BADGES) {
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

// Lifetime per-badge counts: how many times each badge was earned across all
// of a player's games. A badge earned in a match counts once per match.
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
