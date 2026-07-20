import type { Game, GamePlayer, GameRecord, Player, Settings } from './types';
import { MODES, CHECKOUTS, SCORE_POPUPS, TEAM_COLORS, CUSTOM_TITLES, getTitleInfo } from './constants';
import { computeBattleDartDamage } from './battle';

export function recordFromGame(game: Game): GameRecord {
  return {
    id: game.id, date: game.date, mode: game.mode, practice: !!game.practice,
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
  }
  return 'No checkout — score to get ≤ 170';
}

export function visitAvg(pl: GamePlayer): number {
  const visits = pl.visits.filter(v => !v.frozen && !v.bust);
  if (!visits.length) return 0;
  const total = visits.reduce((a, v) => a + (v.scored || 0), 0);
  return total / visits.length;
}

export function leadTrailBadge(pl: GamePlayer, game: Game): string | null {
  if (game.players.length < 2) return null;
  const scores = game.players.map(p => p.score);
  const max = Math.max(...scores);
  const min = Math.min(...scores);
  if (pl.score === max && max > min) return '+lead';
  if (pl.score === min && max > min) return '-trail';
  return null;
}

export function levelFromXP(xp: number, settings: Settings) {
  const mult = settings.xpConfig.levelMult;
  const base = settings.xpConfig.baseLevelXp;
  let level = 1;
  let need = base;
  let remaining = xp;
  while (remaining >= need) {
    remaining -= need;
    level++;
    need = Math.round(need * mult);
  }
  return { level, xp, intoLevel: remaining, nextLevelXp: need };
}

export function getPlayerXPById(id: string, players: Player[]) {
  const p = players.find(pl => pl.id === id);
  if (!p) return { xp: 0, level: 1, intoLevel: 0, nextLevelXp: 100 };
  const li = levelFromXP(p.xp || 0, settingsFromPlayer(p));
  return { xp: p.xp || 0, level: li.level, intoLevel: li.intoLevel, nextLevelXp: li.nextLevelXp, selectedTitle: p.selectedTitle };
}

function settingsFromPlayer(p: Player): Settings {
  return {
    theme: 'dark', accent: '#22c55e', confirmReset: true, sound: true, music: true,
    musicStartTrack: 'start_bullseye_anthem', musicSetupTrack: 'setup_horizon', musicMatchTrack: 'match_drive',
    sfxVolume: 0.9, musicVolume: 0.9,
    xpConfig: { win: 50, visit60: 5, visit80: 10, visit100: 15, visit120: 20, visit140: 25, visit180: 50, checkout: 10, perDart: 1, levelMult: 1.5, baseLevelXp: 100 },
    customTitles: [],
    popups: { scores: true, milestones: true, xp: true, titles: true },
    powerUpScaling: {
      chargePerDouble: 8, chargePerTriple: 12, chargePerBull: 15, chargePerScorePoint: 0.05, chargeMax: 100,
      pointsPerLevel: 1, startingPoints: 1, attributePointsPerLevel: 5,
      attributeStartHealth: 300, attributeStartArmor: 0, attributeStartPower: 0,
      healthPerPoint: 25, armorPerPoint: 1, powerPerPoint: 1,
      armorMax: 25, powerMax: 30, healthMax: 500, battleMinDamage: 1,
      startingCharge: { pu_surge: 40 },
      chargesNeeded: {
        pu_fourth_dart: 100, pu_blocker: 100, pu_reroll: 80, pu_rethrow: 60,
        pu_surge: 90, pu_cripple: 90, pu_steal: 100, pu_freeze: 110, pu_lucky_miss: 70,
        pu_bullseye_frenzy: 80, pu_hot_streak: 90, pu_swap: 110,
      },
    },
  };
}

export { computeBattleDartDamage } from './battle';
