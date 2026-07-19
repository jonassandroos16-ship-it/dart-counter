import { describe, it, expect } from 'vitest';
import {
  checkoutHint,
  leadTrailBadge,
  visitAvg,
  visitAvgStatic,
  levelFromXP,
  getPlayerXP,
  getPlayerXPById,
  allVisitsFor,
  filterGamesByDate,
  playerStats,
  bucketAverages,
  createGame,
  recordFromGame,
  computeUnlockedTitlesForPlayer,
  retroUnlockAll,
  reconcilePlayerPoints,
} from './logic';
import { defaultSettings } from './constants';
import type { Game, GamePlayer, GameRecord, Player, Visit } from './types';

const settings = defaultSettings();

function makeVisit(scored: number, darts: number, opts: Partial<Visit> = {}): Visit {
  return {
    darts: Array.from({ length: darts }, () => ({ value: 0, label: '', base: 0, mult: 1, isDouble: false })),
    scored,
    date: opts.date ?? '2026-01-01T00:00:00.000Z',
    ...opts,
  };
}

function makeGamePlayer(id: string, score: number, visits: Visit[] = [], extra: Partial<GamePlayer> = {}): GamePlayer {
  return {
    id, name: id, color: '#22c55e', score, legsWon: 0, visits, idx: 0, dartsThrown: 0, done: false, ...extra,
  };
}

function makeGameRecord(id: string, players: GameRecord['players'], opts: Partial<GameRecord> = {}): GameRecord {
  return {
    id, date: opts.date ?? '2026-01-01T00:00:00.000Z', mode: '501', practice: false, atc: false,
    doubleOut: true, legsBestOf: 1, winner: null, tied: false, tiedPlayers: null, players, ...opts,
  };
}

describe('checkoutHint', () => {
  it('returns empty string for null remaining', () => {
    expect(checkoutHint(null, true)).toBe('');
  });

  it('returns empty string in practice mode', () => {
    expect(checkoutHint(40, true, true)).toBe('');
  });

  it('returns Bust! for negative remaining', () => {
    expect(checkoutHint(-5, true)).toBe('Bust!');
  });

  it('returns Checked out! for zero', () => {
    expect(checkoutHint(0, true)).toBe('Checked out!');
  });

  it('returns no-checkout message for 1 with double out', () => {
    expect(checkoutHint(1, true)).toBe('No checkout — bust risk');
  });

  it('suggests S1 for 1 with straight out', () => {
    expect(checkoutHint(1, false)).toBe('Checkout: S1');
  });

  it('returns no 3-dart checkout for >170', () => {
    expect(checkoutHint(180, true)).toBe('No 3-dart checkout — score to get ≤ 170');
  });

  it('uses curated checkout table for 170', () => {
    expect(checkoutHint(170, true)).toBe('Checkout: T20  T20  Bull');
  });

  it('uses curated checkout table for 40', () => {
    expect(checkoutHint(40, true)).toBe('Checkout: D20');
  });

  it('suggests straight-out finish for 25', () => {
    expect(checkoutHint(25, false)).toBe('Checkout: 25 (outer bull)');
  });

  it('suggests Bull for 50 straight out', () => {
    expect(checkoutHint(50, false)).toBe('Checkout: Bull');
  });

  it('suggests two singles for 31 straight out (not S31 or D16)', () => {
    expect(checkoutHint(31, false)).toBe('Checkout: S20 + S11');
  });

  it('suggests two singles for 21 straight out', () => {
    expect(checkoutHint(21, false)).toBe('Checkout: S20 + S1');
  });

  it('suggests two singles for 39 straight out', () => {
    expect(checkoutHint(39, false)).toBe('Checkout: S20 + S19');
  });

  it('returns generic message for 41 straight out (no two-single finish)', () => {
    expect(checkoutHint(41, false)).toBe('Checkout: 41 — score to finish');
  });

  it('returns no checkout message for unsupported double-out value', () => {
    expect(checkoutHint(169, true)).toBe('No checkout from 169');
  });
});

