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
  recordLevelClearForPlayer,
  reconcileCoopPassivesForPlayer,
} from '../campaign/engine';
import { getChapter, isChapterComplete } from '../campaign/campaignLevels';
import { levelFromXP } from '../logic';
import { cardsForLevelUp, addCard, defaultPlayerCards } from '../cards/deck';
import { PostGameOverlay, type PostGameInfo, type LevelUpInfo } from './PostGameOverlay';

export type CoopStage = 'none' | 'setup' | 'chapters' | 'map' | 'battle' | 'postgame';

interface Props {
  players: Player[];
  settings: Settings;
  music: MusicEngine;
  setPlayers: (updater: any) => void;
  toast: (m: string) => void;
  onExitToMenu: () => void;
}

export function CoopFlow({ players, settings, music, setPlayers, toast, onExitToMenu }: Props) {
  const [stage, setStage] = useState<CoopStage>('none');
  const [playerIds, setPlayerIds] = useState<string[]>([]);
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
        const unlockedList = unlockedPowerUpId
          ? Array.from(new Set([...(progress.unlockedPowerUps || []), unlockedPowerUpId]))
          : (progress.unlockedPowerUps || []);
        const chapter = getChapter(chapterId);
        const clearedIdx = chapter ? chapter.levels.findIndex(l => l.level_id === levelId) : -1;
        const prevChapterCleared = progress.chapters?.[chapterId] ?? 0;
        const newChapterCleared = Math.max(prevChapterCleared, clearedIdx + 1);
        setProgress(prev => ({
          ...prev,
          highest_level_beaten: newHighest,
          unlockedPowerUps: unlockedList,
          chapters: { ...(prev.chapters || {}), [chapterId]: newChapterCleared },
        }));
        const xpGained = coopXpForBattle(stats, true);
        const ids = (coopPlayers || []).map(p => p.id);
        const levelUps: LevelUpInfo[] = [];
        setPlayers((prev: Player[]) => prev.map(p => {
          if (!ids.includes(p.id)) return p;
          const oldLevel = p.level || 1;
          const newXp = (p.xp || 0) + xpGained;
          const li = levelFromXP(newXp, settings);
          const cur = p.coopProgress || defaultCoopProgress();
          const { progress: nextProg, newlyUnlocked } = reconcileCoopPassivesForPlayer(cur, li.level);
          const nextCampaign = recordLevelClearForPlayer(p, chapterId, clearedIdx, levelId, unlockedPowerUpId);
          let next: Player = { ...p, xp: newXp, level: li.level, coopProgress: nextProg, campaignProgress: nextCampaign };
          if (li.level > oldLevel && settings.gameMode === 'cards') {
            const curCards = next.cards && next.cards.length > 0 ? next.cards : defaultPlayerCards(next.coopProgress?.classId);
            const newCardDefs = cardsForLevelUp(next.coopProgress?.classId || null, li.level, 'coop', curCards);
            if (newCardDefs.length > 0) {
              let updatedCards = curCards;
              for (const def of newCardDefs) {
                updatedCards = addCard(updatedCards, def.id);
              }
              next = { ...next, cards: updatedCards };
            }
            levelUps.push({ playerId: p.id, oldLevel, newLevel: li.level, newCards: newCardDefs.map(d => ({ id: d.id, name: d.name, icon: d.icon })), newPassives: newlyUnlocked });
          } else if (li.level > oldLevel) {
            levelUps.push({ playerId: p.id, oldLevel, newLevel: li.level, newCards: [], newPassives: newlyUnlocked });
          }
          return next;
        }));
        setPostGame({ chapterId, levelId, stats, rewardPowerUpId: unlockedPowerUpId, coopXpGained: xpGained, levelUps });
        setStage('postgame');
        music.startContext('setup', settings);
      }}
      onLose={() => {
        const coopPlayersLocal = (playerIds.map(id => players.find(p => p.id === id)).filter(Boolean) as Player[]) || [];
        const xpGained = coopXpForBattle({ visitsUsed: 0, dartsThrown: 0, damageDealt: 0, enemiesDefeated: 0, powerUpsUsed: 0, partyHpLost: 0 } as CampaignBattleState['stats'], false);
        const ids = coopPlayersLocal.map(p => p.id);
        setPlayers((prev: Player[]) => prev.map(p => {
          if (!ids.includes(p.id)) return p;
          const oldLevel = p.level || 1;
          const newXp = (p.xp || 0) + xpGained;
          const li = levelFromXP(newXp, settings);
          const cur = p.coopProgress || defaultCoopProgress();
          const { progress: nextProg } = reconcileCoopPassivesForPlayer(cur, li.level);
          let next: Player = { ...p, xp: newXp, level: li.level, coopProgress: nextProg };
          if (li.level > oldLevel && settings.gameMode === 'cards') {
            const curCards = next.cards && next.cards.length > 0 ? next.cards : defaultPlayerCards(next.coopProgress?.classId);
            const newCardDefs = cardsForLevelUp(next.coopProgress?.classId || null, li.level, 'coop', curCards);
            if (newCardDefs.length > 0) {
              let updatedCards = curCards;
              for (const def of newCardDefs) {
                updatedCards = addCard(updatedCards, def.id);
              }
              next = { ...next, cards: updatedCards };
            }
          }
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
    return <ChapterSelect
      progress={progress}
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
