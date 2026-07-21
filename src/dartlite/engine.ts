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
  bossTrinketOptions, getTrinket as getTrinketDef,
  type TrinketId,
} from './trinkets';
import type { EnemyDef } from '../campaign/types';
import type { PlayerCard } from '../cards/types';
import { defaultPlayerCards } from '../cards/deck';
import {
  generateCardRewardOptions, applyCardReward, type CardRewardChoice,
} from './cardRewards';

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
  phase: 'setup' | 'battle' | 'choice' | 'reward' | 'boss_victory' | 'gameover';
  cardMode: boolean;          // true = card-based rewards instead of trinket boons
  battle: CampaignBattleState | null;
  pendingChoice: ChoiceOption[] | null;
  // Index of the player currently picking their personal reward. Advances
  // one-by-one through the party during the 'choice' phase.
  choicePlayerIdx: number;
  // Each player's chosen reward for the current round. Length matches
  // playerIds; filled in as choicePlayerIdx advances. Reset per round.
  playerChoices: (ChoiceOption | null)[];
  lastUnlockedTrinket: TrinketId | null; // shown in a popup after boss/mini-boss
  // Boss victory data — set when a boss is defeated, used to show the boss
  // victory screen with boss name + trinket choices.
  bossVictory: { bossName: string; trinketOptions: TrinketId[]; chosenTrinket: TrinketId | null; claimedTrinket: TrinketId | null } | null;
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
  // Card mode: this player's collected card deck
  cards: PlayerCard[];
}

// ── Choices ───────────────────────────────────────────────────────────

export type ChoiceKind = 'heal' | 'stat' | 'trinket' | 'card_new' | 'card_upgrade';

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
  // For 'card_new' / 'card_upgrade': the card id and name
  cardId?: string;
  cardName?: string;
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

export function startRun(players: Player[], settings: Settings, cardMode: boolean = false): DartliteRun {
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
      cards: cardMode ? defaultPlayerCards() : [],
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

// Round scaling: enemies get harder as rounds progress. HP and accuracy/precision
// scale linearly so a normal party can reach at least round 11 (the second boss
// at round 10 must be beatable with accumulated trinkets/stats).
export function enemyHpScale(round: number): number {
  // +8% HP per round past round 1. Capped at +200% so late rounds don't become
  // unkillable.
  return Math.min(3.0, 1 + Math.max(0, round - 1) * 0.08);
}
export function enemyAccScale(round: number): number {
  // +1.5% accuracy per round past round 1, capped at +40%.
  return Math.min(1.4, 1 + Math.max(0, round - 1) * 0.015);
}
export function enemyPrecScale(round: number): number {
  // +1.5% precision per round past round 1, capped at +40%.
  return Math.min(1.4, 1 + Math.max(0, round - 1) * 0.015);
}

// Build a scaled enemy database for a given round. Returns a modified copy of
// ENEMY_DATABASE with HP/accuracy/precision scaled by round count.
export function scaledEnemyDb(round: number): typeof ENEMY_DATABASE {
  const hpMult = enemyHpScale(round);
  const accMult = enemyAccScale(round);
  const precMult = enemyPrecScale(round);
  const db: typeof ENEMY_DATABASE = {};
  for (const [id, def] of Object.entries(ENEMY_DATABASE)) {
    db[id] = {
      ...def,
      max_hp: Math.round(def.max_hp * hpMult),
      accuracy: Math.min(0.95, def.accuracy * accMult),
      precision: Math.min(0.95, def.precision * precMult),
    } as EnemyDef;
  }
  return db;
}

// Build a CampaignLevel-shaped object for a given round number.
export function levelForRound(round: number): CampaignLevel {
  if (isBossRound(round)) {
    // Bosses: pick from harder bosses as rounds progress.
    const bossPool = round <= 10 ? ['warlord_malakar'] : round <= 20 ? ['ice_queen', 'warlord_malakar'] : BOSS_IDS;
    return {
      level_id: round,
      name: `Boss — Round ${round}`,
      is_boss: true,
      enemies: [pick(bossPool)],
    };
  }
  if (isMiniBossRound(round)) {
    // Mini-bosses: use harder mini-bosses as rounds progress.
    const miniPool = round <= 5 ? ['warlord_malakar'] : round <= 15 ? MINIBOSS_IDS : ['frost_knight', 'bloom_warden'];
    return {
      level_id: round,
      name: `Mini-Boss — Round ${round}`,
      is_boss: false,
      enemies: [pick(miniPool)],
    };
  }
  // Normal rounds: 1-3 enemies scaling with round depth. Use harder enemies
  // as rounds progress so early rounds are easy and later rounds are tough.
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
  const battle = startBattle(level, pseudoPlayers, settings, scaledEnemyDb(round), 'dartlite');
  // Apply overcharge trinket: start with bonus charge.
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
    let runPlayers = run.runPlayers.map(rp => ({
      ...rp,
      hp: partyHpAfter > 0 ? Math.max(1, Math.round(partyHpAfter)) : rp.hp,
    }));
    // After a boss victory: heal party to 100% and enter boss_victory phase
    // so the UI can show the boss victory screen with trinket choices.
    if (isBossRound(run.round)) {
      runPlayers = runPlayers.map(rp => ({ ...rp, hp: rp.maxHp }));
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
        phase: 'boss_victory',
        battle: null,
        pendingChoice: null,
        choicePlayerIdx: 0,
        playerChoices: run.playerIds.map(() => null),
        lastUnlockedTrinket: unlocked,
        bossVictory: { bossName, trinketOptions, chosenTrinket: null, claimedTrinket: null },
        log,
      };
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
      bossVictory: null,
      log,
    };
  }
  // Lost — run over.
  return {
    ...run,
    phase: 'gameover',
    battle: null,
    pendingChoice: null,
    bossVictory: null,
  };
}

