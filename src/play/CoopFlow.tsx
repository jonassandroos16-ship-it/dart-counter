import { useState } from 'react';
import type { Player, Settings } from '../types';
import type { MusicEngine } from '../music';
import type { CampaignBattleState, CoopPowerUpId, CampaignProgress } from '../campaign/types';
import { CampaignBattle } from '../campaign/CampaignBattle';
import { CampaignMap } from '../campaign/CampaignMap';
import { ChapterSelect } from '../campaign/ChapterSelect';
import { CoopSetupView } from '../campaign/CoopSetupView';
import { useCampaignProgress } from '../campaign/progress';
import {
  getCoopPowerUp,
  coopXpForBattle,
  defaultCoopProgress,
  reconcileCoopPassivesForPlayer,
  addClassXp,
  classLevelFromXp,
  getCoopClass,
  recordLevelClearForPlayer,
  levelRewardPowerUp,
} from '../campaign/engine';
import { getChapter, isChapterComplete } from '../campaign/campaignLevels';
import { cardsForLevelUp, getPlayerCards } from '../cards/deck';
import { PostGameOverlay, type PostGameInfo, type LevelUpInfo, type XpAwardInfo } from './PostGameOverlay';
import type { LobbyPlayer } from '../multiplayer/client';

export type CoopStage = 'none' | 'setup' | 'chapters' | 'map' | 'battle' | 'postgame';

interface Props {
  players: Player[];
  settings: Settings;
  music: MusicEngine;
  setPlayers: (updater: any) => void;
  toast: (m: string) => void;
  onExitToMenu: () => void;
  /** When true, skip the party-selection setup screen — players are already
   *  chosen by the lobby. Go directly to chapter select. */
  skipSetup?: boolean;
  /** Multiplayer: lobby ID for state sync. */
  lobbyId?: string;
  /** Multiplayer: lobby players for device-ownership checks. */
  lobbyPlayers?: LobbyPlayer[];
  /** Multiplayer: true if this device is the host (writes state to DB). */
  isHost?: boolean;
  /** Multiplayer: remote state received from the host via realtime. */
  remoteRun?: any;
}

