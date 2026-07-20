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
  context?: (playerId: string, games: any[], ctx?: any) => number | string | null;
  // Short label describing what the context value represents (used in UI).
  contextLabel?: string;
  // When true, this badge is only awarded in matches where power ups were
  // enabled. When false (default), the badge is only awarded in standard
  // (non-power-up) matches. This keeps the two pools mutually exclusive so
  // power-up games surface their own dedicated badge set.
  powerUpOnly?: boolean;
  // When true, this badge is a Co-op Campaign badge. It is never earned from
  // a game record; instead its `context` function reads from the campaign
  // progress / coop stats passed via the ctx parameter.
  coopOnly?: boolean;
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

// Lifetime total bull hits (25 or 50).
export function lifetimeBulls(playerId: string, games: any[]): number {
  return aggregate(playerId, games, (_g, visits) => dartsOf(visits).filter(isBull).length, true);
}

// Lifetime total hits on the 20 segment.
export function lifetime20s(playerId: string, games: any[]): number {
  return aggregate(playerId, games, (_g, visits) => dartsOf(visits).filter((d: any) => d.base === 20).length, true);
}

// Lifetime total "Classic 26" visits (20+1+5 = 26).
export function lifetimeClassic26(playerId: string, games: any[]): number {
  return aggregate(playerId, games, (_g, visits) => visits.filter((v: any) => {
    if (v.bust || v.atc) return false;
    const darts = v.darts || [];
    if (darts.length !== 3) return false;
    const bases = darts.map((d: any) => d.base).sort((a: number, b: number) => a - b);
    return bases[0] === 1 && bases[1] === 5 && bases[2] === 20 && v.scored === 26;
  }).length, true);
}

// Lifetime total "Ton" visits (100+).
export function lifetimeTons(playerId: string, games: any[]): number {
  return aggregate(playerId, games, (_g, visits) =>
    visits.filter((v: any) => !v.bust && !v.atc && v.scored >= 100 && v.scored < 140).length, true);
}

// Lifetime total "Big Ton" visits (140+).
export function lifetimeBigTons(playerId: string, games: any[]): number {
  return aggregate(playerId, games, (_g, visits) =>
    visits.filter((v: any) => !v.bust && !v.atc && v.scored >= 140 && v.scored < 180).length, true);
}

// Lifetime total hat tricks (3 bulls in one visit).
export function lifetimeHatTricks(playerId: string, games: any[]): number {
  return aggregate(playerId, games, (_g, visits) =>
    visits.filter((v: any) => (v.darts || []).filter(isBull).length >= 3).length, true);
}

// Lifetime total "Triple Triple" visits (3 triples in one visit).
export function lifetimeTripleTriples(playerId: string, games: any[]): number {
  return aggregate(playerId, games, (_g, visits) =>
    visits.filter((v: any) => (v.darts || []).filter((d: any) => d.mult === 3).length >= 3).length, true);
}

// Lifetime total "Double Dip" visits (3 doubles in one visit).
export function lifetimeDoubleDips(playerId: string, games: any[]): number {
  return aggregate(playerId, games, (_g, visits) =>
    visits.filter((v: any) => (v.darts || []).filter((d: any) => d.mult === 2).length >= 3).length, true);
}

// Lifetime total "First Blood" awards (first to check out a leg in a multi-leg match).
export function lifetimeFirstBloods(playerId: string, games: any[]): number {
  let acc = 0;
  for (const g of games || []) {
    if (!g || !g.players || g.practice || g.atc) continue;
    if (!g.legsBestOf || g.legsBestOf <= 1) continue;
    if (!(g.players as any[]).some((p) => p.id === playerId)) continue;
    let earliest: { pid: string; date: number } | null = null;
    for (const pl of g.players || []) {
      for (const visit of pl.visits || []) {
        if (visit.remaining === 0 && !visit.bust) {
          const t = new Date(visit.date || 0).getTime();
          if (!earliest || t < earliest.date) earliest = { pid: pl.id, date: t };
        }
      }
    }
    if (earliest && earliest.pid === playerId) acc++;
  }
  return acc;
}

