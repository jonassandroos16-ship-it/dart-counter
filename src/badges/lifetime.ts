import { dartsOf, isBull, isMiss, aggregate, lifetimePowerUpWins } from './helpers';

export function lifetimeKills(playerId: string, games: any[]): number {
  return (games || []).reduce((acc: number, g: any) => {
    if (!g || !g.players || g.mode !== 'killer') return acc;
    const pl = (g.players as any[]).find((p) => p.id === playerId);
    return acc + ((pl?.kills as string[])?.length || 0);
  }, 0);
}

export function lifetimeHighScore(playerId: string, games: any[]): number {
  return aggregate(playerId, games, (_g, visits) =>
    Math.max(0, ...visits.filter((v: any) => !v.bust && !v.atc).map((v: any) => v.scored || 0)),
  );
}

export function lifetimeBusts(playerId: string, games: any[]): number {
  return aggregate(playerId, games, (_g, visits) =>
    visits.filter((v: any) => v.bust).length, true,
  );
}

export function lifetimeMisses(playerId: string, games: any[]): number {
  return aggregate(playerId, games, (_g, visits) =>
    dartsOf(visits).filter(isMiss).length, true,
  );
}

export function lifetime180s(playerId: string, games: any[]): number {
  return aggregate(playerId, games, (_g, visits) =>
    visits.filter((v: any) => !v.bust && !v.atc && v.scored === 180).length, true,
  );
}

export function lifetimeTriples(playerId: string, games: any[]): number {
  return aggregate(playerId, games, (_g, visits) =>
    dartsOf(visits).filter((d: any) => d.mult === 3).length, true,
  );
}

export function lifetimeHighCheckout(playerId: string, games: any[]): number {
  return aggregate(playerId, games, (_g, visits) => {
    const checkouts = visits.filter((v: any) => v.remaining === 0 && !v.bust);
    return Math.max(0, ...checkouts.map((v: any) => v.scored || 0));
  });
}

export function lifetimeDartsThrown(playerId: string, games: any[]): number {
  return aggregate(playerId, games, (_g, visits) => dartsOf(visits).length, true);
}

export function lifetimeBulls(playerId: string, games: any[]): number {
  return aggregate(playerId, games, (_g, visits) => dartsOf(visits).filter(isBull).length, true);
}

export function lifetime20s(playerId: string, games: any[]): number {
  return aggregate(playerId, games, (_g, visits) => dartsOf(visits).filter((d: any) => d.base === 20).length, true);
}

export function lifetimeClassic26(playerId: string, games: any[]): number {
  return aggregate(playerId, games, (_g, visits) => visits.filter((v: any) => {
    if (v.bust || v.atc) return false;
    const darts = v.darts || [];
    if (darts.length !== 3) return false;
    const bases = darts.map((d: any) => d.base).sort((a: number, b: number) => a - b);
    return bases[0] === 1 && bases[1] === 5 && bases[2] === 20 && v.scored === 26;
  }).length, true);
}

export function lifetimeTons(playerId: string, games: any[]): number {
  return aggregate(playerId, games, (_g, visits) =>
    visits.filter((v: any) => !v.bust && !v.atc && v.scored >= 100 && v.scored < 140).length, true);
}

export function lifetimeBigTons(playerId: string, games: any[]): number {
  return aggregate(playerId, games, (_g, visits) =>
    visits.filter((v: any) => !v.bust && !v.atc && v.scored >= 140 && v.scored < 180).length, true);
}

export function lifetimeHatTricks(playerId: string, games: any[]): number {
  return aggregate(playerId, games, (_g, visits) =>
    visits.filter((v: any) => (v.darts || []).filter(isBull).length >= 3).length, true);
}

export function lifetimeTripleTriples(playerId: string, games: any[]): number {
  return aggregate(playerId, games, (_g, visits) =>
    visits.filter((v: any) => (v.darts || []).filter((d: any) => d.mult === 3).length >= 3).length, true);
}

export function lifetimeDoubleDips(playerId: string, games: any[]): number {
  return aggregate(playerId, games, (_g, visits) =>
    visits.filter((v: any) => (v.darts || []).filter((d: any) => d.mult === 2).length >= 3).length, true);
}

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

export function lifetimeFullyCharged(playerId: string, games: any[]): number {
  return aggregate(playerId, games, (_g, _visits) => {
    const pl = (_g.players as any[])?.find((p) => p.id === playerId);
    if (!pl) return 0;
    return (pl.powerUpCharge || 0) >= 100 || (pl.powerUpUses || 0) > 0 ? 1 : 0;
  }, true);
}

export function lifetimeUnleashed(playerId: string, games: any[]): number {
  return aggregate(playerId, games, (_g, _visits) => {
    const pl = (_g.players as any[])?.find((p) => p.id === playerId);
    if (!pl) return 0;
    return pl.powerUpUsed || (pl.powerUpUses || 0) > 0 ? 1 : 0;
  }, true);
}

export { lifetimePowerUpWins };
