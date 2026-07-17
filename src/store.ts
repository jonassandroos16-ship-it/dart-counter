import { useState, useCallback, useRef } from 'react';
import type { GameRecord, Player, Settings } from './types';
import { defaultSettings } from './constants';

const KEYS = { players: 'dc_players', games: 'dc_games', settings: 'dc_settings' };

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export const todayKey = (d: Date = new Date()) => d.toISOString().slice(0, 10);
export const initials = (n: string) => (n || '?').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();

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

export interface DBAPI {
  players: Player[];
  games: GameRecord[];
  settings: Settings;
  setPlayers: (updater: Player[] | ((prev: Player[]) => Player[])) => void;
  setGames: (updater: GameRecord[] | ((prev: GameRecord[]) => GameRecord[])) => void;
  setSettings: (updater: Settings | ((prev: Settings) => Settings)) => void;
}

export function useDB(): DBAPI {
  const [players, setPlayersState] = useState<Player[]>(() => JSON.parse(localStorage.getItem(KEYS.players) || '[]'));
  const [games, setGamesState] = useState<GameRecord[]>(() => JSON.parse(localStorage.getItem(KEYS.games) || '[]'));
  const [settings, setSettingsState] = useState<Settings>(loadSettings);
  const ref = useRef({ players, games, settings });
  ref.current = { players, games, settings };

  const setPlayers = useCallback((updater: Player[] | ((prev: Player[]) => Player[])) => {
    setPlayersState(prev => { const next = typeof updater === 'function' ? (updater as any)(prev) : updater; localStorage.setItem(KEYS.players, JSON.stringify(next)); return next; });
  }, []);
  const setGames = useCallback((updater: GameRecord[] | ((prev: GameRecord[]) => GameRecord[])) => {
    setGamesState(prev => { const next = typeof updater === 'function' ? (updater as any)(prev) : updater; localStorage.setItem(KEYS.games, JSON.stringify(next)); return next; });
  }, []);
  const setSettings = useCallback((updater: Settings | ((prev: Settings) => Settings)) => {
    setSettingsState(prev => { const next = typeof updater === 'function' ? (updater as any)(prev) : updater; localStorage.setItem(KEYS.settings, JSON.stringify(next)); return next; });
  }, []);

  return { players, games, settings, setPlayers, setGames, setSettings };
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
