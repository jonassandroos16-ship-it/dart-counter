import { useEffect, useState } from 'react';
import type { Game, GameRecord, Player, Settings } from './types';
import { createGame } from './logic';
import { Sound } from './sound';
import type { MusicEngine } from './music';
import type { PopupControls } from './Popups';
import { SetupView } from './play/SetupView';
import { ModeSelectView } from './play/ModeSelectView';
import { Showdown } from './play/Showdown';
import { X01Board } from './play/boards/X01Board';
import { AtcBoard } from './play/boards/AtcBoard';
import { KillerBoard } from './play/boards/KillerBoard';
import { HighScoreBoard } from './play/boards/HighScoreBoard';
import { BattleBoard } from './play/boards/BattleBoard';
import { CardBoard } from './play/boards/CardBoard';
import { CoopFlow, isCoopActive } from './play/CoopFlow';
import { DartliteFlow, isDartliteActive } from './play/DartliteFlow';
import { MultiplayerFlow } from './multiplayer/MultiplayerFlow';

interface Props {
  players: Player[];
  games: GameRecord[];
  settings: Settings;
  activeGame: Game | null;
  setActiveGame: (updater: any) => void;
  setGames: (updater: any) => void;
  setPlayers: (updater: any) => void;
  toast: (m: string) => void;
  music: MusicEngine;
  onQuit: () => void;
  onGameOver: () => void;
  popups: PopupControls;
}

