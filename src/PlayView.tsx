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
import { CampaignMap } from './campaign/CampaignMap';
import { CampaignBattle } from './campaign/CampaignBattle';
import { CoopSetupView } from './campaign/CoopSetupView';
import { useCampaignProgress } from './campaign/progress';

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

type CoopStage = 'none' | 'setup' | 'map' | 'battle';

export function PlayView({ players, games, settings, activeGame, setActiveGame, setGames, setPlayers, toast, music, onQuit, onGameOver, popups }: Props) {
  const game = activeGame;
  const setGame = setActiveGame;
  const [showdown, setShowdown] = useState<Game | null>(null);
  const [coopStage, setCoopStage] = useState<CoopStage>('none');
  const [coopPlayerIds, setCoopPlayerIds] = useState<string[]>([]);
  const [coopLevelId, setCoopLevelId] = useState<number | null>(null);
  const [mode, setMode] = useState<'menu' | 'competitive'>('menu');
  const { progress, setProgress } = useCampaignProgress();

  useEffect(() => {
    if (game && !game.finished) music.startContext('match', settings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (coopStage === 'battle' && coopLevelId != null) {
    const coopPlayers = coopPlayerIds.map(id => players.find(p => p.id === id)).filter(Boolean) as Player[];
    return <CampaignBattle
      levelId={coopLevelId}
      progress={progress}
      settings={settings}
      players={coopPlayers}
      onWin={(newHighest) => {
        setProgress(prev => ({ ...prev, highest_level_beaten: newHighest }));
        toast(`Level ${coopLevelId} cleared!`);
        setCoopStage('map');
        setCoopLevelId(null);
        music.startContext('setup', settings);
      }}
      onLose={() => {
        toast('Party defeated — try again.');
        setCoopStage('map');
        setCoopLevelId(null);
        music.startContext('setup', settings);
      }}
      onQuit={() => {
        setCoopStage('map');
        setCoopLevelId(null);
        music.startContext('setup', settings);
      }}
    />;
  }

  if (coopStage === 'map') {
    const coopPlayers = coopPlayerIds.map(id => players.find(p => p.id === id)).filter(Boolean) as Player[];
    return <CampaignMap
      progress={progress}
      players={coopPlayers}
      onPick={(id) => { setCoopLevelId(id); setCoopStage('battle'); music.stop(); }}
      onBack={() => { setCoopStage('setup'); music.startContext('setup', settings); }}
    />;
  }

  if (coopStage === 'setup') {
    return <CoopSetupView
      players={players}
      settings={settings}
      onStart={(ids) => { setCoopPlayerIds(ids); setCoopStage('map'); }}
      onBack={() => { setCoopStage('none'); setMode('menu'); music.startContext('setup', settings); }}
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
    if (game.atc) return <AtcBoard game={game} setGame={setGame} settings={settings} players={players} games={games} toast={toast} music={music} onQuit={() => { setGame(null); onQuit(); }} setGames={setGames} setPlayers={setPlayers} />;
    if (game.mode === 'killer') return <KillerBoard game={game} setGame={setGame} settings={settings} players={players} games={games} toast={toast} music={music} onQuit={() => { setGame(null); onQuit(); }} setGames={setGames} setPlayers={setPlayers} popups={popups} onGameOver={onGameOver} />;
    if (game.mode === 'highscore') return <HighScoreBoard game={game} setGame={setGame} settings={settings} players={players} games={games} toast={toast} music={music} onQuit={() => { setGame(null); onQuit(); }} setGames={setGames} setPlayers={setPlayers} popups={popups} onGameOver={onGameOver} />;
    if (game.mode === 'battle') return <BattleBoard game={game} setGame={setGame} settings={settings} players={players} games={games} toast={toast} music={music} onQuit={() => { setGame(null); onQuit(); }} setGames={setGames} setPlayers={setPlayers} popups={popups} onGameOver={onGameOver} />;
    return <X01Board game={game} setGame={setGame} settings={settings} players={players} games={games} setGames={setGames} setPlayers={setPlayers} toast={toast} music={music} onQuit={() => { setGame(null); onQuit(); }} onGameOver={onGameOver} popups={popups} />;
  }

  if (mode === 'competitive') {
    return <SetupView players={players} onBackToModeSelect={() => { setMode('menu'); music.startContext('setup', settings); }} onStart={(mode, ids, dbl, legs, teamMode, teamAssignment, powerUps) => {
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
  />;
}
