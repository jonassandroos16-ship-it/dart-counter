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
  // Optional context value shown alongside the badge icon when equipped.
  // Returns the lifetime aggregate for this player across the given games
  // (e.g. total kills, lifetime high score). Return null/undefined to hide.
  context?: (playerId: string, games: any[]) => number | string | null;
  // Short label describing what the context value represents (used in UI).
  contextLabel?: string;
}

const dartsOf = (visits: any[]) => visits.flatMap((v: any) => v.darts || []);

const isBull = (d: any) => d.value === 50 || d.value === 25;
const isMiss = (d: any) => d.value === 0;

// Aggregate a numeric stat across all of a player's competitive games.
// `gameSelector` returns the per-game number; we sum (sum=true) or take the
// max (sum=false) across games.
function aggregate(
  playerId: string,
  games: any[],
  gameSelector: (game: any, playerVisits: any[]) => number,
  sum = false,
): number {
  let acc = 0;
  for (const g of games || []) {
    if (!g || !g.players) continue;
    const pl = (g.players as any[]).find((p) => p.id === playerId);
    if (!pl) continue;
    const v = gameSelector(g, pl.visits || []);
    if (sum) acc += v;
    else acc = Math.max(acc, v);
  }
  return acc;
}

// Total kills across all killer-mode games for this player.
export function lifetimeKills(playerId: string, games: any[]): number {
  return (games || []).reduce((acc: number, g: any) => {
    if (!g || !g.players || g.mode !== 'killer') return acc;
    const pl = (g.players as any[]).find((p) => p.id === playerId);
    return acc + ((pl?.kills as string[])?.length || 0);
  }, 0);
}

// Lifetime high score (best single visit) across all competitive games.
export function lifetimeHighScore(playerId: string, games: any[]): number {
  return aggregate(playerId, games, (_g, visits) =>
    Math.max(0, ...visits.filter((v: any) => !v.bust && !v.atc).map((v: any) => v.scored || 0)),
  );
}

// Lifetime total busts.
export function lifetimeBusts(playerId: string, games: any[]): number {
  return aggregate(playerId, games, (_g, visits) =>
    visits.filter((v: any) => v.bust).length, true,
  );
}

// Lifetime total missed darts (value === 0).
export function lifetimeMisses(playerId: string, games: any[]): number {
  return aggregate(playerId, games, (_g, visits) =>
    dartsOf(visits).filter(isMiss).length, true,
  );
}

// Lifetime total 180s.
export function lifetime180s(playerId: string, games: any[]): number {
  return aggregate(playerId, games, (_g, visits) =>
    visits.filter((v: any) => !v.bust && !v.atc && v.scored === 180).length, true,
  );
}

// Lifetime total triples landed.
export function lifetimeTriples(playerId: string, games: any[]): number {
  return aggregate(playerId, games, (_g, visits) =>
    dartsOf(visits).filter((d: any) => d.mult === 3).length, true,
  );
}

// Lifetime high checkout.
export function lifetimeHighCheckout(playerId: string, games: any[]): number {
  return aggregate(playerId, games, (_g, visits) => {
    const checkouts = visits.filter((v: any) => v.remaining === 0 && !v.bust);
    return Math.max(0, ...checkouts.map((v: any) => v.scored || 0));
  });
}

