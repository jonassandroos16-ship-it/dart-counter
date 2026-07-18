import { useState, useCallback, useRef, useEffect } from 'react';
import type { Game, GameRecord, Player, Settings, CustomTitle } from './types';
import { defaultSettings } from './constants';
import { supabase } from './supabase';

const KEYS = { players: 'dc_players', games: 'dc_games', settings: 'dc_settings', activeGame: 'dc_active_game', tombPlayers: 'dc_tomb_players', tombGames: 'dc_tomb_games' };

const loadTomb = (key: string): string[] => { try { return JSON.parse(localStorage.getItem(key) || '[]') as string[]; } catch { return []; } };

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
    // Backfill fields added in later versions so old saved games still load.
    if (!g.thrownThisRound) g.thrownThisRound = [];
    return g;
  } catch { return null; }
}

// ── Server sync helpers ──────────────────────────────────────────────
// All helpers THROW on network/permission errors (so callers can mark the
// connection offline) and return null/empty on legitimate no-data cases.
// Tombstones (deleted_player_ids / deleted_game_ids) propagate deletes.

async function fetchAppState(): Promise<{ players: Player[]; settings: Settings; deletedPlayerIds: string[]; deletedGameIds: string[] } | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('app_state')
    .select('players, settings, deleted_player_ids, deleted_game_ids')
    .eq('id', 'main')
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    players: (data.players as Player[]) || [],
    settings: { ...defaultSettings(), ...((data.settings as Partial<Settings>) || {}) },
    deletedPlayerIds: (data.deleted_player_ids as string[]) || [],
    deletedGameIds: (data.deleted_game_ids as string[]) || [],
  };
}

async function fetchAllGames(): Promise<GameRecord[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('games').select('data');
  if (error) throw error;
  return (data || []).map((row: any) => row.data as GameRecord);
}

async function pushAppState(players: Player[], settings: Settings, deletedPlayerIds: string[], deletedGameIds: string[]): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from('app_state')
    .upsert({ id: 'main', players, settings, deleted_player_ids: deletedPlayerIds, deleted_game_ids: deletedGameIds, updated_at: new Date().toISOString() }, { onConflict: 'id' });
  if (error) { console.warn('[sync] app_state upsert failed:', error.message); return false; }
  return true;
}

async function pushAllGames(games: GameRecord[]): Promise<boolean> {
  if (!supabase) return false;
  if (!games.length) return true;
  const rows = games.map(g => ({ id: g.id, data: g }));
  const { error } = await supabase.from('games').upsert(rows, { onConflict: 'id' });
  if (error) { console.warn('[sync] games upsert failed:', error.message); return false; }
  return true;
}

async function upsertGame(record: GameRecord): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from('games')
    .upsert({ id: record.id, data: record }, { onConflict: 'id' });
  if (error) { console.warn('[sync] game upsert failed:', error.message); return false; }
  return true;
}

async function deleteGame(id: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from('games').delete().eq('id', id);
  if (error) { console.warn('[sync] game delete failed:', error.message); return false; }
  return true;
}

// Pull everything from the server. Returns null when there is no database
// configured OR the server is unreachable — callers distinguish those two
// cases via the stable `hasDatabase` flag.
async function pullAll(): Promise<{ players: Player[]; settings: Settings; games: GameRecord[]; deletedPlayerIds: string[]; deletedGameIds: string[] } | null> {
  if (!supabase) return null;
  try {
    const [state, games] = await Promise.all([fetchAppState(), fetchAllGames()]);
    return { players: state?.players || [], settings: state?.settings || defaultSettings(), games, deletedPlayerIds: state?.deletedPlayerIds || [], deletedGameIds: state?.deletedGameIds || [] };
  } catch (e: any) {
    console.warn('[sync] pull failed:', e?.message);
    return null;
  }
}

async function pushAll(players: Player[], settings: Settings, games: GameRecord[], deletedPlayerIds: string[], deletedGameIds: string[]): Promise<boolean> {
  const okState = await pushAppState(players, settings, deletedPlayerIds, deletedGameIds);
  const okGames = await pushAllGames(games);
  return okState && okGames;
}

// ── DB hook ──────────────────────────────────────────────────────────

export interface SyncResult { ok: boolean; message: string }

