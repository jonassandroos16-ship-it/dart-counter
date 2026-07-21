import type { GameMode, GameRecord, Player, Settings } from '../types';
import { defaultSettings } from '../constants';
import { supabase } from '../supabase';
import { withDefaults } from './settings';

// ── Server sync helpers ──────────────────────────────────────────────
// All helpers THROW on network/permission errors (so callers can mark the
// connection offline) and return null/empty on legitimate no-data cases.
// Tombstones (deleted_player_ids / deleted_game_ids) propagate deletes.

// gameMode is a per-device preference (dart vs cards) so concurrent players
// can each use their own mode. It must never be overwritten by the server
// copy, so we strip it before pushing and re-apply the local value on pull.
// Read from the local settings JSON so it always reflects the latest choice.
import { KEYS } from './keys';

export function getLocalGameMode(): GameMode {
  try {
    const raw = localStorage.getItem(KEYS.settings);
    if (!raw) return 'dartboard';
    const s = JSON.parse(raw) as Partial<Settings>;
    return s.gameMode === 'cards' ? 'cards' : 'dartboard';
  } catch { return 'dartboard'; }
}

function stripGameMode(s: Settings): Omit<Settings, 'gameMode'> {
  const { gameMode: _drop, ...rest } = s;
  return rest as Omit<Settings, 'gameMode'>;
}

function withLocalGameMode(s: Settings | Partial<Settings> | null | undefined): Settings {
  const merged = withDefaults(s ?? null);
  return { ...merged, gameMode: getLocalGameMode() };
}

export async function fetchAppState(): Promise<{ players: Player[]; settings: Settings; deletedPlayerIds: string[]; deletedGameIds: string[] } | null> {
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
    settings: withLocalGameMode(data.settings as Partial<Settings> | null),
    deletedPlayerIds: (data.deleted_player_ids as string[]) || [],
    deletedGameIds: (data.deleted_game_ids as string[]) || [],
  };
}

export async function fetchAllGames(): Promise<GameRecord[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('games').select('data');
  if (error) throw error;
  return (data || []).map((row: any) => row.data as GameRecord);
}

export async function pushAppState(players: Player[], settings: Settings, deletedPlayerIds: string[], deletedGameIds: string[]): Promise<boolean> {
  if (!supabase) return false;
  // Strip gameMode before pushing — it's a per-device preference and must
  // not overwrite what other players have chosen on their own devices.
  const remoteSettings = stripGameMode(settings);
  const { error } = await supabase
    .from('app_state')
    .upsert({ id: 'main', players, settings: remoteSettings, deleted_player_ids: deletedPlayerIds, deleted_game_ids: deletedGameIds, updated_at: new Date().toISOString() }, { onConflict: 'id' });
  if (error) { console.warn('[sync] app_state upsert failed:', error.message); return false; }
  return true;
}

export async function pushAllGames(games: GameRecord[]): Promise<boolean> {
  if (!supabase) return false;
  if (!games.length) return true;
  const rows = games.map(g => ({ id: g.id, data: g }));
  const { error } = await supabase.from('games').upsert(rows, { onConflict: 'id' });
  if (error) { console.warn('[sync] games upsert failed:', error.message); return false; }
  return true;
}

export async function upsertGame(record: GameRecord): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from('games')
    .upsert({ id: record.id, data: record }, { onConflict: 'id' });
  if (error) { console.warn('[sync] game upsert failed:', error.message); return false; }
  return true;
}

export async function deleteGame(id: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from('games').delete().eq('id', id);
  if (error) { console.warn('[sync] game delete failed:', error.message); return false; }
  return true;
}

// Pull everything from the server. Returns null when there is no database
// configured OR the server is unreachable — callers distinguish those two
// cases via the stable `hasDatabase` flag.
export async function pullAll(): Promise<{ players: Player[]; settings: Settings; games: GameRecord[]; deletedPlayerIds: string[]; deletedGameIds: string[] } | null> {
  if (!supabase) return null;
  try {
    const [state, games] = await Promise.all([fetchAppState(), fetchAllGames()]);
    // When no server row exists, fall back to defaults but preserve the
    // local gameMode so the player's mode choice survives the merge.
    const fallbackSettings = withLocalGameMode(defaultSettings());
    return { players: state?.players || [], settings: state?.settings || fallbackSettings, games, deletedPlayerIds: state?.deletedPlayerIds || [], deletedGameIds: state?.deletedGameIds || [] };
  } catch (e: any) {
    console.warn('[sync] pull failed:', e?.message);
    return null;
  }
}

export async function pushAll(players: Player[], settings: Settings, games: GameRecord[], deletedPlayerIds: string[], deletedGameIds: string[]): Promise<boolean> {
  const okState = await pushAppState(players, settings, deletedPlayerIds, deletedGameIds);
  const okGames = await pushAllGames(games);
  return okState && okGames;
}
