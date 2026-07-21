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
import { ChapterSelect } from './campaign/ChapterSelect';
import { CampaignMap } from './campaign/CampaignMap';
import { CampaignBattle } from './campaign/CampaignBattle';
import { CoopSetupView } from './campaign/CoopSetupView';
import { useCampaignProgress } from './campaign/progress';
import { getCoopPowerUp, coopXpForBattle, addCoopXpForPlayer, defaultCoopProgress, recordLevelClearForPlayer } from './campaign/engine';
import { getChapter, isChapterComplete } from './campaign/campaignLevels';
import type { CoopPowerUpId, CampaignBattleState, CampaignChapter } from './campaign/types';
import { DartliteSetup } from './dartlite/DartliteSetup';
import { DartliteBattle } from './dartlite/DartliteBattle';
import {
  startRun, beginRound, resolveBattle,
  type DartliteRun,
} from './dartlite/engine';
import { DartliteGameOver } from './dartlite/DartliteGameOver';

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

type CoopStage = 'none' | 'setup' | 'chapters' | 'map' | 'battle' | 'postgame';
type DartliteStage = 'none' | 'setup' | 'battle' | 'gameover';

interface PostGameInfo {
  chapterId: string;
  levelId: number;
  stats: CampaignBattleState['stats'];
  rewardPowerUpId: string | null;
  coopXpGained?: number;
}

