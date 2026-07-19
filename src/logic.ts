import type { Game, GamePlayer, GameRecord, Player, Settings, Visit } from './types';
import { MODES, CHECKOUTS, ATC_TARGETS, atcLabel, defaultSettings } from './constants';
import { uid, todayKey } from './store';

export function createGame(modeKey: string, playerIds: string[], players: Player[], doubleOut: boolean, legsBestOf: number, teamMode = false, teamAssignment: number[] = [], powerUpsEnabled = false, settings: Settings | null = null): Game {
  const mode = MODES[modeKey];
  const meta = (id: string) => players.find(p => p.id === id)!;
  const special = !!(mode.practice || mode.atc || mode.killer || mode.party);
  const basePlayers = playerIds.map((id, i) => {
    const src = meta(id);
    const gp: GamePlayer = { id, name: src.name, color: src.color, score: mode.start, legsWon: 0, visits: [], idx: 0, dartsThrown: 0, done: false, team: teamMode && teamAssignment[i] != null ? teamAssignment[i] : undefined };
    if (mode.killer) { gp.lives = 3; gp.eliminated = false; gp.killerNumber = KILLER_NUMBERS[i % KILLER_NUMBERS.length]; gp.killerHits = 0; gp.kills = []; }
    if (powerUpsEnabled) {
      gp.powerUpCharge = 0;
      gp.powerUpUsed = false;
      gp.powerUpUses = 0;
      gp.powerUpId = src.powerUps?.active ?? null;
    }
    if (modeKey === 'battle') {
      const s = settings as Settings | null;
      const attrs = src.attributes || defaultAttributes(s || defaultSettings());
      const cfg = s ? s.powerUpScaling : defaultSettings().powerUpScaling;
      const startHealth = numOr(cfg.attributeStartHealth, 300);
      const startArmor = numOr(cfg.attributeStartArmor, 0);
      const startPower = numOr(cfg.attributeStartPower, 0);
      const capHealth = Math.max(1, numOr(cfg.healthMax, startHealth));
      const capArmor = Math.max(0, numOr(cfg.armorMax, startArmor));
      const capPower = Math.max(0, numOr(cfg.powerMax, startPower));
      const safeHealth = Number.isFinite(attrs.health) ? (attrs.health as number) : startHealth;
      const safeArmor = Number.isFinite(attrs.armor) ? (attrs.armor as number) : startArmor;
      const safePower = Number.isFinite(attrs.power) ? (attrs.power as number) : startPower;
      gp.hp = Math.max(1, Math.min(capHealth, safeHealth));
      gp.maxHp = Math.max(1, Math.min(capHealth, safeHealth));
      gp.armorPct = Math.max(0, Math.min(capArmor, safeArmor));
      gp.powerPct = Math.max(0, Math.min(capPower, safePower));
      gp.defeated = false;
      gp.attacks = [];
      gp.damageDealt = 0;
      gp.damageTaken = 0;
    }
    return gp;
  });
  const teamCount = teamMode ? (teamAssignment.length ? Math.max(...teamAssignment) + 1 : 0) : 0;
  return {
    id: uid(), mode: modeKey, date: new Date().toISOString(),
    doubleOut: special ? false : doubleOut,
    practice: !!mode.practice, atc: !!mode.atc,
    legsBestOf: special ? 1 : legsBestOf,
    players: basePlayers,
    turn: 0, leg: 1, finished: false, winner: null, checkedOutThisRound: [], thrownThisRound: [], roundStartTurn: 0, darts: [], mult: 1,
    teamMode, teamCount: teamCount || undefined,
    teamLegsWon: teamMode ? Array.from({ length: teamCount }, () => 0) : undefined,
    teamTurn: teamMode ? 0 : undefined,
    teamPlayerCursor: teamMode ? Array.from({ length: teamCount }, () => 0) : undefined,
    winningTeam: null,
    powerUpsEnabled,
  };
}

const KILLER_NUMBERS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