describe('leadTrailBadge', () => {
  it('returns empty for practice games', () => {
    const game = { practice: true, players: [makeGamePlayer('a', 100), makeGamePlayer('b', 90)] } as unknown as Game;
    expect(leadTrailBadge(game.players[0], game)).toBe('');
  });

  it('returns empty for single-player games', () => {
    const game = { practice: false, players: [makeGamePlayer('a', 100)] } as unknown as Game;
    expect(leadTrailBadge(game.players[0], game)).toBe('');
  });

  it('returns +N for the leader (lower score leads in darts)', () => {
    const game = { practice: false, players: [makeGamePlayer('a', 80), makeGamePlayer('b', 100)] } as unknown as Game;
    expect(leadTrailBadge(game.players[0], game)).toBe('+20');
  });

  it('returns empty string for the leader when tied with next', () => {
    const game = { practice: false, players: [makeGamePlayer('a', 100), makeGamePlayer('b', 100)] } as unknown as Game;
    expect(leadTrailBadge(game.players[0], game)).toBe('');
  });

  it('returns -N for trailer (higher score trails in darts)', () => {
    const game = { practice: false, players: [makeGamePlayer('a', 80), makeGamePlayer('b', 100)] } as unknown as Game;
    expect(leadTrailBadge(game.players[1], game)).toBe('-20');
  });
});

describe('visitAvg / visitAvgStatic', () => {
  it('returns 0 for no visits', () => {
    expect(visitAvg(makeGamePlayer('a', 501))).toBe(0);
    expect(visitAvgStatic({ visits: [] })).toBe(0);
  });

  it('computes per-visit average (scored/darts*3)', () => {
    const visits = [makeVisit(60, 3), makeVisit(45, 3)];
    const pl = makeGamePlayer('a', 396, visits);
    expect(visitAvg(pl)).toBeCloseTo((60 + 45) / 6 * 3, 5);
  });

  it('visitAvgStatic excludes bust visits', () => {
    const visits = [makeVisit(60, 3), makeVisit(0, 3, { bust: true })];
    expect(visitAvgStatic({ visits })).toBeCloseTo(60, 5);
  });
});

describe('levelFromXP', () => {
  it('starts at level 1 with 0 XP', () => {
    const r = levelFromXP(0, settings);
    expect(r.level).toBe(1);
    expect(r.xpIntoLevel).toBe(0);
  });

  it('levels up when XP exceeds threshold', () => {
    // baseLevelXp=100, levelMult=1.5 → L1 needs 100, L2 needs 150, L3 needs 225
    const r = levelFromXP(250, settings);
    expect(r.level).toBe(3);
    expect(r.xpIntoLevel).toBe(0);
  });

  it('partial XP into a level is tracked', () => {
    const r = levelFromXP(120, settings);
    expect(r.level).toBe(2);
    expect(r.xpIntoLevel).toBe(20);
    expect(r.xpNeeded).toBe(150);
  });
});

describe('getPlayerXP / getPlayerXPById', () => {
  it('returns defaults for undefined player', () => {
    const r = getPlayerXP(undefined);
    expect(r.xp).toBe(0);
    expect(r.level).toBe(1);
    expect(r.unlockedTitles).toEqual([]);
    expect(r.unlockedBadges).toEqual([]);
  });

  it('returns stored values for a player', () => {
    const player: Player = {
      id: 'p1', name: 'P1', color: '#000',
      xp: 250, level: 3,
      unlockedTitles: ['t1'], selectedTitle: 't1',
      unlockedBadges: ['b1'], badgeCounts: { b1: 2 }, selectedBadge: 'b1',
    };
    const r = getPlayerXP(player);
    expect(r.xp).toBe(250);
    expect(r.level).toBe(3);
    expect(r.unlockedTitles).toEqual(['t1']);
    expect(r.badgeCounts).toEqual({ b1: 2 });
  });

  it('getPlayerXPById looks up by id', () => {
    const players: Player[] = [
      { id: 'p1', name: 'P1', color: '#000', xp: 100 },
      { id: 'p2', name: 'P2', color: '#000', xp: 200 },
    ];
    expect(getPlayerXPById('p2', players).xp).toBe(200);
    expect(getPlayerXPById('missing', players).xp).toBe(0);
  });
});

describe('allVisitsFor', () => {
  it('aggregates visits across games for a player', () => {
    const games: GameRecord[] = [
      makeGameRecord('g1', [
        { id: 'p1', name: 'P1', color: '#000', legsWon: 0, dartsThrown: 3, visits: [makeVisit(60, 3, { gameId: 'g1' })] },
      ]),
      makeGameRecord('g2', [
        { id: 'p1', name: 'P1', color: '#000', legsWon: 0, dartsThrown: 3, visits: [makeVisit(45, 3, { gameId: 'g2' })] },
        { id: 'p2', name: 'P2', color: '#000', legsWon: 0, dartsThrown: 3, visits: [makeVisit(30, 3)] },
      ]),
    ];
    const visits = allVisitsFor('p1', games);
    expect(visits).toHaveLength(2);
    expect(visits[0].scored).toBe(60);
    expect(visits[1].scored).toBe(45);
  });

  it('returns empty for player not in any game', () => {
    const games: GameRecord[] = [makeGameRecord('g1', [])];
    expect(allVisitsFor('p1', games)).toEqual([]);
  });
});