export function PlayView({ players, games, settings, activeGame, setActiveGame, setGames, setPlayers, toast, music, onQuit, onGameOver, popups }: Props) {
  const game = activeGame;
  const setGame = setActiveGame;
  const [showdown, setShowdown] = useState<Game | null>(null);
  const [coopStage, setCoopStage] = useState<CoopStage>('none');
  const [coopPlayerIds, setCoopPlayerIds] = useState<string[]>([]);
  const [coopChapterId, setCoopChapterId] = useState<string | null>(null);
  const [coopLevelId, setCoopLevelId] = useState<number | null>(null);
  const [mode, setMode] = useState<'menu' | 'competitive'>('menu');
  const [postGame, setPostGame] = useState<PostGameInfo | null>(null);
  const { progress, setProgress } = useCampaignProgress();
  const [dartliteStage, setDartliteStage] = useState<DartliteStage>('none');
  const [dartliteRun, setDartliteRun] = useState<DartliteRun | null>(null);

  useEffect(() => {
    if (game && !game.finished) music.startContext('match', settings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (coopStage === 'battle' && coopLevelId != null && coopChapterId) {
    const coopPlayers = coopPlayerIds.map(id => players.find(p => p.id === id)).filter(Boolean) as Player[];
    return <CampaignBattle
      levelId={coopLevelId}
      chapterId={coopChapterId}
      progress={progress}
      settings={settings}
      players={coopPlayers}
      music={music}
      onWin={(newHighest, unlockedPowerUpId, stats) => {
        const unlockedList = unlockedPowerUpId
          ? Array.from(new Set([...(progress.unlockedPowerUps || []), unlockedPowerUpId]))
          : (progress.unlockedPowerUps || []);
        // Per-chapter progress: store the highest cleared level index.
        const chapter = getChapter(coopChapterId);
        const clearedIdx = chapter ? chapter.levels.findIndex(l => l.level_id === coopLevelId) : -1;
        const prevChapterCleared = progress.chapters?.[coopChapterId] ?? 0;
        const newChapterCleared = Math.max(prevChapterCleared, clearedIdx + 1);
        setProgress(prev => ({
          ...prev,
          highest_level_beaten: newHighest,
          unlockedPowerUps: unlockedList,
          chapters: { ...(prev.chapters || {}), [coopChapterId]: newChapterCleared },
        }));
        // Grant Coop XP to every player in the party based on battle stats.
        // Wins give more XP than losses; darts thrown and enemies defeated
        // add bonus XP. Unlocked passives auto-grant via addCoopXpForPlayer.
        const xpGained = coopXpForBattle(stats, true);
        const coopPlayerIds = (coopPlayers || []).map(p => p.id);
        // Record the level clear per-player so each party member tracks
        // their own progress. A reward power-up is only granted to players
        // who haven't already unlocked it (the shared `unlockedPowerUpId`
        // is the first-time grant for the party; per-player we mirror it
        // so the info box can tell when everyone has it).
        setPlayers((prev: Player[]) => prev.map(p => {
          if (!coopPlayerIds.includes(p.id)) return p;
          const cur = p.coopProgress || defaultCoopProgress();
          const { progress: nextProg } = addCoopXpForPlayer(cur, xpGained);
          const nextCampaign = recordLevelClearForPlayer(p, coopChapterId, clearedIdx, coopLevelId, unlockedPowerUpId);
          return { ...p, coopProgress: nextProg, campaignProgress: nextCampaign };
        }));
        // Always show the post-game screen — power-up info only if unlocked.
        setPostGame({ chapterId: coopChapterId, levelId: coopLevelId, stats, rewardPowerUpId: unlockedPowerUpId, coopXpGained: xpGained });
        setCoopStage('postgame');
        music.startContext('setup', settings);
      }}
      onLose={() => {
        // Even on a loss, the party earns a small amount of Coop XP for
        // participating. Wins give the bulk of the XP.
        const coopPlayersLocal = (coopPlayerIds.map(id => players.find(p => p.id === id)).filter(Boolean) as Player[]) || [];
        const xpGained = coopXpForBattle({ visitsUsed: 0, dartsThrown: 0, damageDealt: 0, enemiesDefeated: 0, powerUpsUsed: 0, partyHpLost: 0 } as CampaignBattleState['stats'], false);
        const ids = coopPlayersLocal.map(p => p.id);
        setPlayers((prev: Player[]) => prev.map(p => {
          if (!ids.includes(p.id)) return p;
          const cur = p.coopProgress || defaultCoopProgress();
          const { progress: nextProg } = addCoopXpForPlayer(cur, xpGained);
          return { ...p, coopProgress: nextProg };
        }));
        toast(`Party defeated — earned ${xpGained} Coop XP. Try again.`);
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

  if (coopStage === 'postgame' && postGame) {
    const chapter = getChapter(postGame.chapterId) || null;
    const level = chapter?.levels.find(l => l.level_id === postGame.levelId) || null;
    const pu = postGame.rewardPowerUpId ? getCoopPowerUp(postGame.rewardPowerUpId as CoopPowerUpId) : null;
    const isBoss = level?.is_boss ?? false;
    const chapterComplete = chapter ? isChapterComplete(chapter.id, { chapters: { [chapter.id]: (progress.chapters?.[chapter.id] ?? 0) } }) : false;
    return <PostGameOverlay
      chapter={chapter}
      levelName={level?.name || `Level ${postGame.levelId}`}
      isBoss={isBoss}
      stats={postGame.stats}
      rewardPowerUp={pu ? { name: pu.name, icon: pu.icon, desc: pu.desc, tier: pu.tier } : null}
      chapterComplete={chapterComplete}
      coopXpGained={postGame.coopXpGained}
      onContinue={() => {
        setPostGame(null);
        setCoopStage('chapters');
        setCoopLevelId(null);
      }}
    />;
  }

  if (coopStage === 'map' && coopChapterId) {
    const coopPlayers = coopPlayerIds.map(id => players.find(p => p.id === id)).filter(Boolean) as Player[];
    return <CampaignMap
      progress={progress}
      players={coopPlayers}
      chapterId={coopChapterId}
      onPick={(id) => { setCoopLevelId(id); setCoopStage('battle'); music.stop(); }}
      onBack={() => { setCoopStage('chapters'); music.startContext('setup', settings); }}
    />;
  }

  if (coopStage === 'chapters') {
    return <ChapterSelect
      progress={progress}
      onPick={(id) => { setCoopChapterId(id); setCoopStage('map'); }}
      onBack={() => { setCoopStage('setup'); music.startContext('setup', settings); }}
    />;
  }

  if (coopStage === 'setup') {
    return <CoopSetupView
      players={players}
      settings={settings}
      onStart={(ids) => { setCoopPlayerIds(ids); setCoopStage('chapters'); }}
      onBack={() => { setCoopStage('none'); setMode('menu'); music.startContext('setup', settings); }}
    />;
  }

  // ── Dartlite rogue-lite mode ─────────────────────────────────────────
  if (dartliteStage === 'setup') {
    return <DartliteSetup
      players={players}
      onStart={(ids) => {
        const party = players.filter(p => ids.includes(p.id));
        const run = startRun(party, settings);
        const started = beginRound(run, party, settings);
        setDartliteRun(started);
        setDartliteStage('battle');
        music.startContext('coop', settings);
      }}
      onBack={() => { setDartliteStage('none'); setMode('menu'); music.startContext('setup', settings); }}
    />;
  }

  if (dartliteStage === 'battle' && dartliteRun) {
    return <DartliteBattle
      run={dartliteRun}
      settings={settings}
      music={music}
      onBattleEnd={(won) => {
        if (won) {
          const resolved = resolveBattle(dartliteRun, true);
          setDartliteRun(resolved);
          if (resolved.phase === 'gameover') {
            setDartliteStage('gameover');
          }
        } else {
          const resolved = resolveBattle(dartliteRun, false);
          setDartliteRun(resolved);
          setDartliteStage('gameover');
        }
      }}
      onChoice={(nextRun) => {
        const started = beginRound(nextRun, players.filter(p => nextRun.playerIds.includes(p.id)), settings);
        setDartliteRun(started);
      }}
      onQuit={() => { setDartliteStage('none'); setDartliteRun(null); setMode('menu'); music.startContext('setup', settings); }}
    />;
  }

  if (dartliteStage === 'gameover' && dartliteRun) {
    return <DartliteGameOver
      run={dartliteRun}
      setPlayers={setPlayers}
      onContinue={() => { setDartliteStage('none'); setDartliteRun(null); setMode('menu'); music.startContext('setup', settings); }}
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
    onPickDartlite={() => { setDartliteStage('setup'); music.startContext('setup', settings); }}
  />;
}

// ── Post-game overlay ────────────────────────────────────────────────
//
// Always shown after a Coop campaign level is cleared. Displays the level
// name, a "DEFEATED" callout, the battle stats (visits, darts, damage,
// enemies defeated, power-ups used, party HP lost), and a short story
// beat. If the level granted a new power-up, the power-up card is shown
// below the stats. If this was the chapter's boss, the chapter outro is
// shown as the story beat.
function PostGameOverlay({
  chapter, levelName, isBoss, stats, rewardPowerUp, chapterComplete, coopXpGained, onContinue,
}: {
  chapter: CampaignChapter | null;
  levelName: string;
  isBoss: boolean;
  stats: CampaignBattleState['stats'];
  rewardPowerUp: { name: string; icon: string; desc: string; tier: 'starter' | 'advanced' } | null;
  chapterComplete: boolean;
  coopXpGained?: number;
  onContinue: () => void;
}) {
  const theme = chapter?.theme;
  const accent = theme?.accent || 'var(--accent)';
  const bg = theme?.background || 'var(--bg)';
  const storyBit = isBoss
    ? chapter?.story.outro
    : chapter?.levels.find(l => l.name === levelName)?.story_bit;
  return (
    <div className="battle-overlay-bg" style={{ alignItems: 'center', justifyContent: 'center', background: `rgba(0,0,0,.65)` }}>
      <div className="battle-overlay" style={{ maxWidth: 440, padding: 20, background: `linear-gradient(180deg, ${bg} 0%, var(--bg-2) 100%)` }} onClick={(e) => e.stopPropagation()}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.18em', color: accent, textTransform: 'uppercase' }}>
            {chapter?.name}
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, marginTop: 4 }}>{levelName}</div>
          <div style={{
            margin: '10px auto 6px',
            width: 80, height: 80, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 40,
            background: `radial-gradient(circle at 30% 30%, color-mix(in srgb, ${accent} 45%, var(--bg-3)) 0%, var(--bg-3) 80%)`,
            border: `2px solid ${accent}`,
            boxShadow: `0 0 18px color-mix(in srgb, ${accent} 45%, transparent)`,
          }}>
            {isBoss ? '☠' : '✓'}
          </div>
          <div style={{ fontSize: 16, fontWeight: 900, color: accent, letterSpacing: '.04em' }}>
            DEFEATED
          </div>
        </div>

        <div className="card" style={{ padding: 12, marginTop: 14, background: 'var(--bg-3)' }}>
          <div className="muted small" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 8 }}>Battle stats</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <Stat label="Visits" value={stats.visitsUsed} />
            <Stat label="Darts" value={stats.dartsThrown} />
            <Stat label="Damage" value={stats.damageDealt} />
            <Stat label="Enemies" value={stats.enemiesDefeated} />
            <Stat label="Power-ups" value={stats.powerUpsUsed} />
            <Stat label="HP lost" value={stats.partyHpLost} />
          </div>
        </div>

        {rewardPowerUp && (
          <div className="card" style={{ marginTop: 12, padding: 14, background: `color-mix(in srgb, ${accent} 14%, var(--bg-3))`, borderColor: `color-mix(in srgb, ${accent} 50%, var(--border))` }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.14em', color: accent, textTransform: 'uppercase', marginBottom: 6 }}>
              {isBoss ? 'Boss Reward Unlocked' : 'New Power-Up Unlocked'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ fontSize: 32 }}>{rewardPowerUp.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 900, fontSize: 16 }}>{rewardPowerUp.name}</div>
                <div className="muted small" style={{ marginTop: 2, lineHeight: 1.4 }}>{rewardPowerUp.desc}</div>
              </div>
            </div>
            <div className="muted small" style={{ marginTop: 8, fontStyle: 'italic' }}>
              Equip it from Players → Power-Ups → Coop section.
            </div>
          </div>
        )}

        {coopXpGained != null && coopXpGained > 0 && (
          <div className="card" style={{ marginTop: 12, padding: 12, background: 'var(--bg-3)' }}>
            <div className="row" style={{ gap: 10, alignItems: 'center' }}>
              <div style={{ fontSize: 26 }}>✨</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: 14 }}>+{coopXpGained} Coop XP earned</div>
                <div className="muted small" style={{ marginTop: 2, lineHeight: 1.4 }}>Each party member gained Coop XP toward unlocking new class passives. Check Players → Class to spend any newly unlocked passives.</div>
              </div>
            </div>
          </div>
        )}

        {storyBit && (
          <div className="muted" style={{ marginTop: 14, fontSize: 13, lineHeight: 1.55, fontStyle: 'italic', textAlign: 'center' }}>
            {storyBit}
          </div>
        )}

        {chapterComplete && (
          <div className="pill" style={{ marginTop: 12, display: 'inline-flex', alignSelf: 'center', background: accent, color: '#04150a', borderColor: 'transparent' }}>
            Chapter complete
          </div>
        )}

        <button className="btn primary block" style={{ marginTop: 16 }} onClick={onContinue}>
          Continue
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontWeight: 900, fontSize: 18 }}>{value}</div>
      <div className="muted small" style={{ marginTop: 2 }}>{label}</div>
    </div>
  );
}