export function recordFromGame(game: Game): GameRecord {
  return {
    id: game.id, date: game.date, mode: game.mode, practice: game.practice, atc: game.atc,
    doubleOut: game.doubleOut, legsBestOf: game.legsBestOf, winner: game.winner,
    tied: !!game.tied, tiedPlayers: game.tiedPlayers ?? null,
    teamMode: !!game.teamMode, teamCount: game.teamCount, winningTeam: game.winningTeam ?? null,
    powerUpsEnabled: !!game.powerUpsEnabled,
    players: game.players.map(pl => {
      const r: any = { id: pl.id, name: pl.name, color: pl.color, legsWon: pl.legsWon, dartsThrown: pl.dartsThrown || 0, visits: pl.visits, team: pl.team, kills: pl.kills, defeated: pl.defeated };
      if (game.powerUpsEnabled) {
        const pu = (pl as any);
        const used = pu._usedBlocker ? 'pu_blocker'
          : pu._usedSurge ? 'pu_surge'
          : pu._usedSteal ? 'pu_steal'
          : pu._usedFreeze ? 'pu_freeze'
          : pu._usedReroll ? 'pu_reroll'
          : pu._usedLuckyMiss ? 'pu_lucky_miss'
          : pu._usedFourthDart ? 'pu_fourth_dart'
          : null;
        r.usedPowerUp = used;
      }
      return r;
    }),
  };
}

export function checkoutHint(remaining: number | null, doubleOut: boolean, practice?: boolean): string {
  if (remaining == null || practice) return '';
  if (remaining < 0) return 'Bust!';
  if (remaining === 0) return 'Checked out!';
  if (remaining === 1) return doubleOut ? 'No checkout — bust risk' : 'Checkout: S1';
  if (remaining > 170) return 'No 3-dart checkout — score to get ≤ 170';
  const co = CHECKOUTS[remaining];
  if (co) return 'Checkout: ' + co.join('  ');
  if (!doubleOut) {
    if (remaining <= 20) return `Checkout: S${remaining}`;
    if (remaining === 25) return 'Checkout: 25 (outer bull)';
    if (remaining === 50) return 'Checkout: Bull';
    // Straight-out: any darts summing to `remaining` finish the leg. Suggest
    // two single segments (1-20) that add up when possible; otherwise fall
    // back to a generic message so we never reference impossible segments
    // (e.g. S31) or darts that would bust (e.g. D16 on 31).
    if (remaining <= 40) {
      const first = Math.min(20, remaining - 1);
      const rest = remaining - first;
      return `Checkout: S${first} + S${rest}`;
    }
    return `Checkout: ${remaining} — score to finish`;
  }
  return 'No checkout from ' + remaining;
}

export function leadTrailBadge(pl: GamePlayer, game: Game): string {
  if (game.practice || game.players.length < 2) return '';
  const scores = game.players.map(p => p.score);
  const leaderScore = Math.min(...scores);
  if (pl.score === leaderScore) {
    const next = scores.filter(s => s !== leaderScore).sort((a, b) => a - b)[0];
    const ahead = next != null ? next - leaderScore : 0;
    return ahead > 0 ? `+${ahead}` : '';
  }
  const behind = pl.score - leaderScore;
  return behind > 0 ? `-${behind}` : '';
}

export function visitAvg(pl: GamePlayer): number {
  if (!pl.visits.length) return 0;
  const total = pl.visits.reduce((a, v) => a + v.scored, 0);
  const darts = pl.visits.reduce((a, v) => a + v.darts.length, 0);
  return darts ? total / darts * 3 : 0;
}

export function visitAvgStatic(pl: { visits: Visit[] }): number {
  const s = (pl.visits || []).filter(v => !v.bust);
  const t = s.reduce((a, v) => a + v.scored, 0);
  const d = s.reduce((a, v) => a + v.darts.length, 0);
  return d ? t / d * 3 : 0;
}

export function levelFromXP(totalXP: number, settings: Settings) {
  const xpForLevel = (level: number) => Math.round(settings.xpConfig.baseLevelXp * Math.pow(settings.xpConfig.levelMult, level - 1));
  let level = 1, remaining = totalXP;
  while (remaining >= xpForLevel(level)) { remaining -= xpForLevel(level); level++; }
  return { level, xpIntoLevel: remaining, xpNeeded: xpForLevel(level) };
}

