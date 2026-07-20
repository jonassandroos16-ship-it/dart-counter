import type {
  CampaignProgress,
  PlayerCampaignProgress,
  PlayerCoopProgress,
} from '../types';
import type { Player } from '../../types';
import { getLevel, getLevelInChapter } from './levels';

// Default per-player campaign progress for a brand-new player: nothing
// cleared, no reward power-ups unlocked.
export function defaultPlayerCampaignProgress(): PlayerCampaignProgress {
  return { highest_level_beaten: 0, unlockedPowerUps: [], chapters: {} };
}

// Returns a player's campaign progress, falling back to defaults if unset.
export function playerCampaignProgress(p: Player | undefined | null): PlayerCampaignProgress {
  if (!p || !p.campaignProgress) return defaultPlayerCampaignProgress();
  return {
    highest_level_beaten: Math.max(0, p.campaignProgress.highest_level_beaten || 0),
    unlockedPowerUps: Array.isArray(p.campaignProgress.unlockedPowerUps)
      ? Array.from(new Set(p.campaignProgress.unlockedPowerUps.filter((x): x is string => typeof x === 'string')))
      : [],
    chapters: (p.campaignProgress.chapters && typeof p.campaignProgress.chapters === 'object')
      ? Object.fromEntries(
          Object.entries(p.campaignProgress.chapters).map(([k, v]) => [k, Math.max(0, Math.floor(Number(v) || 0))]),
        )
      : {},
  };
}

// True if a player has cleared the given level index (0-based) in a chapter.
export function playerHasClearedLevel(p: Player, chapterId: string, levelIdx: number): boolean {
  const prog = playerCampaignProgress(p);
  return (prog.chapters?.[chapterId] ?? 0) > levelIdx;
}

// True if every player in the party has cleared the given level index
// (0-based) in a chapter. Used to decide whether a level's reward is
// "unlocked for everyone" vs only some party members.
export function partyAllClearedLevel(players: Player[], chapterId: string, levelIdx: number): boolean {
  if (!players.length) return false;
  return players.every(p => playerHasClearedLevel(p, chapterId, levelIdx));
}

// Returns the names of party members who have NOT cleared the given level
// index (0-based) in a chapter. Empty when everyone has cleared it.
export function partyMissingClearForLevel(players: Player[], chapterId: string, levelIdx: number): string[] {
  return players.filter(p => !playerHasClearedLevel(p, chapterId, levelIdx)).map(p => p.name);
}

// Record a level clear for a player. Returns the updated PlayerCampaignProgress.
// `levelIdx` is 0-based within the chapter; `levelId` is the flat level id
// used for the `highest_level_beaten` aggregate (kept for backwards compat
// with badges that read it).
export function recordLevelClearForPlayer(
  p: Player,
  chapterId: string,
  levelIdx: number,
  levelId: number,
  rewardPowerUpId: string | null,
): PlayerCampaignProgress {
  const cur = playerCampaignProgress(p);
  const prevCleared = cur.chapters?.[chapterId] ?? 0;
  const newCleared = Math.max(prevCleared, levelIdx + 1);
  const unlocked = rewardPowerUpId
    ? Array.from(new Set([...(cur.unlockedPowerUps || []), rewardPowerUpId]))
    : (cur.unlockedPowerUps || []);
  return {
    highest_level_beaten: Math.max(cur.highest_level_beaten, levelId),
    unlockedPowerUps: unlocked,
    chapters: { ...(cur.chapters || {}), [chapterId]: newCleared },
  };
}

// Returns the reward power-up id for a level, or null if none. Looks up
// the level within a specific chapter (since level ids are unique only
// within a chapter). Falls back to the flat lookup for backwards compat.
export function levelRewardPowerUp(levelId: number, chapterId?: string): string | null {
  const level = chapterId ? getLevelInChapter(chapterId, levelId) : getLevel(levelId);
  if (!level || !level.reward_power_up) return null;
  return level.reward_power_up;
}

// ── Level unlock gating ────────────────────────────────────────────────
//
// Per-chapter gating: level 1 of any chapter is unlocked as soon as the
// chapter itself is unlocked. Each subsequent level requires the previous
// level in the same chapter to be cleared. The flat `highest_level_beaten`
// is kept for backwards compat with badges/titles that read it as a
// cumulative count.

export function isLevelUnlocked(levelId: number, highestBeaten: number): boolean {
  if (levelId <= 1) return true;
  return levelId <= highestBeaten + 1;
}

// Per-chapter version: level 1 is unlocked iff the chapter is unlocked;
// later levels require the previous level in the same chapter to be
// cleared (chapters[chapterId] >= levelId - 1).
export function isLevelUnlockedInChapter(
  chapterId: string,
  levelId: number,
  progress: { chapters?: Record<string, number> } | undefined | null,
): boolean {
  if (levelId <= 1) return true;
  const cleared = progress?.chapters?.[chapterId] ?? 0;
  return levelId <= cleared + 1;
}

// Per-player unlock check: a level is playable for the party if ANY party
// member has unlocked it (so friends can carry a newer player forward),
// but each member's personal progress is tracked separately. Level 1 of
// any chapter is always unlocked.
export function isLevelUnlockedForParty(
  chapterId: string,
  levelId: number,
  players: Player[],
): boolean {
  if (levelId <= 1) return true;
  if (!players.length) return false;
  return players.some(p => isLevelUnlockedInChapter(chapterId, levelId, playerCampaignProgress(p)));
}

// Re-exported for callers that need both progress and unlock helpers.
export type { CampaignProgress, PlayerCoopProgress };