// Lifetime total darts thrown.
export function lifetimeDartsThrown(playerId: string, games: any[]): number {
  return aggregate(playerId, games, (_g, visits) => dartsOf(visits).length, true);
}

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
    check: (v) => v.some((visit: any) => !visit.bust && !visit.atc && visit.scored === 180),
    context: lifetime180s, contextLabel: '180s' },
  { id: 'b_hat_trick', name: 'Hat Trick', desc: 'Hit 3 bulls in one visit', icon: '🎩', kind: 'in-game',
    check: (v) => v.some((visit: any) => (visit.darts || []).filter(isBull).length >= 3) },
  { id: 'b_triple_triple', name: 'Triple Triple', desc: 'Land 3 triples in one visit', icon: '🥞', kind: 'in-game',
    check: (v) => v.some((visit: any) => (visit.darts || []).filter((d: any) => d.mult === 3).length >= 3) },
  { id: 'b_double_dip', name: 'Double Dip', desc: 'Land 3 doubles in one visit', icon: '💠', kind: 'in-game',
    check: (v) => v.some((visit: any) => (visit.darts || []).filter((d: any) => d.mult === 2).length >= 3) },
  { id: 'b_buster', name: 'Buster', desc: 'Bust at least once', icon: '😵', kind: 'in-game',
    check: (v) => v.some((visit: any) => visit.bust),
    context: lifetimeBusts, contextLabel: 'busts' },
  { id: 'b_shark', name: 'Shark', desc: 'Hit 5+ triples in the game', icon: '🦈', kind: 'in-game',
    check: (v) => dartsOf(v).filter((d: any) => d.mult === 3).length >= 5,
    context: lifetimeTriples, contextLabel: 'triples' },
  { id: 'b_first_blood', name: 'First Blood', desc: 'Be the first player to check out a leg', icon: '🩸', kind: 'in-game',
    check: (v, game) => {
      if (!game || game.practice || game.atc) return false;
      // Only meaningful in multi-leg matches — a single-leg match has no
      // "first" checkout distinct from the only one.
      if (!game.legsBestOf || game.legsBestOf <= 1) return false;
      let earliest: { pid: string; date: number } | null = null;
      for (const pl of game.players || []) {
        for (const visit of pl.visits || []) {
          if (visit.remaining === 0 && !visit.bust) {
            const t = new Date(visit.date || 0).getTime();
            if (!earliest || t < earliest.date) earliest = { pid: pl.id, date: t };
          }
        }
      }
      if (!earliest) return false;
      // Award only the player who actually checked out first.
      return v.some((visit: any) => visit.remaining === 0 && !visit.bust &&
        new Date(visit.date || 0).getTime() === earliest!.date);
    } },

  // ============ Post-game (comparative — one winner per badge) ============
  { id: 'b_most_misses', name: 'Wild Throw', desc: 'Missed the most darts in the game', icon: '🌪️', kind: 'post-game',
    pick: (game) => pickExtreme(game, (pl) => dartsOf(pl.visits || []).filter(isMiss).length, 'max'),
    context: lifetimeMisses, contextLabel: 'misses' },
  { id: 'b_most_busts', name: 'Bust Master', desc: 'Busted the most times in the game', icon: '🚫', kind: 'post-game',
    pick: (game) => pickExtreme(game, (pl) => (pl.visits || []).filter((v: any) => v.bust).length, 'max'),
    context: lifetimeBusts, contextLabel: 'busts' },
  { id: 'b_highest_score', name: 'Top Scorer', desc: 'Had the highest single-visit score', icon: '📈', kind: 'post-game',
    pick: (game) => pickExtreme(game, (pl) => Math.max(0, ...(pl.visits || []).filter((v: any) => !v.bust && !v.atc).map((v: any) => v.scored || 0)), 'max'),
    context: lifetimeHighScore, contextLabel: 'high score' },
  { id: 'b_most_darts', name: 'Marathon', desc: 'Threw the most darts in the game', icon: '🏃', kind: 'post-game',
    pick: (game) => pickExtreme(game, (pl) => dartsOf(pl.visits || []).length, 'max'),
    context: lifetimeDartsThrown, contextLabel: 'darts' },
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
      players.forEach((p: any) => (p.visits || []).forEach((v: any) => timeline.push({ pid: p.id, date: new Date(v.date || 0).getTime(), scored: v.scored || 0, bust: !!v.bust, atc: !!v.atc }))));
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
    },
    context: lifetimeHighCheckout, contextLabel: 'high checkout' },

  // ============ Killer mode ============
  { id: 'b_slayer', name: 'Slayer', desc: 'Eliminate at least one opponent in a Killer game', icon: '💀', kind: 'post-game',
    pick: (game) => {
      if (!game || game.mode !== 'killer') return null;
      const slayers = (game.players || []).filter((p: any) => (p.kills || []).length >= 1);
      if (!slayers.length) return null;
      return slayers.length === 1 ? slayers[0].id : slayers.map((p: any) => p.id);
    },
    context: lifetimeKills, contextLabel: 'kills' },
];

function pickExtreme(game: any, score: (pl: any) => number, mode: 'max' | 'min'): string | string[] | null {
  const players = (game?.players || []).filter((p: any) => (p.visits || []).length > 0);
  if (players.length < 2) return null;
  const scored = players.map((p: any) => ({ id: p.id, n: score(p) }));
  if (mode === 'max') {
    const max = Math.max(...scored.map((s: { id: string; n: number }) => s.n));
    if (max <= 0) return null;
    const winners = scored.filter((s: { id: string; n: number }) => s.n === max);
    return winners.length === 1 ? winners[0].id : winners.map((w: { id: string; n: number }) => w.id);
  }
  const min = Math.min(...scored.map((s: { id: string; n: number }) => s.n));
  const winners = scored.filter((s: { id: string; n: number }) => s.n === min);
  return winners.length === 1 ? winners[0].id : winners.map((w: { id: string; n: number }) => w.id);
}

export function getBadgeInfo(badgeId: string | null | undefined): BadgeDef | undefined {
  if (!badgeId) return undefined;
  return BADGES.find((b) => b.id === badgeId);
}

// Computes the context value to display for a player's equipped badge.
// Returns null when the badge has no context function or the value is 0/empty.
export function getBadgeContext(
  badgeId: string | null | undefined,
  playerId: string,
  games: any[],
): { value: number | string; label: string } | null {
  if (!badgeId) return null;
  const b = getBadgeInfo(badgeId);
  if (!b || !b.context) return null;
  try {
    const v = b.context(playerId, games || []);
    if (v == null) return null;
    if (typeof v === 'number' && v <= 0) return null;
    if (typeof v === 'string' && !v) return null;
    return { value: v, label: b.contextLabel || '' };
  } catch {
    return null;
  }
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
