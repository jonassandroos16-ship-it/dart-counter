import type { Game, GamePlayer, GameRecord, Player, Settings, Visit } from '../types';
import { MODES, CHECKOUTS, ATC_TARGETS, atcLabel, defaultSettings } from '../constants';
import { uid } from '../store';

import { effectiveAttributes, classHealthMax, classArmorMax, classPowerMax, classStartHealth, classStartArmor, classStartPower } from './attributes';

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
      const s = settings as Settings | null;
      const startMap = (s && s.powerUpScaling && s.powerUpScaling.startingCharge) || {};
      const startCharge = startMap[gp.powerUpId || ''] || 0;
      if (startCharge > 0) {
        const cap = (s && s.powerUpScaling && s.powerUpScaling.chargeMax) || 100;
        const neededMap = (s && s.powerUpScaling && s.powerUpScaling.chargesNeeded) || {};
        const needed = neededMap[gp.powerUpId || ''];
        const orbCap = Number.isFinite(needed) && needed != null ? Math.min(cap, needed as number) : cap;
        gp.powerUpCharge = Math.max(0, Math.min(orbCap, startCharge));
      }
    }
    if (modeKey === 'battle') {
      const s = settings as Settings | null;
      const ss = s || defaultSettings();
      const attrs = effectiveAttributes(src, ss);
      const cid = src.coopProgress?.classId;
      const healthMax = classHealthMax(cid, ss);
      const armorMax = classArmorMax(cid, ss);
      const powerMax = classPowerMax(cid, ss);
      const startHealth = classStartHealth(cid, ss);
      const startArmor = classStartArmor(cid, ss);
      const startPower = classStartPower(cid, ss);
      const safeHealth = Number.isFinite(attrs.health) ? attrs.health : startHealth;
      const safeArmor = Number.isFinite(attrs.armor) ? attrs.armor : startArmor;
      const safePower = Number.isFinite(attrs.power) ? attrs.power : startPower;
      gp.hp = Math.max(1, Math.min(healthMax, safeHealth));
      gp.maxHp = Math.max(1, Math.min(healthMax, safeHealth));
      gp.armorPct = Math.max(0, Math.min(armorMax, safeArmor));
      gp.powerPct = Math.max(0, Math.min(powerMax, safePower));
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
          : pu._usedRethrow ? 'pu_rethrow'
          : pu._usedCripple ? 'pu_cripple'
          : pu._usedBullseyeFrenzy ? 'pu_bullseye_frenzy'
          : pu._usedHotStreak ? 'pu_hot_streak'
          : pu._usedSwap ? 'pu_swap'
          : pu._usedShield ? 'pu_shield'
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
  const isHighScore = game.mode === 'highscore';
  const leaderScore = isHighScore ? Math.max(...scores) : Math.min(...scores);
  if (pl.score === leaderScore) {
    const next = scores.filter(s => s !== leaderScore).sort((a, b) => isHighScore ? b - a : a - b)[0];
    const ahead = isHighScore ? leaderScore - next : next - leaderScore;
    return ahead > 0 ? `+${ahead}` : '';
  }
  const behind = isHighScore ? leaderScore - pl.score : pl.score - leaderScore;
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

export { ATC_TARGETS, atcLabel };