// Lifetime total "Comeback Kid" awards.
export function lifetimeComebacks(playerId: string, games: any[]): number {
  let acc = 0;
  for (const g of games || []) {
    if (!g || !g.players || g.practice || g.atc) continue;
    if (!g.winner || g.winner !== playerId) continue;
    const winner = (g.players as any[]).find((p) => p.id === g.winner);
    if (!winner) continue;
    const hadBigVisit = (winner.visits || []).some((v: any) => !v.bust && !v.atc && v.scored >= 150);
    const players = g.players || [];
    let trailedBy50 = false;
    const totals: Record<string, number> = {};
    players.forEach((p: any) => (totals[p.id] = 0));
    const timeline: { pid: string; date: number; scored: number; bust: boolean; atc: boolean }[] = [];
    players.forEach((p: any) => (p.visits || []).forEach(function (v: any) {
      timeline.push({ pid: p.id, date: new Date(v.date || 0).getTime(), scored: v.scored || 0, bust: !!v.bust, atc: !!v.atc });
    }));
    timeline.sort((a, b) => a.date - b.date);
    let winnerScored = 0;
    for (const ev of timeline) {
      if (ev.bust || ev.atc) continue;
      const leaderScored = Math.max(...players.map((p: any) => totals[p.id] || 0));
      if (ev.pid === winner.id && winnerScored + 50 <= leaderScored) trailedBy50 = true;
      totals[ev.pid] = (totals[ev.pid] || 0) + ev.scored;
      if (ev.pid === winner.id) winnerScored += ev.scored;
    }
    if (hadBigVisit || trailedBy50) acc++;
  }
  return acc;
}

// Lifetime total "Fully Charged" awards (power-up matches where orb reached full).
export function lifetimeFullyCharged(playerId: string, games: any[]): number {
  return aggregate(playerId, games, (_g, _visits) => {
    const pl = (_g.players as any[])?.find((p) => p.id === playerId);
    if (!pl) return 0;
    return (pl.powerUpCharge || 0) >= 100 || (pl.powerUpUses || 0) > 0 ? 1 : 0;
  }, true);
}

// Lifetime total "Unleashed" awards (power-up matches where power-up was activated).
export function lifetimeUnleashed(playerId: string, games: any[]): number {
  return aggregate(playerId, games, (_g, _visits) => {
    const pl = (_g.players as any[])?.find((p) => p.id === playerId);
    if (!pl) return 0;
    return pl.powerUpUsed || (pl.powerUpUses || 0) > 0 ? 1 : 0;
  }, true);
}

// Lifetime count of power-up matches won after activating a given power-up.
function lifetimePowerUpWins(playerId: string, games: any[], puId: string): number {
  let acc = 0;
  for (const g of games || []) {
    if (!g || !g.powerUpsEnabled || !g.winner || g.winner !== playerId) continue;
    const w = (g.players || []).find((p: any) => p.id === playerId);
    if (!w) continue;
    const flagMap: Record<string, string> = {
      pu_blocker: '_usedBlocker',
      pu_surge: '_usedSurge',
      pu_steal: '_usedSteal',
      pu_freeze: '_usedFreeze',
      pu_reroll: '_usedReroll',
      pu_lucky_miss: '_usedLuckyMiss',
      pu_fourth_dart: '_usedFourthDart',
      pu_rethrow: '_usedRethrow',
      pu_cripple: '_usedCripple',
    };
    if ((w as any).usedPowerUp === puId || (w as any)[flagMap[puId]] === true) acc++;
  }
  return acc;
}