// ── Boon choices ──────────────────────────────────────────────────────

export function generateChoices(run: DartliteRun): ChoiceOption[] {
  // Card mode: offer card-based rewards (new cards + upgrades) instead of
  // the standard heal/stat/trinket boons.
  if (run.cardMode) {
    return generateCardChoices(run);
  }
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

// Generate card-based reward options for card mode. Offers up to 2 new card
// rewards and 1 card upgrade, falling back to heal if the pool/upgradeable
// cards are exhausted.
function generateCardChoices(run: DartliteRun): ChoiceOption[] {
  const idx = run.choicePlayerIdx;
  const rp = run.runPlayers[idx];
  const ownedCards = rp?.cards ?? [];
  const cardOpts = generateCardRewardOptions(ownedCards, 'coop');
  return cardOpts.map(o => ({
    kind: o.kind,
    label: o.label,
    desc: o.desc,
    icon: o.icon,
    cardId: o.cardId,
    cardName: o.cardName,
  }));
}

// Apply one player's reward choice. That player receives the benefit. The
// run stays in 'choice' and advances choicePlayerIdx so the next player
// can pick; only after the last player picks does it move to 'reward' so
// the UI can show the reveal and progress popup before the next round.
export function applyPlayerChoice(run: DartliteRun, option: ChoiceOption): DartliteRun {
  const idx = run.choicePlayerIdx;
  let runPlayers = run.runPlayers;
  let trinkets = run.trinkets;
  let stats = run.stats;
  // Resolved copy of the option with the specific reward details filled in so
  // the reveal popup can show exactly what this player received.
  let resolved: ChoiceOption = option;

  if (option.kind === 'heal') {
    const rp = runPlayers[idx];
    const healAmt = Math.round(rp.maxHp * 0.2);
    runPlayers = runPlayers.map((p, i) => i === idx ? { ...p, hp: Math.min(p.maxHp, p.hp + healAmt) } : p);
    resolved = { ...option, amount: healAmt, label: `Heal ${healAmt} HP`, desc: `Restored ${healAmt} HP (${rp.name}).` };
  } else if (option.kind === 'card_new' || option.kind === 'card_upgrade') {
    const rp = runPlayers[idx];
    const ownedCards = rp.cards;
    const cardChoice: CardRewardChoice = {
      kind: option.kind,
      label: option.label,
      desc: option.desc,
      icon: option.icon,
      cardId: option.cardId,
      cardName: option.cardName,
    };
    const updatedCards = applyCardReward(ownedCards, cardChoice);
    runPlayers = runPlayers.map((p, i) => i === idx ? { ...p, cards: updatedCards } : p);
    const cardLabel = option.kind === 'card_new' ? `New Card: ${option.cardName ?? '??'}` : `Upgraded: ${option.cardName ?? '??'}`;
    resolved = { ...option, label: cardLabel, desc: option.desc };
  } else if (option.kind === 'stat') {
    const statRoll = Math.random();
    let statName: 'health' | 'armor' | 'power';
    let amount: number;
    if (statRoll < 0.4) {
      statName = 'health'; amount = 20;
      runPlayers = runPlayers.map((p, i) => i === idx ? { ...p, maxHp: p.maxHp + 20, hp: p.hp + 20, bonusHealth: p.bonusHealth + 20 } : p);
    } else if (statRoll < 0.7) {
      statName = 'armor'; amount = 3;
      runPlayers = runPlayers.map((p, i) => i === idx ? { ...p, armor: p.armor + 3, bonusArmor: p.bonusArmor + 3 } : p);
    } else {
      statName = 'power'; amount = 4;
      runPlayers = runPlayers.map((p, i) => i === idx ? { ...p, power: p.power + 4, bonusPower: p.bonusPower + 4 } : p);
    }
    const statLabel = statName === 'health' ? `+${amount} Max HP` : statName === 'armor' ? `+${amount}% Armor` : `+${amount} Power`;
    resolved = { ...option, stat: statName, amount, label: statLabel, desc: `Gained ${statLabel}.` };
  } else if (option.kind === 'trinket') {
    const pool = run.pool.length ? run.pool : STARTER_POOL;
    const id = pick(pool) as TrinketId;
    runPlayers = runPlayers.map((p, i) => i === idx ? { ...p, trinkets: [...p.trinkets, id] } : p);
    trinkets = [...trinkets, id];
    stats = { ...stats, trinketsCollected: [...stats.trinketsCollected, id] };
    resolved = { ...option, trinketId: id };
  }

  const playerStats = run.playerStats.map(ps =>
    ps.playerId === run.playerIds[idx]
      ? { ...ps, rewards: [...ps.rewards, resolved], trinkets: resolved.trinketId ? [...ps.trinkets, resolved.trinketId] : ps.trinkets }
      : ps
  );

  const playerChoices = run.playerChoices.map((c, i) => i === idx ? resolved : c);

  const nextIdx = idx + 1;
  const allChosen = nextIdx >= run.playerIds.length;

  // While players still need to pick, stay in 'choice' and offer fresh
  // options to the next player. Only after the last player picks do we move
  // to 'reward' so the UI can show the reveal + progress popup.
  if (!allChosen) {
    return {
      ...run,
      runPlayers,
      trinkets,
      stats,
      playerStats,
      playerChoices,
      choicePlayerIdx: nextIdx,
      pendingChoice: generateChoices({ ...run, runPlayers, trinkets, stats, playerStats, playerChoices, choicePlayerIdx: nextIdx }),
      lastUnlockedTrinket: run.lastUnlockedTrinket,
      phase: 'choice',
    };
  }

  return {
    ...run,
    runPlayers,
    trinkets,
    stats,
    playerStats,
    playerChoices,
    choicePlayerIdx: idx,
    pendingChoice: null,
    lastUnlockedTrinket: run.lastUnlockedTrinket,
    phase: 'reward',
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

// ── Boss trinket selection ────────────────────────────────────────────
//
// After a boss victory, the UI shows a boss victory screen with 3-4 boss
// trinket options. The player picks one; it is applied to the party and the
// run proceeds to the next round.

export function applyBossTrinketChoice(run: DartliteRun, trinketId: TrinketId): DartliteRun {
  if (!run.bossVictory) return run;
  const def = getTrinketDef(trinketId);
  if (!def) return run;
  // Apply the boss trinket to the whole party.
  let runPlayers = run.runPlayers.map(rp => ({ ...rp, trinkets: [...rp.trinkets, trinketId] }));
  // Apply stat bonuses from boss trinkets.
  if (trinketId === 'trk_boss_warlords_crown') {
    runPlayers = runPlayers.map(rp => ({ ...rp, power: rp.power + 25, bonusPower: rp.bonusPower + 25 }));
  } else if (trinketId === 'trk_boss_ice_crystal') {
    runPlayers = runPlayers.map(rp => ({ ...rp, armor: rp.armor + 15, bonusArmor: rp.bonusArmor + 15 }));
  } else if (trinketId === 'trk_boss_verdant_seed') {
    runPlayers = runPlayers.map(rp => ({ ...rp, maxHp: rp.maxHp + 200, hp: rp.hp + 200, bonusHealth: rp.bonusHealth + 200 }));
  } else if (trinketId === 'trk_boss_dragon_heart') {
    runPlayers = runPlayers.map(rp => ({ ...rp, power: rp.power + 40, bonusPower: rp.bonusPower + 40 }));
  } else if (trinketId === 'trk_boss_frost_throne') {
    runPlayers = runPlayers.map(rp => ({ ...rp, armor: rp.armor + 25, bonusArmor: rp.bonusArmor + 25 }));
  } else if (trinketId === 'trk_boss_maw_jaw') {
    runPlayers = runPlayers.map(rp => ({ ...rp, maxHp: rp.maxHp + 400, hp: rp.hp + 400, bonusHealth: rp.bonusHealth + 400 }));
  } else if (trinketId === 'trk_boss_void_cloak') {
    runPlayers = runPlayers.map(rp => ({ ...rp, power: rp.power + 60, bonusPower: rp.bonusPower + 60 }));
  } else if (trinketId === 'trk_boss_eternal_flame') {
    runPlayers = runPlayers.map(rp => ({ ...rp, armor: rp.armor + 35, bonusArmor: rp.bonusArmor + 35 }));
  } else if (trinketId === 'trk_boss_titan_heart') {
    runPlayers = runPlayers.map(rp => ({ ...rp, maxHp: rp.maxHp + 600, hp: rp.hp + 600, bonusHealth: rp.bonusHealth + 600 }));
  } else if (trinketId === 'trk_boss_godhand') {
    runPlayers = runPlayers.map(rp => ({ ...rp, power: rp.power + 100, bonusPower: rp.bonusPower + 100 }));
  }
  const trinkets = [...run.trinkets, trinketId];
  const stats = { ...run.stats, trinketsCollected: [...run.stats.trinketsCollected, trinketId] };
  const playerStats = run.playerStats.map(ps => ({ ...ps, trinkets: [...ps.trinkets, trinketId] }));
  const log = [...run.log, `Boss trinket chosen: ${def.name}`];
  return {
    ...run,
    runPlayers,
    trinkets,
    stats,
    playerStats,
    bossVictory: { ...run.bossVictory, chosenTrinket: trinketId, claimedTrinket: trinketId },
    phase: 'reward',
    log,
  };
}
