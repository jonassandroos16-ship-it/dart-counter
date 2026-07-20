export const dartsOf = (visits: any[]) => visits.flatMap((v: any) => v.darts || []);

export const isBull = (d: any) => d.value === 50 || d.value === 25;
export const isMiss = (d: any) => d.value === 0;

export function aggregate(
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

export function pickExtreme(game: any, score: (pl: any) => number, mode: 'max' | 'min'): string | string[] | null {
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

const PU_FLAG_MAP: Record<string, string> = {
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

export function pickPowerUpWinner(game: any, puId: string): string | null {
  if (!game || !game.powerUpsEnabled || !game.winner) return null;
  const w = (game.players || []).find((p: any) => p.id === game.winner);
  if (!w) return null;
  const used = (w as any).usedPowerUp === puId || (w as any)[PU_FLAG_MAP[puId]] === true;
  return used ? game.winner : null;
}

export function lifetimePowerUpWins(playerId: string, games: any[], puId: string): number {
  let acc = 0;
  for (const g of games || []) {
    if (!g || !g.powerUpsEnabled || !g.winner || g.winner !== playerId) continue;
    const w = (g.players || []).find((p: any) => p.id === playerId);
    if (!w) continue;
    if ((w as any).usedPowerUp === puId || (w as any)[PU_FLAG_MAP[puId]] === true) acc++;
  }
  return acc;
}