export function getPlayerXP(player: Player | undefined) {
  if (!player) return { xp: 0, level: 1, unlockedTitles: [] as string[], selectedTitle: null as string | null, unlockedBadges: [] as string[], badgeCounts: {} as Record<string, number>, selectedBadge: null as string | null, showBadgeContext: false };
  return {
    xp: player.xp ?? 0, level: player.level ?? 1,
    unlockedTitles: player.unlockedTitles ?? [], selectedTitle: player.selectedTitle ?? null,
    unlockedBadges: player.unlockedBadges ?? [], badgeCounts: player.badgeCounts ?? {}, selectedBadge: player.selectedBadge ?? null,
    showBadgeContext: player.showBadgeContext ?? false,
  };
}

export function defaultAttributes(settings: Settings) {
  const cfg = settings.powerUpScaling;
  return {
    health: numOr(cfg.attributeStartHealth, 0),
    armor: numOr(cfg.attributeStartArmor, 0),
    power: numOr(cfg.attributeStartPower, 0),
    pointsAvailable: 0,
  };
}

function numOr<T>(v: unknown, fallback: T): T | number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

export function defaultPowerUps(settings: Settings) {
  return {
    unlocked: [] as string[],
    active: null as string | null,
    pointsAvailable: settings.powerUpScaling.startingPoints,
  };
}

export function totalAttributePointsForLevel(level: number, settings: Settings): number {
  return Math.max(0, (level - 1)) * settings.powerUpScaling.attributePointsPerLevel;
}

export function totalPowerUpPointsForLevel(level: number, settings: Settings): number {
  return settings.powerUpScaling.startingPoints + Math.max(0, (level - 1)) * settings.powerUpScaling.pointsPerLevel;
}

export function reconcilePlayerPoints(player: Player, settings: Settings): Player {
  const level = player.level ?? 1;
  const cfg = settings.powerUpScaling;
  const attrs = player.attributes || defaultAttributes(settings);
  const pwr = player.powerUps || defaultPowerUps(settings);
  const devBonus = player.developerMode ? 100 : 0;

  const attrTotal = totalAttributePointsForLevel(level, settings) + devBonus;

  // Sanitize raw attribute values: clamp NaN/non-finite to the configured
  // starting value, then clamp to the configured caps. Old saves may carry
  // values from a previous scaling config (e.g. health=400 when the base is
  // now 300) — we recompute each attribute from the starting value plus the
  // points the player could have spent on it, so the stored value always
  // reflects the current base stats rather than a stale DB snapshot.
  const startHealth = numOr(cfg.attributeStartHealth, 0);
  const startArmor = numOr(cfg.attributeStartArmor, 0);
  const startPower = numOr(cfg.attributeStartPower, 0);
  const capHealth = numOr(cfg.healthMax, startHealth);
  const capArmor = numOr(cfg.armorMax, startArmor);
  const capPower = numOr(cfg.powerMax, startPower);
  const perHealth = numOr(cfg.healthPerPoint, 1) || 1;
  const perArmor = numOr(cfg.armorPerPoint, 1) || 1;
  const perPower = numOr(cfg.powerPerPoint, 1) || 1;

  const rawHealth = Number.isFinite(attrs.health) ? (attrs.health as number) : startHealth;
  const rawArmor = Number.isFinite(attrs.armor) ? (attrs.armor as number) : startArmor;
  const rawPower = Number.isFinite(attrs.power) ? (attrs.power as number) : startPower;

  // How many points the player has effectively spent on each attribute,
  // derived from the stored value vs the current starting value.
  let healthSpent = safeSpent(rawHealth, startHealth, perHealth);
  let armorSpent = safeSpent(rawArmor, startArmor, perArmor);
  let powerSpent = safeSpent(rawPower, startPower, perPower);

  // If the total spent exceeds what the player could have earned, the stored
  // values came from an old scaling config. Recompute each attribute from the
  // starting value using the points actually available to spend on it, so the
  // value is always derived from base stats rather than the stale DB value.
  const attrSpent = healthSpent + armorSpent + powerSpent;
  if (attrSpent > attrTotal) {
    // Redistribute the available points proportionally to what was spent,
    // falling back to an even split when the prior spend can't be honored.
    if (attrSpent <= 0) {
      healthSpent = 0; armorSpent = 0; powerSpent = 0;
    } else {
      const scale = attrTotal / attrSpent;
      healthSpent = Math.floor(healthSpent * scale);
      armorSpent = Math.floor(armorSpent * scale);
      powerSpent = Math.max(0, attrTotal - healthSpent - armorSpent);
    }
  }

  const sanitizedHealth = Math.max(startHealth, Math.min(capHealth, startHealth + healthSpent * perHealth));
  const sanitizedArmor = Math.max(startArmor, Math.min(capArmor, startArmor + armorSpent * perArmor));
  const sanitizedPower = Math.max(startPower, Math.min(capPower, startPower + powerSpent * perPower));

  const attrAvail = Math.max(0, attrTotal - (healthSpent + armorSpent + powerSpent));

  const pwrTotal = totalPowerUpPointsForLevel(level, settings) + devBonus;
  const pwrSpent = (pwr.unlocked || []).length;
  const pwrAvail = Math.max(0, pwrTotal - pwrSpent);

  const nextAttrs = { ...attrs, health: sanitizedHealth, armor: sanitizedArmor, power: sanitizedPower, pointsAvailable: attrAvail };
  const nextPwr = { ...pwr, pointsAvailable: pwrAvail };

  const changed =
    (attrs.pointsAvailable !== attrAvail) ||
    (attrs.health !== sanitizedHealth) ||
    (attrs.armor !== sanitizedArmor) ||
    (attrs.power !== sanitizedPower) ||
    (pwr.pointsAvailable !== pwrAvail);
  if (!changed) return player;
  return { ...player, attributes: nextAttrs, powerUps: nextPwr };
}

