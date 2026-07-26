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
  playerPowerInfo, effectiveRunPlayerMaxHp,
} from './trinketEffects';

import { isMiniBossRound, isBossRound, xpForBattleWin, xpForKill } from './engineTypes';
import { scaledEnemyDb, levelForRound, rewardScale } from './roundLogic';
import { ENEMY_DATABASE } from '../campaign/enemyDatabase';
import { generateChoices } from './choices';
import { xpMultiplier, shouldPhoenixRevive, applyPhoenixRevive } from './trinketEffects';
import { computePartyPassiveBonus } from '../campaign/engine/classes';

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
      cards: cardMode ? defaultPlayerCards(p.coopProgress?.classId) : [],
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
    partyPassiveHealth: computePartyPassiveBonus(players).health,
  };
}

// ── Start a battle for the current round ───────────────────────────────

export function beginRound(run: DartliteRun, players: Player[], settings: Settings): DartliteRun {
  const round = run.round + 1;
  const playerCount = run.runPlayers.length;
  const level = levelForRound(round, playerCount);
  const passiveBonus = computePartyPassiveBonus(players);
  const playerCurrentHp: Record<string, number> = {};
  const pseudoPlayers: Player[] = run.runPlayers.map(rp => {
    const orig = players.find(p => p.id === rp.id) || ({} as Player);
    let hp = rp.hp + passiveBonus.health;
    let maxHp = rp.maxHp;
    let armor = rp.armor;
    let power = rp.power;
    let crit = rp.crit;
    const scale = rewardScale(round);
    for (const tid of rp.trinkets) {
      if (tid === 'trk_vitality') { const add = Math.round(60 * scale); hp += add; maxHp += add; }
      else if (tid === 'trk_giants_belt') { const add = Math.round(rp.maxHp * 0.5); hp += add; maxHp += add; }
      else if (tid === 'trk_sharp_tip') { power += Math.round(5 * scale); }
      else if (tid === 'trk_berserker' && rp.hp < rp.maxHp * 0.3) { power += Math.round(15 * scale); }
      else if (tid === 'trk_thick_hide') { armor += Math.round(8 * scale); }
      else if (tid === 'trk_eagle_eye') { crit += Math.round(15 * scale); }
    }
    playerCurrentHp[rp.id] = Math.max(1, Math.min(maxHp + passiveBonus.health, hp));
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
  battle.players = battle.players.map(bp => {
    const cur = playerCurrentHp[bp.id];
    return cur != null ? { ...bp, hp: cur } : bp;
  });
  const partyHpStart = battle.players.reduce((sum, bp) => sum + bp.hp, 0);
  battle.partyHp = Math.min(battle.partyMaxHp, partyHpStart);
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
    // choosing the heal reward boon. The battle tracks damage on a shared
    // partyHp pool, so deduct the lost amount proportionally from each
    // runPlayer's hp — otherwise damage taken during the fight is silently
    // discarded and players are effectively full-healed every round.
    const partyHpLost = Math.max(0, (battle.partyMaxHp ?? 0) - (battle.partyHp ?? 0));
    const totalMax = run.runPlayers.reduce((sum, rp) => sum + Math.max(1, rp.maxHp), 0);
    let runPlayers: typeof run.runPlayers;
    if (partyHpLost <= 0 || totalMax <= 0) {
      runPlayers = run.runPlayers.map(rp => ({ ...rp }));
    } else {
      let remaining = partyHpLost;
      runPlayers = run.runPlayers.map((rp, i) => {
        const share = i === run.runPlayers.length - 1
          ? remaining
          : Math.min(remaining, Math.round((Math.max(1, rp.maxHp) / totalMax) * partyHpLost));
        remaining -= share;
        return { ...rp, hp: Math.max(0, rp.hp - share) };
      });
    }

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
  if (shouldPhoenixRevive(run)) {
    const revived = applyPhoenixRevive(run);
    const log = [...run.log, `Phoenix Heart revived the party!`];
    return { ...revived, phase: 'choice', battle: null, pendingChoice: null, bossVictory: null, log };
  }
  return { ...run, phase: 'gameover', battle: null, pendingChoice: null, bossVictory: null };
}
