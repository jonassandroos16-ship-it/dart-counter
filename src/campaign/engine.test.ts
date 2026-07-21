import { describe, it, expect } from 'vitest';
import {
  addDart, computePlayerDartDamage, dartMatchesShield, describeShield, getLevel,
  isLevelUnlocked, prepareEnemyTurn, applyNextEnemyAttack, resolvePlayerVisit,
  setTarget, startBattle, totalLevels, undoDart,
  COOP_POWER_UPS,
  canActivateCoopPowerUp, activateCoopPowerUp,
  isLevelUnlockedForParty, playerCampaignProgress, defaultPlayerCampaignProgress,
  partyAllClearedLevel, partyMissingClearForLevel, recordLevelClearForPlayer,
} from './engine';
import { ENEMY_DATABASE } from './enemyDatabase';
import { CAMPAIGN_LEVELS } from './campaignLevels';
import type { CampaignDart, CoopClassId, CoopPassiveId, ShieldLayer } from './types';
import type { Player } from '../types';
import { defaultSettings } from '../constants';

const dart = (base: number, mult: number): CampaignDart => ({
  value: base === 0 ? 0 : base === 25 ? (mult === 2 ? 50 : 25) : base === 50 ? 50 : base * mult,
  label: base === 0 ? 'Miss' : base === 50 ? 'Bull' : (mult === 2 ? 'D' : mult === 3 ? 'T' : '') + base,
  base,
  mult: base === 50 ? 2 : mult,
  isDouble: base === 50 || mult === 2,
  isBull: base === 25 || base === 50,
});

// Build a dart that satisfies the given shield layer's target so the match
// check returns true. For span targets we pick a representative segment; for
// exact targets we parse the "D"/"T"/single encoding.
const makeDartMatching = (shield: ShieldLayer): CampaignDart => {
  if (shield.type === 'span') {
    switch (shield.target_value) {
      case 'TOP_HALF': return dart(20, 1);
      case 'BOTTOM_HALF': return dart(3, 1);
      case 'LEFT_HALF': return dart(11, 1);
      case 'RIGHT_HALF': return dart(6, 1);
      case 'ANY_DOUBLE': return dart(20, 2);
      case 'ANY_TRIPLE': return dart(20, 3);
      case 'ANY_BULL': return dart(25, 1);
    }
    return dart(20, 1);
  }
  const t = shield.target_value as string;
  if (t === 'Bull') return dart(50, 1);
  if (t === '25') return dart(25, 1);
  const m = /^([DT]?)(\d+)$/.exec(t);
  if (!m) return dart(20, 1);
  