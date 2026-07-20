import { useState, useCallback, useRef, useEffect } from 'react';
import type { Game, GameRecord, Player, Settings } from '../types';
import { supabase } from '../supabase';
import { KEYS, loadTomb } from './keys';
import { withDefaults, loadSettings, loadActiveGame } from './settings';
import { mergeBackup } from './merge';
import { pullAll, pushAll, pushAppState, upsertGame, deleteGame } from './sync';

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
    const localSettings = withDefaults(JSON.parse(localStorage.getItem(KEYS.settings) || '{}') as Partial<Settings>);
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
      const localSettings = withDefaults(JSON.parse(localStorage.getItem(KEYS.settings) || '{}') as Partial<Settings>);
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