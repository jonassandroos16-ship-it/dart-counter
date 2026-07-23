import { useEffect, useState, useCallback, useRef } from 'react';
import type { Game, GameRecord, Player, Settings } from '../types';
import type { Lobby, LobbyPlayer, GameConfig, InputMode } from './client';
import {
  createLobby, joinLobby, leaveLobby, deleteLobby,
  fetchLobbyPlayers, startGame, subscribeToLobby,
  getDeviceId, setLobbyStatus, startCoopGame,
} from './client';
import type { MultiplayerGameMode } from './client';
import { Sound } from '../sound';
import type { MusicEngine } from '../music';
import type { PopupControls } from '../Popups';
import { LobbyBrowser } from './LobbyBrowser';
import { CreateLobbyView } from './CreateLobbyView';
import { LobbyRoom } from './LobbyRoom';
import { MultiplayerGameView } from './MultiplayerGameView';
import { CoopFlow } from '../play/CoopFlow';
import { DartliteFlow } from '../play/DartliteFlow';

type Stage = 'browser' | 'create' | 'room' | 'game' | 'coop' | 'dartlite';
interface Props {
  players: Player[];
  setPlayers: (updater: any) => void;
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
    gameMode: MultiplayerGameMode;
  }) => React.ReactNode;
}


export function MultiplayerFlow({
  players, setPlayers, settings, music, popups, setGames, toast, onExitToMenu, renderBoard,
}: Props) {
  const deviceId = getDeviceId();
  const [stage, setStage] = useState<Stage>('browser');
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [lobbyPlayers, setLobbyPlayers] = useState<LobbyPlayer[]>([]);
  const [game, setGameState] = useState<Game | null>(null);
  const [coopPlayers, setCoopPlayers] = useState<Player[]>([]);
  const [remoteRun, setRemoteRun] = useState<any>(null);
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
          const gs = updated.game_state as any;
          // Coop/Dartlite runs are synced as game_state but don't have the
          // standard Game shape (no .players array with .visits). Detect by
          // checking for _coopRun marker or phase/round fields.
          if (gs._coopRun || gs.phase === 'choice' || gs.phase === 'boss_victory' || gs.phase === 'reward' || gs.phase === 'battle' || gs.phase === 'gameover') {
            setRemoteRun(gs);
          } else {
            setGameState(updated.game_state);
            setStage('game');
          }
        }
        if (updated.status === 'playing' && !updated.game_state && updated.game_config) {
          // Coop/Dartlite start: host wrote game_config with _coopMode but no
          // game_state. Remote devices read the config and transition to the
          // coop/dartlite stage using the player IDs from the lobby.
          const cfg = updated.game_config as any;
          if (cfg._coopMode === 'dartlite') {
            const coopPlayers = lobbyPlayers
              .filter(lp => cfg.playerIds?.includes(lp.player_id))
              .map(lp => ({ id: lp.player_id, name: lp.player_name, color: lp.player_color } as Player));
            setCoopPlayers(coopPlayers);
            setStage('dartlite');
            music.stop();
          } else if (cfg._coopMode === 'coop') {
            const coopPlayers = lobbyPlayers
              .filter(lp => cfg.playerIds?.includes(lp.player_id))
              .map(lp => ({ id: lp.player_id, name: lp.player_name, color: lp.player_color } as Player));
            setCoopPlayers(coopPlayers);
            setStage('coop');
            music.stop();
          }
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
  }, [lobbyPlayers, music]);

  const handleCreate = useCallback(async (name: string, hostPlayer: Player) => {
    const newLobby = await createLobby(name, hostPlayer, settings.gameMode, settings.gameMode);
    if (!newLobby) { toast('Could not create lobby'); return; }
    setLobby(newLobby);
    setStage('room');
    subscribe(newLobby.id);
    const ok = await joinLobby(newLobby.id, hostPlayer);
    if (!ok) { toast('Could not join lobby'); return; }
    const lp = await fetchLobbyPlayers(newLobby.id);
    setLobbyPlayers(lp);
    toast(`Lobby created! Code: ${newLobby.code}`);
  }, [subscribe, toast, settings.gameMode]);

  const handleJoin = useCallback(async (targetLobby: Lobby, joinPlayer: Player) => {
    setLobby(targetLobby);
    setStage('room');
    subscribe(targetLobby.id);
    const ok = await joinLobby(targetLobby.id, joinPlayer);
    if (!ok) { toast('Could not join lobby'); return; }
    const lp = await fetchLobbyPlayers(targetLobby.id);
    setLobbyPlayers(lp);
  }, [subscribe, toast]);

  const handleAddLocalPlayer = useCallback(async (player: Player) => {
    if (!lobby) return;
    const ok = await joinLobby(lobby.id, player);
    if (ok) {
      const lp = await fetchLobbyPlayers(lobby.id);
      setLobbyPlayers(lp);
      toast(`${player.name} joined the lobby`);
    }
  }, [lobby, toast]);

  const isHost = lobby?.host_device_id === deviceId;
  useEffect(() => {
    localStorage.setItem('mp_hosting', isHost && lobby ? '1' : '0');
    return () => { localStorage.setItem('mp_hosting', '0'); };
  }, [isHost, lobby]);

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
    localStorage.setItem('mp_hosting', '0');
    setLobby(null);
    setLobbyPlayers([]);
    setGameState(null);
    setStage('browser');
  }, [lobby, lobbyPlayers, deviceId]);

  const handleStartGame = useCallback(async (config: GameConfig, newGame: Game) => {
    if (!lobby) return;
    const mpGame = newGame as any;
    if (mpGame._multiplayerCoop) {
      const coopMode = mpGame._coopMode as string;
      const coopPlayers = mpGame.players as Player[];
      const inputMode = (mpGame._inputMode as InputMode) ?? (settings.gameMode === 'cards' ? 'cards' : 'dartboard');
      const playerIds = coopPlayers.map(p => p.id);
      setCoopPlayers(coopPlayers);
      setStage(coopMode === 'dartlite' ? 'dartlite' : 'coop');
      music.stop();
      // Notify remote devices via realtime so they also transition.
      await startCoopGame(lobby.id, coopMode as 'coop' | 'dartlite', playerIds, inputMode);
      return;
    }
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

  const lobbyGameMode: MultiplayerGameMode = lobby?.game_mode ?? settings.gameMode;
  const lobbyInputMode: InputMode = lobby?.input_mode ?? (lobbyGameMode === 'cards' ? 'cards' : 'dartboard');

  if (stage === 'coop' && coopPlayers.length > 0) {
    return <CoopFlow
      players={coopPlayers}
      settings={settings}
      music={music}
      setPlayers={setPlayers}
      toast={toast}
      onExitToMenu={() => { setCoopPlayers([]); setRemoteRun(null); handleLeave(); }}
      skipSetup
      lobbyId={lobby?.id}
      lobbyPlayers={lobbyPlayers}
      isHost={isHost}
      remoteRun={remoteRun}
    />;
  }

  if (stage === 'dartlite' && coopPlayers.length > 0) {
    return <DartliteFlow
      players={coopPlayers}
      settings={settings}
      music={music}
      setPlayers={setPlayers}
      onExitToMenu={() => { setCoopPlayers([]); setRemoteRun(null); handleLeave(); }}
      skipSetup
      cardMode={lobbyInputMode === 'cards'}
      lobbyId={lobby?.id}
      lobbyPlayers={lobbyPlayers}
      isHost={isHost}
      remoteRun={remoteRun}
    />;
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
        onLeaveGame={() => { setGameState(null); handleLeave(); }}
        toast={toast}
        renderBoard={renderBoard}
        gameMode={lobbyGameMode}
      />
    );
  }

  return <LobbyBrowser players={players} onCreate={() => setStage('create')} onJoin={handleJoin} onBack={onExitToMenu} />;
}
