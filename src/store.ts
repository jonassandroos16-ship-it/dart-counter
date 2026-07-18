import { useState, useCallback, useRef, useEffect } from 'react';
import type { Game, GameRecord, Player, Settings, CustomTitle } from './types';
import { defaultSettings } from './constants';
import { supabase } from './supabase';

const KEYS = { players: 'dc_players', games: 'dc_games', settings: 'dc_settings', activeGame: 'dc_active_game' };

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export const todayKey = (d: Date = new Date()) => d.toISOString().slice(0, 10);
export const initials = (n: string) => (n || '?').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();

// European (en-GB) date formatting helpers — DD/MM/YYYY, 24-hour time.
const LOCALE = 'en-GB';
export const fmtDate = (d: Date | string) => new Date(d).toLocaleDateString(LOCALE);
export const fmtTime = (d: Date | string) => new Date(d).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' });
export const fmtDateTime = (d: Date | string) => new Date(d).toLocaleString(LOCALE);
export const fmtDateLong = (d: Date | string) => new Date(d).toLocaleDateString(LOCALE, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

export function applyTheme(settings: Settings) {
  document.documentElement.setAttribute('data-theme', settings.theme);
  document.documentElement.style.setProperty('--accent', settings.accent);
  const meta = document.querySelector('meta[name=theme-color]');
  if (meta) meta.setAttribute('content', settings.theme === 'dark' ? '#0f1115' : '#f4f6fb');
}

function loadSettings(): Settings {
  const raw = localStorage.getItem(KEYS.settings);
  if (!raw) return defaultSettings();
  return { ...defaultSettings(), ...JSON.parse(raw) };
}

function loadActiveGame(): Game | null {
  try {
    const raw = localStorage.getItem(KEYS.activeGame);
    if (!raw) return null;
    const g = JSON.parse(raw) as Game;
    // Don't resume a finished game — it's already saved in `games`.
    if (!g || g.finished) return null;
    return g;
  } catch { return null; }
}

// ── Server sync helpers ──────────────────────────────────────────────

async function fetchAppState(): Promise<{ players: Player[]; settings: Settings } | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('app_state')
    .select('players, settings')
    .eq('id', 'main')
    .maybeSingle();
  if (error || !data) return null;
  return {
    players: (data.players as Player[]) || [],
    settings: { ...defaultSettings(), ...((data.settings as Partial<Settings>) || {}) },
  };
}

async function upsertAppState(players: Player[], settings: Settings): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from('app_state')
    .upsert({ id: 'main', players, settings, updated_at: new Date().toISOString() }, { onConflict: 'id' });
  if (error) console.warn('[sync] app_state upsert failed:', error.message);
}

async function fetchAllGames(): Promise<GameRecord[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('games').select('data');
  if (error || !data) return [];
  return data.map((row: any) => row.data as GameRecord);
}

async function upsertGame(record: GameRecord): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from('games')
    .upsert({ id: record.id, data: record }, { onConflict: 'id' });
  if (error) console.warn('[sync] game upsert failed:', error.message);
}

async function deleteGame(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('games').delete().eq('id', id);
  if (error) console.warn('[sync] game delete failed:', error.message);
}

// ── DB hook ──────────────────────────────────────────────────────────

export interface DBAPI {
  players: Player[];
  games: GameRecord[];
  settings: Settings;
  activeGame: Game | null;
  setPlayers: (updater: Player[] | ((prev: Player[]) => Player[])) => void;
  setGames: (updater: GameRecord[] | ((prev: GameRecord[]) => GameRecord[])) => void;
  setSettings: (updater: Settings | ((prev: Settings) => Settings)) => void;
  setActiveGame: (updater: Game | null | ((prev: Game | null) => Game | null)) => void;
}

