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
import { defaultPlayerCards } from '../cards/deck';

import type { DartliteRun, DartliteRunPlayer, DartliteRunStats } from './engineTypes';
export type { DartliteRun, DartliteRunPlayer, DartliteRunStats, DartlitePlayerRunStats, ChoiceOption, ChoiceKind } from './engineTypes';
export { isMiniBossRound, isBossRound, xpForKill, xpForBattleWin } from './engineTypes';
export { enemyHpScale, enemyAccScale, enemyPrecScale, scaledEnemyDb, levelForRound, rewardScale } from './roundLogic';
export { generateChoices, applyPlayerChoice, applyChoice } from './choices';
export {
  hasTrinket, partyPowerBonus, partyArmorBonus, partyMaxHpBonus,
  enemyAccuracyMultiplier, chargeGainMultiplier, xpMultiplier,
  shouldPhoenixRevive, applyPhoenixRevive, applyBossTrinketChoice,
  playerPowerInfo, effectiveTeamMaxHp,
} from './trinketEffects';

import { isMiniBossRound, isBossRound, xpForBattleWin, xpForKill } from './engineTypes';
import { scaledEnemyDb, levelForRound, rewardScale } from './roundLogic';
import { ENEMY_DATABASE } from '../campaign/enemyDatabase';
import { generateChoices } from './choices';
import { xpMultiplier, shouldPhoenixRevive, applyPhoenixRevive } from './trinketEffects';
import { computePartyPassiveBonus } from '../campaign/engine/classes';

// ── Run initialization ────────────────────────────────────────────────

export function startRun(players: Player[], settings: Settings, cardMode: boolean = false): DartliteRun {
  const passiveBonus = computePartyPassiveBonus(players);
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
      baseHp: Math.max(1, h),
      power: Math.max(0, pw),
      armor: Math.max(0, a),
      crit: Math.max(0, cr),
      trinkets: [],
      bonusHealth: 0,
      bonusArmor: 0,
      bonusPower: 0,
      cards: cardMode ? defaultPlayerCards(p.coopProgress?.classId) : [],
    };
  });
  // Team HP = sum of each player's base HP + party passive HP bonus.
  const baseTeamHp = runPlayers.reduce((sum, rp) => sum + rp.baseHp, 0);
  const teamMaxHp = Math.max(1, baseTeamHp + passiveBonus.health);
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
    partyPassiveHealth: passiveBonus.health,
    teamHp: teamMaxHp,
    teamMaxHp,
  };
}

// ── Start a battle for the current round ───────────────────────────────