export const BADGES: BadgeDef[] = [
  // ============ In-game (per player) ============
  { id: 'b_hit_bull', name: 'Hit Bull', desc: 'Hit any bull (25 or 50) during the game', icon: '🎯', kind: 'in-game',
    check: (v) => dartsOf(v).some(isBull),
    context: lifetimeBulls, contextLabel: 'bulls' },
  { id: 'b_hit_20', name: 'Hit 20', desc: 'Hit a 20 segment during the game', icon: '💥', kind: 'in-game',
    check: (v) => dartsOf(v).some((d: any) => d.base === 20),
    context: lifetime20s, contextLabel: '20s' },
  { id: 'b_classic_26', name: 'Classic 26', desc: 'Score a 26 with 20, 1, 5 in a single visit', icon: '🃏', kind: 'in-game',
    check: (v) => v.some((visit: any) => {
      if (visit.bust || visit.atc) return false;
      const darts = visit.darts || [];
      if (darts.length !== 3) return false;
      const bases = darts.map((d: any) => d.base).sort((a: number, b: number) => a - b);
      return bases[0] === 1 && bases[1] === 5 && bases[2] === 20 && visit.scored === 26;
    }),
    context: lifetimeClassic26, contextLabel: '26s' },
  { id: 'b_ton', name: 'Ton', desc: 'Score 100+ in a single visit', icon: '💯', kind: 'in-game',
    check: (v) => v.some((visit: any) => !visit.bust && !visit.atc && visit.scored >= 100),
    context: lifetimeTons, contextLabel: 'tons' },
  { id: 'b_ton40', name: 'Big Ton', desc: 'Score 140+ in a single visit', icon: '🔥', kind: 'in-game',
    check: (v) => v.some((visit: any) => !visit.bust && !visit.atc && visit.scored >= 140),
    context: lifetimeBigTons, contextLabel: 'big tons' },
  { id: 'b_ton80', name: 'Maximum', desc: 'Score a 180', icon: '💥', kind: 'in-game',
    check: (v) => v.some((visit: any) => !visit.bust && !visit.atc && visit.scored === 180),
    context: lifetime180s, contextLabel: '180s' },
  { id: 'b_hat_trick', name: 'Hat Trick', desc: 'Hit 3 bulls in one visit', icon: '🎩', kind: 'in-game',
    check: (v) => v.some((visit: any) => (visit.darts || []).filter(isBull).length >= 3),
    context: lifetimeHatTricks, contextLabel: 'hat tricks' },
  { id: 'b_triple_triple', name: 'Triple Triple', desc: 'Land 3 triples in one visit', icon: '🥞', kind: 'in-game',
    check: (v) => v.some((visit: any) => (visit.darts || []).filter((d: any) => d.mult === 3).length >= 3),
    context: lifetimeTripleTriples, contextLabel: 'triple-triples' },
  { id: 'b_double_dip', name: 'Double Dip', desc: 'Land 3 doubles in one visit', icon: '💠', kind: 'in-game',
    check: (v) => v.some((visit: any) => (visit.darts || []).filter((d: any) => d.mult === 2).length >= 3),
    context: lifetimeDoubleDips, contextLabel: 'double dips' },
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
    },
    context: lifetimeFirstBloods, contextLabel: 'first bloods' },

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
      players.forEach((p: any) => (p.visits || []).forEach(function (v: any) { timeline.push({ pid: p.id, date: new Date(v.date || 0).getTime(), scored: v.scored || 0, bust: !!v.bust, atc: !!v.atc }); }));
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
    },
    context: lifetimeComebacks, contextLabel: 'comebacks' },
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

  // ============ Power-up matches (only awarded when powerUpsEnabled) ============
  { id: 'b_power_charged', name: 'Fully Charged', desc: 'Charge your power-up to full during a power-up match', icon: '🔋', kind: 'post-game', powerUpOnly: true,
    pick: (game) => {
      if (!game || !game.powerUpsEnabled) return null;
      // A player counts as "fully charged" if their orb reached the
      // activation threshold. Since the orb is capped at the per-power-up
      // threshold, having activated (uses > 0) implies it was full. We also
      // count players still sitting on a full 100% orb (legacy default).
      const charged = (game.players || []).filter((p: any) => (p.powerUpCharge || 0) >= 100 || (p.powerUpUses || 0) > 0).map((p: any) => p.id);
      if (!charged.length) return null;
      return charged.length === 1 ? charged[0] : charged;
    },
    context: lifetimeFullyCharged, contextLabel: 'charges' },
  { id: 'b_power_used', name: 'Unleashed', desc: 'Activate your equipped power-up during a power-up match', icon: '⚡', kind: 'post-game', powerUpOnly: true,
    pick: (game) => {
      if (!game || !game.powerUpsEnabled) return null;
      const used = (game.players || []).filter((p: any) => p.powerUpUsed || (p.powerUpUses || 0) > 0).map((p: any) => p.id);
      if (!used.length) return null;
      return used.length === 1 ? used[0] : used;
    },
    context: lifetimeUnleashed, contextLabel: 'activations' },
  { id: 'b_power_blocker', name: 'Wall Builder', desc: 'Win a power-up match after activating Blocker', icon: '🛡️', kind: 'post-game', powerUpOnly: true,
    pick: (game) => pickPowerUpWinner(game, 'pu_blocker'),
    context: (pid, games) => lifetimePowerUpWins(pid, games, 'pu_blocker'), contextLabel: 'wins' },
  { id: 'b_power_surge', name: 'Surge Rider', desc: 'Win a power-up match after activating Surge', icon: '⚡', kind: 'post-game', powerUpOnly: true,
    pick: (game) => pickPowerUpWinner(game, 'pu_surge'),
    context: (pid, games) => lifetimePowerUpWins(pid, games, 'pu_surge'), contextLabel: 'wins' },
  { id: 'b_power_steal', name: 'Thief', desc: 'Win a power-up match after activating Steal', icon: '🥷', kind: 'post-game', powerUpOnly: true,
    pick: (game) => pickPowerUpWinner(game, 'pu_steal'),
    context: (pid, games) => lifetimePowerUpWins(pid, games, 'pu_steal'), contextLabel: 'wins' },
  { id: 'b_power_freeze', name: 'Cold Snap', desc: 'Win a power-up match after activating Freeze', icon: '❄️', kind: 'post-game', powerUpOnly: true,
    pick: (game) => pickPowerUpWinner(game, 'pu_freeze'),
    context: (pid, games) => lifetimePowerUpWins(pid, games, 'pu_freeze'), contextLabel: 'wins' },
  { id: 'b_power_reroll', name: 'Lucky Hand', desc: 'Win a power-up match after activating Reroll', icon: '🎲', kind: 'post-game', powerUpOnly: true,
    pick: (game) => pickPowerUpWinner(game, 'pu_reroll'),
    context: (pid, games) => lifetimePowerUpWins(pid, games, 'pu_reroll'), contextLabel: 'wins' },
  { id: 'b_power_lucky', name: 'Saved', desc: 'Win a power-up match after activating Lucky Miss', icon: '🍀', kind: 'post-game', powerUpOnly: true,
    pick: (game) => pickPowerUpWinner(game, 'pu_lucky_miss'),
    context: (pid, games) => lifetimePowerUpWins(pid, games, 'pu_lucky_miss'), contextLabel: 'wins' },
  { id: 'b_power_fourth', name: 'Quad Squad', desc: 'Win a power-up match after activating Fourth Dart', icon: '🎯', kind: 'post-game', powerUpOnly: true,
    pick: (game) => pickPowerUpWinner(game, 'pu_fourth_dart'),
    context: (pid, games) => lifetimePowerUpWins(pid, games, 'pu_fourth_dart'), contextLabel: 'wins' },
  { id: 'b_power_rethrow', name: 'Second Chance', desc: 'Win a power-up match after activating Re-Throw', icon: '🔁', kind: 'post-game', powerUpOnly: true,
    pick: (game) => pickPowerUpWinner(game, 'pu_rethrow'),
    context: (pid, games) => lifetimePowerUpWins(pid, games, 'pu_rethrow'), contextLabel: 'wins' },
  { id: 'b_power_cripple', name: 'Saboteur', desc: 'Win a power-up match after activating Cripple', icon: '🦾', kind: 'post-game', powerUpOnly: true,
    pick: (game) => pickPowerUpWinner(game, 'pu_cripple'),
    context: (pid, games) => lifetimePowerUpWins(pid, games, 'pu_cripple'), contextLabel: 'wins' },

  // ============ Co-op Campaign ============
  // Coop badges are awarded based on the campaign progress stored under
  // `dc_campaign_progress`. Since campaign progress isn't tied to a specific
  // game record, these badges use the `context` function form to surface
  // the highest level beaten as the badge context value.
  { id: 'b_coop_first_clear', name: 'First Strike', desc: 'Clear your first Co-op Campaign level', icon: '🛡️', kind: 'in-game', coopOnly: true,
    check: (_v, _game) => false, // coop badges are never earned from a game record
    context: (_playerId, _games, ctx?: any) => (ctx?.campaignProgress?.highest_level_beaten || 0) >= 1 ? 1 : 0,
    contextLabel: 'levels' },
  { id: 'b_coop_boss_slayer', name: 'Boss Slayer', desc: 'Defeat a Co-op Campaign boss', icon: '☠️', kind: 'in-game', coopOnly: true,
    check: (_v, _game) => false,
    context: (_playerId, _games, ctx?: any) => (ctx?.campaignProgress?.highest_level_beaten || 0) >= 5 ? 1 : 0,
    contextLabel: 'boss' },
  { id: 'b_coop_healer', name: 'Field Medic', desc: 'Use the Heal power-up in a Co-op battle', icon: '❤️', kind: 'in-game', coopOnly: true,
    check: (_v, _game) => false,
    context: (_playerId, _games, ctx?: any) => (ctx?.coopStats?.healsUsed || 0),
    contextLabel: 'heals' },
  { id: 'b_coop_freezer', name: 'Cold Front', desc: 'Use the Freeze power-up in a Co-op battle', icon: '❄️', kind: 'in-game', coopOnly: true,
    check: (_v, _game) => false,
    context: (_playerId, _games, ctx?: any) => (ctx?.coopStats?.freezesUsed || 0),
    contextLabel: 'freezes' },
];

