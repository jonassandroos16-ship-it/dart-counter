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
import { effectiveAttributes } from '../logic';
import { ENEMY_DATABASE } from '../campaign/enemyDatabase';
import { startBattle } from '../campaign/engine/playerTurn';
import {
  STARTER_POOL, availablePool, newlyUnlockedTrinket,
  bossTrinketOptions, getTrinket as getTrinketDef,
  type TrinketId,
} from './trinkets';
import type { EnemyDef } from '../campaign/types';
import type { PlayerCard } from '../cards/types';
import { getPlayerCards } from '../cards/deck';
import { generateCardRewardOptions } from './cardRewards';

// ── Round & boss schedule ──────────────────────────────────────────────

export function isMiniBossRound(round: number): boolean {
  return round > 0 && round % 5 === 0 && round % 10 !== 0;
}
export function isBossRound(round: number): boolean {
  return round > 0 && round % 10 === 0;
}

// ── Run state ──────────────────────────────────────────────────────────

export interface RunPlayerState {
  id: string;
  hp: number;
  maxHp: number;
  power: number;
  armor: number;
  cards: PlayerCard[];
}

export interface RunPlayerStats {
  playerId: string;
  kills: number;
  damageDealt: number;
  rewards: ChoiceOption[];     // every reward this player has chosen so far
  trinkets: TrinketId[];        // trinkets this player personally holds
}

export interface DartliteRun {
  playerIds: string[];
  round: number;
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
  bossVictory: { bossName: string; trinketChoices: TrinketId[] } | null;
  pool: TrinketId[];          // remaining trinkets available to unlock
  trinkets: TrinketId[];       // trinkets the party holds
  runPlayers: RunPlayerState[];
  playerStats: RunPlayerStats[];
  stats: { roundsCleared: number; enemiesDefeated: number; totalDamage: number };
}

export type ChoiceKind = 'heal' | 'stat' | 'trinket' | 'card_new' | 'card_upgrade' | 'deck_upgrade';

export interface ChoiceOption {
  kind: ChoiceKind;
  label: string;
  desc: string;
  icon: string;
  cardId?: string;
  cardAction?: 'upgrade_card' | 'remove_card' | 'add_card';
}

// ── Run creation ───────────────────────────────────────────────────────

export function createRun(
  playerIds: string[],
  players: Player[],
  cardMode: boolean,
): DartliteRun {
  const runPlayers = playerIds.map(id => {
    const p = players.find(pl => pl.id === id);
    const cls = p?.coopProgress?.classId ?? 'warrior';
    const cards = cardMode ? getPlayerCards(p, cls) : [];
    const attrs = effectiveAttributes(p, cls);
    return {
      id,
      hp: attrs.hp,
      maxHp: attrs.hp,
      power: attrs.power,
      armor: attrs.armor,
      cards,
    };
  });

  const playerStats = playerIds.map(id => ({
    playerId: id,
    kills: 0,
    damageDealt: 0,
    rewards: [] as ChoiceOption[],
    trinkets: [] as TrinketId[],
  }));

  return {
    playerIds,
    round: 0,
    phase: 'setup',
    cardMode,
    battle: null,
    pendingChoice: null,
    choicePlayerIdx: 0,
    playerChoices: playerIds.map(() => null),
    lastUnlockedTrinket: null,
    bossVictory: null,
    pool: [...STARTER_POOL],
    trinkets: [],
    runPlayers,
    playerStats,
    stats: { roundsCleared: 0, enemiesDefeated: 0, totalDamage: 0 },
  };
}

// ── Battle setup ───────────────────────────────────────────────────────

const ENEMY_COUNT_BY_ROUND = [1, 1, 2, 2, 3, 1, 2, 2, 3, 3];

function pickEnemies(round: number): EnemyDef[] {
  const count = ENEMY_COUNT_BY_ROUND[(round - 1) % ENEMY_COUNT_BY_ROUND.length] ?? 1;
  const pool = ENEMY_DATABASE.filter(e => !e.isBoss && !e.isMiniBoss);
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, count);
  return selected;
}

