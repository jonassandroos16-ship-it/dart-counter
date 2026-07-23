import { supabase } from '../supabase';
import { uid } from '../store';
import type { Game, Player } from '../types';

// ── Device identity ─────────────────────────────────────────────────
// Each device gets a persistent random id so we can determine which device
// owns which player in a multiplayer game.

const DEVICE_KEY = 'dc_device_id';

export function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = uid();
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

// ── Lobby code generation ────────────────────────────────────────────

function generateLobbyCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// ── Types ───────────────────────────────────────────────────────────

export interface LobbyPlayer {
  id: string;
  lobby_id: string;
  device_id: string;
  player_id: string;
  player_name: string;
  player_color: string;
  ready: boolean;
  joined_at: string;
}

export interface GameConfig {
  mode: string;
  doubleOut: boolean;
  legs: number;
  teamMode: boolean;
  teamAssignment: number[];
  powerUps: boolean;
}

export type MultiplayerGameMode = 'dartboard' | 'cards' | 'coop' | 'dartlite';

export interface Lobby {
  id: string;
  code: string;
  name: string;
  host_device_id: string;
  host_player_id: string;
  status: 'lobby' | 'playing' | 'finished';
  game_config: GameConfig | null;
  game_state: Game | null;
  popup_state: { type: string; playerId: string; data: any } | null;
  player_turn: number;
  game_mode: MultiplayerGameMode;
  created_at: string;
  updated_at: string;
}

export interface LobbyWithPlayers extends Lobby {
  players: LobbyPlayer[];
}

// ── Lobby CRUD ──────────────────────────────────────────────────────

export async function createLobby(name: string, hostPlayer: Player, gameMode: MultiplayerGameMode): Promise<Lobby | null> {
  if (!supabase) return null;
  const deviceId = getDeviceId();
  const code = generateLobbyCode();
  const { data, error } = await supabase
    .from('mp_lobbies')
    .insert({
      code,
      name,
      host_device_id: deviceId,
      host_player_id: hostPlayer.id,
      status: 'lobby',
      game_mode: gameMode,
    })
    .select()
    .single();
  if (error) { console.warn('[mp] createLobby:', error.message); return null; }
  return data as Lobby;
}

export async function joinLobby(lobbyId: string, player: Player): Promise<boolean> {
  if (!supabase) return false;
  const deviceId = getDeviceId();
  const { error } = await supabase
    .from('mp_lobby_players')
    .insert({
      lobby_id: lobbyId,
      device_id: deviceId,
      player_id: player.id,
      player_name: player.name,
      player_color: player.color,
      ready: false,
    });
  if (error) {
    if (error.code === '23505') return true;
    console.warn('[mp] joinLobby:', error.message);
    return false;
  }
  return true;
}

export async function leaveLobby(lobbyId: string, playerId: string): Promise<void> {
  if (!supabase) return;
  const deviceId = getDeviceId();
  await supabase
    .from('mp_lobby_players')
    .delete()
    .eq('lobby_id', lobbyId)
    .eq('device_id', deviceId)
    .eq('player_id', playerId);
}

export async function deleteLobby(lobbyId: string): Promise<void> {
  if (!supabase) return;
  await supabase.from('mp_lobbies').delete().eq('id', lobbyId);
}

export async function setPlayerReady(lobbyId: string, playerId: string, ready: boolean): Promise<void> {
  if (!supabase) return;
  const deviceId = getDeviceId();
  await supabase
    .from('mp_lobby_players')
    .update({ ready })
    .eq('lobby_id', lobbyId)
    .eq('device_id', deviceId)
    .eq('player_id', playerId);
}

export async function fetchLobby(lobbyId: string): Promise<Lobby | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('mp_lobbies')
    .select('*')
    .eq('id', lobbyId)
    .maybeSingle();
  if (error) { console.warn('[mp] fetchLobby:', error.message); return null; }
  return data as Lobby;
}

export async function fetchLobbyPlayers(lobbyId: string): Promise<LobbyPlayer[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('mp_lobby_players')
    .select('*')
    .eq('lobby_id', lobbyId)
    .order('joined_at', { ascending: true });
  if (error) { console.warn('[mp] fetchLobbyPlayers:', error.message); return []; }
  return (data || []) as LobbyPlayer[];
}