// Compute how many points were spent on a single attribute, guarding against
// zero/missing per-point values so we never produce NaN.
function safeSpent(current: number, start: number, perPoint: number): number {
  if (!Number.isFinite(current) || !Number.isFinite(start)) return 0;
  if (!Number.isFinite(perPoint) || perPoint <= 0) return 0;
  const diff = current - start;
  if (diff <= 0) return 0;
  return Math.round(diff / perPoint);
}

export function reconcileAllPlayersPoints(players: Player[], settings: Settings): { players: Player[]; changed: boolean } {
  let changed = false;
  const next = players.map((p) => {
    const updated = reconcilePlayerPoints(p, settings);
    if (updated !== p) changed = true;
    return updated;
  });
  return { players: next, changed };
}

// Per-dart battle damage. Each dart is calculated independently so armor
// applies to every dart (countering multi-hit builds) and power boosts every
// successful hit. Misses deal 0 damage (power only applies on a hit). A
// successful hit always deals at least `battleMinDamage` (default 1) so armor
// can never fully neutralize a turn.
//
//   damage(dart) = max(0, dartValue + power) − armor   →   clamp to [minDamage, ∞) on hit, 0 on miss
export function computeBattleDartDamage(dartValue: number, attackerPower: number, targetArmor: number, settings: Settings): number {
  const cfg = settings.powerUpScaling;
  const power = Math.min(cfg.powerMax, Math.max(0, attackerPower));
  const armor = Math.min(cfg.armorMax, Math.max(0, targetArmor));
  if (dartValue <= 0) return 0; // miss — power only applies on successful hits
  const raw = Math.max(0, dartValue + power) - armor;
  return Math.max(cfg.battleMinDamage, raw);
}

// Convenience: total damage across a visit's darts.
export function computeBattleVisitDamage(dartValues: number[], attackerPower: number, targetArmor: number, settings: Settings): number {
  return dartValues.reduce((sum, v) => sum + computeBattleDartDamage(v, attackerPower, targetArmor, settings), 0);
}

// Legacy single-number API kept for any external callers; computes per-dart
// damage from a flat visit score treated as a single hit. Prefer
// computeBattleDartDamage / computeBattleVisitDamage for new code.
export function computeBattleDamage(visitScore: number, attackerPower: number, targetArmor: number, settings: Settings): number {
  return computeBattleDartDamage(visitScore, attackerPower, targetArmor, settings);
}

export function getPlayerXPById(playerId: string, players: Player[]) {
  return getPlayerXP(players.find(p => p.id === playerId));
}

export function allVisitsFor(playerId: string, games: GameRecord[]): any[] {
  const out: any[] = [];
  games.forEach(g => {
    const pl = g.players.find(p => p.id === playerId);
    if (!pl) return;
    pl.visits.forEach(v => out.push({ ...v, mode: g.mode, gameId: g.id, gameDate: g.date, practice: g.practice }));
  });
  return out;
}