function pickBoss(): EnemyDef {
  const bosses = ENEMY_DATABASE.filter(e => e.isBoss);
  return bosses[Math.floor(Math.random() * bosses.length)] ?? ENEMY_DATABASE[0];
}

function pickMiniBoss(): EnemyDef {
  const miniBosses = ENEMY_DATABASE.filter(e => e.isMiniBoss);
  return miniBosses[Math.floor(Math.random() * miniBosses.length)] ?? ENEMY_DATABASE[0];
}

export function startRound(run: DartliteRun, players: Player[], settings: Settings): DartliteRun {
  const enemies = isBossRound(run.round)
    ? [pickBoss()]
    : isMiniBossRound(run.round)
    ? [pickMiniBoss()]
    : pickEnemies(run.round);

  const level: CampaignLevel = {
    id: `dartlite-${run.round}`,
    name: `Round ${run.round}`,
    enemies,
    isBossRound: isBossRound(run.round),
    isMiniBossRound: isMiniBossRound(run.round),
  };

  const battleState = startBattle(
    run.runPlayers.map((rp, i) => {
      const p = players.find(pl => pl.id === rp.id)!;
      return {
        id: rp.id,
        name: p.name,
        color: p.color,
        hp: rp.hp,
        maxHp: rp.maxHp,
        power: rp.power,
        armor: rp.armor,
      };
    }),
    level,
    settings,
  );

  return { ...run, phase: 'battle', battle: battleState };
}

// ── Boon choices ──────────────────────────────────────────────────────

export function generateChoices(run: DartliteRun): ChoiceOption[] {
  if (run.cardMode) {
    return generateCardChoices(run);
  }
  const pool = run.pool.length ? run.pool : STARTER_POOL;
  const options: ChoiceOption[] = [
    { kind: 'heal', label: 'Heal 20%', desc: 'Restore 20% of the party\'s max HP.', icon: '❤️‍🩹' },
    { kind: 'stat', label: 'Gain a Stat', desc: '+20 HP, +3% armor, or +4 power (random).', icon: '📊' },
    { kind: 'trinket', label: 'Random Trinket', desc: 'Draw a random trinket from the available pool.', icon: '🔮' },
  ];
  if (!pool.length) {
    options[2] = { kind: 'heal', label: 'Heal 20%', desc: 'Restore 20% of max HP.', icon: '❤️‍🩹' };
  }
  return options;
}

function generateCardChoices(run: DartliteRun): ChoiceOption[] {
  const idx = run.choicePlayerIdx;
  const rp = run.runPlayers[idx];
  const ownedCards = rp?.cards ?? [];
  const cardOpts = generateCardRewardOptions(ownedCards, 'coop');
  const options: ChoiceOption[] = cardOpts.map(o => ({
    kind: o.kind === 'deck_upgrade' ? 'deck_upgrade' : o.kind === 'heal' ? 'heal' : o.kind === 'stat' ? 'stat' : 'card_new',
    label: o.label,
    desc: o.desc,
    icon: o.icon,
  }));
  const pool = run.pool.length ? run.pool : STARTER_POOL;
  if (pool.length) {
    options.push({ kind: 'trinket', label: 'Random Trinket', desc: 'Draw a random trinket from the available pool.', icon: '🔮' });
  } else {
    options.push({ kind: 'heal', label: 'Heal 20%', desc: 'Restore 20% of max HP.', icon: '❤️‍🩹' });
  }
  return options;
}

