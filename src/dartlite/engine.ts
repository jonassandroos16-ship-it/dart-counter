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

import type { CampaignBattleState, CampaignLevel } from '../campaign/types';
import type { Player, Settings } from '../types';
import { ENEMY_DATABASE } from '../campaign/enemyDatabase';
import { startBattle } from '../campaign/engine/playerTurn';
import {
  STARTER_POOL, availablePool, newlyUnlockedTrinket,
  type TrinketId,
} from './trinkets';

// ── Round & boss schedule ──────────────────────────────────────────────

export function isMiniBossRound(round: number): boolean {
  return round > 0 && round % 5 === 0 && round % 10 !== 0;
}
export function isBossRound(round: number): boolean {
  return round > 0 && round % 10 === 0;
}

// ── Run state ─────────────────────────────────────────────────────────

export interface DartliteRunStats {
  roundsCleared: number;
  enemiesDefeated: number;
  miniBossesDefeated: number;
  bossesDefeated: number;
  damageDealt: number;
  xpGained: number;
  trinketsCollected: TrinketId[];
}

// Per-player run stats tracked across the whole run (kills, damage, rewards
// chosen, trinkets acquired). Used by the between-round progress popup.
export interface DartlitePlayerRunStats {
  playerId: string;
  kills: number;
  damageDealt: number;
  rewards: ChoiceOption[];     // every reward this player has chosen so far
  trinkets: TrinketId[];        // trinkets this player personally holds
}

export interface DartliteRun {
  round: number;              // current round (1-based; 0 = not started)
  playerIds: string[];
  // Per-player run-time attributes (start from the player's real attributes,
  // modified by boons/trinkets during the run). Reset every new game.
  runPlayers: DartliteRunPlayer[];
  trinkets: TrinketId[];      // trinkets the party has collected this run
  pool: TrinketId[];          // currently available trinket pool
  stats: DartliteRunStats;
  playerStats: DartlitePlayerRunStats[]; // per-player cumulative run stats
  phase: 'setup' | 'battle' | 'choice' | 'reward' | 'gameover';
  battle: CampaignBattleState | null;
  pendingChoice: ChoiceOption[] | null;
  // Index of the player currently picking their personal reward. Advances
  // one-by-one through the party during the 'choice' phase.
  choicePlayerIdx: number;
  // Each player's chosen reward for the current round. Length matches
  // playerIds; filled in as choicePlayerIdx advances. Reset per round.
  playerChoices: (ChoiceOption | null)[];
  lastUnlockedTrinket: TrinketId | null; // shown in a popup after boss/mini-boss
  log: string[];
}

export interface DartliteRunPlayer {
  id: string;
  name: string;
  color: string;
  hp: number;
  maxHp: number;
  power: number;
  armor: number;
  trinkets: TrinketId[];
  // run-only stat points spent (for display)
  bonusHealth: number;
  bonusArmor: number;
  bonusPower: number;
}

// ── Choices ───────────────────────────────────────────────────────────

export type ChoiceKind = 'heal' | 'stat' | 'trinket';

export interface ChoiceOption {
  kind: ChoiceKind;
  label: string;
  desc: string;
  icon: string;
  // For 'stat': which attribute and how much
  stat?: 'health' | 'armor' | 'power';
  amount?: number;
  // For 'trinket': the trinket id
  trinketId?: TrinketId;
}

// ── XP rewards ─────────────────────────────────────────────────────────

export function xpForKill(enemyDifficulty: string): number {
  if (enemyDifficulty === 'Boss') return 100;
  if (enemyDifficulty === 'Hard') return 40;
  return 20;
}

export function xpForBattleWin(round: number): number {
  if (isBossRound(round)) return 200;
  if (isMiniBossRound(round)) return 100;
  return 50;
}

// ── Run initialization ────────────────────────────────────────────────