export function beginRound(run: DartliteRun, players: Player[], settings: Settings): DartliteRun {
  const round = run.round + 1;
  const playerCount = run.runPlayers.length;
  const level = levelForRound(round, playerCount);
  // Build pseudo-Player objects for startBattle. HP is no longer per-player —
  // the team HP pool is the single source of truth. We still pass each
  // player's base HP + bonuses into the pseudo-Player's health attribute so
  // startBattle's partyMaxHpFor computes the correct partyMaxHp, then we
  // override partyHp/partyMaxHp with the run's teamHp/teamMaxHp afterwards.
  const scale = rewardScale(round);
  let teamMaxHpBonus = 0;
  const pseudoPlayers: Player[] = run.runPlayers.map(rp => {
    let armor = rp.armor;
    let power = rp.power;
    let crit = rp.crit;
    let maxHp = rp.baseHp + rp.bonusHealth;
    for (const tid of rp.trinkets) {
      if (tid === 'trk_vitality') { const add = Math.round(60 * scale); maxHp += add; teamMaxHpBonus += add; }
      else if (tid === 'trk_giants_belt') { const add = Math.round(rp.baseHp * 0.5); maxHp += add; teamMaxHpBonus += add; }
      else if (tid === 'trk_sharp_tip') { power += Math.round(5 * scale); }
      else if (tid === 'trk_berserker' && run.teamHp < run.teamMaxHp * 0.3) { power += Math.round(15 * scale); }
      else if (tid === 'trk_thick_hide') { armor += Math.round(8 * scale); }
      else if (tid === 'trk_eagle_eye') { crit += Math.round(15 * scale); }
    }
    const orig = players.find(p => p.id === rp.id) || ({} as Player);
    const cid = orig.coopProgress?.classId;
    const boostedAttrs = { health: maxHp, armor, power, crit, pointsAvailable: 0 };
    const classAttributes = cid && orig.classAttributes
      ? { ...orig.classAttributes, [cid]: boostedAttrs }
      : undefined;
    return {
      ...orig,
      id: rp.id,
      name: rp.name,
      color: rp.color,
      attributes: boostedAttrs,
      classAttributes,
    } as Player;
  });
  const allTrinkets = run.runPlayers.flatMap(rp => rp.trinkets);
  const battle = startBattle(level, pseudoPlayers, settings, scaledEnemyDb(round, playerCount), 'dartlite', run.cardMode);
  battle.trinkets = allTrinkets;
  // Override the battle's party HP with the run's team HP pool. The battle
  // engine reads and writes partyHp; after the battle, resolveBattle copies
  // it back to run.teamHp. teamMaxHp grows with trinket/stat upgrades via
  // teamMaxHpBonus (already applied above) — the battle's partyMaxHp is
  // derived from the pseudo-Players' health, which includes those bonuses.
  const teamMaxHp = Math.max(1, run.teamMaxHp + teamMaxHpBonus);
  battle.partyMaxHp = teamMaxHp;
  battle.partyHp = Math.min(teamMaxHp, run.teamHp + teamMaxHpBonus);
  for (const rp of run.runPlayers) {
    if (rp.trinkets.includes('trk_overcharge')) {
      const idx = battle.players.findIndex(p => p.id === rp.id);
      if (idx >= 0) {
        battle.players[idx] = { ...battle.players[idx], powerUpCharge: Math.min(settings.powerUpScaling.chargeMax, 40) };
      }
    }
  }
  return { ...run, round, phase: 'battle', battle, teamMaxHp, lastUnlockedTrinket: null, bossVictory: null, choicePlayerIdx: 0, playerChoices: run.playerIds.map(() => null) };
}

// ── Resolve a battle outcome ──────────────────────────────────────────

export function resolveBattle(run: DartliteRun, won: boolean): DartliteRun {
  if (!run.battle) return run;
  const battle = run.battle;
  // The battle's partyHp IS the team HP. Copy it back to the run.
  const teamHpAfter = Math.max(0, battle.partyHp);
  if (won) {
    const soulMult = xpMultiplier(run);
    const killXp = Math.round(battle.enemies
      .filter(e => e.defeated)
      .reduce((sum, e) => sum + xpForKill(ENEMY_DATABASE[e.defId]?.difficulty ?? 'Easy'), 0) * soulMult);
    const xp = Math.round((xpForBattleWin(run.round) + killXp) * soulMult);
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

    // Boss round: full heal to max team HP.
    if (isBossRound(run.round)) {
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
      return { ...run, pool: newPool, stats, playerStats, phase: 'boss_victory', battle: null, pendingChoice: null, choicePlayerIdx: 0, playerChoices: run.playerIds.map(() => null), lastUnlockedTrinket: unlocked, bossVictory: { bossName, trinketOptions, chosenTrinket: null, claimedTrinket: null }, log, teamHp: run.teamMaxHp };
    }

    // Non-boss rounds: NO default healing. Team HP persists between rounds.
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
    return { ...run, pool: newPool, stats, playerStats, phase: 'choice', battle: null, pendingChoice: generateChoices({ ...run, pool: newPool, stats, playerStats, teamHp: teamHpAfter }), choicePlayerIdx: 0, playerChoices: run.playerIds.map(() => null), lastUnlockedTrinket: unlocked, bossVictory: null, log, teamHp: teamHpAfter };
  }
  if (shouldPhoenixRevive(run)) {
    const revived = applyPhoenixRevive(run);
    const log = [...run.log, `Phoenix Heart revived the party!`];
    return { ...revived, phase: 'choice', battle: null, pendingChoice: null, bossVictory: null, log };
  }
  return { ...run, phase: 'gameover', battle: null, pendingChoice: null, bossVictory: null };
}
