import type { Game, GamePlayer, GameRecord, Player, Settings } from '../types';
import { BUILTIN_TITLES, buildTitleCheck, SCORE_POPUPS, MILESTONES } from '../constants';
import { allVisitsFor } from '../logic';
import { Sound } from '../sound';
import type { PopupControls } from '../Popups';
import { computeGameBadges } from '../badges';
import { reconcileCoopPassivesForPlayer, addClassXp, classLevelFromXp } from '../campaign/engine/classes';
import { COOP_CLASSES } from '../campaign/engine/classes';
import type { CoopClassId } from '../campaign/types';

function buildClassLevels(player: Player | undefined, settings: Settings): Record<string, number> {
  const prog = player?.coopProgress;
  if (!prog) return {};
  const out: Record<string, number> = {};
  for (const cls of COOP_CLASSES) {
    out[cls.id] = classLevelFromXp(prog, cls.id as CoopClassId, settings).level;
  }
  return out;
}

export function runMilestones(p: GamePlayer, remaining: number, visitScore: number, settings: Settings, popups: PopupControls, setPlayers: (updater: any) => void, game: Game, players: Player[], games: GameRecord[]) {
  if (settings.popups.scores) {
    for (const sp of SCORE_POPUPS) { if (visitScore >= sp.min) { popups.setMilestone({ emoji: sp.emoji, title: sp.title, sub: sp.sub }); Sound.play('milestone', {}, settings); break; } }
  }
  if (settings.popups.milestones) {
    for (const ms of MILESTONES) { if (remaining < ms.threshold && p.score + visitScore >= ms.threshold) { setTimeout(() => popups.setMilestone({ emoji: ms.emoji, title: ms.title, sub: ms.sub }), 1800); break; } }
  }
  const pid = p.id;
  const prevVisits = allVisitsFor(pid, []).filter(v => !v.bust && !v.atc);
  void prevVisits;
  awardVisitXP(p, visitScore, settings, setPlayers, popups);
  checkTitleUnlocks(p, settings, popups, setPlayers, game, players, games);
}

export function awardVisitXP(p: GamePlayer, visitScore: number, settings: Settings, setPlayers: (updater: any) => void, popups: PopupControls) {
  const cfg = settings.xpConfig;
  let xp = cfg.perDart * 3;
  if (visitScore >= 180) xp += cfg.visit180;
  else if (visitScore >= 140) xp += cfg.visit140;
  else if (visitScore >= 120) xp += cfg.visit120;
  else if (visitScore >= 100) xp += cfg.visit100;
  else if (visitScore >= 80) xp += cfg.visit80;
  else if (visitScore >= 60) xp += cfg.visit60;
  awardXP(p.id, xp, `${visitScore}-point visit`, settings, setPlayers, popups);
}

export function awardXP(playerId: string, amount: number, reason: string, settings: Settings, setPlayers: (updater: any) => void, popups: PopupControls) {
  if (amount <= 0) return;
  setPlayers((prev: Player[]) => prev.map(p => {
    if (p.id !== playerId) return p;
    const classId = p.coopProgress?.classId || null;
    const curProg = p.coopProgress;
    const oldLevel = classLevelFromXp(curProg, classId, settings).level;
    const updatedProg = addClassXp(curProg, classId, amount);
    const li = classLevelFromXp(updatedProg, classId, settings);
    if (li.level > oldLevel && settings.popups.xp) { popups.setLevelUp({ level: li.level, name: p.name, xpGained: amount, reason }); Sound.play('levelup', {}, settings); }
    let next: Player = { ...p, coopProgress: updatedProg };
    if (li.level > oldLevel) {
      const coopProg = next.coopProgress;
      if (coopProg?.classId) {
        const { progress: reconciledProg } = reconcileCoopPassivesForPlayer(coopProg, li.level);
        next = { ...next, coopProgress: reconciledProg };
      }
    }
    return next;
  }));
}

export function checkTitleUnlocks(pl: GamePlayer, settings: Settings, popups: PopupControls, setPlayers: (updater: any) => void, game: Game, _players: Player[], games: GameRecord[] = []) {
  if (!settings.popups.titles) return;
  const titles = [...BUILTIN_TITLES, ...settings.customTitles.map(t => ({ ...t, custom: true, check: buildTitleCheck(t) as any }))];
  setPlayers((prev: Player[]) => {
    const player = prev.find(p => p.id === pl.id);
    if (!player) return prev;
    const unlocked = [...(player.unlockedTitles || [])];

    const historyGames = games.filter(g => g.id !== game.id && g.players.some(p => p.id === pl.id));
    const historyVisits = allVisitsFor(pl.id, historyGames);
    const lifetimeVisits = [...historyVisits, ...(pl.visits || [])];
    const gamesPlayed = historyGames.length + (game.finished ? 1 : 0);
    const gamesWon = historyGames.filter(g => g.winner === pl.id).length + (game.finished && game.winner === pl.id ? 1 : 0);
    const ctx = { playerId: pl.id, games: historyGames, gamesPlayed, gamesWon, lifetimeVisits, classLevels: buildClassLevels(player, settings) };

    titles.forEach(t => {
      if (unlocked.includes(t.id)) return;
      let met = false;
      try { met = t.check(lifetimeVisits, pl.visits || [], game, ctx); } catch { met = false; }
      if (met) {
        unlocked.push(t.id);
        popups.setTitleUnlock({ icon: t.icon || '🏅', name: t.name, player: pl.name, desc: t.desc || '' });
        Sound.play('title', {}, settings);
      }
    });
    return prev.map(p => p.id === pl.id ? { ...p, unlockedTitles: unlocked } : p);
  });
}

export function awardBadges(game: Game, setPlayers: (updater: any) => void) {
  const map = computeGameBadges(game);
  setPlayers((prev: Player[]) => prev.map(p => {
    const ids = map[p.id] || [];
    if (!ids.length) return p;
    const existing = new Set(p.unlockedBadges || []);
    const counts: Record<string, number> = { ...(p.badgeCounts || {}) };
    let changed = false;
    const uniqueThisGame = Array.from(new Set(ids));
    uniqueThisGame.forEach((id) => {
      if (!existing.has(id)) { existing.add(id); changed = true; }
      counts[id] = (counts[id] || 0) + 1;
      changed = true;
    });
    return changed ? { ...p, unlockedBadges: Array.from(existing), badgeCounts: counts } : p;
  }));
}