export function PlayView({ players, games, settings, activeGame, setActiveGame, setGames, setPlayers, toast, music, onQuit, onGameOver, popups }: Props) {
  const game = activeGame;
  const setGame = setActiveGame;
  const [showdown, setShowdown] = useState<Game | null>(null);
  const [coopStage, setCoopStage] = useState<'none' | 'setup' | 'chapters' | 'map' | 'battle' | 'postgame'>('none');
  const [mode, setMode] = useState<'menu' | 'competitive' | 'multiplayer'>('menu');
  const [dartliteStage, setDartliteStage] = useState<'none' | 'setup' | 'battle' | 'gameover'>('none');

  useEffect(() => {
    if (game && !game.finished) music.startContext('match', settings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isCoopActive(coopStage)) {
    return <CoopFlow
      players={players}
      settings={settings}
      music={music}
      setPlayers={setPlayers}
      toast={toast}
      onExitToMenu={() => { setCoopStage('none'); setMode('menu'); }}
    />;
  }

  if (isDartliteActive(dartliteStage)) {
    return <DartliteFlow
      players={players}
      settings={settings}
      music={music}
      setPlayers={setPlayers}
      onExitToMenu={() => { setDartliteStage('none'); setMode('menu'); }}
    />;
  }

  if (mode === 'multiplayer') {
    return <MultiplayerFlow
      players={players}
      settings={settings}
      music={music}
      popups={popups}
      setGames={setGames}
      toast={toast}
      onExitToMenu={() => { setMode('menu'); music.startContext('setup', settings); }}
      renderBoard={({ game: g, setGame: sg, popups: mpPopups, isMyTurn: myTurn, gameMode: mpGameMode }) => {
        const quit = () => { sg(null); onQuit(); };
        if (mpGameMode === 'cards') return <CardBoard game={g} setGame={sg} settings={settings} players={players} games={games} setGames={setGames} setPlayers={setPlayers} toast={toast} music={music} onQuit={quit} onGameOver={onGameOver} popups={mpPopups} isMyTurn={myTurn} />;
        if (g.atc) return <AtcBoard game={g} setGame={sg} settings={settings} players={players} games={games} toast={toast} music={music} onQuit={quit} setGames={setGames} setPlayers={setPlayers} popups={mpPopups} onGameOver={onGameOver} isMyTurn={myTurn} />;
        if (g.mode === 'killer') return <KillerBoard game={g} setGame={sg} settings={settings} players={players} games={games} toast={toast} music={music} onQuit={quit} setGames={setGames} setPlayers={setPlayers} popups={mpPopups} onGameOver={onGameOver} isMyTurn={myTurn} />;
        if (g.mode === 'highscore') return <HighScoreBoard game={g} setGame={sg} settings={settings} players={players} games={games} toast={toast} music={music} onQuit={quit} setGames={setGames} setPlayers={setPlayers} popups={mpPopups} onGameOver={onGameOver} isMyTurn={myTurn} />;
        if (g.mode === 'battle') return <BattleBoard game={g} setGame={sg} settings={settings} players={players} games={games} toast={toast} music={music} onQuit={quit} setGames={setGames} setPlayers={setPlayers} popups={mpPopups} onGameOver={onGameOver} isMyTurn={myTurn} />;
        return <X01Board game={g} setGame={sg} settings={settings} players={players} games={games} setGames={setGames} setPlayers={setPlayers} toast={toast} music={music} onQuit={quit} onGameOver={onGameOver} popups={mpPopups} isMyTurn={myTurn} />;
      }}
    />;
  }

  if (showdown) {
    return <Showdown game={showdown} players={players} games={games} settings={settings} music={music}
      onClose={() => {
        Sound.play('showdown_close', {}, settings);
        setShowdown(null);
        music.startContext('match', settings);
      }} />;
  }

  if (game) {
    if (settings.gameMode === 'cards') return <CardBoard game={game} setGame={setGame} settings={settings} players={players} games={games} setGames={setGames} setPlayers={setPlayers} toast={toast} music={music} onQuit={() => { setGame(null); onQuit(); }} onGameOver={onGameOver} popups={popups} />;
    if (game.atc) return <AtcBoard game={game} setGame={setGame} settings={settings} players={players} games={games} toast={toast} music={music} onQuit={() => { setGame(null); onQuit(); }} setGames={setGames} setPlayers={setPlayers} popups={popups} onGameOver={onGameOver} />;
    if (game.mode === 'killer') return <KillerBoard game={game} setGame={setGame} settings={settings} players={players} games={games} toast={toast} music={music} onQuit={() => { setGame(null); onQuit(); }} setGames={setGames} setPlayers={setPlayers} popups={popups} onGameOver={onGameOver} />;
    if (game.mode === 'highscore') return <HighScoreBoard game={game} setGame={setGame} settings={settings} players={players} games={games} toast={toast} music={music} onQuit={() => { setGame(null); onQuit(); }} setGames={setGames} setPlayers={setPlayers} popups={popups} onGameOver={onGameOver} />;
    if (game.mode === 'battle') return <BattleBoard game={game} setGame={setGame} settings={settings} players={players} games={games} toast={toast} music={music} onQuit={() => { setGame(null); onQuit(); }} setGames={setGames} setPlayers={setPlayers} popups={popups} onGameOver={onGameOver} />;
    return <X01Board game={game} setGame={setGame} settings={settings} players={players} games={games} setGames={setGames} setPlayers={setPlayers} toast={toast} music={music} onQuit={() => { setGame(null); onQuit(); }} onGameOver={onGameOver} popups={popups} />;
  }

  if (mode === 'competitive') {
    return <SetupView players={players} settings={settings} onBackToModeSelect={() => { setMode('menu'); music.startContext('setup', settings); }} onStart={(mode, ids, dbl, legs, teamMode, teamAssignment, powerUps) => {
      const g = createGame(mode, ids, players, dbl, legs, teamMode, teamAssignment, powerUps, settings);
      Sound.play('showdown', {}, settings);
      music.stop();
      setActiveGame(g);
      setShowdown(g);
    }} />;
  }

  return <ModeSelectView
    players={players}
    onPickCompetitive={() => { setMode('competitive'); music.startContext('setup', settings); }}
    onPickCoop={() => { setCoopStage('setup'); music.startContext('setup', settings); }}
    onPickDartlite={() => { setDartliteStage('setup'); music.startContext('setup', settings); }}
    onPickMultiplayer={() => { setMode('multiplayer'); music.startContext('setup', settings); }}
  />;
}