export interface DateFilter {
  start: string;
  end: string;
}

export function filterGamesByDate(games: GameRecord[], filter: DateFilter | null): GameRecord[] {
  if (!filter) return games;
  const start = new Date(filter.start).getTime();
  const end = new Date(filter.end).getTime();
  return games.filter(g => {
    const t = new Date(g.date).getTime();
    return t >= start && t < end;
  });
}

export function playerStats(playerId: string, games: GameRecord[]) {
  const visits = allVisitsFor(playerId, games);
  const scoring = visits.filter((v: any) => !v.bust && !v.atc);
  const totalScore = scoring.reduce((a: number, v: any) => a + v.scored, 0);
  const totalDarts = scoring.reduce((a: number, v: any) => a + v.darts.length, 0);
  const playerGames = games.filter(g => g.players.some(p => p.id === playerId));
  const competitiveGames = playerGames.filter(g => g.players.length >= 2);
  const legsWon = competitiveGames.reduce((a, g) => a + (g.players.find(p => p.id === playerId)?.legsWon || 0), 0);
  const gamesWon = competitiveGames.filter(g => g.winner === playerId).length;
  const gamesTied = competitiveGames.filter(g => g.tied && g.tiedPlayers && g.tiedPlayers.includes(playerId)).length;
  const checkouts = scoring.filter((v: any) => v.remaining === 0);
  const highCheckout = Math.max(0, ...checkouts.map((v: any) => v.scored));
  const highScore = Math.max(0, ...scoring.map((v: any) => v.scored));
  const n180 = scoring.filter((v: any) => v.scored === 180).length;
  const n140 = scoring.filter((v: any) => v.scored >= 140 && v.scored < 180).length;
  const tons = scoring.filter((v: any) => v.scored >= 100 && v.scored < 140).length;
  const first9 = (() => {
    let s = 0, c = 0;
    playerGames.forEach(g => {
      const pl = g.players.find(p => p.id === playerId); if (!pl) return;
      const byLeg: Record<number, any[]> = {};
      pl.visits.forEach(v => { if (v.bust || v.atc) return; (byLeg[v.leg || 1] = byLeg[v.leg || 1] || []).push(v); });
      Object.values(byLeg).forEach(arr => { arr.slice(0, 3).forEach(v => { s += v.scored; c += v.darts.length; }); });
    });
    return c ? s / c * 3 : 0;
  })();
  const winRate = competitiveGames.length ? gamesWon / competitiveGames.length * 100 : 0;
  const tieRate = competitiveGames.length ? gamesTied / competitiveGames.length * 100 : 0;

  let dartsThrown = 0;
  const finishDartsList: number[] = [];
  playerGames.forEach(g => {
    const pl = g.players.find(p => p.id === playerId); if (!pl) return;
    const byLeg: Record<string, { darts: number; finished: boolean }> = {};
    pl.visits.forEach((v: any) => {
      dartsThrown += (v.darts?.length || 0);
      if (v.atc || g.practice) return;
      const k = String(v.leg || 1);
      const b = byLeg[k] = byLeg[k] || { darts: 0, finished: false };
      b.darts += (v.darts?.length || 0);
      if (v.remaining === 0) b.finished = true;
    });
    Object.values(byLeg).forEach(b => { if (b.finished) finishDartsList.push(b.darts); });
  });
  const finishMin = finishDartsList.length ? Math.min(...finishDartsList) : 0;
  const finishMax = finishDartsList.length ? Math.max(...finishDartsList) : 0;
  const finishAvg = finishDartsList.length ? finishDartsList.reduce((a, b) => a + b, 0) / finishDartsList.length : 0;

  const battleGames = playerGames.filter(g => g.mode === 'battle');
  const kills = battleGames.reduce((a, g) => a + ((g.players.find(p => p.id === playerId)?.kills || []).length), 0);
  const defeatedCount = battleGames.filter(g => g.players.find(p => p.id === playerId)?.defeated).length;

  return { games: playerGames.length, competitiveGames: competitiveGames.length, gamesWon, gamesTied, legsWon, winRate, tieRate, avg: totalDarts ? totalScore / totalDarts * 3 : 0, first9, highScore, highCheckout, n180, n140, tons, visits, dartsThrown, finishMin, finishMax, finishAvg, legsFinished: finishDartsList.length, kills, defeatedCount, battleGames: battleGames.length };
}