describe('filterGamesByDate', () => {
  it('returns all games when filter is null', () => {
    const games: GameRecord[] = [makeGameRecord('g1', [], { date: '2026-01-01T00:00:00Z' })];
    expect(filterGamesByDate(games, null)).toBe(games);
  });

  it('filters by inclusive start, exclusive end', () => {
    const games: GameRecord[] = [
      makeGameRecord('g1', [], { date: '2026-01-01T00:00:00Z' }),
      makeGameRecord('g2', [], { date: '2026-01-02T00:00:00Z' }),
      makeGameRecord('g3', [], { date: '2026-01-03T00:00:00Z' }),
    ];
    const filtered = filterGamesByDate(games, { start: '2026-01-01T00:00:00Z', end: '2026-01-03T00:00:00Z' });
    expect(filtered.map(g => g.id)).toEqual(['g1', 'g2']);
  });
});

describe('playerStats', () => {
  it('returns zeros for a player with no games', () => {
    const stats = playerStats('p1', []);
    expect(stats.games).toBe(0);
    expect(stats.gamesWon).toBe(0);
    expect(stats.winRate).toBe(0);
    expect(stats.avg).toBe(0);
    expect(stats.n180).toBe(0);
  });

  it('counts solo games as games played but not competitive', () => {
    const games: GameRecord[] = [
      makeGameRecord('g1', [
        { id: 'p1', name: 'P1', color: '#000', legsWon: 1, dartsThrown: 6, visits: [makeVisit(60, 3), makeVisit(60, 3)] },
      ], { winner: 'p1' }),
    ];
    const stats = playerStats('p1', games);
    expect(stats.games).toBe(1);
    expect(stats.competitiveGames).toBe(0);
    expect(stats.gamesWon).toBe(0);
    expect(stats.avg).toBeCloseTo(60, 5);
  });

  it('counts competitive wins and ties', () => {
    const games: GameRecord[] = [
      makeGameRecord('g1', [
        { id: 'p1', name: 'P1', color: '#000', legsWon: 2, dartsThrown: 6, visits: [makeVisit(60, 3), makeVisit(60, 3)] },
        { id: 'p2', name: 'P2', color: '#000', legsWon: 0, dartsThrown: 6, visits: [makeVisit(30, 3), makeVisit(30, 3)] },
      ], { winner: 'p1' }),
      makeGameRecord('g2', [
        { id: 'p1', name: 'P1', color: '#000', legsWon: 1, dartsThrown: 6, visits: [makeVisit(40, 3)] },
        { id: 'p2', name: 'P2', color: '#000', legsWon: 1, dartsThrown: 6, visits: [makeVisit(40, 3)] },
      ], { tied: true, tiedPlayers: ['p1', 'p2'] }),
    ];
    const stats = playerStats('p1', games);
    expect(stats.competitiveGames).toBe(2);
    expect(stats.gamesWon).toBe(1);
    expect(stats.gamesTied).toBe(1);
    expect(stats.legsWon).toBe(3);
    expect(stats.winRate).toBeCloseTo(50, 5);
    expect(stats.tieRate).toBeCloseTo(50, 5);
  });

  it('counts 180s, 140s, and tons', () => {
    const games: GameRecord[] = [
      makeGameRecord('g1', [
        { id: 'p1', name: 'P1', color: '#000', legsWon: 0, dartsThrown: 9, visits: [
          makeVisit(180, 3), makeVisit(150, 3), makeVisit(120, 3), makeVisit(100, 3),
        ] },
        { id: 'p2', name: 'P2', color: '#000', legsWon: 0, dartsThrown: 9, visits: [makeVisit(30, 3)] },
      ]),
    ];
    const stats = playerStats('p1', games);
    expect(stats.n180).toBe(1);
    expect(stats.n140).toBe(1);
    expect(stats.tons).toBe(2);
    expect(stats.highScore).toBe(180);
  });

  it('records high checkout from finishing visits', () => {
    const games: GameRecord[] = [
      makeGameRecord('g1', [
        { id: 'p1', name: 'P1', color: '#000', legsWon: 1, dartsThrown: 6, visits: [
          makeVisit(60, 3, { remaining: 441 }),
          makeVisit(40, 3, { remaining: 0 }),
        ] },
        { id: 'p2', name: 'P2', color: '#000', legsWon: 0, dartsThrown: 6, visits: [makeVisit(30, 3)] },
      ], { winner: 'p1' }),
    ];
    const stats = playerStats('p1', games);
    expect(stats.highCheckout).toBe(40);
    expect(stats.legsFinished).toBe(1);
    expect(stats.finishMin).toBe(6);
  });
});