export function useDB(): DBAPI {
  const [players, setPlayersState] = useState<Player[]>(() => JSON.parse(localStorage.getItem(KEYS.players) || '[]'));
  const [games, setGamesState] = useState<GameRecord[]>(() => JSON.parse(localStorage.getItem(KEYS.games) || '[]'));
  const [settings, setSettingsState] = useState<Settings>(loadSettings);
  const [activeGame, setActiveGameState] = useState<Game | null>(loadActiveGame);

  // Track whether the initial server pull has completed so we don't push
  // stale local state before the merge.
  const syncedRef = useRef(false);
  // Debounce timers for players/settings upserts.
  const playersSyncTimer = useRef<ReturnType<typeof setTimeout>>();
  const settingsSyncTimer = useRef<ReturnType<typeof setTimeout>>();

  const doMerge = useCallback((remoteState: { players: Player[]; settings: Settings } | null, remoteGames: GameRecord[]) => {
    const localPlayers = JSON.parse(localStorage.getItem(KEYS.players) || '[]') as Player[];
    const localGames = JSON.parse(localStorage.getItem(KEYS.games) || '[]') as GameRecord[];
    const localSettings = { ...defaultSettings(), ...JSON.parse(localStorage.getItem(KEYS.settings) || '{}') } as Settings;
    const merged = mergeBackup(
      { players: localPlayers, games: localGames, settings: localSettings },
      { players: remoteState?.players, games: remoteGames, settings: remoteState?.settings },
    );
    localStorage.setItem(KEYS.players, JSON.stringify(merged.players));
    localStorage.setItem(KEYS.games, JSON.stringify(merged.games));
    localStorage.setItem(KEYS.settings, JSON.stringify(merged.settings));
    setPlayersState(merged.players);
    setGamesState(merged.games);
    setSettingsState(merged.settings);
    return merged;
  }, []);

  // Initial pull: merge server data with local, then mark as synced.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [remoteState, remoteGames] = await Promise.all([fetchAppState(), fetchAllGames()]);
      if (cancelled) return;
      const merged = doMerge(remoteState, remoteGames);
      syncedRef.current = true;
      void upsertAppState(merged.players, merged.settings);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refresh from server when the tab regains focus.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      (async () => {
        const [remoteState, remoteGames] = await Promise.all([fetchAppState(), fetchAllGames()]);
        if (!remoteState && !remoteGames.length) return;
        const merged = doMerge(remoteState, remoteGames);
        void upsertAppState(merged.players, merged.settings);
      })();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const playersRef = useRef(players);
  playersRef.current = players;

  const setPlayers = useCallback((updater: Player[] | ((prev: Player[]) => Player[])) => {
    setPlayersState(prev => {
      const next = typeof updater === 'function' ? (updater as any)(prev) : updater;
      localStorage.setItem(KEYS.players, JSON.stringify(next));
      if (syncedRef.current) {
        if (playersSyncTimer.current) clearTimeout(playersSyncTimer.current);
        playersSyncTimer.current = setTimeout(() => void upsertAppState(next, settingsRef.current), 800);
      }
      return next;
    });
  }, []);

  const setSettings = useCallback((updater: Settings | ((prev: Settings) => Settings)) => {
    setSettingsState(prev => {
      const next = typeof updater === 'function' ? (updater as any)(prev) : updater;
      localStorage.setItem(KEYS.settings, JSON.stringify(next));
      settingsRef.current = next;
      if (syncedRef.current) {
        if (settingsSyncTimer.current) clearTimeout(settingsSyncTimer.current);
        settingsSyncTimer.current = setTimeout(() => void upsertAppState(playersRef.current, next), 800);
      }
      return next;
    });
  }, []);

  const setGames = useCallback((updater: GameRecord[] | ((prev: GameRecord[]) => GameRecord[])) => {
    setGamesState(prev => {
      const next = typeof updater === 'function' ? (updater as any)(prev) : updater;
      localStorage.setItem(KEYS.games, JSON.stringify(next));

      if (syncedRef.current) {
        // Diff: find added/removed game IDs vs prev.
        const prevIds = new Set(prev.map((g: GameRecord) => g.id));
        const nextIds = new Set(next.map((g: GameRecord) => g.id));
        for (const g of next as GameRecord[]) {
          if (!prevIds.has(g.id)) void upsertGame(g); // newly added
        }
        for (const g of prev) {
          if (!nextIds.has(g.id)) void deleteGame(g.id); // removed
        }
      }
      return next;
    });
  }, []);

  const setActiveGame = useCallback((updater: Game | null | ((prev: Game | null) => Game | null)) => {
    setActiveGameState(prev => {
      const next = typeof updater === 'function' ? (updater as any)(prev) : updater;
      // activeGame stays local-only so concurrent matches don't clash.
      if (next && !next.finished) localStorage.setItem(KEYS.activeGame, JSON.stringify(next));
      else localStorage.removeItem(KEYS.activeGame);
      return next;
    });
  }, []);

  return { players, games, settings, activeGame, setPlayers, setGames, setSettings, setActiveGame };
}

