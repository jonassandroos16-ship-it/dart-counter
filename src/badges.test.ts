import { describe, it, expect } from 'vitest';
import {
  BADGES,
  getBadgeContext,
  getBadgeInfo,
  computeGameBadges,
  lifetimeKills,
  lifetimeHighScore,
  lifetimeBusts,
  lifetime180s,
  lifetimeTriples,
  lifetimeHighCheckout,
  lifetimeDartsThrown,
} from './badges';
import type { GameRecord, Visit } from './types';

function makeVisit(scored: number, darts: { base: number; mult: number; value?: number }[], opts: Partial<Visit> = {}): Visit {
  return {
    darts: darts.map((d) => ({ value: d.value ?? d.base * d.mult, label: '', base: d.base, mult: d.mult, isDouble: d.mult === 2 })),
    scored,
    date: opts.date ?? '2026-01-01T00:00:00.000Z',
    ...opts,
  };
}

function makeGameRecord(
  id: string,
  players: GameRecord['players'],
  opts: Partial<GameRecord> = {},
): GameRecord {
  return {
    id,
    date: opts.date ?? '2026-01-01T00:00:00.000Z',
    mode: '501',
    practice: false,
    atc: false,
    doubleOut: true,
    legsBestOf: 1,
    winner: null,
    tied: false,
    tiedPlayers: null,
    players,
    ...opts,
  };
}

describe('badge context definitions', () => {
  it('every badge with a context function also has a label', () => {
    for (const b of BADGES) {
      if (b.context) {
        expect(b.contextLabel, `${b.id} should have contextLabel`).toBeTruthy();
      }
    }
  });

  it('Top Scorer badge exposes high-score context', () => {
    const b = getBadgeInfo('b_highest_score');
    expect(b?.context).toBeDefined();
    expect(b?.contextLabel).toBe('high score');
  });

  it('Slayer badge exposes kills context', () => {
    const b = getBadgeInfo('b_slayer');
    expect(b?.context).toBeDefined();
    expect(b?.contextLabel).toBe('kills');
  });
});

describe('getBadgeContext', () => {
  it('returns null when badge id is null', () => {
    expect(getBadgeContext(null, 'p1', [])).toBeNull();
  });

  it('returns null for a badge without a context function', () => {
    expect(getBadgeContext('b_hit_bull', 'p1', [])).toBeNull();
  });

  it('returns null when the context value is zero', () => {
    expect(getBadgeContext('b_highest_score', 'p1', [])).toBeNull();
  });

  it('returns the lifetime high score for Top Scorer', () => {
    const games: GameRecord[] = [
      makeGameRecord('g1', [
        { id: 'p1', name: 'P1', color: '#000', legsWon: 0, dartsThrown: 6, visits: [makeVisit(140, [{ base: 20, mult: 3 }, { base: 20, mult: 3 }, { base: 20, mult: 1 }]), makeVisit(60, [{ base: 20, mult: 3 }])] },
        { id: 'p2', name: 'P2', color: '#000', legsWon: 0, dartsThrown: 3, visits: [makeVisit(30, [{ base: 10, mult: 3 }])] },
      ]),
    ];
    const ctx = getBadgeContext('b_highest_score', 'p1', games);
    expect(ctx).toEqual({ value: 140, label: 'high score' });
  });

  it('returns the lifetime kill count for Slayer', () => {
    const games: GameRecord[] = [
      makeGameRecord('g1', [
        { id: 'p1', name: 'P1', color: '#000', legsWon: 0, dartsThrown: 0, visits: [], team: undefined } as any,
        { id: 'p2', name: 'P2', color: '#000', legsWon: 0, dartsThrown: 0, visits: [] },
      ], { mode: 'killer' }),
    ];
    // Simulate kills stored on the player — GameRecord.players don't carry
    // kills, so we cast to inject them for the test.
    (games[0].players[0] as any).kills = ['p2', 'p3'];
    (games[0].players[1] as any).kills = ['p1'];
    const ctx = getBadgeContext('b_slayer', 'p1', games);
    expect(ctx).toEqual({ value: 2, label: 'kills' });
  });
});

describe('lifetime aggregators', () => {
  const games: GameRecord[] = [
    makeGameRecord('g1', [
      { id: 'p1', name: 'P1', color: '#000', legsWon: 0, dartsThrown: 9, visits: [
        makeVisit(180, [{ base: 20, mult: 3 }, { base: 20, mult: 3 }, { base: 20, mult: 3 }]),
        makeVisit(0, [{ base: 20, mult: 3 }, { base: 20, mult: 3 }, { base: 20, mult: 3 }], { bust: true }),
        makeVisit(100, [{ base: 20, mult: 3 }, { base: 20, mult: 3 }, { base: 20, mult: 1 }], { remaining: 0 }),
      ] },
      { id: 'p2', name: 'P2', color: '#000', legsWon: 0, dartsThrown: 3, visits: [makeVisit(30, [{ base: 10, mult: 3 }])] },
    ]),
  ];

  it('lifetime180s counts 180s', () => {
    expect(lifetime180s('p1', games)).toBe(1);
  });

  it('lifetimeBusts counts busts', () => {
    expect(lifetimeBusts('p1', games)).toBe(1);
  });

  it('lifetimeHighScore returns the best visit', () => {
    expect(lifetimeHighScore('p1', games)).toBe(180);
  });

  it('lifetimeHighCheckout returns the best finishing visit', () => {
    expect(lifetimeHighCheckout('p1', games)).toBe(100);
  });

  it('lifetimeTriples counts triples', () => {
    expect(lifetimeTriples('p1', games)).toBe(8); // 3 + 3 (bust) + 2
  });

  it('lifetimeDartsThrown counts all darts', () => {
    expect(lifetimeDartsThrown('p1', games)).toBe(9);
  });

  it('returns 0 for a player with no games', () => {
    expect(lifetime180s('missing', [])).toBe(0);
    expect(lifetimeKills('missing', [])).toBe(0);
  });
});

describe('computeGameBadges — Slayer', () => {
  it('awards Slayer to killer-mode players with at least one kill', () => {
    const game: any = {
      mode: 'killer',
      players: [
        { id: 'p1', name: 'P1', color: '#000', visits: [], kills: ['p2', 'p3'] },
        { id: 'p2', name: 'P2', color: '#000', visits: [], kills: [] },
        { id: 'p3', name: 'P3', color: '#000', visits: [], kills: ['p1'] },
      ],
    };
    const map = computeGameBadges(game);
    expect(map['p1']).toContain('b_slayer');
    expect(map['p3']).toContain('b_slayer');
    expect(map['p2']).not.toContain('b_slayer');
  });

  it('does not award Slayer in non-killer modes', () => {
    const game: any = {
      mode: '501',
      players: [
        { id: 'p1', name: 'P1', color: '#000', visits: [], kills: ['p2'] },
        { id: 'p2', name: 'P2', color: '#000', visits: [], kills: [] },
      ],
    };
    const map = computeGameBadges(game);
    expect(map['p1']).not.toContain('b_slayer');
  });
});
