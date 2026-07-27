import { useEffect, useState } from 'react';
import type { Game, GameRecord, Player, Settings } from './types';
import { createGame } from './logic';
import { Sound } from './sound';
import type { MusicEngine } from './music';
import type { PopupControls } from './Popups';
import { SetupView } from './play/SetupView';
import { ModeSelectView } from './play/ModeSelectView';
import { Showdown } from './play/Showdown';
import { renderBoard } from './play/renderBoard';
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
      setPlayers={setPlayers}
      settings={settings}
      music={music}
      popups={popups}
      setGames={setGames}
      toast={toast}
      onExitToMenu={() => { setMode('menu'); music.startContext('setup', settings); }}
      renderBoard={({ game: g, setGame: sg, popups: mpPopups, isMyTurn: myTurn, gameMode: mpGameMode }) =>
        renderBoard({
          game: g, setGame: sg, settings, players, games, setGames, setPlayers, toast, music,
          onQuit: () => { sg(null); onQuit(); }, onGameOver, popups: mpPopups, isMyTurn: myTurn, gameMode: mpGameMode === 'cards' ? 'cards' : 'dartboard',
        })
      }
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
    return renderBoard({
      game, setGame, settings, players, games, setGames, setPlayers, toast, music,
      onQuit: () => { setGame(null); onQuit(); }, onGameOver, popups, gameMode: settings.gameMode,
    });
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
