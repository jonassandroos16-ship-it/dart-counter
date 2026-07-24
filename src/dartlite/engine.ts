// ── Dartlite engine ───────────────────────────────────────────────────
//
// Dartlite is a rogue-lite coop mode. The party fights through endless
// rounds of enemies drawn from the existing enemy database. Every 5th
// round is a mini-boss; every 10th round is a boss. After each round the
// party chooses one of three boons: heal 20%, gain a stat, or get a random
// trinket. Trinkets and stats gained during the run do NOT carry over to
// new games. The run ends when the party dies.
//
// The combat itself reuses the Coop Campaign battle engine (playerTurn.ts,
// enemyAi.ts) so the dart-throwing experience is identical. This module
// owns the meta-layer: round progression, enemy selection, boon choices,
// trinket application, and run stats.
//
// This file is a barrel re-export. The logic has been split into:
//   engineTypes.ts     — interfaces, types, round schedule, XP helpers
//   roundLogic.ts      — enemy selection, scaling, level building
//   choices.ts         — boon choice generation and application
//   trinketEffects.ts  — trinket effect helpers and boss trinket selection

import type { Player, Settings } from '../types';
import { effectiveAttributes } from '../logic';
import { startBattle } from '../campaign/engine/playerTurn';
import {
  STARTER_POOL, availablePool, newlyUnlockedTrinket,
  bossTrinketOptions,
} from './trinkets';
import { getPlayerCards } from '../cards/deck';

import type { DartliteRun, DartliteRunPlayer, DartliteRunStats } from './engineTypes';
export type { DartliteRun, DartliteRunPlayer, DartliteRunStats, DartlitePlayerRunStats, ChoiceOption, ChoiceKind } from './engineTypes';
export { isMiniBossRound, isBossRound, xpForKill, xpForBattleWin } from './engineTypes';
export { enemyHpScale, enemyAccScale, enemyPrecScale, scaledEnemyDb, levelForRound } from './roundLogic';
export { generateChoices, applyPlayerChoice, applyChoice } from './choices';
export {
  hasTrinket, partyPowerBonus, partyArmorBonus, partyMaxHpBonus,
  enemyAccuracyMultiplier, chargeGainMultiplier, xpMultiplier,
  shouldPhoenixRevive, applyPhoenixRevive, applyBossTrinketChoice,
} from './trinketEffects';

import { isMiniBossRound, isBossRound, xpForBattleWin } from './engineTypes';
import { scaledEnemyDb, levelForRound } from './roundLogic';
import { generateChoices } from './choices';

// ── Run initialization ────────────────────────────────────────────────

export function startRun(players: Player[], settings: Settings, cardMode: boolean = false): DartliteRun {
  const runPlayers: DartliteRunPlayer[] = players.map(p => {
    const cfg = settings.powerUpScaling;
    const startHealth = Number.isFinite(cfg.attributeStartHealth) ? cfg.attributeStartHealth : 400;
    const startArmor = Number.isFinite(cfg.attributeStartArmor) ? cfg.attributeStartArmor : 0;
    const startPower = Number.isFinite(cfg.attributeStartPower) ? cfg.attributeStartPower : 0;
    const startCrit = Number.isFinite(cfg.attributeStartCrit) ? cfg.attributeStartCrit : 5;
    const attrs = effectiveAttributes(p, settings);
    const h = Number.isFinite(attrs.health) ? attrs.health : startHealth;
    const a = Number.isFinite(attrs.armor) ? attrs.armor : startArmor;
    const pw = Number.isFinite(attrs.power) ? attrs.power : startPower;
    const cr = Number.isFinite(attrs.crit) ? attrs.crit : startCrit;
    return {
      id: p.id,
      name: p.name,
      color: p.color,
      hp: Math.max(1, h),
      maxHp: Math.max(1, h),
      power: Math.max(0, pw),
      armor: Math.max(0, a),
      crit: Math.max(0, cr),
      trinkets: [],
      bonusHealth: 0,
      bonusArmor: 0,
      bonusPower: 0,
      cards: cardMode ? getPlayerCards(p) : [],
    };
  });
  return {
    round: 0,
    playerIds: players.map(p => p.id),
    runPlayers,
    trinkets: [],
    pool: [...STARTER_POOL],
    stats: {
      roundsCleared: 0,
      enemiesDefeated: 0,
      miniBossesDefeated: 0,
      bossesDefeated: 0,
      damageDealt: 0,
      xpGained: 0,
      trinketsCollected: [],
    },
    playerStats: players.map(p => ({
      playerId: p.id,
      kills: 0,
      damageDealt: 0,
      rewards: [],
      trinkets: [],
    })),
    phase: 'setup',
    battle: null,
    pendingChoice: null,
    choicePlayerIdx: 0,
    playerChoices: players.map(() => null),
    lastUnlockedTrinket: null,
    bossVictory: null,
    cardMode,
    log: [],
  };
}

// ── Start a battle for the current round ───────────────────────────────