// Awards a power-up badge to the winner of a power-up match if they activated
// the given power-up. Works for both in-progress games (which carry `_usedX`
// flags on the player) and stored GameRecords (which carry `usedPowerUp`).
function pickPowerUpWinner(game: any, puId: string): string | null {
  if (!game || !game.powerUpsEnabled || !game.winner) return null;
  const w = (game.players || []).find((p: any) => p.id === game.winner);
  if (!w) return null;
  const flagMap: Record<string, string> = {
    pu_blocker: '_usedBlocker',
    pu_surge: '_usedSurge',
    pu_steal: '_usedSteal',
    pu_freeze: '_usedFreeze',
    pu_reroll: '_usedReroll',
    pu_lucky_miss: '_usedLuckyMiss',
    pu_fourth_dart: '_usedFourthDart',
    pu_rethrow: '_usedRethrow',
    pu_cripple: '_usedCripple',
  };
  const used = (w as any).usedPowerUp === puId || (w as any)[flagMap[puId]] === true;
  return used ? game.winner : null;
}

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

// Build the extra ctx object (campaign progress + coop stats) that coop
// badge context functions read from. Reads from localStorage so callers
// don't need to thread the data through manually.
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

export function computeGameBadges(game: any): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const pl of game.players || []) {
    out[pl.id] = [];
  }
  // Solo games (playing against yourself) don't earn badges — there's no
  // opponent to compete against, so comparative awards are meaningless.
  if ((game?.players || []).length < 2) return out;
  const powerUpsOn = !!(game && game.powerUpsEnabled);
  for (const badge of BADGES) {
    // Power-up-only badges only fire in power-up matches; standard badges
    // are disabled when power ups are on so the two pools stay separate.
    if (badge.powerUpOnly && !powerUpsOn) continue;
    if (!badge.powerUpOnly && powerUpsOn) continue;
    // Co-op Campaign badges are never earned from a game record.
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