export function bucketAverages(visits: any[], period: string) {
  if (!visits.length) return { labels: [], values: [] };
  const key = (d: string) => {
    const dt = new Date(d);
    if (period === 'Daily') return todayKey(dt);
    if (period === 'Weekly') { const t = new Date(dt); const day = (t.getDay() + 6) % 7; t.setDate(t.getDate() - day); return todayKey(t); }
    if (period === 'Monthly') return dt.toISOString().slice(0, 7);
    if (period === 'Yearly') return String(dt.getFullYear());
    return todayKey(dt);
  };
  const map: Record<string, { s: number; d: number }> = {};
  visits.forEach(v => { const k = key(v.date || v.gameDate); (map[k] = map[k] || { s: 0, d: 0 }); map[k].s += v.scored; map[k].d += v.darts.length; });
  const keys = Object.keys(map).sort();
  const trimmed = period === 'Overall' ? keys.slice(-30) : keys.slice(-14);
  const shortLabel = (k: string) => {
    if (period === 'Monthly') { const [, m] = k.split('-'); return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+m - 1]; }
    if (period === 'Yearly') return k;
    const d = new Date(k); return d.getDate() + '/' + (d.getMonth() + 1);
  };
  return { labels: trimmed.map(shortLabel), values: trimmed.map(k => map[k].d ? map[k].s / map[k].d * 3 : 0) };
}

export { ATC_TARGETS, atcLabel };

import { BUILTIN_TITLES, buildTitleCheck, type TitleCtx } from './constants';
import type { CustomTitle } from './types';

export function computeUnlockedTitlesForPlayer(
  playerId: string,
  games: GameRecord[],
  customTitles: CustomTitle[] = [],
): string[] {
  const playerGames = games.filter(g => g.players.some(p => p.id === playerId));
  const gamesWon = playerGames.filter(g => g.players.length >= 2 && g.winner === playerId).length;
  const gamesPlayed = playerGames.length;
  const lifetimeVisits: any[] = [];
  playerGames.forEach(g => {
    const pl = g.players.find(p => p.id === playerId);
    if (!pl) return;
    pl.visits.forEach(v => lifetimeVisits.push({ ...v, gameId: g.id, gameDate: g.date, practice: g.practice }));
  });

  const titles = [
    ...BUILTIN_TITLES,
    ...customTitles.map(t => ({ ...t, custom: true, check: buildTitleCheck(t) as any })),
  ];
  const unlocked = new Set<string>();

  const ctx: TitleCtx = { playerId, games: playerGames, gamesPlayed, gamesWon, lifetimeVisits };

  titles.forEach(t => {
    try { if (t.check(lifetimeVisits, [], null, ctx)) unlocked.add(t.id); } catch { /* ignore */ }
  });

  playerGames.forEach(g => {
    const pl = g.players.find(p => p.id === playerId);
    if (!pl) return;
    const gameVisits = pl.visits;
    const gameLike = { ...g, winner: g.winner, players: g.players, legsBestOf: g.legsBestOf };
    titles.forEach(t => {
      if (unlocked.has(t.id)) return;
      try { if (t.check(lifetimeVisits, gameVisits, gameLike, ctx)) unlocked.add(t.id); } catch { /* ignore */ }
    });
  });

  return Array.from(unlocked);
}

export function retroUnlockPlayerTitles(
  player: Player,
  games: GameRecord[],
  customTitles: CustomTitle[] = [],
): Player {
  const existing = new Set(player.unlockedTitles || []);
  const found = computeUnlockedTitlesForPlayer(player.id, games, customTitles);
  let changed = false;
  found.forEach(id => { if (!existing.has(id)) { existing.add(id); changed = true; } });
  return changed ? { ...player, unlockedTitles: Array.from(existing) } : player;
}

export function retroUnlockAll(
  players: Player[],
  games: GameRecord[],
  customTitles: CustomTitle[] = [],
): { players: Player[]; changed: boolean } {
  let changed = false;
  const next = players.map(p => {
    const updated = retroUnlockPlayerTitles(p, games, customTitles);
    if (updated !== p) changed = true;
    return updated;
  });
  return { players: next, changed };
}

export { computeLifetimeBadges } from './badges';
