import type { CampaignChapter, CampaignLevel } from '../types';
import { CAMPAIGN_LEVELS, CAMPAIGN_CHAPTERS, getChapter } from '../campaignLevels';

// Flat lookup across all chapters (backwards compat). Returns the first
// level with a matching id across all chapters.
export function getLevel(levelId: number): CampaignLevel | undefined {
  return CAMPAIGN_LEVELS.levels.find(l => l.level_id === levelId);
}

// Lookup within a specific chapter.
export function getLevelInChapter(chapterId: string, levelId: number): CampaignLevel | undefined {
  return getChapter(chapterId)?.levels.find(l => l.level_id === levelId);
}

export function totalLevels(): number {
  return CAMPAIGN_LEVELS.levels.length;
}

export function nextLevelId(levelId: number): number | null {
  const idx = CAMPAIGN_LEVELS.levels.findIndex(l => l.level_id === levelId);
  if (idx < 0 || idx + 1 >= CAMPAIGN_LEVELS.levels.length) return null;
  return CAMPAIGN_LEVELS.levels[idx + 1].level_id;
}

// Returns the next level id within a chapter, or null if this was the last.
export function nextLevelIdInChapter(chapterId: string, levelId: number): number | null {
  const chapter = getChapter(chapterId);
  if (!chapter) return null;
  const idx = chapter.levels.findIndex(l => l.level_id === levelId);
  if (idx < 0 || idx + 1 >= chapter.levels.length) return null;
  return chapter.levels[idx + 1].level_id;
}

// Returns the chapter a level belongs to (by level id, first match wins).
export function chapterForLevel(levelId: number): CampaignChapter | undefined {
  return CAMPAIGN_CHAPTERS.find(ch => ch.levels.some(l => l.level_id === levelId));
}
