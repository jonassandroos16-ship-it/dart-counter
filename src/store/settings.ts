import type { Game, Settings } from '../types';
import { defaultSettings } from '../constants';
import { KEYS } from './keys';

export function applyTheme(settings: Settings) {
  document.documentElement.setAttribute('data-theme', settings.theme);
  document.documentElement.style.setProperty('--accent', settings.accent);
  const meta = document.querySelector('meta[name=theme-color]');
  if (meta) meta.setAttribute('content', settings.theme === 'dark' ? '#0f1115' : '#f4f6fb');
}

// Deep-merge `powerUpScaling` so a partial saved config (e.g. an older
// backup missing fields like `healthMax` or `battleMinDamage`) is backfilled
// from defaults. Without this, missing numeric fields become `undefined`,
// which turns `Math.min(undefined, x)` into `NaN` and corrupts battle mode.
export function withDefaults(parsed: Partial<Settings> | undefined | null): Settings {
  const base = defaultSettings();
  if (!parsed) return base;
  const merged: Settings = {
    ...base,
    ...parsed,
    powerUpScaling: { ...base.powerUpScaling, ...(parsed.powerUpScaling || {}) },
  };
  if (!Array.isArray(merged.customTitles)) merged.customTitles = [];
  return merged;
}

export function loadSettings(): Settings {
  const raw = localStorage.getItem(KEYS.settings);
  if (!raw) return defaultSettings();
  try {
    return withDefaults(JSON.parse(raw) as Partial<Settings>);
  } catch {
    return defaultSettings();
  }
}

export function loadActiveGame(): Game | null {
  try {
    const raw = localStorage.getItem(KEYS.activeGame);
    if (!raw) return null;
    const g = JSON.parse(raw) as Game;
    // Don't resume a finished game — it's already saved in `games`.
    if (!g || g.finished) return null;
    // Backfill fields added in later versions so old saved games still load.
    if (!g.thrownThisRound) g.thrownThisRound = [];
    return g;
  } catch { return null; }
}
