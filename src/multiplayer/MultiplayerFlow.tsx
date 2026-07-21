import { useEffect, useState, useCallback, useRef } from 'react';
import type { Game, GameRecord, Player, Settings } from '../types';
import type { Lobby, LobbyPlayer, GameConfig } from './client';
import {
  createLobby, joinLobby, leaveLobby, deleteLobby,
  fetchLobbyPlayers, startGame, subscribeToLobby,
  getDeviceId, setLobbyStatus,
} from './client';
import { Sound } from '../sound';
import type { MusicEngine } from '../music';
import type { PopupControls } from '../Popups';
import { LobbyBrowser } from './LobbyBrowser';
import { CreateLobbyView } from './CreateLobbyView';
import { LobbyRoom } from './LobbyRoom';
import { MultiplayerGameView } from './MultiplayerGameView';

type Stage = 'browser' | 'create' | 'room' | 'game';
interface Props {
  players: Player[];
  settings: Settings;
  music: MusicEngine;
  popups: PopupControls;
  setGames: (updater: any) => void;
  toast: (m: string) => void;
  onExitToMenu: () => void;
  renderBoard: (props: {
    game: Game;
    setGame: (g: Game | null) => void;
    isMyTurn: boolean;
    popups: PopupControls;
  }) => React.ReactNode;
}


export function MultiplayerFlow({
  players, settings, music, popups, setGames, toast, onExitToMenu, renderBoard,
}: Props) {
  const deviceId = getDeviceId();
  const [stage, setStage] = useState<Stage>('browser');
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [lobbyPlayers, setLobbyPlayers] = useState<LobbyPlayer[]>([]);
  const [game, setGameState] = useState<Game | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    return () => { if (unsubRef.current) unsubRef.current(); };
  }, []);

  const subscribe = useCallback((lobbyId: string) => {
    if (unsubRef.current) unsubRef.current();
    unsubRef.current = subscribeToLobby(
      lobbyId,
      (updated) => {
        setLobby(updated);
        if (updated.status === 'playing' && updated.game_state) {
          setGameState(updated.game_state);
          setStage('game');
        }
        if (updated.status === 'lobby') {
          setStage('room');
          setGameState(null);
        }
        if (updated.status === 'finished') {
          setStage('room');
        }
      },
      (lp) => setLobbyPlayers(lp),
    );
  }, []);

  const handleCreate = useCallback(async (name: string, hostPlayer: Player) => {
    const newLobby = await createLobby(name, hostPlayer);
    if (!newLobby) { toast('Could not create lobby'); return; }
    setLobby(newLobby);
    setStage('room');
    subscribe(newLobby.id);
    const ok = await joinLobby(newLobby.id, hostPlayer);
    if (!ok) { toast('Could not join lobby'); return; }
    const lp = await fetchLobbyPlayers(newLobby.id);
    setLobbyPlayers(lp);
    toast(`Lobby created! Code: ${newLobby.code}`);
  }, [subscribe, toast]);

  const handleJoin = useCallback(async (targetLobby: Lobby) => {
    if (!players.length) { toast('Add a player first'); return; }
    setLobby(targetLobby);
    setStage('room');
    subscribe(targetLobby.id);
    const ok = await joinLobby(targetLobby.id, players[0]);
    if (!ok) { toast('Could not join lobby'); return; }
    const lp = await fetchLobbyPlayers(targetLobby.id);
    setLobbyPlayers(lp);
  }, [players, subscribe, toast]);

  const handleAddLocalPlayer = useCallback(async (player: Player) => {
    if (!lobby) return;
    const ok = await joinLobby(lobby.id, player);
    if (ok) {
      const lp = await fetchLobbyPlayers(lobby.id);
      setLobbyPlayers(lp);
      toast(`${player.name} joined the lobby`);
    }
  }, [lobby, toast]);

  const handleLeave = useCallback(async () => {
    if (!lobby) return;
    const myPlayers = lobbyPlayers.filter(lp => lp.device_id === deviceId);
    for (const lp of myPlayers) {
      await leaveLobby(lobby.id, lp.player_id);
    }
    if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; }
    if (lobby.host_device_id === deviceId) {
      await deleteLobby(lobby.id);
    }
    setLobby(null);
    setLobbyPlayers([]);
    setGameState(null);
    setStage('browser');
  }, [lobby, lobbyPlayers, deviceId]);

  const handleStartGame = useCallback(async (config: GameConfig, newGame: Game) => {
    if (!lobby) return;
    await startGame(lobby.id, config, newGame);
    setGameState(newGame);
    setStage('game');
    Sound.play('showdown', {}, settings);
    music.stop();
  }, [lobby, settings, music]);

  const handleGameUpdate = useCallback((updated: Game) => {
    setGameState(updated);
  }, []);

  const handleGameOver = useCallback((record: GameRecord) => {
    setGames((prev: GameRecord[]) => [...prev, record]);
    if (lobby) void setLobbyStatus(lobby.id, 'finished');
  }, [setGames, lobby]);

  if (stage === 'browser') {
    return <LobbyBrowser players={players} onCreate={() => setStage('create')} onJoin={handleJoin} onBack={onExitToMenu} />;
  }

  if (stage === 'create') {
    return <CreateLobbyView players={players} onCreate={handleCreate} onBack={() => setStage('browser')} />;
  }

  if (stage === 'room' && lobby) {
    return (
      <LobbyRoom
        lobby={lobby}
        players={lobbyPlayers}
        localPlayers={players}
        settings={settings}
        isHost={lobby.host_device_id === deviceId}
        onStartGame={handleStartGame}
        onLeave={handleLeave}
        onAddLocalPlayer={handleAddLocalPlayer}
      />
    );
  }

  if (stage === 'game' && lobby && game) {
    return (
      <MultiplayerGameView
        lobby={lobby}
        lobbyPlayers={lobbyPlayers}
        game={game}
        settings={settings}
        isHost={lobby.host_device_id === deviceId}
        popups={popups}
        onGameUpdate={handleGameUpdate}
        onGameOver={handleGameOver}
        renderBoard={renderBoard}
      />
    );
  }

  return <LobbyBrowser players={players} onCreate={() => setStage('create')} onJoin={handleJoin} onBack={onExitToMenu} />;
}
