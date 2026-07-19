import { describe, it, expect } from 'vitest';
import { withDefaults, mergeBackup } from './store';
import { defaultSettings } from './constants';
import type { GameRecord, Player, Settings } from './types';

// Regression: a real user backup shipped a `powerUpScaling` block that predated
// the `healthMax` and `battleMinDamage` fields. The old shallow-merge logic
// replaced the entire default `powerUpScaling` with the partial saved one,
// dropping `healthMax`/`battleMinDamage` and producing NaN in battle mode.
describe('settings merge — powerUpScaling backfill (NaN regression)', () => {
  function partialScaling(): Settings['powerUpScaling'] {
    const full = defaultSettings().powerUpScaling;
    const rest: Record<string, unknown> = { ...full };
    delete rest.healthMax;
    delete rest.battleMinDamage;
    return rest as unknown as Settings['powerUpScaling'];
  }

  it('withDefaults backfills missing healthMax and battleMinDamage from defaults', () => {
    const parsed: Partial<Settings> = {
      theme: 'dark',
      accent: '#22c55e',
      powerUpScaling: partialScaling(),
    };
    const out = withDefaults(parsed);
    expect(out.powerUpScaling.healthMax).toBe(defaultSettings().powerUpScaling.healthMax);
    expect(out.powerUpScaling.battleMinDamage).toBe(defaultSettings().powerUpScaling.battleMinDamage);
    // Preserves the user's custom values.
    expect(out.powerUpScaling.attributeStartHealth).toBe(partialScaling().attributeStartHealth);
  });

  it('mergeBackup deep-merges powerUpScaling so existing defaults survive a partial incoming block', () => {
    const existing: { players: Player[]; games: GameRecord[]; settings: Settings } = {
      players: [],
      games: [],
      settings: defaultSettings(),
    };
    const incomingSettings: Partial<Settings> = {
      theme: 'light',
      powerUpScaling: partialScaling(),
    };
    const out = mergeBackup(existing, { players: [], games: [], settings: incomingSettings as Settings });
    expect(out.settings.powerUpScaling.healthMax).toBe(defaultSettings().powerUpScaling.healthMax);
    expect(out.settings.powerUpScaling.battleMinDamage).toBe(defaultSettings().powerUpScaling.battleMinDamage);
    expect(Number.isFinite(out.settings.powerUpScaling.healthMax)).toBe(true);
    expect(Number.isFinite(out.settings.powerUpScaling.battleMinDamage)).toBe(true);
  });
});
