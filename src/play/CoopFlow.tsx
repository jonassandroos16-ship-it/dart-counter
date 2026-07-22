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
  addClassXp,
  classLevelFromXp,
  getCoopClass,
} from '../campaign/engine';
import { getChapter, isChapterComplete } from '../campaign/campaignLevels';
import { cardsForLevelUp, addCard, getPlayerCards, setPlayerCards } from '../cards/deck';
import { PostGameOverlay, type PostGameInfo, type LevelUpInfo, type XpAwardInfo } from './PostGameOverlay';

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
      onWin={(stats) => {
        const unlockedPowerUpId = recordLevelClearForPlayer(progress, chapterId, levelId, setProgress, stats);
        const xpGained = coopXpForBattle(stats, true);
        const ids = (coopPlayers || []).map(p => p.id);
        const levelUps: LevelUpInfo[] = [];
        const xpAwards: XpAwardInfo[] = [];
        setPlayers((prev: Player[]) => prev.map(p => {
          if (!ids.includes(p.id)) return p;
          const classId = p.coopProgress?.classId || null;
          const cur = p.coopProgress || defaultCoopProgress();
          const oldLevel = classLevelFromXp(cur, classId, settings).level;
          const updatedProg = addClassXp(cur, classId, xpGained);
          const li = classLevelFromXp(updatedProg, classId, settings);
          const cls = getCoopClass(classId);
          xpAwards.push({ playerId: p.id, classId: classId || '', className: cls?.name || 'Unknown', classIcon: cls?.icon || '✨', xpGained, newLevel: li.level });
          const { progress: nextProg } = reconcileCoopPassivesForPlayer(updatedProg, li.level);
          let next: Player = { ...p, coopProgress: nextProg };
          if (li.level > oldLevel && settings.gameMode === 'cards') {
            const curCards = getPlayerCards(next);
            const newCardDefs = cardsForLevelUp(next.coopProgress?.classId || null, li.level, 'coop', curCards);
            if (newCardDefs.length > 0) {
              let updatedCards = curCards;
              for (const def of newCardDefs) {
                updatedCards = addCard(updatedCards, def.id);
              }
              next = setPlayerCards(next, updatedCards);
            }
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
          const oldLevel = classLevelFromXp(cur, classId, settings).level;
          const updatedProg = addClassXp(cur, classId, xpGained);
          const li = classLevelFromXp(updatedProg, classId, settings);
          const { progress: nextProg } = reconcileCoopPassivesForPlayer(updatedProg, li.level);
          let next: Player = { ...p, coopProgress: nextProg };
          if (li.level > oldLevel && settings.gameMode === 'cards') {
            const curCards = getPlayerCards(next);
            const newCardDefs = cardsForLevelUp(next.coopProgress?.classId || null, li.level, 'coop', curCards);
            if (newCardDefs.length > 0) {
              let updatedCards = curCards;
              for (const def of newCardDefs) {
                updatedCards = addCard(updatedCards, def.id);
              }
              next = setPlayerCards(next, updatedCards);
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
