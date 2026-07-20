import type { GameRecord, Player, Settings } from '../types';
import { defaultSettings } from '../constants';
import { supabase } from '../supabase';
import { withDefaults } from './settings';

// ── Server sync helpers ──────────────────────────────────────────────
// All helpers THROW on network/permission errors (so callers can mark the
// connection offline) and return null/empty on legitimate no-data cases.
// Tombstones (deleted_player_ids / deleted_game_ids) propagate deletes.

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
    settings: withDefaults(data.settings as Partial<Settings> | null),
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
  const { error } = await supabase
    .from('app_state')
    .upsert({ id: 'main', players, settings, deleted_player_ids: deletedPlayerIds, deleted_game_ids: deletedGameIds, updated_at: new Date().toISOString() }, { onConflict: 'id' });
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
    return { players: state?.players || [], settings: state?.settings || defaultSettings(), games, deletedPlayerIds: state?.deletedPlayerIds || [], deletedGameIds: state?.deletedGameIds || [] };
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