export function beginRound(run: DartliteRun, players: Player[], settings: Settings): DartliteRun {
  const round = run.round + 1;
  const level = levelForRound(round);
  const pseudoPlayers: Player[] = run.runPlayers.map(rp => {
    const orig = players.find(p => p.id === rp.id) || ({} as Player);
    return {
      ...orig,
      id: rp.id,
      name: rp.name,
      color: rp.color,
      attributes: { health: rp.hp, armor: rp.armor, power: rp.power, crit: rp.crit, pointsAvailable: 0 },
    } as Player;
  });
  const battle = startBattle(level, pseudoPlayers, settings, scaledEnemyDb(round), 'dartlite');
  for (const rp of run.runPlayers) {
    if (rp.trinkets.includes('trk_overcharge')) {
      const idx = battle.players.findIndex(p => p.id === rp.id);
      if (idx >= 0) {
        battle.players[idx] = { ...battle.players[idx], powerUpCharge: Math.min(settings.powerUpScaling.chargeMax, 40) };
      }
    }
  }
  return { ...run, round, phase: 'battle', battle, lastUnlockedTrinket: null, bossVictory: null, choicePlayerIdx: 0, playerChoices: run.playerIds.map(() => null) };
}

// ── Resolve a battle outcome ──────────────────────────────────────────

export function resolveBattle(run: DartliteRun, won: boolean): DartliteRun {
  if (!run.battle) return run;
  const battle = run.battle;
  if (won) {
    const xp = xpForBattleWin(run.round);
    let miniBosses = run.stats.miniBossesDefeated;
    let bosses = run.stats.bossesDefeated;
    let unlocked: import('./trinkets').TrinketId | null = null;
    if (isMiniBossRound(run.round)) {
      miniBosses += 1;
      unlocked = newlyUnlockedTrinket(miniBosses, bosses);
    }
    if (isBossRound(run.round)) {
      bosses += 1;
      unlocked = newlyUnlockedTrinket(miniBosses, bosses);
    }
    const newPool = availablePool(miniBosses, bosses);

    // Boss round: full heal to max HP.
    if (isBossRound(run.round)) {
      const runPlayers = run.runPlayers.map(rp => ({ ...rp, hp: rp.maxHp }));
      const bossName = battle.enemies.length > 0 ? battle.enemies[0].name : `Boss`;
      const trinketOptions = bossTrinketOptions(bosses);
      const stats: DartliteRunStats = {
        ...run.stats,
        roundsCleared: run.stats.roundsCleared + 1,
        enemiesDefeated: run.stats.enemiesDefeated + battle.stats.enemiesDefeated,
        miniBossesDefeated: miniBosses,
        bossesDefeated: bosses,
        damageDealt: run.stats.damageDealt + battle.stats.damageDealt,
        xpGained: run.stats.xpGained + xp,
      };
      const log = [...run.log, `Boss defeated on Round ${run.round} — ${bossName} falls! Party healed to full.`];
      const playerStats = run.playerStats.map(ps => {
        const bp = battle.players.find(p => p.id === ps.playerId);
        if (!bp) return ps;
        return { ...ps, kills: ps.kills + (bp.kills ?? 0), damageDealt: ps.damageDealt + (bp.damageDealt ?? 0) };
      });
      return { ...run, runPlayers, pool: newPool, stats, playerStats, phase: 'boss_victory', battle: null, pendingChoice: null, choicePlayerIdx: 0, playerChoices: run.playerIds.map(() => null), lastUnlockedTrinket: unlocked, bossVictory: { bossName, trinketOptions, chosenTrinket: null, claimedTrinket: null }, log };
    }

    // Non-boss rounds: NO default healing. Players keep whatever HP they
    // ended the battle with. Healing only comes from card effects or
    // choosing the heal reward boon.
    const runPlayers = run.runPlayers.map(rp => ({ ...rp }));

    const stats: DartliteRunStats = {
      ...run.stats,
      roundsCleared: run.stats.roundsCleared + 1,
      enemiesDefeated: run.stats.enemiesDefeated + battle.stats.enemiesDefeated,
      miniBossesDefeated: miniBosses,
      bossesDefeated: bosses,
      damageDealt: run.stats.damageDealt + battle.stats.damageDealt,
      xpGained: run.stats.xpGained + xp,
    };
    const log = [...run.log, `Round ${run.round} cleared — +${xp} XP`];
    const playerStats = run.playerStats.map(ps => {
      const bp = battle.players.find(p => p.id === ps.playerId);
      if (!bp) return ps;
      return { ...ps, kills: ps.kills + (bp.kills ?? 0), damageDealt: ps.damageDealt + (bp.damageDealt ?? 0) };
    });
    return { ...run, runPlayers, pool: newPool, stats, playerStats, phase: 'choice', battle: null, pendingChoice: generateChoices({ ...run, runPlayers, pool: newPool, stats, playerStats }), choicePlayerIdx: 0, playerChoices: run.playerIds.map(() => null), lastUnlockedTrinket: unlocked, bossVictory: null, log };
  }
  // Defeat: still accumulate per-player kills/damage from the battle so the
  // game-over screen shows correct totals.
  const playerStats = run.playerStats.map(ps => {
    const bp = battle.players.find(p => p.id === ps.playerId);
    if (!bp) return ps;
    return { ...ps, kills: ps.kills + (bp.kills ?? 0), damageDealt: ps.damageDealt + (bp.damageDealt ?? 0) };
  });
  return { ...run, playerStats, phase: 'gameover', battle: null, pendingChoice: null, bossVictory: null };
}