describe('bucketAverages', () => {
  it('returns empty for no visits', () => {
    expect(bucketAverages([], 'Daily')).toEqual({ labels: [], values: [] });
  });

  it('groups visits by day for Daily period', () => {
    const visits = [
      makeVisit(60, 3, { date: '2026-01-01T00:00:00Z', gameDate: '2026-01-01T00:00:00Z' }),
      makeVisit(90, 3, { date: '2026-01-01T00:00:00Z', gameDate: '2026-01-01T00:00:00Z' }),
      makeVisit(30, 3, { date: '2026-01-02T00:00:00Z', gameDate: '2026-01-02T00:00:00Z' }),
    ];
    const { labels, values } = bucketAverages(visits, 'Daily');
    expect(labels).toHaveLength(2);
    expect(values[0]).toBeCloseTo((60 + 90) / 6 * 3, 5);
    expect(values[1]).toBeCloseTo(30, 5);
  });
});

describe('createGame', () => {
  it('creates a 501 game with correct starting scores', () => {
    const players: Player[] = [
      { id: 'p1', name: 'P1', color: '#22c55e' },
      { id: 'p2', name: 'P2', color: '#3b82f6' },
    ];
    const game = createGame('501', ['p1', 'p2'], players, true, 3);
    expect(game.mode).toBe('501');
    expect(game.players).toHaveLength(2);
    expect(game.players[0].score).toBe(501);
    expect(game.players[1].score).toBe(501);
    expect(game.doubleOut).toBe(true);
    expect(game.legsBestOf).toBe(3);
    expect(game.finished).toBe(false);
    expect(game.winner).toBeNull();
  });

  it('forces single leg and no double-out for practice modes', () => {
    const players: Player[] = [{ id: 'p1', name: 'P1', color: '#22c55e' }];
    const game = createGame('practice', ['p1'], players, true, 5);
    expect(game.doubleOut).toBe(false);
    expect(game.legsBestOf).toBe(1);
    expect(game.practice).toBe(true);
  });

  it('sets up killer mode lives and numbers', () => {
    const players: Player[] = [
      { id: 'p1', name: 'P1', color: '#22c55e' },
      { id: 'p2', name: 'P2', color: '#3b82f6' },
    ];
    const game = createGame('killer', ['p1', 'p2'], players, false, 1);
    expect(game.players[0].lives).toBe(3);
    expect(game.players[0].eliminated).toBe(false);
    expect(game.players[0].killerNumber).toBeDefined();
    expect(game.players[1].killerNumber).toBeDefined();
    expect(game.players[0].killerNumber).not.toBe(game.players[1].killerNumber);
  });

  it('sets up team mode with team assignment', () => {
    const players: Player[] = [
      { id: 'p1', name: 'P1', color: '#22c55e' },
      { id: 'p2', name: 'P2', color: '#3b82f6' },
      { id: 'p3', name: 'P3', color: '#f59e0b' },
      { id: 'p4', name: 'P4', color: '#ef4444' },
    ];
    const game = createGame('501', ['p1', 'p2', 'p3', 'p4'], players, true, 1, true, [0, 0, 1, 1]);
    expect(game.teamMode).toBe(true);
    expect(game.teamCount).toBe(2);
    expect(game.players[0].team).toBe(0);
    expect(game.players[1].team).toBe(0);
    expect(game.players[2].team).toBe(1);
    expect(game.players[3].team).toBe(1);
    expect(game.teamLegsWon).toEqual([0, 0]);
  });
});

describe('recordFromGame', () => {
  it('maps a Game to a GameRecord with the right shape', () => {
    const players: Player[] = [{ id: 'p1', name: 'P1', color: '#22c55e' }];
    const game = createGame('501', ['p1'], players, true, 1);
    game.winner = 'p1';
    game.tied = false;
    const record = recordFromGame(game);
    expect(record.id).toBe(game.id);
    expect(record.mode).toBe('501');
    expect(record.winner).toBe('p1');
    expect(record.players[0].name).toBe('P1');
    expect(record.players[0].visits).toEqual([]);
  });
});

