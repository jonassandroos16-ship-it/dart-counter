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