export async function fetchOpenLobbies(): Promise<Lobby[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('mp_lobbies')
    .select('*')
    .eq('status', 'lobby')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) { console.warn('[mp] fetchOpenLobbies:', error.message); return []; }
  return (data || []) as Lobby[];
}

export async function fetchLobbyByCode(code: string): Promise<Lobby | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('mp_lobbies')
    .select('*')
    .eq('code', code.toUpperCase())
    .eq('status', 'lobby')
    .maybeSingle();
  if (error) { console.warn('[mp] fetchLobbyByCode:', error.message); return null; }
  return data as Lobby;
}

// ── Host game operations ────────────────────────────────────────────

export async function updateGameState(lobbyId: string, game: Game): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from('mp_lobbies')
    .update({
      game_state: game,
      player_turn: game.turn,
      updated_at: new Date().toISOString(),
    })
    .eq('id', lobbyId);
  if (error) console.warn('[mp] updateGameState:', error.message);
}

export async function startGame(lobbyId: string, config: GameConfig, game: Game): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from('mp_lobbies')
    .update({
      status: 'playing',
      game_config: config,
      game_state: game,
      player_turn: game.turn,
      updated_at: new Date().toISOString(),
    })
    .eq('id', lobbyId);
  if (error) console.warn('[mp] startGame:', error.message);
}

export async function setLobbyGameMode(lobbyId: string, gameMode: MultiplayerGameMode): Promise<void> {
  if (!supabase) return;
  await supabase
    .from('mp_lobbies')
    .update({ game_mode: gameMode, updated_at: new Date().toISOString() })
    .eq('id', lobbyId);
}

export async function updateLobbyConfig(lobbyId: string, config: GameConfig): Promise<void> {
  if (!supabase) return;
  await supabase
    .from('mp_lobbies')
    .update({ game_config: config, updated_at: new Date().toISOString() })
    .eq('id', lobbyId);
}

export async function setLobbyStatus(lobbyId: string, status: string): Promise<void> {
  if (!supabase) return;
  await supabase
    .from('mp_lobbies')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', lobbyId);
}

// ── Popup sync ──────────────────────────────────────────────────────

export async function setPopupState(
  lobbyId: string,
  popup: { type: string; playerId: string; data: any } | null,
): Promise<void> {
  if (!supabase) return;
  await supabase
    .from('mp_lobbies')
    .update({ popup_state: popup, updated_at: new Date().toISOString() })
    .eq('id', lobbyId);
}

// ── Realtime subscriptions ──────────────────────────────────────────

export function subscribeToLobby(
  lobbyId: string,
  onLobbyUpdate: (lobby: Lobby) => void,
  onPlayersUpdate: (players: LobbyPlayer[]) => void,
): () => void {
  if (!supabase) return () => {};
  const s = supabase;

  const lobbyChannel = s
    .channel(`lobby-${lobbyId}`)
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'mp_lobbies', filter: `id=eq.${lobbyId}` },
      (payload: any) => {
        if (payload.new) onLobbyUpdate(payload.new as Lobby);
      },
    )
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'mp_lobby_players', filter: `lobby_id=eq.${lobbyId}` },
      () => {
        void fetchLobbyPlayers(lobbyId).then(onPlayersUpdate);
      },
    )
    .subscribe();

  return () => {
    s.removeChannel(lobbyChannel);
  };
}

export function subscribeToLobbyList(onChange: () => void): () => void {
  if (!supabase) return () => {};
  const s = supabase;
  const channel = s
    .channel('lobby-list')
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'mp_lobbies' },
      () => onChange(),
    )
    .subscribe();
  return () => { s.removeChannel(channel); };
}

// ── Turn ownership ──────────────────────────────────────────────────

export function isMyTurn(lobbyPlayers: LobbyPlayer[], game: Game | null): boolean {
  if (!game || game.finished) return false;
  const currentTurn = game.turn;
  const currentPlayer = game.players[currentTurn];
  if (!currentPlayer) return false;
  const deviceId = getDeviceId();
  const lobbyPlayer = lobbyPlayers.find(lp => lp.player_id === currentPlayer.id);
  if (!lobbyPlayer) return false;
  return lobbyPlayer.device_id === deviceId;
}

export function ownsPlayer(lobbyPlayers: LobbyPlayer[], playerId: string): boolean {
  const deviceId = getDeviceId();
  return lobbyPlayers.some(lp => lp.player_id === playerId && lp.device_id === deviceId);
}