export function CoopFlow({ players, settings, music, setPlayers, toast, onExitToMenu, skipSetup }: Props) {
  const [stage, setStage] = useState<CoopStage>(skipSetup ? 'chapters' : 'setup');
  const [playerIds, setPlayerIds] = useState<string[]>(skipSetup ? players.map(p => p.id) : []);
  const [chapterId, setChapterId] = useState<string | null>(null);
  const [levelId, setLevelId] = useState<number | null>(null);
  const [postGame, setPostGame] = useState<PostGameInfo | null>(null);
  const { progress, setProgress } = useCampaignProgress();

  if (stage === 'battle' && levelId != null && chapterId) {
    const coopPlayers = playerIds.map(id => players.find(p => p.id === id)).filter(Boolean) as Player[];
    return <CampaignBattle
      levelId={levelId}
      chapterId={chapterId}
      progress={progress}
      settings={settings}
      players={coopPlayers}
      music={music}
      onWin={(newHighest, unlockedPowerUpId, stats) => {
        void newHighest;
        const xpGained = coopXpForBattle(stats, true);
        const ids = (coopPlayers || []).map(p => p.id);
        const levelUps: LevelUpInfo[] = [];
        const xpAwards: XpAwardInfo[] = [];
        const chapter = getChapter(chapterId);
        const levelIdx = chapter ? chapter.levels.findIndex(l => l.level_id === levelId) : -1;
        const rewardId = levelRewardPowerUp(levelId, chapterId);
        if (levelIdx >= 0) {
          setProgress(prev => recordLevelClearForPlayer(
            { campaignProgress: prev } as Player,
            chapterId,
            levelIdx,
            levelId,
            rewardId,
          ));
        }
        setPlayers((prev: Player[]) => prev.map(p => {
          if (!ids.includes(p.id)) return p;
          const clearedProgress = levelIdx >= 0
            ? recordLevelClearForPlayer(p, chapterId, levelIdx, levelId, rewardId)
            : p.campaignProgress;
          const classId = p.coopProgress?.classId || null;
          const cur = p.coopProgress || defaultCoopProgress();
          const oldLevel = classLevelFromXp(cur, classId, settings).level;
          const updatedProg = addClassXp(cur, classId, xpGained);
          const li = classLevelFromXp(updatedProg, classId, settings);
          const cls = getCoopClass(classId);
          xpAwards.push({ playerId: p.id, classId: classId || '', className: cls?.name || 'Unknown', classIcon: cls?.icon || '✨', xpGained, newLevel: li.level });
          const { progress: nextProg } = reconcileCoopPassivesForPlayer(updatedProg, li.level);
          let next: Player = { ...p, coopProgress: nextProg, campaignProgress: clearedProgress };
          if (li.level > oldLevel && settings.gameMode === 'cards') {
            const curCards = getPlayerCards(next);
            const newCardDefs = cardsForLevelUp(next.coopProgress?.classId || null, li.level, 'coop', curCards);
            levelUps.push({ playerId: p.id, oldLevel, newLevel: li.level, newCards: newCardDefs.map(d => ({ id: d.id, name: d.name, icon: d.icon })), newPassives: [] });
          } else if (li.level > oldLevel) {
            levelUps.push({ playerId: p.id, oldLevel, newLevel: li.level, newCards: [], newPassives: [] });
          }
          return next;
        }));
        setPostGame({ chapterId, levelId, stats, rewardPowerUpId: unlockedPowerUpId, coopXpGained: xpGained, xpAwards, levelUps });
        setStage('postgame');
        music.startContext('setup', settings);
      }}
      onLose={() => {
        const coopPlayersLocal = (playerIds.map(id => players.find(p => p.id === id)).filter(Boolean) as Player[]) || [];
        const xpGained = coopXpForBattle({ visitsUsed: 0, dartsThrown: 0, damageDealt: 0, enemiesDefeated: 0, powerUpsUsed: 0, partyHpLost: 0 } as CampaignBattleState['stats'], false);
        const ids = coopPlayersLocal.map(p => p.id);
        setPlayers((prev: Player[]) => prev.map(p => {
          if (!ids.includes(p.id)) return p;
          const classId = p.coopProgress?.classId || null;
          const cur = p.coopProgress || defaultCoopProgress();
          const updatedProg = addClassXp(cur, classId, xpGained);
          const li = classLevelFromXp(updatedProg, classId, settings);
          const { progress: nextProg } = reconcileCoopPassivesForPlayer(updatedProg, li.level);
          let next: Player = { ...p, coopProgress: nextProg };
          return next;
        }));
        toast(`Party defeated — earned ${xpGained} XP. Try again.`);
        setStage('map');
        setLevelId(null);
        music.startContext('setup', settings);
      }}
      onQuit={() => {
        setStage('map');
        setLevelId(null);
        music.startContext('setup', settings);
      }}
    />;
  }

  if (stage === 'postgame' && postGame) {
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
      xpAwards={postGame.xpAwards}
      levelUps={postGame.levelUps}
      players={players}
      onContinue={() => {
        setPostGame(null);
        setStage('chapters');
        setLevelId(null);
      }}
    />;
  }

  if (stage === 'map' && chapterId) {
    const coopPlayers = playerIds.map(id => players.find(p => p.id === id)).filter(Boolean) as Player[];
    return <CampaignMap
      progress={progress}
      players={coopPlayers}
      chapterId={chapterId}
      onPick={(id) => { setLevelId(id); setStage('battle'); music.stop(); }}
      onBack={() => { setStage('chapters'); music.startContext('setup', settings); }}
    />;
  }

  if (stage === 'chapters') {
    const coopPlayers = playerIds.map(id => players.find(p => p.id === id)).filter(Boolean) as Player[];
    return <ChapterSelect
      progress={progress}
      players={coopPlayers}
      onPick={(id) => { setChapterId(id); setStage('map'); }}
      onBack={() => { setStage('setup'); music.startContext('setup', settings); }}
    />;
  }

  if (stage === 'setup') {
    return <CoopSetupView
      players={players}
      settings={settings}
      onStart={(ids) => { setPlayerIds(ids); setStage('chapters'); }}
      onBack={() => { setStage('none'); onExitToMenu(); music.startContext('setup', settings); }}
    />;
  }

  return null;
}

export function isCoopActive(stage: CoopStage): boolean {
  return stage !== 'none';
}

export type { CampaignProgress };
