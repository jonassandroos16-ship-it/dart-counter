import { describe, it, expect } from 'vitest';
import { clearVisitPowerUpFlags } from './dart';

describe('clearVisitPowerUpFlags', () => {
  it('clears the blocker flag so it does not persist forever', () => {
    const pl: any = { id: 'p1', _oneDartNext: true };
    const out = clearVisitPowerUpFlags(pl);
    expect(out).not.toBe(pl);
    expect(out._oneDartNext).toBeUndefined();
  });

  it('clears every one-visit stun/buff flag at once when stacked', () => {
    const pl: any = {
      id: 'p1',
      _oneDartNext: true,
      _crippledNext: true,
      _surgeNext: true,
      _surgeArmed: true,
      _fourthDart: true,
      _frozenNext: true,
      _luckyMiss: true,
      score: 301,
    };
    const out = clearVisitPowerUpFlags(pl);
    expect(out._oneDartNext).toBeUndefined();
    expect(out._crippledNext).toBeUndefined();
    expect(out._surgeNext).toBeUndefined();
    expect(out._surgeArmed).toBeUndefined();
    expect(out._fourthDart).toBeUndefined();
    expect(out._frozenNext).toBeUndefined();
    expect(out._luckyMiss).toBeUndefined();
    expect(out.score).toBe(301);
  });

  it('returns the same object reference when there is nothing to clear', () => {
    const pl: any = { id: 'p1', score: 50 };
    const out = clearVisitPowerUpFlags(pl);
    expect(out).toBe(pl);
  });
});
