// Barrel re-export of the campaign engine modules. The engine was split
// into focused files under ./engine/ for readability; this file preserves
// the original import surface (`from './engine'`) for callers.

export {
  COOP_POWER_UPS,
  getCoopPowerUp,
} from './engine/powerUps';

export {
  COOP_CLASSES,
  COOP_PASSIVES,
  getCoopClass,
  getCoopPassive,
  passivesForClass,
  computePartyPassiveBonus,
  coopXpForBattle,
  unlockedPassivesForPlayer,
  defaultCoopProgress,
  selectClassForPlayer,
  equipPassiveForPlayer,
  addCoopXpForPlayer,
  reconcileCoopPassivesForPlayer,
  unlockedCoopPowerUps,
  getClassXp,
  addClassXp,
  classLevelFromXp,
} from './engine/classes';
export type { PartyPassiveBonus } from './engine/classes';

export {
  getLevel,
  getLevelInChapter,
  totalLevels,
  nextLevelId,
  nextLevelIdInChapter,
  chapterForLevel,
} from './engine/levels';

export {
  defaultPlayerCampaignProgress,
  playerCampaignProgress,
  playerHasClearedLevel,
  partyAllClearedLevel,
  partyMissingClearForLevel,
  recordLevelClearForPlayer,
  levelRewardPowerUp,
  isLevelUnlocked,
  isLevelUnlockedInChapter,
  isLevelUnlockedForParty,
} from './engine/progress';

export {
  neighborsOf,
  isTopHalf,
  isBottomHalf,
  isLeftHalf,
  isRightHalf,
  dartMatchesShield,
  matchesExactTarget,
  describeShield,
  flatHpForShield,
} from './engine/shields';

export {
  partyMaxHpFor,
  partyArmorFor,
  partyPowerFor,
  toCoopPlayer,
} from './engine/party';

export {
  effectiveAccuracy,
  effectivePrecision,
  simulateEnemyDart,
  makeDart,
  prepareEnemyTurn,
  applyNextEnemyAttack,
  finishEnemyTurn,
} from './engine/enemyAi';

export {
  startBattle,
  addDart,
  undoDart,
  setTarget,
  effectivePower,
  computePlayerDartDamage,
  resolvePlayerVisit,
} from './engine/playerTurn';

export {
  canActivateCoopPowerUp,
  activateCoopPowerUp,
} from './engine/coopActions';

export { getEnemyDef } from './engine/enemies';