// ── Merge logic (unchanged from original) ────────────────────────────

export interface BackupShape {
  players?: Player[];
  games?: GameRecord[];
  settings?: Settings;
  exportedAt?: string;
}

function matchPlayerKey(p: Player): string {
  return `${(p.name || '').trim().toLowerCase()}|${(p.color || '').toLowerCase()}`;
}

function mergePlayers(existing: Player[], incoming: Player[]): Player[] {
  const byId = new Map<string, Player>();
  const byKey = new Map<string, Player>();
  for (const p of existing) {
    byId.set(p.id, p);
    byKey.set(matchPlayerKey(p), p);
  }
  for (const p of incoming) {
    const idMatch = byId.get(p.id);
    if (idMatch) {
      byId.set(idMatch.id, {
        ...idMatch,
        ...p,
        xp: Math.max(idMatch.xp || 0, p.xp || 0) || idMatch.xp || p.xp || 0,
        level: Math.max(idMatch.level || 0, p.level || 0) || idMatch.level || p.level || 0,
        unlockedTitles: Array.from(new Set([...(idMatch.unlockedTitles || []), ...(p.unlockedTitles || [])])),
      });
      byKey.set(matchPlayerKey(p), byId.get(p.id)!);
      continue;
    }
    const keyMatch = byKey.get(matchPlayerKey(p));
    if (keyMatch) {
      byId.set(keyMatch.id, {
        ...keyMatch,
        ...p,
        id: keyMatch.id,
        xp: Math.max(keyMatch.xp || 0, p.xp || 0) || keyMatch.xp || p.xp || 0,
        level: Math.max(keyMatch.level || 0, p.level || 0) || keyMatch.level || p.level || 0,
        unlockedTitles: Array.from(new Set([...(keyMatch.unlockedTitles || []), ...(p.unlockedTitles || [])])),
      });
      continue;
    }
    let id = p.id;
    while (byId.has(id)) id = id + '_' + uid();
    const placed = { ...p, id };
    byId.set(id, placed);
    byKey.set(matchPlayerKey(placed), placed);
  }
  return Array.from(byId.values());
}

function mergeGames(existing: GameRecord[], incoming: GameRecord[]): GameRecord[] {
  const byId = new Map<string, GameRecord>(existing.map(g => [g.id, g]));
  for (const g of incoming) {
    if (!byId.has(g.id)) byId.set(g.id, g);
  }
  return Array.from(byId.values());
}

function mergeSettings(existing: Settings, incoming?: Settings): Settings {
  if (!incoming) return existing;
  const customTitles = (() => {
    const byId = new Map<string, CustomTitle>();
    for (const t of [...existing.customTitles, ...(incoming.customTitles || [])]) byId.set(t.id, t);
    return Array.from(byId.values());
  })();
  return { ...existing, ...incoming, customTitles };
}

export function mergeBackup(
  existing: { players: Player[]; games: GameRecord[]; settings: Settings },
  backup: BackupShape,
): { players: Player[]; games: GameRecord[]; settings: Settings } {
  return {
    players: mergePlayers(existing.players, backup.players || []),
    games: mergeGames(existing.games, backup.games || []),
    settings: mergeSettings(existing.settings, backup.settings),
  };
}

export function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const show = useCallback((m: string) => {
    setMsg(m);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), 1800);
  }, []);
  return { msg, show };
}