describe('retroUnlockAll / computeUnlockedTitlesForPlayer', () => {
  it('returns empty titles for a player with no games', () => {
    expect(computeUnlockedTitlesForPlayer('p1', [])).toEqual([]);
  });

  it('is idempotent — running twice does not change players', () => {
    const players: Player[] = [{ id: 'p1', name: 'P1', color: '#22c55e', unlockedTitles: [] }];
    const games: GameRecord[] = [];
    const first = retroUnlockAll(players, games);
    const second = retroUnlockAll(first.players, games);
    expect(second.changed).toBe(false);
    expect(second.players).toEqual(first.players);
  });

  it('does not crash with custom titles', () => {
    const customTitles = [{
      id: 'ct', name: 'Custom', desc: '', custom: true,
      condition: { type: 'sum', value: 1000 } as const,
    }];
    const games: GameRecord[] = [
      makeGameRecord('g1', [
        { id: 'p1', name: 'P1', color: '#000', legsWon: 1, dartsThrown: 3, visits: [makeVisit(1200, 3)] },
        { id: 'p2', name: 'P2', color: '#000', legsWon: 0, dartsThrown: 3, visits: [makeVisit(30, 3)] },
      ], { winner: 'p1' }),
    ];
    expect(() => computeUnlockedTitlesForPlayer('p1', games, customTitles)).not.toThrow();
  });
});

describe('reconcilePlayerPoints — health recalculation from base stats', () => {
  it('clamps NaN health to the configured starting value', () => {
    const player: Player = {
      id: 'p1', name: 'P1', color: '#000', level: 1,
      attributes: { health: NaN, armor: 0, power: 0, pointsAvailable: 0 },
    };
    const out = reconcilePlayerPoints(player, settings);
    expect(out.attributes?.health).toBe(settings.powerUpScaling.attributeStartHealth);
    expect(Number.isFinite(out.attributes?.health as number)).toBe(true);
  });

  it('recalculates health from base stats when old save exceeds available points', () => {
    // Old save: health=400 with base=300, perPoint=25 → 4 points "spent".
    // Player is level 1 with 0 attribute points, so they cannot have spent 4.
    // The reconciler should clamp the stored health to the starting value.
    const player: Player = {
      id: 'p1', name: 'P1', color: '#000', level: 1,
      attributes: { health: 400, armor: 0, power: 0, pointsAvailable: 0 },
    };
    const out = reconcilePlayerPoints(player, settings);
    expect(out.attributes?.health).toBe(settings.powerUpScaling.attributeStartHealth);
    expect(out.attributes?.pointsAvailable).toBe(0);
  });

  it('preserves legitimate health upgrades within available points', () => {
    // Level 3 → (3-1)*5 = 10 attribute points. Spending 2 on health → 300 + 2*25 = 350.
    // Level is derived from XP (source of truth), so set xp to reach level 3
    // (100 for level 1 + 150 for level 2 = 250 XP).
    const player: Player = {
      id: 'p1', name: 'P1', color: '#000', level: 3, xp: 250,
      attributes: { health: 350, armor: 0, power: 0, pointsAvailable: 8 },
    };
    const out = reconcilePlayerPoints(player, settings);
    expect(out.attributes?.health).toBe(350);
    expect(out.attributes?.pointsAvailable).toBe(8);
  });

  it('never produces NaN in battle-mode game creation from corrupted attributes', () => {
    const player: Player = {
      id: 'p1', name: 'P1', color: '#22c55e',
      attributes: { health: NaN, armor: NaN, power: NaN, pointsAvailable: 0 },
    };
    const game = createGame('battle', ['p1'], [player], false, 1, false, [], false, settings);
    const gp = game.players[0];
    expect(Number.isFinite(gp.hp)).toBe(true);
    expect(Number.isFinite(gp.maxHp)).toBe(true);
    expect(Number.isFinite(gp.armorPct)).toBe(true);
    expect(Number.isFinite(gp.powerPct)).toBe(true);
    expect(gp.hp).toBeGreaterThan(0);
  });

  it('recalculates health when scaling config shrinks the base', () => {
    // Player leveled up and spent 4 points on health under an old config where
    // base was 400 and perPoint was 25 (health=500). Now base is 300, perPoint
    // is 25, level 2 gives 5 points. The stored 500 would imply 8 points spent
    // (500-300)/25, but the player only has 5. Reconcile should clamp.
    // Level is derived from XP, so set xp to reach level 2 (100 XP).
    const player: Player = {
      id: 'p1', name: 'P1', color: '#000', level: 2, xp: 100,
      attributes: { health: 500, armor: 0, power: 0, pointsAvailable: 0 },
    };
    const out = reconcilePlayerPoints(player, settings);
    const cfg = settings.powerUpScaling;
    // Level 2 → 5 attribute points. All 5 go to health (since armor/power are 0).
    expect(out.attributes?.health).toBe(cfg.attributeStartHealth + 5 * cfg.healthPerPoint);
    expect(out.attributes?.pointsAvailable).toBe(0);
  });
});