// applyPlayerChoice applies one player's choice to the run. After applying,
// run stays in 'choice' and advances choicePlayerIdx so the next player
// can pick; only after the last player picks does it move to 'reward' so
// the UI can show the reveal and progress popup before the next round.
export function applyPlayerChoice(run: DartliteRun, option: ChoiceOption): DartliteRun {
  const idx = run.choicePlayerIdx;
  let runPlayers = run.runPlayers;
  let trinkets = run.trinkets;
  let stats = run.stats;
  let resolved: ChoiceOption = option;

  if (option.kind === 'heal') {
    const rp = runPlayers[idx];
    const healAmount = Math.ceil(rp.maxHp * 0.2);
    runPlayers = runPlayers.map((p, i) =>
      i === idx ? { ...p, hp: Math.min(p.maxHp, p.hp + healAmount) } : p
    );
  } else if (option.kind === 'stat') {
    const rp = runPlayers[idx];
    const roll = Math.random();
    if (roll < 0.34) {
      runPlayers = runPlayers.map((p, i) =>
        i === idx ? { ...p, maxHp: p.maxHp + 20, hp: p.hp + 20 } : p
      );
      resolved = { ...option, desc: '+20 Max HP' };
    } else if (roll < 0.67) {
      runPlayers = runPlayers.map((p, i) =>
        i === idx ? { ...p, armor: p.armor + 3 } : p
      );
      resolved = { ...option, desc: '+3% Armor' };
    } else {
      runPlayers = runPlayers.map((p, i) =>
        i === idx ? { ...p, power: p.power + 4 } : p
      );
      resolved = { ...option, desc: '+4 Power' };
    }
  } else if (option.kind === 'trinket') {
    const pool = run.pool.length ? run.pool : STARTER_POOL;
    const id = pool[Math.floor(Math.random() * pool.length)];
    trinkets = [...trinkets, id];
    const newPool = run.pool.filter(t => t !== id);
    const playerStats = run.playerStats.map((ps, i) =>
      i === idx ? { ...ps, trinkets: [...ps.trinkets, id] } : ps
    );
    return {
      ...run,
      trinkets,
      pool: newPool,
      playerStats,
      playerChoices: [...run.playerChoices.slice(0, idx), resolved, ...run.playerChoices.slice(idx + 1)],
      choicePlayerIdx: idx + 1,
    };
  }

  const playerStats = run.playerStats.map((ps, i) =>
    i === idx ? { ...ps, rewards: [...ps.rewards, resolved] } : ps
  );

  return {
    ...run,
    runPlayers,
    stats,
    playerStats,
    playerChoices: [...run.playerChoices.slice(0, idx), resolved, ...run.playerChoices.slice(idx + 1)],
    choicePlayerIdx: idx + 1,
  };
}

// Legacy single-choice API kept for backwards compat / tests. Applies one
// choice to the whole party and moves to 'setup' (next round ready).
export function applyChoice(run: DartliteRun, option: ChoiceOption): DartliteRun {
  let runPlayers = run.runPlayers;
  let trinkets = run.trinkets;
  let stats = run.stats;

  if (option.kind === 'heal') {
    runPlayers = runPlayers.map(p => ({ ...p, hp: Math.min(p.maxHp, p.hp + Math.ceil(p.maxHp * 0.2)) }));
  } else if (option.kind === 'stat') {
    const roll = Math.random();
    if (roll < 0.34) {
      runPlayers = runPlayers.map(p => ({ ...p, maxHp: p.maxHp + 20, hp: p.hp + 20 }));
    } else if (roll < 0.67) {
      runPlayers = runPlayers.map(p => ({ ...p, armor: p.armor + 3 }));
    } else {
      runPlayers = runPlayers.map(p => ({ ...p, power: p.power + 4 }));
    }
  } else if (option.kind === 'trinket') {
    const pool = run.pool.length ? run.pool : STARTER_POOL;
    const id = pool[Math.floor(Math.random() * pool.length)];
    trinkets = [...trinkets, id];
    const newPool = run.pool.filter(t => t !== id);
    return { ...run, trinkets, pool: newPool, phase: 'setup' };
  }

  return { ...run, runPlayers, trinkets, stats, phase: 'setup' };
}