export interface DBAPI {
  players: Player[];
  games: GameRecord[];
  settings: Settings;
  activeGame: Game | null;
  setPlayers: (updater: Player[] | ((prev: Player[]) => Player[])) => void;
  setGames: (updater: GameRecord[] | ((prev: GameRecord[]) => GameRecord[])) => void;
  setSettings: (updater: Settings | ((prev: Settings) => Settings)) => void;
  setActiveGame: (updater: Game | null | ((prev: Game | null) => Game | null)) => void;
  hasDatabase: boolean;
  connected: boolean;
  upToDate: boolean;
  lastSync: number | null;
  syncing: boolean;
  manualSync: () => Promise<SyncResult>;
}

export function useDB(): DBAPI {
  const [players, setPlayersState] = useState<Player[]>(() => JSON.parse(localStorage.getItem(KEYS.players) || '[]'));
  const [games, setGamesState] = useState<GameRecord[]>(() => JSON.parse(localStorage.getItem(KEYS.games) || '[]'));
  const [settings, setSettingsState] = useState<Settings>(loadSettings);
  const [activeGame, setActiveGameState] = useState<Game | null>(loadActiveGame);

  // Sync status. `hasDatabase` is stable for the lifetime of the app; the
  // others update as server round-trips succeed or fail.
  const hasDatabase = !!supabase;
  const [connected, setConnected] = useState(false);
  const [upToDate, setUpToDate] = useState(false);
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);

  // Track whether the initial server pull has completed so we don't push
  // stale local state before the merge.
  const syncedRef = useRef(false);
  // Debounce timers for players/settings upserts.
  const playersSyncTimer = useRef<ReturnType<typeof setTimeout>>();
  const settingsSyncTimer = useRef<ReturnType<typeof setTimeout>>();

  const playersRef = useRef(players);
  playersRef.current = players;
  const gamesRef = useRef(games);
  gamesRef.current = games;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const tombPlayersRef = useRef<string[]>(loadTomb(KEYS.tombPlayers));
  const tombGamesRef = useRef<string[]>(loadTomb(KEYS.tombGames));

  const doMerge = useCallback((remoteState: { players: Player[]; settings: Settings; deletedPlayerIds?: string[]; deletedGameIds?: string[] } | null, remoteGames: GameRecord[]) => {
    const localPlayers = JSON.parse(localStorage.getItem(KEYS.players) || '[]') as Player[];
    const localGames = JSON.parse(localStorage.getItem(KEYS.games) || '[]') as GameRecord[];
    const localSettings = { ...defaultSettings(), ...JSON.parse(localStorage.getItem(KEYS.settings) || '{}') } as Settings;
    // Union local + remote tombstones so a delete on any client propagates everywhere.
    const tombP = Array.from(new Set([...loadTomb(KEYS.tombPlayers), ...(remoteState?.deletedPlayerIds || [])]));
    const tombG = Array.from(new Set([...loadTomb(KEYS.tombGames), ...(remoteState?.deletedGameIds || [])]));
    localStorage.setItem(KEYS.tombPlayers, JSON.stringify(tombP));
    localStorage.setItem(KEYS.tombGames, JSON.stringify(tombG));
    tombPlayersRef.current = tombP;
    tombGamesRef.current = tombG;
    const tombPSet = new Set(tombP);
    const tombGSet = new Set(tombG);
    const merged = mergeBackup(
      { players: localPlayers.filter(p => !tombPSet.has(p.id)), games: localGames.filter(g => !tombGSet.has(g.id)), settings: localSettings },
      { players: (remoteState?.players || []).filter(p => !tombPSet.has(p.id)), games: remoteGames.filter(g => !tombGSet.has(g.id)), settings: remoteState?.settings },
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
      if (!supabase) { syncedRef.current = true; return; } // local-only mode
      const remote = await pullAll();
      if (cancelled) return;
      if (!remote) { setConnected(false); syncedRef.current = true; return; }
      const merged = doMerge({ players: remote.players, settings: remote.settings, deletedPlayerIds: remote.deletedPlayerIds, deletedGameIds: remote.deletedGameIds }, remote.games);
      syncedRef.current = true;
      setConnected(true);
      setUpToDate(true);
      setLastSync(Date.now());
      // Push the merged result back so the server reflects the union.
      const pushOk = await pushAll(merged.players, merged.settings, merged.games, tombPlayersRef.current, tombGamesRef.current);
      setConnected(pushOk);
      if (pushOk) { setUpToDate(true); setLastSync(Date.now()); }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refresh from server when the tab regains focus.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (!supabase) return;
      (async () => {
        const remote = await pullAll();
        if (!remote) { setConnected(false); return; }
        const merged = doMerge({ players: remote.players, settings: remote.settings, deletedPlayerIds: remote.deletedPlayerIds, deletedGameIds: remote.deletedGameIds }, remote.games);
        setConnected(true);
        setUpToDate(true);
        setLastSync(Date.now());
        void pushAll(merged.players, merged.settings, merged.games, tombPlayersRef.current, tombGamesRef.current);
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

  // Mark a server write's outcome on sync status.
  const afterPush = useCallback((ok: boolean) => {
    setConnected(ok);
    if (ok) { setUpToDate(true); setLastSync(Date.now()); }
    else setUpToDate(false);
  }, []);

  const setPlayers = useCallback((updater: Player[] | ((prev: Player[]) => Player[])) => {
    const prev = playersRef.current;
    const next = typeof updater === 'function' ? (updater as any)(prev) : updater;
    playersRef.current = next;
    localStorage.setItem(KEYS.players, JSON.stringify(next));
    // Record tombstones for any removed players so the delete propagates to other clients.
    const nextIds = new Set(next.map((p: Player) => p.id));
    const newTomb = prev.filter(p => !nextIds.has(p.id)).map(p => p.id);
    if (newTomb.length) {
      const tomb = Array.from(new Set([...tombPlayersRef.current, ...newTomb]));
      tombPlayersRef.current = tomb;
      localStorage.setItem(KEYS.tombPlayers, JSON.stringify(tomb));
    }
    setUpToDate(false);
    setPlayersState(next);
    if (syncedRef.current && supabase) {
      if (playersSyncTimer.current) clearTimeout(playersSyncTimer.current);
      playersSyncTimer.current = setTimeout(() => {
        void pushAppState(next, settingsRef.current, tombPlayersRef.current, tombGamesRef.current).then(afterPush);
      }, 800);
    }
  }, [afterPush]);

  const setSettings = useCallback((updater: Settings | ((prev: Settings) => Settings)) => {
    const prev = settingsRef.current;
    const next = typeof updater === 'function' ? (updater as any)(prev) : updater;
    settingsRef.current = next;
    localStorage.setItem(KEYS.settings, JSON.stringify(next));
    setUpToDate(false);
    setSettingsState(next);
    if (syncedRef.current && supabase) {
      if (settingsSyncTimer.current) clearTimeout(settingsSyncTimer.current);
      settingsSyncTimer.current = setTimeout(() => {
        void pushAppState(playersRef.current, next, tombPlayersRef.current, tombGamesRef.current).then(afterPush);
      }, 800);
    }
  }, [afterPush]);

  const setGames = useCallback((updater: GameRecord[] | ((prev: GameRecord[]) => GameRecord[])) => {
    const prev = gamesRef.current;
    const next = typeof updater === 'function' ? (updater as any)(prev) : updater;
    gamesRef.current = next;
    localStorage.setItem(KEYS.games, JSON.stringify(next));
    // Record tombstones for any removed games so the delete propagates to other clients.
    const nextIds = new Set(next.map((g: GameRecord) => g.id));
    const newTomb = prev.filter(g => !nextIds.has(g.id)).map(g => g.id);
    if (newTomb.length) {
      const tomb = Array.from(new Set([...tombGamesRef.current, ...newTomb]));
      tombGamesRef.current = tomb;
      localStorage.setItem(KEYS.tombGames, JSON.stringify(tomb));
    }
    setUpToDate(false);
    setGamesState(next);
    if (syncedRef.current && supabase) {
      // Diff: find added/removed game IDs vs prev.
      const prevIds = new Set(prev.map((g: GameRecord) => g.id));
      const tasks: Promise<boolean>[] = [];
      for (const g of next as GameRecord[]) {
        if (!prevIds.has(g.id)) tasks.push(upsertGame(g)); // newly added
      }
      for (const g of prev) {
        if (!nextIds.has(g.id)) tasks.push(deleteGame(g.id)); // removed
      }
      if (tasks.length) void Promise.all(tasks).then(oks => afterPush(oks.every(Boolean)));
      else afterPush(true); // no server-side change — local already matches
    }
  }, [afterPush]);

  const setActiveGame = useCallback((updater: Game | null | ((prev: Game | null) => Game | null)) => {
    setActiveGameState(prev => {
      const next = typeof updater === 'function' ? (updater as any)(prev) : updater;
      // activeGame stays local-only so concurrent matches don't clash.
      if (next && !next.finished) localStorage.setItem(KEYS.activeGame, JSON.stringify(next));
      else localStorage.removeItem(KEYS.activeGame);
      return next;
    });
  }, []);

  // Manual sync: pull remote, merge with local, persist merged to both
  // localStorage and the server, and report the outcome for UI feedback.
  const manualSync = useCallback(async (): Promise<SyncResult> => {
    if (!supabase) return { ok: false, message: 'No database configured' };
    setSyncing(true);
    setUpToDate(false);
    try {
      const remote = await pullAll();
      if (!remote) { setConnected(false); return { ok: false, message: 'Could not reach database' }; }
      const localPlayers = JSON.parse(localStorage.getItem(KEYS.players) || '[]') as Player[];
      const localGames = JSON.parse(localStorage.getItem(KEYS.games) || '[]') as GameRecord[];
      const localSettings = { ...defaultSettings(), ...JSON.parse(localStorage.getItem(KEYS.settings) || '{}') } as Settings;
      const tombP = Array.from(new Set([...loadTomb(KEYS.tombPlayers), ...(remote.deletedPlayerIds || [])]));
      const tombG = Array.from(new Set([...loadTomb(KEYS.tombGames), ...(remote.deletedGameIds || [])]));
      localStorage.setItem(KEYS.tombPlayers, JSON.stringify(tombP));
      localStorage.setItem(KEYS.tombGames, JSON.stringify(tombG));
      tombPlayersRef.current = tombP;
      tombGamesRef.current = tombG;
      const tombPSet = new Set(tombP);
      const tombGSet = new Set(tombG);
      const merged = mergeBackup(
        { players: localPlayers.filter(p => !tombPSet.has(p.id)), games: localGames.filter(g => !tombGSet.has(g.id)), settings: localSettings },
        { players: (remote.players || []).filter(p => !tombPSet.has(p.id)), games: remote.games.filter(g => !tombGSet.has(g.id)), settings: remote.settings },
      );
      localStorage.setItem(KEYS.players, JSON.stringify(merged.players));
      localStorage.setItem(KEYS.games, JSON.stringify(merged.games));
      localStorage.setItem(KEYS.settings, JSON.stringify(merged.settings));
      setPlayersState(merged.players);
      setGamesState(merged.games);
      setSettingsState(merged.settings);
      const ok = await pushAll(merged.players, merged.settings, merged.games, tombPlayersRef.current, tombGamesRef.current);
      setConnected(ok);
      if (ok) { setUpToDate(true); setLastSync(Date.now()); }
      return ok
        ? { ok: true, message: `Synced — ${merged.players.length} players, ${merged.games.length} games` }
        : { ok: false, message: 'Database write failed' };
    } catch {
      setConnected(false);
      return { ok: false, message: 'Sync failed' };
    } finally {
      setSyncing(false);
    }
  }, []);

  return { players, games, settings, activeGame, setPlayers, setGames, setSettings, setActiveGame, hasDatabase, connected, upToDate, lastSync, syncing, manualSync };
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
        unlockedBadges: Array.from(new Set([...(idMatch.unlockedBadges || []), ...(p.unlockedBadges || [])])),
        badgeCounts: mergeBadgeCounts(idMatch.badgeCounts, p.badgeCounts),
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
        unlockedBadges: Array.from(new Set([...(keyMatch.unlockedBadges || []), ...(p.unlockedBadges || [])])),
        badgeCounts: mergeBadgeCounts(keyMatch.badgeCounts, p.badgeCounts),
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

function mergeBadgeCounts(a: Record<string, number> | undefined, b: Record<string, number> | undefined): Record<string, number> {
  const out: Record<string, number> = { ...(a || {}) };
  for (const [k, v] of Object.entries(b || {})) {
    out[k] = Math.max(out[k] || 0, v);
  }
  return out;
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
