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
import { getCoopPowerUp } from './campaign/engine';
import type { CoopPowerUpId } from './campaign/types';

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
  onImmersiveChange?: (immersive: boolean) => void;
}

type CoopStage = 'none' | 'setup' | 'map' | 'battle' | 'reward';

export function PlayView({ players, games, settings, activeGame, setActiveGame, setGames, setPlayers, toast, music, onQuit, onGameOver, popups, onImmersiveChange }: Props) {
  const game = activeGame;
  const setGame = setActiveGame;
  const [showdown, setShowdown] = useState<Game | null>(null);
  const [coopStage, setCoopStage] = useState<CoopStage>('none');
  const [coopPlayerIds, setCoopPlayerIds] = useState<string[]>([]);
  const [coopLevelId, setCoopLevelId] = useState<number | null>(null);
  const [mode, setMode] = useState<'menu' | 'competitive'>('menu');
  const [rewardPowerUpId, setRewardPowerUpId] = useState<string | null>(null);
  const [rewardLevelId, setRewardLevelId] = useState<number | null>(null);
  const { progress, setProgress } = useCampaignProgress();

  useEffect(() => {
    if (game && !game.finished) music.startContext('match', settings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tell the app shell when we're in an immersive view (active game, showdown,
  // or coop battle/reward) so it can hide the bottom navigation bar.
  const immersive = !!(game || showdown || coopStage === 'battle' || coopStage === 'reward');
  useEffect(() => { onImmersiveChange?.(immersive); }, [immersive, onImmersiveChange]);

  if (coopStage === 'battle' && coopLevelId != null) {
    const coopPlayers = coopPlayerIds.map(id => players.find(p => p.id === id)).filter(Boolean) as Player[];
    return <CampaignBattle
      levelId={coopLevelId}
      progress={progress}
      settings={settings}
      players={coopPlayers}
      onWin={(newHighest, unlockedPowerUpId) => {
        const unlockedList = unlockedPowerUpId
          ? Array.from(new Set([...(progress.unlockedPowerUps || []), unlockedPowerUpId]))
          : (progress.unlockedPowerUps || []);
        setProgress(prev => ({ ...prev, highest_level_beaten: newHighest, unlockedPowerUps: unlockedList }));
        if (unlockedPowerUpId) {
          // Show the post-game unlock screen before returning to the map.
          setRewardPowerUpId(unlockedPowerUpId);
          setRewardLevelId(coopLevelId);
          setCoopStage('reward');
          music.startContext('setup', settings);
        } else {
          toast(`Level ${coopLevelId} cleared!`);
          setCoopStage('map');
          setCoopLevelId(null);
          music.startContext('setup', settings);
        }
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

  if (coopStage === 'reward' && rewardPowerUpId) {
    const pu = getCoopPowerUp(rewardPowerUpId as CoopPowerUpId);
    return <PowerUpUnlockOverlay
      powerUpName={pu?.name || rewardPowerUpId}
      powerUpIcon={pu?.icon || '✨'}
      powerUpDesc={pu?.desc || ''}
      tier={pu?.tier || 'advanced'}
      levelId={rewardLevelId}
      onContinue={() => {
        setRewardPowerUpId(null);
        setRewardLevelId(null);
        setCoopStage('map');
        setCoopLevelId(null);
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

// Post-game overlay shown when a Coop campaign level unlocks a new advanced
// power-up. Lets the player see what they earned before returning to the map.
function PowerUpUnlockOverlay({
  powerUpName, powerUpIcon, powerUpDesc, tier, levelId, onContinue,
}: {
  powerUpName: string;
  powerUpIcon: string;
  powerUpDesc: string;
  tier: 'starter' | 'advanced';
  levelId: number | null;
  onContinue: () => void;
}) {
  const isBoss = levelId === 5;
  return (
    <div className="battle-overlay-bg" style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div className="battle-overlay" style={{ maxWidth: 420, textAlign: 'center', padding: 24 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.18em', color: isBoss ? '#fca5a5' : 'var(--accent)', textTransform: 'uppercase' }}>
          {isBoss ? '☠ BOSS REWARD UNLOCKED' : 'NEW POWER-UP UNLOCKED'}
        </div>
        <div style={{
          margin: '14px auto 10px',
          width: 96, height: 96, borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 48,
          background: isBoss
            ? 'radial-gradient(circle at 30% 30%, color-mix(in srgb,#ef4444 60%,var(--bg-3)) 0%, var(--bg-3) 80%)'
            : 'radial-gradient(circle at 30% 30%, color-mix(in srgb,var(--accent) 45%,var(--bg-3)) 0%, var(--bg-3) 80%)',
          border: `2px solid ${isBoss ? '#ef4444' : 'var(--accent)'}`,
          boxShadow: isBoss ? '0 0 24px color-mix(in srgb,#ef4444 50%,transparent)' : '0 0 18px color-mix(in srgb,var(--accent) 50%,transparent)',
          animation: 'popIn .5s ease',
        }}>
          {powerUpIcon}
        </div>
        <div style={{ fontSize: 22, fontWeight: 900 }}>{powerUpName}</div>
        <div className="pill" style={{ marginTop: 6, fontSize: 10, background: 'var(--bg-3)', color: 'var(--muted)', borderColor: 'transparent' }}>
          {tier === 'advanced' ? 'ADVANCED TIER' : 'STARTER TIER'}
        </div>
        <div className="muted" style={{ marginTop: 10, fontSize: 13, lineHeight: 1.4 }}>{powerUpDesc}</div>
        <div className="muted small" style={{ marginTop: 10, fontStyle: 'italic' }}>
          Equip it from the Players tab → Power-Ups → Coop section.
        </div>
        <button className="btn primary block" style={{ marginTop: 16 }} onClick={onContinue}>
          Continue
        </button>
      </div>
    </div>
  );
}
