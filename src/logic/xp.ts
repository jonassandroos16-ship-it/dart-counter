import type { Player, Settings } from '../types';

export function levelFromXP(totalXP: number, settings: Settings) {
  const xpForLevel = (level: number) => Math.round(settings.xpConfig.baseLevelXp * Math.pow(settings.xpConfig.levelMult, level - 1));
  let level = 1, remaining = totalXP;
  while (remaining >= xpForLevel(level)) { remaining -= xpForLevel(level); level++; }
  return { level, xpIntoLevel: remaining, xpNeeded: xpForLevel(level) };
}

export function getPlayerXP(player: Player | undefined) {
  if (!player) return { xp: 0, level: 1, unlockedTitles: [] as string[], selectedTitle: null as string | null, unlockedBadges: [] as string[], badgeCounts: {} as Record<string, number>, selectedBadge: null as string | null, showBadgeContext: false };
  const classId = player.coopProgress?.classId;
  const classXp = classId ? (player.coopProgress?.classXp?.[classId] ?? 0) : 0;
  const xp = classXp || player.xp || 0;
  return {
    xp,
    level: player.level ?? 1,
    unlockedTitles: player.unlockedTitles ?? [], selectedTitle: player.selectedTitle ?? null,
    unlockedBadges: player.unlockedBadges ?? [], badgeCounts: player.badgeCounts ?? {}, selectedBadge: player.selectedBadge ?? null,
    showBadgeContext: player.showBadgeContext ?? false,
  };
}

export function getPlayerXPById(playerId: string, players: Player[]) {
  return getPlayerXP(players.find(p => p.id === playerId));
}
