import { useEffect, useState } from 'react';
import type { Game, GameRecord, Player, Settings } from './types';
import { createGame } from './logic';
import { Sound } from './sound';
import type { MusicEngine } from './music';
import type { PopupControls } from './Popups';
import { SetupView } from './play/SetupView';
import { Showdown } from './play/Showdown';
import { X01Board } from './play/boards/X01Board';
import { AtcBoard } from './play/boards/AtcBoard';
import { KillerBoard } from './play/boards/KillerBoard';
import { HighScoreBoard } from './play/boards/HighScoreBoard';
import { BattleBoard } from './play/boards/BattleBoard';
import { CampaignMap } from './campaign/CampaignMap';
import { CampaignBattle } from './campaign/CampaignBattle';
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

export function PlayView({ players, games, settings, activeGame, setActiveGame, setGames, setPlayers, toast, music, onQuit, onGameOver, popups }: Props) {
  const game = activeGame;
  const setGame = setActiveGame;
  const [showdown, setShowdown] = useState<Game | null>(null);
  const [campaignView, setCampaignView] = useState<'none' | 'map' | 'battle'>('none');
  const [campaignLevelId, setCampaignLevelId] = useState<number | null>(null);
  const { progress, setProgress } = useCampaignProgress();

  useEffect(() => {
    if (game && !game.finished) music.startContext('match', settings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (campaignView === 'battle' && campaignLevelId != null) {
    return <CampaignBattle
      levelId={campaignLevelId}
      progress={progress}
      settings={settings}
      onWin={(newHighest, partyHp) => {
        setProgress(prev => ({ ...prev, highest_level_beaten: newHighest, current_party_hp: partyHp }));
        toast(`Level ${campaignLevelId} cleared!`);
        setCampaignView('map');
        setCampaignLevelId(null);
        music.startContext('setup', settings);
      }}
      onLose={(partyHp) => {
        setProgress(prev => ({ ...prev, current_party_hp: Math.max(1, Math.floor(partyHp || progress.party_max_hp / 2)) }));
        toast('Party defeated — HP restored to half.');
        setCampaignView('map');
        setCampaignLevelId(null);
        music.startContext('setup', settings);
      }}
      onQuit={() => {
        setProgress(prev => ({ ...prev, current_party_hp: prev.current_party_hp }));
        setCampaignView('map');
        setCampaignLevelId(null);
        music.startContext('setup', settings);
      }}
    />;
  }

  if (campaignView === 'map') {
    return <CampaignMap
      progress={progress}
      onPick={(id) => { setCampaignLevelId(id); setCampaignView('battle'); music.stop(); }}
      onBack={() => { setCampaignView('none'); music.startContext('setup', settings); }}
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
  return <SetupView players={players} onOpenCampaign={() => { setCampaignView('map'); music.startContext('setup', settings); }} onStart={(mode, ids, dbl, legs, teamMode, teamAssignment, powerUps) => {
    const g = createGame(mode, ids, players, dbl, legs, teamMode, teamAssignment, powerUps, settings);
    Sound.play('showdown', {}, settings);
    music.stop();
    setActiveGame(g);
    setShowdown(g);
  }} />;
}