export function startRun(players: Player[], settings: Settings): DartliteRun {
  const runPlayers: DartliteRunPlayer[] = players.map(p => {
    const cfg = settings.powerUpScaling;
    const startHealth = Number.isFinite(cfg.attributeStartHealth) ? cfg.attributeStartHealth : 400;
    const startArmor = Number.isFinite(cfg.attributeStartArmor) ? cfg.attributeStartArmor : 0;
    const startPower = Number.isFinite(cfg.attributeStartPower) ? cfg.attributeStartPower : 0;
    const h = Number.isFinite(p.attributes?.health) ? p.attributes!.health : startHealth;
    const a = Number.isFinite(p.attributes?.armor) ? p.attributes!.armor : startArmor;
    const pw = Number.isFinite(p.attributes?.power) ? p.attributes!.power : startPower;
    return {
      id: p.id,
      name: p.name,
      color: p.color,
      hp: Math.max(1, h),
      maxHp: Math.max(1, h),
      power: Math.max(0, pw),
      armor: Math.max(0, a),
      trinkets: [],
      bonusHealth: 0,
      bonusArmor: 0,
      bonusPower: 0,
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
    log: [],
  };
}

// ── Enemy selection per round ─────────────────────────────────────────

const EASY_IDS = ['goblin_scout', 'goblin_brute', 'orc_raider', 'dark_mage', 'royal_guard', 'ice_wolf'];
const HARD_IDS = ['frost_archer', 'frost_knight', 'vine_lasher', 'spore_bloom', 'thorn_spearman', 'bloom_warden'];
const MINIBOSS_IDS = ['warlord_malakar', 'frost_knight', 'bloom_warden'];
const BOSS_IDS = ['warlord_malakar', 'ice_queen', 'the_verdant_maw'];

function pick<T>(arr: T[], rng: () => number = Math.random): T {
  return arr[Math.floor(rng() * arr.length)];
}

function pickN<T>(arr: T[], n: number, rng: () => number = Math.random): T[] {
  const copy = [...arr];
  const out: T[] = [];
  for (let i = 0; i < n && copy.length; i++) {
    const idx = Math.floor(rng() * copy.length);
    out.push(copy.splice(idx, 1)[0]);
  }
  return out;
}

// Build a CampaignLevel-shaped object for a given round number.
export function levelForRound(round: number): CampaignLevel {
  if (isBossRound(round)) {
    return {
      level_id: round,
      name: `Boss — Round ${round}`,
      is_boss: true,
      enemies: [pick(BOSS_IDS)],
    };
  }
  if (isMiniBossRound(round)) {
    return {
      level_id: round,
      name: `Mini-Boss — Round ${round}`,
      is_boss: false,
      enemies: [pick(MINIBOSS_IDS)],
    };
  }
  // Normal rounds: 1-3 enemies scaling with round depth.
  const count = Math.min(3, 1 + Math.floor(round / 3));
  const pool = round <= 4 ? EASY_IDS : round <= 9 ? [...EASY_IDS, ...HARD_IDS] : HARD_IDS;
  return {
    level_id: round,
    name: `Round ${round}`,
    is_boss: false,
    enemies: pickN(pool, count),
  };
}

// ── Start a battle for the current round ───────────────────────────────

export function beginRound(run: DartliteRun, players: Player[], settings: Settings): DartliteRun {
  const round = run.round + 1;
  const level = levelForRound(round);
  // Build pseudo-Player objects from run state so startBattle reads the
  // run-modified attributes (not the saved ones).
  const pseudoPlayers: Player[] = run.runPlayers.map(rp => {
    const orig = players.find(p => p.id === rp.id) || ({} as Player);
    return {
      ...orig,
      id: rp.id,
      name: rp.name,
      color: rp.color,
      attributes: {
        health: rp.maxHp,
        armor: rp.armor,
        power: rp.power,
        pointsAvailable: 0,
      },
    } as Player;
  });
  const battle = startBattle(level, pseudoPlayers, settings, ENEMY_DATABASE, 'dartlite');
  // Apply overcharge trinket: start with bonus charge.
  for (const rp of run.runPlayers) {
    if (rp.trinkets.includes('trk_overcharge')) {
      const idx = battle.players.findIndex(p => p.id === rp.id);
      if (idx >= 0) {
        battle.players[idx] = { ...battle.players[idx], powerUpCharge: Math.min(settings.powerUpScaling.chargeMax, 40) };
      }
    }
  }
  return { ...run, round, phase: 'battle', battle, lastUnlockedTrinket: null, choicePlayerIdx: 0, playerChoices: run.playerIds.map(() => null) };
}

// ── Resolve a battle outcome ──────────────────────────────────────────

export function resolveBattle(run: DartliteRun, won: boolean): DartliteRun {
  if (!run.battle) return run;
  const battle = run.battle;
  if (won) {
    const xp = xpForBattleWin(run.round);
    let miniBosses = run.stats.miniBossesDefeated;
    let bosses = run.stats.bossesDefeated;
    let unlocked: TrinketId | null = null;
    if (isMiniBossRound(run.round)) {
      miniBosses += 1;
      unlocked = newlyUnlockedTrinket(miniBosses, bosses);
    }
    if (isBossRound(run.round)) {
      bosses += 1;
      unlocked = newlyUnlockedTrinket(miniBosses, bosses);
    }
    const newPool = availablePool(miniBosses, bosses);
    // Carry HP forward from the battle (party shares one HP pool).
    const partyHpAfter = Math.max(0, battle.partyHp);
    const runPlayers = run.runPlayers.map(rp => ({
      ...rp,
      hp: partyHpAfter > 0 ? Math.max(1, Math.round(partyHpAfter)) : rp.hp,
    }));
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
    // Accumulate per-player kills/damage from this battle into run stats.
    const playerStats = run.playerStats.map(ps => {
      const bp = battle.players.find(p => p.id === ps.playerId);
      if (!bp) return ps;
      return {
        ...ps,
        kills: ps.kills + (bp.kills ?? 0),
        damageDealt: ps.damageDealt + (bp.damageDealt ?? 0),
      };
    });
    return {
      ...run,
      runPlayers,
      pool: newPool,
      stats,
      playerStats,
      phase: 'choice',
      battle: null,
      pendingChoice: generateChoices(run),
      choicePlayerIdx: 0,
      playerChoices: run.playerIds.map(() => null),
      lastUnlockedTrinket: unlocked,
      log,
    };
  }
  // Lost — run over.
  return {
    ...run,
    phase: 'gameover',
    battle: null,
    pendingChoice: null,
  };
}

// ── Boon choices ──────────────────────────────────────────────────────

export function generateChoices(run: DartliteRun): ChoiceOption[] {
  const pool = run.pool.length ? run.pool : STARTER_POOL;
  const options: ChoiceOption[] = [
    {
      kind: 'heal',
      label: 'Heal 20%',
      desc: 'Restore 20% of the party\'s max HP.',
      icon: '❤️‍🩹',
    },
    {
      kind: 'stat',
      label: 'Gain a Stat',
      desc: '+20 HP, +3% armor, or +4 power (random).',
      icon: '📊',
    },
    {
      kind: 'trinket',
      label: 'Random Trinket',
      desc: 'Draw a random trinket from the available pool.',
      icon: '🔮',
    },
  ];
  // If the trinket pool is empty, replace it with an extra heal.
  if (!pool.length) {
    options[2] = { kind: 'heal', label: 'Heal 20%', desc: 'Restore 20% of max HP.', icon: '❤️‍🩹' };
  }
  return options;
}

// Apply a single player's personal reward choice. Only that player receives
// the benefit. When every player has chosen, the run moves to the 'reward'
// phase so the UI can show the progress popup before the next round starts.
export function applyPlayerChoice(run: DartliteRun, option: ChoiceOption): DartliteRun {
  const idx = run.choicePlayerIdx;
  let runPlayers = run.runPlayers;
  let trinkets = run.trinkets;
  let stats = run.stats;
  const playerStats = run.playerStats.map(ps =>
    ps.playerId === run.playerIds[idx]
      ? { ...ps, rewards: [...ps.rewards, option] }
      : ps
  );

  if (option.kind === 'heal') {
    const rp = runPlayers[idx];
    const healAmt = Math.round(rp.maxHp * 0.2);
    runPlayers = runPlayers.map((p, i) => i === idx ? { ...p, hp: Math.min(p.maxHp, p.hp + healAmt) } : p);
  } else if (option.kind === 'stat') {
    const rp = runPlayers[idx];
    const statRoll = Math.random();
    if (statRoll < 0.4) {
      runPlayers = runPlayers.map((p, i) => i === idx ? { ...p, maxHp: p.maxHp + 20, hp: p.hp + 20, bonusHealth: p.bonusHealth + 20 } : p);
    } else if (statRoll < 0.7) {
      runPlayers = runPlayers.map((p, i) => i === idx ? { ...p, armor: p.armor + 3, bonusArmor: p.bonusArmor + 3 } : p);
    } else {
      runPlayers = runPlayers.map((p, i) => i === idx ? { ...p, power: p.power + 4, bonusPower: p.bonusPower + 4 } : p);
    }
  } else if (option.kind === 'trinket') {
    const pool = run.pool.length ? run.pool : STARTER_POOL;
    const id = pick(pool) as TrinketId;
    runPlayers = runPlayers.map((p, i) => i === idx ? { ...p, trinkets: [...p.trinkets, id] } : p);
    trinkets = [...trinkets, id];
    stats = { ...stats, trinketsCollected: [...stats.trinketsCollected, id] };
    const psIdx = playerStats.findIndex(ps => ps.playerId === run.playerIds[idx]);
    if (psIdx >= 0) playerStats[psIdx] = { ...playerStats[psIdx], trinkets: [...playerStats[psIdx].trinkets, id] };
  }

  const playerChoices = run.playerChoices.map((c, i) => i === idx ? option : c);
  const nextIdx = idx + 1;
  const allChosen = nextIdx >= run.playerIds.length;

  return {
    ...run,
    runPlayers,
    trinkets,
    stats,
    playerStats,
    playerChoices,
    choicePlayerIdx: allChosen ? idx : nextIdx,
    pendingChoice: allChosen ? null : run.pendingChoice,
    lastUnlockedTrinket: run.lastUnlockedTrinket,
    phase: allChosen ? 'reward' : 'choice',
  };
}

// Legacy single-choice API kept for backwards compat / tests. Applies one
// choice to the whole party and moves to 'setup' (next round ready).
export function applyChoice(run: DartliteRun, option: ChoiceOption): DartliteRun {
  let runPlayers = run.runPlayers;
  let trinkets = run.trinkets;
  let stats = run.stats;
  let lastUnlocked = run.lastUnlockedTrinket;

  if (option.kind === 'heal') {
    const totalMax = runPlayers.reduce((a, p) => a + p.maxHp, 0);
    const healTotal = Math.round(totalMax * 0.2);
    let remaining = healTotal;
    runPlayers = runPlayers.map(p => {
      const share = Math.round((p.maxHp / totalMax) * healTotal);
      const healed = Math.min(p.maxHp, p.hp + share);
      remaining -= healed - p.hp;
      return { ...p, hp: healed };
    });
  } else if (option.kind === 'stat') {
    const statRoll = Math.random();
    if (statRoll < 0.4) {
      runPlayers = runPlayers.map(p => ({ ...p, maxHp: p.maxHp + 20, hp: p.hp + 20, bonusHealth: p.bonusHealth + 20 }));
    } else if (statRoll < 0.7) {
      runPlayers = runPlayers.map(p => ({ ...p, armor: p.armor + 3, bonusArmor: p.bonusArmor + 3 }));
    } else {
      runPlayers = runPlayers.map(p => ({ ...p, power: p.power + 4, bonusPower: p.bonusPower + 4 }));
    }
  } else if (option.kind === 'trinket') {
    const pool = run.pool.length ? run.pool : STARTER_POOL;
    const id = pick(pool) as TrinketId;
    const idx = Math.floor(Math.random() * runPlayers.length);
    runPlayers = runPlayers.map((p, i) => i === idx ? { ...p, trinkets: [...p.trinkets, id] } : p);
    trinkets = [...trinkets, id];
    stats = { ...stats, trinketsCollected: [...stats.trinketsCollected, id] };
  }

  return {
    ...run,
    runPlayers,
    trinkets,
    stats,
    pendingChoice: null,
    lastUnlockedTrinket: lastUnlocked,
    phase: 'setup',
  };
}

// ── Trinket effect helpers (used by the battle view) ───────────────────

export function hasTrinket(run: DartliteRun, id: TrinketId): boolean {
  return run.runPlayers.some(p => p.trinkets.includes(id));
}

export function partyPowerBonus(run: DartliteRun): number {
  let bonus = 0;
  for (const p of run.runPlayers) {
    if (p.trinkets.includes('trk_sharp_tip')) bonus += 5;
    if (p.trinkets.includes('trk_berserker') && p.hp < p.maxHp * 0.3) bonus += 15;
  }
  return bonus;
}

export function partyArmorBonus(run: DartliteRun): number {
  let bonus = 0;
  for (const p of run.runPlayers) {
    if (p.trinkets.includes('trk_thick_hide')) bonus += 8;
  }
  return bonus;
}

export function partyMaxHpBonus(run: DartliteRun): number {
  let bonus = 0;
  for (const p of run.runPlayers) {
    if (p.trinkets.includes('trk_vitality')) bonus += 60;
    if (p.trinkets.includes('trk_giants_belt')) bonus += Math.round(p.maxHp * 0.5);
  }
  return bonus;
}

export function enemyAccuracyMultiplier(run: DartliteRun): number {
  let mult = 1;
  for (const p of run.runPlayers) {
    if (p.trinkets.includes('trk_quick_reflex')) mult -= 0.1;
  }
  return Math.max(0, mult);
}

export function chargeGainMultiplier(run: DartliteRun): number {
  let mult = 1;
  for (const p of run.runPlayers) {
    if (p.trinkets.includes('trk_lucky_penny')) mult += 0.3;
  }
  return mult;
}

export function xpMultiplier(run: DartliteRun): number {
  let mult = 1;
  for (const p of run.runPlayers) {
    if (p.trinkets.includes('trk_soul_harvest')) mult += 0.5;
  }
  return mult;
}

// Returns true if the phoenix heart revive should trigger (once per run).
export function shouldPhoenixRevive(run: DartliteRun): boolean {
  return hasTrinket(run, 'trk_phoenix_heart') && !run.stats.trinketsCollected.includes('trk_phoenix_heart_used' as TrinketId);
}

export function applyPhoenixRevive(run: DartliteRun): DartliteRun {
  const totalMax = run.runPlayers.reduce((a, p) => a + p.maxHp, 0);
  const reviveHp = Math.round(totalMax * 0.25);
  return {
    ...run,
    runPlayers: run.runPlayers.map(p => ({ ...p, hp: Math.max(p.hp, Math.round(reviveHp / run.runPlayers.length)) })),
    stats: { ...run.stats, trinketsCollected: [...run.stats.trinketsCollected, 'trk_phoenix_heart_used' as TrinketId] },
  };
}