export function applyBossTrinketChoice(run: DartliteRun, trinketId: TrinketId): DartliteRun {
  const trinkets = [...run.trinkets, trinketId];
  const pool = run.pool.filter(t => t !== trinketId);
  return { ...run, trinkets, pool, phase: 'reward', bossVictory: null };
}

export function recordBattleResult(
  run: DartliteRun,
  won: boolean,
  players: Player[],
  damageDealt: { [playerId: string]: number },
  kills: { [playerId: string]: number },
): DartliteRun {
  if (!won) return { ...run, phase: 'gameover' };

  const runPlayers = run.runPlayers.map(rp => {
    const bs = run.battle?.players.find(p => p.id === rp.id);
    return bs ? { ...rp, hp: bs.hp } : rp;
  });

  const playerStats = run.playerStats.map(ps => ({
    ...ps,
    kills: ps.kills + (kills[ps.playerId] ?? 0),
    damageDealt: ps.damageDealt + (damageDealt[ps.playerId] ?? 0),
  }));

  const stats = {
    roundsCleared: run.stats.roundsCleared + 1,
    enemiesDefeated: run.stats.enemiesDefeated + Object.values(kills).reduce((a, b) => a + b, 0),
    totalDamage: run.stats.totalDamage + Object.values(damageDealt).reduce((a, b) => a + b, 0),
  };

  return {
    ...run,
    runPlayers,
    playerStats,
    stats,
    battle: null,
    phase: 'choice',
    pendingChoice: generateChoices({ ...run, runPlayers, playerStats, stats }),
    choicePlayerIdx: 0,
    playerChoices: run.playerIds.map(() => null),
  };
}

export function advanceChoicePlayer(run: DartliteRun): DartliteRun {
  if (run.choicePlayerIdx >= run.playerIds.length - 1) {
    return { ...run, phase: 'reward' };
  }
  return run;
}

export function endRewardPhase(run: DartliteRun): DartliteRun {
  const nextRound = run.round + 1;
  return {
    ...run,
    round: nextRound,
    phase: 'setup',
    pendingChoice: null,
    choicePlayerIdx: 0,
    playerChoices: run.playerIds.map(() => null),
  };
}

export function applyDeckUpgradeResult(
  run: DartliteRun,
  updatedCards: PlayerCard[],
  option: ChoiceOption,
): DartliteRun {
  const idx = run.choicePlayerIdx;
  const runPlayers = run.runPlayers.map((rp, i) =>
    i === idx ? { ...rp, cards: updatedCards } : rp
  );
  const playerStats = run.playerStats.map((ps, i) =>
    i === idx ? { ...ps, rewards: [...ps.rewards, option] } : ps
  );
  return {
    ...run,
    runPlayers,
    playerStats,
    playerChoices: [...run.playerChoices.slice(0, idx), option, ...run.playerChoices.slice(idx + 1)],
    choicePlayerIdx: idx + 1,
  };
}

export function checkBossVictory(run: DartliteRun): DartliteRun {
  if (run.phase === 'choice' && isBossRound(run.round) && run.bossVictory === null) {
    const choices = bossTrinketOptions(run.pool);
    return { ...run, phase: 'boss_victory', bossVictory: { bossName: `Boss Round ${run.round}`, trinketChoices: choices } };
  }
  return run;
}

export function applyBossVictoryReward(run: DartliteRun, trinketId: TrinketId): DartliteRun {
  const trinkets = [...run.trinkets, trinketId];
  const pool = run.pool.filter(t => t !== trinketId);
  return { ...run, trinkets, pool, phase: 'choice', bossVictory: null };
}

export function getRunStats(run: DartliteRun): { totalKills: number; totalDamage: number; roundsCleared: number } {
  return {
    totalKills: run.playerStats.reduce((sum, ps) => sum + ps.kills, 0),
    totalDamage: run.playerStats.reduce((sum, ps) => sum + ps.damageDealt, 0),
    roundsCleared: run.stats.roundsCleared,
  };
}
