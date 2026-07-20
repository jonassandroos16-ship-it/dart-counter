import type {
  ActiveEnemy,
  CampaignBattleState,
  CampaignDart,
  CampaignLevel,
  CampaignProgress,
  CoopPlayer,
  CoopPowerUpDef,
  CoopPowerUpId,
  CoopClassDef,
  CoopClassId,
  CoopPassiveDef,
  CoopPassiveId,
  PlayerCoopProgress,
  EnemyDef,
  EnemyDatabase,
  ExactTarget,
  PlayerBuff,
  ResolvedDart,
  ShieldLayer,
  SpanTarget,
  EnemyAttackStep,
  VisitLogEntry,
} from './types';
import { ENEMY_DATABASE } from './enemyDatabase';
import { CAMPAIGN_LEVELS, CAMPAIGN_CHAPTERS, getChapter } from './campaignLevels';
import type { CampaignChapter } from './types';
import type { Player, Settings } from '../types';

// How much the Focus Buff subtracts from each alive enemy's accuracy and
// precision while active. 0.2 mirrors the old "+20% accuracy" hint but now
// applies to the AI's throw, where it actually has an in-game effect.
const FOCUS_BUFF_DISTRACT_AMOUNT = 0.2;
const FOCUS_BUFF_TURNS = 3;

export const COOP_POWER_UPS: CoopPowerUpDef[] = [
  // ── Starter tier (always available) ───────────────────────────────
  { id: 'coop_heal', name: 'Heal', icon: '❤️', desc: 'Restore 80 party HP instantly.', cost: 100, tier: 'starter' },
  { id: 'coop_buff_power', name: 'Power Buff', icon: '⚡', desc: 'All players +10 power for 3 turns.', cost: 80, tier: 'starter' },
  { id: 'coop_buff_acc', name: 'Focus Buff', icon: '🎯', desc: 'Distract all enemies — -20% accuracy & precision for 3 turns.', cost: 80, tier: 'starter' },
  { id: 'coop_freeze', name: 'Freeze', icon: '❄️', desc: 'Freeze all enemies for 2 turns — they cannot attack.', cost: 100, tier: 'starter' },
  { id: 'coop_shield', name: 'Party Shield', icon: '🛡️', desc: 'Absorb the next 40 party damage from enemies.', cost: 70, tier: 'starter' },
  // ── Advanced tier (unlocked as level rewards) ──────────────────────
  // Each is stronger than the one before it. Apocalypse is the boss reward.
  { id: 'coop_meteor', name: 'Meteor Strike', icon: '☄️', desc: 'Rain fire on every enemy — 60 damage to each, ignoring shields.', cost: 90, tier: 'advanced' },
  { id: 'coop_phantom', name: 'Phantom Darts', icon: '👻', desc: 'Your next 3 darts auto-hit bullseye (50 each) on the targeted enemy.', cost: 80, tier: 'advanced' },
  { id: 'coop_time_warp', name: 'Time Warp', icon: '⏳', desc: 'Enemies take 50% more damage from all sources for 3 turns.', cost: 110, tier: 'advanced' },
  { id: 'coop_ressurect', name: 'Resurrection', icon: '✨', desc: 'Restore the party to full HP and clear all enemy shields.', cost: 130, tier: 'advanced' },
  { id: 'coop_apocalypse', name: 'Apocalypse', icon: '🔥', desc: 'BOSS REWARD: 150 damage to every enemy, freeze them for 2 turns, and fully heal the party.', cost: 150, tier: 'advanced' },
  // ── Advanced tier — Chapter 2 (Frozen Throne) ──────────────────────
  { id: 'coop_blizzard', name: 'Blizzard', icon: '🌨️', desc: 'A howling gale — 45 damage to every enemy and freeze them for 1 turn.', cost: 95, tier: 'advanced' },
  { id: 'coop_frostbite', name: 'Frostbite', icon: '🥶', desc: 'Chill every enemy to the bone — 40 damage and -25% accuracy for 3 turns.', cost: 100, tier: 'advanced' },
  { id: 'coop_ice_lance', name: 'Ice Lance', icon: '🔱', desc: 'A single perfect shard — 120 damage to the targeted enemy, ignoring shields.', cost: 90, tier: 'advanced' },
  { id: 'coop_winter_veil', name: "Winter's Veil", icon: '🌫️', desc: 'Wrap the party in mist — restore 60 HP and shield against the next 2 turns of damage.', cost: 120, tier: 'advanced' },
  { id: 'coop_glacial_doom', name: 'Glacial Doom', icon: '🧊', desc: 'BOSS REWARD: 180 damage to every enemy, freeze them for 3 turns, and fully heal the party.', cost: 160, tier: 'advanced' },
];

export function getCoopPowerUp(id: CoopPowerUpId): CoopPowerUpDef | undefined {
  return COOP_POWER_UPS.find(p => p.id === id);
}

// ── Coop classes & passives ────────────────────────────────────────────
//
// Three classes, each with a starter passive plus two stronger progression
// passives (3 tiers total per class). Each tier is strictly stronger than
// the one before. Passives grant team-wide stat bonuses while the player is
// in the party.

export const COOP_CLASSES: CoopClassDef[] = [
  { id: 'warrior', name: 'Warrior', icon: '⚔️', desc: 'A frontline striker. Grants the party flat POWER bonuses, making every dart hit harder.', starterPassive: 'war_power_1' },
  { id: 'priest', name: 'Priest', icon: '✨', desc: 'A guardian healer. Grants the party flat MAX HP bonuses, so the party can soak more damage.', starterPassive: 'pri_hp_1' },
  { id: 'rogue', name: 'Rogue', icon: '🗡️', desc: 'A nimble defender. Grants the party flat ARMOR bonuses, reducing every enemy dart.', starterPassive: 'rog_armor_1' },
];

export const COOP_PASSIVES: CoopPassiveDef[] = [
  // Warrior — power
  { id: 'war_power_1', classId: 'warrior', tier: 1, name: 'Battle Cry', icon: '⚔️', desc: 'Party +3 power (flat per dart).', bonus: { power: 3 }, xpRequired: 0 },
  { id: 'war_power_2', classId: 'warrior', tier: 2, name: 'War Banner', icon: '🚩', desc: 'Party +8 power (flat per dart).', bonus: { power: 8 }, xpRequired: 50 },
  { id: 'war_power_3', classId: 'warrior', tier: 3, name: 'Berserker Aura', icon: '🔥', desc: 'Party +15 power (flat per dart).', bonus: { power: 15 }, xpRequired: 150 },
  // Priest — health
  { id: 'pri_hp_1', classId: 'priest', tier: 1, name: 'Blessing', icon: '✨', desc: 'Party +60 max HP.', bonus: { health: 60 }, xpRequired: 0 },
  { id: 'pri_hp_2', classId: 'priest', tier: 2, name: 'Sanctuary', icon: '🙏', desc: 'Party +150 max HP.', bonus: { health: 150 }, xpRequired: 50 },
  { id: 'pri_hp_3', classId: 'priest', tier: 3, name: 'Divine Aegis', icon: '😇', desc: 'Party +300 max HP.', bonus: { health: 300 }, xpRequired: 150 },
  // Rogue — armor
  { id: 'rog_armor_1', classId: 'rogue', tier: 1, name: 'Light Steps', icon: '🗡️', desc: 'Party +2 armor (flat per enemy dart).', bonus: { armor: 2 }, xpRequired: 0 },
  { id: 'rog_armor_2', classId: 'rogue', tier: 2, name: 'Shadow Veil', icon: '🌫️', desc: 'Party +5 armor (flat per enemy dart).', bonus: { armor: 5 }, xpRequired: 50 },
  { id: 'rog_armor_3', classId: 'rogue', tier: 3, name: 'Phantom Guard', icon: '👻', desc: 'Party +10 armor (flat per enemy dart).', bonus: { armor: 10 }, xpRequired: 150 },
];

export function getCoopClass(id: CoopClassId | null | undefined): CoopClassDef | undefined {
  if (!id) return undefined;
  return COOP_CLASSES.find(c => c.id === id);
}

export function getCoopPassive(id: CoopPassiveId | null | undefined): CoopPassiveDef | undefined {
  if (!id) return undefined;
  return COOP_PASSIVES.find(p => p.id === id);
}

export function passivesForClass(classId: CoopClassId): CoopPassiveDef[] {
  return COOP_PASSIVES.filter(p => p.classId === classId).sort((a, b) => a.tier - b.tier);
}

// Compute the team-wide passive bonus from a set of players' equipped
// passives. Each unique passive id contributes its bonus to the party
// exactly once — multiple players equipping the same passive (e.g. three
// priests all equipping `pri_hp_1`) do NOT stack; the buff is applied a
// single time. Different passives (e.g. `pri_hp_1` and `pri_hp_2`) each
// contribute independently, so a party with priests running different
// tiers still benefits from every distinct equipped passive.
export interface PartyPassiveBonus {
  power: number;
  health: number;
  armor: number;
  sources: { playerId: string; playerName: string; passiveName: string; icon: string; bonus: CoopPassiveDef['bonus'] }[];
}

export function computePartyPassiveBonus(players: Player[]): PartyPassiveBonus {
  const bonus: PartyPassiveBonus = { power: 0, health: 0, armor: 0, sources: [] };
  const seen = new Set<CoopPassiveId>();
  for (const p of players) {
    const prog = p.coopProgress;
    if (!prog || !prog.classId) continue;
    const equipped = prog.equippedPassives || [];
    if (!equipped.length) continue;
    for (const pid of equipped) {
      // Skip passives already counted from another player — each unique
      // passive id buffs the party once, not once per priest.
      if (seen.has(pid)) continue;
      const def = getCoopPassive(pid);
      if (!def) continue;
      seen.add(pid);
      bonus.power += def.bonus.power || 0;
      bonus.health += def.bonus.health || 0;
      bonus.armor += def.bonus.armor || 0;
      bonus.sources.push({
        playerId: p.id,
        playerName: p.name,
        passiveName: def.name,
        icon: def.icon,
        bonus: def.bonus,
      });
    }
  }
  return bonus;
}

// XP granted per Coop battle. Scaled by outcome (win = more) and darts thrown.
export function coopXpForBattle(stats: CampaignBattleState['stats'], won: boolean): number {
  const base = won ? 20 : 5;
  const dartBonus = Math.min(20, Math.floor(stats.dartsThrown / 3));
  const defeatBonus = Math.min(15, stats.enemiesDefeated * 3);
  return base + dartBonus + defeatBonus;
}

// Returns the list of passives a player can unlock/equip given their Coop XP.
export function unlockedPassivesForPlayer(prog: PlayerCoopProgress | undefined | null): CoopPassiveId[] {
  if (!prog || !prog.classId) return [];
  const classPassives = passivesForClass(prog.classId);
  return classPassives.filter(p => (prog.xp || 0) >= p.xpRequired).map(p => p.id);
}

// Default coop progress for a brand-new player: no class, 0 XP, no passives.
export function defaultCoopProgress(): PlayerCoopProgress {
  return { classId: null, xp: 0, unlockedPassives: [], equippedPassives: [] };
}

// When a player picks a class, auto-equip the starter passive (tier 1).
export function selectClassForPlayer(prog: PlayerCoopProgress, classId: CoopClassId): PlayerCoopProgress {
  const starter = COOP_PASSIVES.find(p => p.classId === classId && p.tier === 1);
  return {
    ...prog,
    classId,
    unlockedPassives: Array.from(new Set([...(prog.unlockedPassives || []), starter?.id].filter(Boolean) as CoopPassiveId[])),
    equippedPassives: [starter?.id].filter(Boolean) as CoopPassiveId[],
  };
}

// Equip a passive for the player. Replaces any currently-equipped passive of
// the same class (only one per class at a time).
export function equipPassiveForPlayer(prog: PlayerCoopProgress, passiveId: CoopPassiveId): PlayerCoopProgress {
  const def = getCoopPassive(passiveId);
  if (!def || !prog.classId || def.classId !== prog.classId) return prog;
  const unlocked = unlockedPassivesForPlayer(prog);
  if (!unlocked.includes(passiveId)) return prog;
  // Remove any currently-equipped passives of the same class, then add this one.
  const other = (prog.equippedPassives || []).filter(id => {
    const d = getCoopPassive(id);
    return d && d.classId !== def.classId;
  });
  return { ...prog, equippedPassives: [...other, passiveId] };
}

// Add Coop XP to a player's progress, auto-unlocking any passives whose
// XP threshold they now meet. Returns the updated progress and the list of
// newly unlocked passive ids (for UI toast).
export function addCoopXpForPlayer(prog: PlayerCoopProgress | undefined | null, xp: number): { progress: PlayerCoopProgress; newlyUnlocked: CoopPassiveId[] } {
  const cur = prog || defaultCoopProgress();
  if (!cur.classId) return { progress: cur, newlyUnlocked: [] };
  const newXp = Math.max(0, (cur.xp || 0) + Math.max(0, xp));
  const classPassives = passivesForClass(cur.classId);
  const newlyUnlocked: CoopPassiveId[] = [];
  const unlockedSet = new Set(cur.unlockedPassives || []);
  for (const p of classPassives) {
    if (newXp >= p.xpRequired && !unlockedSet.has(p.id)) {
      newlyUnlocked.push(p.id);
      unlockedSet.add(p.id);
    }
  }
  return {
    progress: { ...cur, xp: newXp, unlockedPassives: Array.from(unlockedSet) },
    newlyUnlocked,
  };
}

// Starter power-ups are always available. Advanced power-ups unlock as level
// rewards. This helper returns the full list of ids a player can equip given
// their campaign progress.
export function unlockedCoopPowerUps(progress: CampaignProgress | undefined | null): string[] {
  const starter = COOP_POWER_UPS.filter(p => p.tier === 'starter').map(p => p.id);
  const advanced = (progress?.unlockedPowerUps || []) as string[];
  return [...starter, ...advanced];
}

// Returns the reward power-up id for a level, or null if none. Looks up
// the level within a specific chapter (since level ids are unique only
// within a chapter). Falls back to the flat lookup for backwards compat.
export function levelRewardPowerUp(levelId: number, chapterId?: string): string | null {
  const level = chapterId ? getLevelInChapter(chapterId, levelId) : getLevel(levelId);
  if (!level || !level.reward_power_up) return null;
  return level.reward_power_up;
}

let instanceCounter = 0;
function nextInstanceId(prefix: string): string {
  instanceCounter += 1;
  return `${prefix}_${instanceCounter}_${Math.random().toString(36).slice(2, 6)}`;
}

// Flat lookup across all chapters (backwards compat). Returns the first
// level with a matching id across all chapters.
export function getLevel(levelId: number): CampaignLevel | undefined {
  return CAMPAIGN_LEVELS.levels.find(l => l.level_id === levelId);
}

// Lookup within a specific chapter.
export function getLevelInChapter(chapterId: string, levelId: number): CampaignLevel | undefined {
  return getChapter(chapterId)?.levels.find(l => l.level_id === levelId);
}

export function getEnemyDef(defId: string, db: EnemyDatabase = ENEMY_DATABASE): EnemyDef | undefined {
  return db[defId];
}

export function totalLevels(): number {
  return CAMPAIGN_LEVELS.levels.length;
}

// ── Party attribute aggregation ──────────────────────────────────────
//
// Party HP for a level = sum of each selected player's `health` attribute
// (NOT capped — the per-player `healthMax` cap applies to individuals, not
// to the party total). Armor and power are averaged (sum / playerCount) so
// adding more players can't push armor/power above the configured caps —
// they share the load. Each player still attacks with their own per-dart
// power (so high power players hit harder), but the shared armor is what
// mitigates incoming enemy damage.

export function partyMaxHpFor(players: Player[], settings: Settings): number {
  const cfg = settings.powerUpScaling;
  const startHealth = Number.isFinite(cfg.attributeStartHealth) ? cfg.attributeStartHealth : 0;
  const sum = players.reduce((acc, p) => {
    const h = p.attributes?.health;
    return acc + (typeof h === 'number' && Number.isFinite(h) ? Math.max(1, h) : startHealth);
  }, 0);
  return Math.max(1, sum);
}

export function partyArmorFor(players: Player[], settings: Settings): number {
  const cfg = settings.powerUpScaling;
  if (!players.length) return 0;
  const armorMax = Number.isFinite(cfg.armorMax) ? cfg.armorMax : Number.MAX_SAFE_INTEGER;
  const startArmor = Number.isFinite(cfg.attributeStartArmor) ? cfg.attributeStartArmor : 0;
  const sum = players.reduce((acc, p) => {
    const a = p.attributes?.armor;
    return acc + (typeof a === 'number' && Number.isFinite(a) ? a : startArmor);
  }, 0);
  // Divide by player count so the combined armor never exceeds the cap.
  const avg = sum / players.length;
  return Math.max(0, Math.min(armorMax, avg));
}

export function partyPowerFor(players: Player[], settings: Settings): number {
  const cfg = settings.powerUpScaling;
  if (!players.length) return 0;
  const powerMax = Number.isFinite(cfg.powerMax) ? cfg.powerMax : Number.MAX_SAFE_INTEGER;
  const startPower = Number.isFinite(cfg.attributeStartPower) ? cfg.attributeStartPower : 0;
  const sum = players.reduce((acc, p) => {
    const pw = p.attributes?.power;
    return acc + (typeof pw === 'number' && Number.isFinite(pw) ? pw : startPower);
  }, 0);
  const avg = sum / players.length;
  return Math.max(0, Math.min(powerMax, avg));
}

// Per-player snapshot used during a battle.
function toCoopPlayer(p: Player, settings: Settings, startCharge: number): CoopPlayer {
  const cfg = settings.powerUpScaling;
  const healthMax = Number.isFinite(cfg.healthMax) ? cfg.healthMax : Number.MAX_SAFE_INTEGER;
  const armorMax = Number.isFinite(cfg.armorMax) ? cfg.armorMax : Number.MAX_SAFE_INTEGER;
  const powerMax = Number.isFinite(cfg.powerMax) ? cfg.powerMax : Number.MAX_SAFE_INTEGER;
  const startHealth = Number.isFinite(cfg.attributeStartHealth) ? cfg.attributeStartHealth : 0;
  const startArmor = Number.isFinite(cfg.attributeStartArmor) ? cfg.attributeStartArmor : 0;
  const startPower = Number.isFinite(cfg.attributeStartPower) ? cfg.attributeStartPower : 0;
  const h = Number.isFinite(p.attributes?.health) ? p.attributes!.health : startHealth;
  const a = Number.isFinite(p.attributes?.armor) ? p.attributes!.armor : startArmor;
  const pw = Number.isFinite(p.attributes?.power) ? p.attributes!.power : startPower;
  return {
    id: p.id,
    name: p.name,
    color: p.color,
    hp: Math.max(1, Math.min(healthMax, h)),
    maxHp: Math.max(1, Math.min(healthMax, h)),
    power: Math.max(0, Math.min(powerMax, pw)),
    armor: Math.max(0, Math.min(armorMax, a)),
    buffs: [],
    powerUpCharge: Math.max(0, startCharge),
    classId: p.coopProgress?.classId ?? null,
  };
}

// ── Battle initialization ─────────────────────────────────────────────

export function startBattle(
  level: CampaignLevel,
  players: Player[],
  settings: Settings,
  db: EnemyDatabase = ENEMY_DATABASE,
  chapterId: string = 'crimson_vale',
): CampaignBattleState {
  const cfg = settings?.powerUpScaling;
  const chargeCap = Number.isFinite(cfg?.chargeMax) ? (cfg?.chargeMax as number) : 100;
  const startMap = (cfg && cfg.startingCharge) || {};
  // Per-player starting charge: each player uses their own equipped coop
  // power-up's starting charge. This is the core fix for the bug where one
  // player could charge but another couldn't use their power-up.
  const party = players.map(p => {
    const equippedId = p.powerUps?.coopActive ?? null;
    const startCharge = equippedId ? (startMap[equippedId] || 0) : 0;
    return toCoopPlayer(p, settings, Math.max(0, Math.min(chargeCap, startCharge)));
  });
  // Apply team-wide passive bonuses (from each player's equipped passives)
  // to the party's stats. Health bonus raises maxHp AND current hp; power
  // and armor bonuses raise the per-player stats.
  const passiveBonus = computePartyPassiveBonus(players);
  const healthMax = Number.isFinite(cfg?.healthMax) ? (cfg?.healthMax as number) : Number.MAX_SAFE_INTEGER;
  const armorMax = Number.isFinite(cfg?.armorMax) ? (cfg?.armorMax as number) : Number.MAX_SAFE_INTEGER;
  const powerMax = Number.isFinite(cfg?.powerMax) ? (cfg?.powerMax as number) : Number.MAX_SAFE_INTEGER;
  for (const cp of party) {
    cp.maxHp = Math.min(healthMax, cp.maxHp + passiveBonus.health);
    cp.hp = cp.maxHp;
    cp.power = Math.min(powerMax, cp.power + passiveBonus.power);
    cp.armor = Math.min(armorMax, cp.armor + passiveBonus.armor);
  }
  const partyMaxHp = party.reduce((acc, p) => acc + p.maxHp, 0);
  // Legacy shared charge kept for backwards-compat with old saves/tests.
  // Initialized to the first player's charge (mirrors old behavior).
  const powerUpCharge = party.length ? party[0].powerUpCharge : 0;
  const enemies: ActiveEnemy[] = level.enemies.map((defId) => {
    const def = db[defId];
    if (!def) throw new Error(`Unknown enemy id: ${defId}`);
    return {
      id: nextInstanceId(defId),
      defId,
      name: def.name,
      hp: def.max_hp,
      maxHp: def.max_hp,
      armor: def.armor,
      accuracy: def.accuracy,
      precision: def.precision,
      shields: def.shields.map(s => ({ ...s })),
      defeated: false,
      frozenTurns: 0,
      vulnerableTurns: 0,
      distractedTurns: 0,
      distractAmount: 0,
    };
  });
  return {
    levelId: level.level_id,
    levelName: level.name,
    isBoss: level.is_boss,
    partyHp: partyMaxHp,
    partyMaxHp,
    players: party,
    chapterId,
    stats: {
      visitsUsed: 0,
      dartsThrown: 0,
      damageDealt: 0,
      enemiesDefeated: 0,
      powerUpsUsed: 0,
      partyHpLost: 0,
    },
    playerTurnIdx: 0,
    darts: [],
    enemies,
    targetIdx: 0,
    phase: 'player',
    lastVisitLog: [],
    visitNumber: 1,
    outcome: 'ongoing',
    powerUpCharge,
    resolvedDarts: [],
    visitEnemiesSnapshot: [],
    pendingEnemyAttacks: [],
    appliedEnemyAttacks: [],
    awaitContinue: false,
    phantomDarts: 0,
    frozenEnemiesThisRound: [],
    passiveBonus,
  };
}

// ── Shield matching ───────────────────────────────────────────────────

const DARTBOARD_ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

function neighborsOf(base: number): number[] {
  const i = DARTBOARD_ORDER.indexOf(base);
  if (i < 0) return [];
  const left = DARTBOARD_ORDER[(i - 1 + DARTBOARD_ORDER.length) % DARTBOARD_ORDER.length];
  const right = DARTBOARD_ORDER[(i + 1) % DARTBOARD_ORDER.length];
  return [left, right];
}

function isTopHalf(base: number): boolean {
  return base >= 11 && base <= 20;
}
function isBottomHalf(base: number): boolean {
  return base >= 1 && base <= 10;
}
function isLeftHalf(base: number): boolean {
  const i = DARTBOARD_ORDER.indexOf(base);
  return i % 2 === 0;
}
function isRightHalf(base: number): boolean {
  const i = DARTBOARD_ORDER.indexOf(base);
  return i % 2 === 1;
}

export function dartMatchesShield(dart: CampaignDart, shield: ShieldLayer): boolean {
  if (shield.type === 'span') {
    const target = shield.target_value as SpanTarget;
    if (dart.base === 0) return false;
    switch (target) {
      case 'TOP_HALF': return isTopHalf(dart.base);
      case 'BOTTOM_HALF': return isBottomHalf(dart.base);
      case 'LEFT_HALF': return isLeftHalf(dart.base);
      case 'RIGHT_HALF': return isRightHalf(dart.base);
      case 'ANY_DOUBLE': return dart.isDouble;
      case 'ANY_TRIPLE': return dart.mult === 3 && !dart.isBull;
      case 'ANY_BULL': return dart.base === 25 || dart.base === 50;
    }
    return false;
  }
  const t = shield.target_value as ExactTarget;
  return matchesExactTarget(dart, t);
}

function matchesExactTarget(dart: CampaignDart, t: ExactTarget): boolean {
  if (t === 'Bull') return dart.base === 50;
  if (t === '25') return dart.base === 25 && !dart.isBull;
  const m = /^([DT]?)(\d+)$/.exec(t);
  if (!m) return false;
  const mult = m[1] === 'D' ? 2 : m[1] === 'T' ? 3 : 1;
  const base = Number(m[2]);
  if (!Number.isFinite(base)) return false;
  if (dart.base !== base) return false;
  if (base === 25 || base === 50) return true;
  return dart.mult === mult;
}

export function describeShield(shield: ShieldLayer): string {
  if (shield.type === 'span') {
    const map: Record<SpanTarget, string> = {
      TOP_HALF: 'Top Half',
      BOTTOM_HALF: 'Bottom Half',
      LEFT_HALF: 'Left Half',
      RIGHT_HALF: 'Right Half',
      ANY_DOUBLE: 'Any Double',
      ANY_TRIPLE: 'Any Triple',
      ANY_BULL: 'Any Bull',
    };
    return map[shield.target_value as SpanTarget] || String(shield.target_value);
  }
  const t = shield.target_value as ExactTarget;
  if (t === 'Bull') return 'Bullseye';
  if (t === '25') return '25 (outer bull)';
  const m = /^([DT]?)(\d+)$/.exec(t);
  if (!m) return t;
  const prefix = m[1] === 'D' ? 'Double ' : m[1] === 'T' ? 'Triple ' : 'Single ';
  return prefix + m[2];
}

// ── Player turn ───────────────────────────────────────────────────────
//
// In Coop mode, each dart a player throws is resolved immediately against
// the targeted enemy — shields are checked, damage is applied, and the
// enemy may be defeated mid-visit. The thrower can keep throwing darts (up
// to 3) at any alive enemy. After the 3rd dart, the player taps "Continue"
// to see a summary of all darts thrown this visit (with per-dart target,
// damage, and resulting HP) and then advance to the next player or the
// enemy phase.
//
// `undoDart` reverts the most recent dart by restoring the enemy snapshot
// taken when the first dart of the visit was thrown.

export function addDart(
  state: CampaignBattleState,
  base: number,
  mult: number,
  labelOverride?: string,
  isBull?: boolean,
  settings?: Settings,
): CampaignBattleState {
  if (state.phase !== 'player') return state;
  if (state.darts.length >= 3) return state;
  let value: number, label: string;
  if (isBull) { value = 50; label = 'Bull'; }
  else if (base === 25) { value = mult === 2 ? 50 : 25; label = mult === 2 ? 'Bull' : '25'; }
  else if (base === 0) { value = 0; label = 'Miss'; }
  else { value = base * mult; label = (mult === 2 ? 'D' : mult === 3 ? 'T' : '') + base; }
  let dart: CampaignDart = {
    value,
    label: labelOverride || label,
    base,
    mult: isBull ? 2 : (base === 25 && value === 50 ? 2 : mult),
    isDouble: !!(isBull || (base === 25 && value === 50) || mult === 2),
    isBull: !!isBull || base === 25,
  };
  let phantomDarts = state.phantomDarts;
  // Phantom Darts power-up: convert thrown darts into bullseyes. Each
  // consumed dart decrements the counter. Misses (base 0) are not converted
  // so the player can still intentionally miss if they want.
  if (phantomDarts > 0 && base !== 0) {
    dart = { value: 50, label: '👻 Bull', base: 50, mult: 2, isDouble: true, isBull: true };
    phantomDarts = phantomDarts - 1;
  }

  // Power-up charge: every dart thrown contributes to the CURRENT THROWER's
  // coop power-up orb. This is per-player — other players' orbs are not
  // affected. Mirrors the competitive `addDartToGame` flow.
  const chargeCap = settings?.powerUpScaling?.chargeMax ?? 100;
  const gained = settings ? chargeFromDart(dart, settings) : 0;
  const throwerIdx = state.playerTurnIdx;
  const players = state.players.map((p, i) => i === throwerIdx
    ? { ...p, powerUpCharge: Math.min(chargeCap, p.powerUpCharge + gained) }
    : p);
  // Legacy shared charge kept in sync with the current thrower for backwards
  // compat with old code that reads state.powerUpCharge.
  const powerUpCharge = players[throwerIdx].powerUpCharge;

  // Snapshot enemies at the start of the visit so undo can restore them.
  const visitEnemiesSnapshot = state.darts.length === 0
    ? state.enemies.map(e => ({ ...e, shields: e.shields.map(s => ({ ...s })) }))
    : state.visitEnemiesSnapshot;

  // Resolve this dart immediately against the targeted enemy.
  const thrower = players[throwerIdx];
  if (!thrower) {
    return { ...state, players, darts: [...state.darts, dart], phantomDarts, visitEnemiesSnapshot, powerUpCharge };
  }
  const power = effectivePower(thrower);

  // Find a valid target (auto-pick first alive if the chosen one is dead).
  let targetIdx = state.targetIdx;
  let target = state.enemies[targetIdx];
  if (!target || target.defeated) {
    const firstAlive = state.enemies.findIndex(e => !e.defeated);
    if (firstAlive < 0) {
      // No alive enemies — just record the dart.
      return {
        ...state,
        players,
        darts: [...state.darts, dart],
        phantomDarts,
        visitEnemiesSnapshot,
        powerUpCharge,
      };
    }
    targetIdx = firstAlive;
    target = state.enemies[targetIdx];
  }

  const enemies = state.enemies.map(e => ({ ...e, shields: [...e.shields] }));
  const t = enemies[targetIdx];
  let step: ResolvedDart;
  if (t.shields.length > 0) {
    const shieldIdx = 0;
    const shield = t.shields[shieldIdx];
    if (dartMatchesShield(dart, shield)) {
      t.shields = t.shields.filter((_, i) => i !== shieldIdx);
      step = {
        dart, damage: 0, kind: 'shield_break',
        shieldTarget: describeShield(shield),
        enemyId: t.id, enemyName: t.name, hpAfter: t.hp,
      };
    } else {
      step = {
        dart, damage: 0, kind: 'miss',
        enemyId: t.id, enemyName: t.name, hpAfter: t.hp,
      };
    }
  } else {
    const dmg = computePlayerDartDamage(dart, power, t.armor);
    const finalDmg = t.vulnerableTurns > 0 ? Math.round(dmg * 1.5) : dmg;
    t.hp = Math.max(0, t.hp - finalDmg);
    const defeated = t.hp <= 0;
    if (defeated) t.defeated = true;
    step = {
      dart, damage: finalDmg, kind: defeated ? 'defeated' : 'damage',
      enemyId: t.id, enemyName: t.name, hpAfter: t.hp,
    };
  }

  const anyAlive = enemies.some(e => !e.defeated);
  const outcome: CampaignBattleState['outcome'] = !anyAlive ? 'victory' : state.outcome;

  return {
    ...state,
    players,
    enemies,
    darts: [...state.darts, dart],
    resolvedDarts: [...state.resolvedDarts, step],
    targetIdx,
    phantomDarts,
    visitEnemiesSnapshot,
    outcome,
    powerUpCharge,
    stats: {
      ...state.stats,
      dartsThrown: state.stats.dartsThrown + 1,
      damageDealt: state.stats.damageDealt + (step.kind === 'damage' || step.kind === 'defeated' ? step.damage : 0),
      enemiesDefeated: state.stats.enemiesDefeated + (step.kind === 'defeated' ? 1 : 0),
    },
  };
}

export function undoDart(state: CampaignBattleState, settings?: Settings): CampaignBattleState {
  if (!state.darts.length) return state;
  // Restore enemies from the visit snapshot (taken when the first dart was
  // thrown). If this was the first dart, clear the snapshot.
  const enemies = state.visitEnemiesSnapshot.length
    ? state.visitEnemiesSnapshot.map(e => ({ ...e, shields: e.shields.map(s => ({ ...s })) }))
    : state.enemies;
  const resolvedDarts = state.resolvedDarts.slice(0, -1);
  const darts = state.darts.slice(0, -1);
  const visitEnemiesSnapshot = darts.length === 0 ? [] : state.visitEnemiesSnapshot;
  // Recompute outcome — undoing a dart could un-defeat an enemy.
  const anyAlive = enemies.some(e => !e.defeated);
  const outcome: CampaignBattleState['outcome'] = !anyAlive ? 'victory' : 'ongoing';
  // Revert the power-up charge added by the undone dart from the CURRENT
  // THROWER's per-player orb (not the shared pool).
  const undoneDart = state.darts[state.darts.length - 1];
  const revert = settings ? chargeFromDart(undoneDart, settings) : 0;
  const throwerIdx = state.playerTurnIdx;
  const players = state.players.map((p, i) => i === throwerIdx
    ? { ...p, powerUpCharge: Math.max(0, p.powerUpCharge - revert) }
    : p);
  const powerUpCharge = Math.max(0, state.powerUpCharge - revert);
  return {
    ...state,
    players,
    enemies,
    darts,
    resolvedDarts,
    visitEnemiesSnapshot,
    outcome,
    powerUpCharge,
  };
}

export function setTarget(state: CampaignBattleState, enemyId: string): CampaignBattleState {
  const idx = state.enemies.findIndex(e => e.id === enemyId);
  if (idx < 0) return state;
  return { ...state, targetIdx: idx };
}

// Effective power for the current thrower, including active buffs.
function effectivePower(player: CoopPlayer): number {
  const buff = player.buffs.filter(b => b.kind === 'power').reduce((a, b) => a + b.amount, 0);
  return Math.max(0, player.power + buff);
}

// Per-dart damage = max(0, dartValue + power) − armor, min 1 on a hit. Misses deal 0.
export function computePlayerDartDamage(dart: CampaignDart, attackerPower: number, targetArmor: number): number {
  if (dart.value <= 0) return 0;
  const raw = Math.max(0, dart.value + attackerPower) - Math.max(0, targetArmor);
  return Math.max(1, raw);
}

// After a player has thrown all their darts (and the damage has already
// been applied dart-by-dart via `addDart`), `resolvePlayerVisit` finalizes
// the visit: it logs the visit, clears the dart slots, and advances to the
// next player or to the enemy phase. The UI shows a summary overlay of all
// darts thrown this visit before calling this.
export function resolvePlayerVisit(state: CampaignBattleState): CampaignBattleState {
  if (state.phase !== 'player') return state;
  if (!state.darts.length) return state;
  return advanceAfterPlayerVisit({
    ...state,
    darts: [],
    resolvedDarts: [],
    visitEnemiesSnapshot: [],
    stats: { ...state.stats, visitsUsed: state.stats.visitsUsed + 1 },
  });
}

// After a player's visit is fully animated, either pass to the next player
// or start the enemy phase.
function advanceAfterPlayerVisit(state: CampaignBattleState): CampaignBattleState {
  if (state.outcome === 'victory') {
    return {
      ...state,
      phase: 'player',
      darts: [],
      resolvedDarts: [],
      visitEnemiesSnapshot: [],
      awaitContinue: false,
    };
  }
  const nextIdx = state.playerTurnIdx + 1;
  if (nextIdx < state.players.length) {
    return {
      ...state,
      playerTurnIdx: nextIdx,
      darts: [],
      resolvedDarts: [],
      visitEnemiesSnapshot: [],
      awaitContinue: false,
    };
  }
  // All players have thrown — start the enemy phase.
  return {
    ...state,
    phase: 'enemy',
    darts: [],
    resolvedDarts: [],
    visitEnemiesSnapshot: [],
    awaitContinue: false,
  };
}

// ── Enemy AI turn ─────────────────────────────────────────────────────

// Effective accuracy/precision for an enemy, applying the Focus Buff
// distract debuff (clamped to >= 0).
function effectiveAccuracy(enemy: ActiveEnemy): number {
  return enemy.distractedTurns > 0
    ? Math.max(0, enemy.accuracy - enemy.distractAmount)
    : enemy.accuracy;
}
function effectivePrecision(enemy: ActiveEnemy): number {
  return enemy.distractedTurns > 0
    ? Math.max(0, enemy.precision - enemy.distractAmount)
    : enemy.precision;
}

function simulateEnemyDart(enemy: ActiveEnemy, rng: () => number): CampaignDart {
  const intendedBase = 20;
  const intendedMult = 3;
  const hit = rng() < effectiveAccuracy(enemy);
  let base = intendedBase;
  let mult = intendedMult;
  if (!hit) {
    if (rng() < effectivePrecision(enemy)) {
      const neighbors = neighborsOf(intendedBase);
      base = neighbors[Math.floor(rng() * neighbors.length)] || intendedBase;
    } else {
      base = DARTBOARD_ORDER[Math.floor(rng() * DARTBOARD_ORDER.length)];
    }
    const r = rng();
    mult = r < 0.1 ? 3 : r < 0.25 ? 2 : 1;
  }
  return makeDart(base, mult);
}

function makeDart(base: number, mult: number): CampaignDart {
  if (base === 25) {
    return { value: mult === 2 ? 50 : 25, label: mult === 2 ? 'Bull' : '25', base: 25, mult: mult === 2 ? 2 : 1, isDouble: mult === 2, isBull: true };
  }
  if (base === 50) {
    return { value: 50, label: 'Bull', base: 50, mult: 2, isDouble: true, isBull: true };
  }
  if (base === 0) {
    return { value: 0, label: 'Miss', base: 0, mult: 1, isDouble: false };
  }
  const value = base * mult;
  const label = (mult === 2 ? 'D' : mult === 3 ? 'T' : '') + base;
  return { value, label, base, mult, isDouble: mult === 2, isBull: false };
}

// Build the list of enemy attack steps for the upcoming enemy phase. Each
// alive (and non-frozen) enemy throws 3 darts; each dart is one step so the
// UI can animate them one at a time. Frozen enemies skip their turn and
// have their `frozenTurns` decremented. The list of frozen enemies is
// recorded in `frozenEnemiesThisRound` so the UI can show a "frozen" popup
// even when no attacks are produced (e.g. all enemies are frozen).
export function prepareEnemyTurn(state: CampaignBattleState, rng: () => number = Math.random): CampaignBattleState {
  if (state.phase !== 'enemy') return state;
  const steps: EnemyAttackStep[] = [];
  let partyHp = state.partyHp;
  const frozenEnemiesThisRound: { id: string; name: string; frozenTurns: number }[] = [];
  const enemies = state.enemies.map(e => ({ ...e }));
  for (const enemy of enemies) {
    if (enemy.defeated) continue;
    if (enemy.frozenTurns > 0) {
      frozenEnemiesThisRound.push({ id: enemy.id, name: enemy.name, frozenTurns: enemy.frozenTurns });
      enemy.frozenTurns -= 1;
      continue;
    }
    for (let i = 0; i < 3; i++) {
      const dart = simulateEnemyDart(enemy, rng);
      const dmg = Math.max(0, dart.value); // enemy damage = dart value, no armor reduction for simplicity
      partyHp = Math.max(0, partyHp - dmg);
      steps.push({
        enemyId: enemy.id,
        enemyName: enemy.name,
        dart,
        damage: dmg,
        partyHpAfter: partyHp,
      });
    }
  }
  return {
    ...state,
    enemies,
    pendingEnemyAttacks: steps,
    appliedEnemyAttacks: [],
    frozenEnemiesThisRound,
    // Keep awaiting Continue even when all enemies were frozen so the UI
    // can show the frozen popup before returning to the player phase.
    awaitContinue: true,
  };
}

// Apply the next pending enemy attack step. When the queue empties, return
// to the player phase (or defeat if party HP is 0). Each applied step is
// moved to `appliedEnemyAttacks` so the overlay can show all darts thrown
// so far cumulatively (dart 1, 2, 3…) rather than only the current one.
export function applyNextEnemyAttack(state: CampaignBattleState): CampaignBattleState {
  if (!state.pendingEnemyAttacks.length) {
    return finishEnemyTurn(state);
  }
  const [step, ...rest] = state.pendingEnemyAttacks;
  const log: VisitLogEntry[] = [...state.lastVisitLog, { kind: 'player_attack_step', step }];
  const partyHpLost = state.stats.partyHpLost + (step.damage > 0 ? step.damage : 0);
  const next: CampaignBattleState = {
    ...state,
    partyHp: step.partyHpAfter,
    pendingEnemyAttacks: rest,
    appliedEnemyAttacks: [...state.appliedEnemyAttacks, step],
    lastVisitLog: log,
    awaitContinue: rest.length > 0,
    stats: { ...state.stats, partyHpLost },
  };
  if (next.partyHp <= 0) {
    return { ...next, outcome: 'defeat', phase: 'player', pendingEnemyAttacks: [], appliedEnemyAttacks: [], awaitContinue: false };
  }
  if (!rest.length) {
    return finishEnemyTurn({ ...next, awaitContinue: false });
  }
  return next;
}

function finishEnemyTurn(state: CampaignBattleState): CampaignBattleState {
  if (state.partyHp <= 0) {
    return { ...state, outcome: 'defeat', phase: 'player', awaitContinue: false };
  }
  // Decrement player buff timers at the end of the round.
  const players = state.players.map(p => ({
    ...p,
    buffs: p.buffs
      .map(b => ({ ...b, turnsLeft: b.turnsLeft - 1 }))
      .filter(b => b.turnsLeft > 0),
  }));
  // Decrement enemy vulnerability timers (Time Warp) and Focus Buff
  // distract timers.
  const enemies = state.enemies.map(e => ({
    ...e,
    vulnerableTurns: Math.max(0, e.vulnerableTurns - 1),
    distractedTurns: Math.max(0, e.distractedTurns - 1),
    distractAmount: e.distractedTurns - 1 > 0 ? e.distractAmount : 0,
  }));
  return {
    ...state,
    players,
    enemies,
    phase: 'player',
    playerTurnIdx: 0,
    darts: [],
    resolvedDarts: [],
    visitEnemiesSnapshot: [],
    pendingEnemyAttacks: [],
    appliedEnemyAttacks: [],
    frozenEnemiesThisRound: [],
    visitNumber: state.visitNumber + 1,
    awaitContinue: false,
  };
}

// ── Coop power-ups ────────────────────────────────────────────────────

export function canActivateCoopPowerUp(state: CampaignBattleState, id: CoopPowerUpId): boolean {
  if (state.phase !== 'player') return false;
  if (state.darts.length > 0) return false; // only before throwing
  const def = getCoopPowerUp(id);
  if (!def) return false;
  // Per-player charge: only the current thrower's orb is checked.
  const thrower = state.players[state.playerTurnIdx];
  if (!thrower) return false;
  return thrower.powerUpCharge >= def.cost;
}

export function activateCoopPowerUp(state: CampaignBattleState, id: CoopPowerUpId): CampaignBattleState {
  if (!canActivateCoopPowerUp(state, id)) return state;
  const def = getCoopPowerUp(id)!;
  const throwerIdx = state.playerTurnIdx;
  const thrower = state.players[throwerIdx];
  // Deduct from the thrower's per-player orb only. Other players keep their
  // own charge.
  const newCharge = thrower.powerUpCharge - def.cost;
  const players = state.players.map((p, i) => i === throwerIdx
    ? { ...p, powerUpCharge: newCharge }
    : p);
  // Update the legacy shared charge to mirror the thrower for backwards compat.
  const powerUpCharge = newCharge;
  const next = applyCoopPowerUp({ ...state, players }, id, thrower, powerUpCharge);
  return { ...next, stats: { ...next.stats, powerUpsUsed: next.stats.powerUpsUsed + 1 } };
}

function applyCoopPowerUp(state: CampaignBattleState, id: CoopPowerUpId, thrower: CoopPlayer, charge: number): CampaignBattleState {
  if (id === 'coop_heal') {
    const healed = Math.min(state.partyMaxHp, state.partyHp + 80);
    return { ...state, partyHp: healed, powerUpCharge: charge };
  }
  if (id === 'coop_buff_power') {
    const kind: PlayerBuff['kind'] = 'power';
    const amount = 10;
    const buffId = `${kind}_${Date.now()}`;
    const players = state.players.map(p => ({
      ...p,
      buffs: [...p.buffs, { id: buffId, kind, amount, turnsLeft: 3, source: thrower.id }],
    }));
    return { ...state, players, powerUpCharge: charge };
  }
  if (id === 'coop_buff_acc') {
    // Focus Buff: distract every alive enemy. Reduce their accuracy and
    // precision for 3 turns. This is the in-game effect — darts are
    // user-tapped, so a player accuracy buff has no real-life effect.
    const enemies = state.enemies.map(e => e.defeated ? e : {
      ...e,
      distractedTurns: FOCUS_BUFF_TURNS,
      distractAmount: FOCUS_BUFF_DISTRACT_AMOUNT,
    });
    return { ...state, enemies, powerUpCharge: charge };
  }
  if (id === 'coop_freeze') {
    const enemies = state.enemies.map(e => e.defeated ? e : { ...e, frozenTurns: 2 });
    return { ...state, enemies, powerUpCharge: charge };
  }
  if (id === 'coop_shield') {
    // Represented as a buff on every player with kind 'shield' — the engine
    // doesn't reduce enemy damage directly, but we add a flat 40-HP party
    // shield by raising partyHp temporarily via a special buff. Simpler:
    // just heal 40 (acts as absorbtion).
    const healed = Math.min(state.partyMaxHp, state.partyHp + 40);
    return { ...state, partyHp: healed, powerUpCharge: charge };
  }
  // ── Advanced tier ───────────────────────────────────────────────────
  if (id === 'coop_meteor') {
    // 60 damage to every alive enemy, ignoring shields (shields are not
    // consumed since the meteor strikes directly).
    const enemies = state.enemies.map(e => {
      if (e.defeated) return e;
      const hp = Math.max(0, e.hp - 60);
      return { ...e, hp, defeated: hp <= 0 };
    });
    return { ...state, enemies, powerUpCharge: charge };
  }
  if (id === 'coop_phantom') {
    // The next 3 darts thrown by the current player auto-bullseye.
    return { ...state, phantomDarts: 3, powerUpCharge: charge };
  }
  if (id === 'coop_time_warp') {
    // All alive enemies take +50% damage for 3 rounds.
    const enemies = state.enemies.map(e => e.defeated ? e : { ...e, vulnerableTurns: 3 });
    return { ...state, enemies, powerUpCharge: charge };
  }
  if (id === 'coop_ressurect') {
    // Full party HP and clear all enemy shields.
    const enemies = state.enemies.map(e => ({ ...e, shields: [] }));
    return { ...state, partyHp: state.partyMaxHp, enemies, powerUpCharge: charge };
  }
  if (id === 'coop_apocalypse') {
    // Boss reward: 150 dmg to every alive enemy + freeze 2 turns + full heal.
    const enemies = state.enemies.map(e => {
      if (e.defeated) return e;
      const hp = Math.max(0, e.hp - 150);
      return { ...e, hp, defeated: hp <= 0, frozenTurns: 2, shields: [] };
    });
    return { ...state, enemies, partyHp: state.partyMaxHp, powerUpCharge: charge };
  }
  // ── Chapter 2 advanced power-ups ───────────────────────────────────
  if (id === 'coop_blizzard') {
    // 45 dmg to every alive enemy + freeze 1 turn.
    const enemies = state.enemies.map(e => {
      if (e.defeated) return e;
      const hp = Math.max(0, e.hp - 45);
      return { ...e, hp, defeated: hp <= 0, frozenTurns: Math.max(e.frozenTurns, 1) };
    });
    return { ...state, enemies, powerUpCharge: charge };
  }
  if (id === 'coop_frostbite') {
    // 40 dmg + distract (-25% acc/precision) for 3 turns on every alive enemy.
    const enemies = state.enemies.map(e => e.defeated ? e : {
      ...e,
      hp: Math.max(0, e.hp - 40),
      defeated: e.hp - 40 <= 0,
      distractedTurns: FOCUS_BUFF_TURNS,
      distractAmount: Math.max(e.distractAmount, 0.25),
    });
    return { ...state, enemies, powerUpCharge: charge };
  }
  if (id === 'coop_ice_lance') {
    // 120 dmg to the targeted enemy, ignoring shields.
    let targetIdx = state.targetIdx;
    let target = state.enemies[targetIdx];
    if (!target || target.defeated) {
      const firstAlive = state.enemies.findIndex(e => !e.defeated);
      if (firstAlive < 0) return { ...state, powerUpCharge: charge };
      targetIdx = firstAlive;
      target = state.enemies[targetIdx];
    }
    const enemies = state.enemies.map((e, i) => {
      if (i !== targetIdx || e.defeated) return e;
      const hp = Math.max(0, e.hp - 120);
      return { ...e, hp, defeated: hp <= 0 };
    });
    return { ...state, enemies, targetIdx, powerUpCharge: charge };
  }
  if (id === 'coop_winter_veil') {
    // Restore 60 HP (acts as shield absorption) + clear enemy shields.
    const healed = Math.min(state.partyMaxHp, state.partyHp + 60);
    const enemies = state.enemies.map(e => ({ ...e, shields: [] }));
    return { ...state, partyHp: healed, enemies, powerUpCharge: charge };
  }
  if (id === 'coop_glacial_doom') {
    // Boss reward: 180 dmg to every alive enemy + freeze 3 turns + full heal.
    const enemies = state.enemies.map(e => {
      if (e.defeated) return e;
      const hp = Math.max(0, e.hp - 180);
      return { ...e, hp, defeated: hp <= 0, frozenTurns: 3, shields: [] };
    });
    return { ...state, enemies, partyHp: state.partyMaxHp, powerUpCharge: charge };
  }
  return state;
}

// Add power-up charge based on a dart just thrown (called from addDart flow
// in the UI, or rolled into resolvePlayerVisit). Returns the new charge.
export function chargeFromDart(dart: CampaignDart, settings: Settings): number {
  const cfg = settings.powerUpScaling;
  let c = 0;
  const isBull = dart.value === 50 || dart.value === 25;
  if (isBull) c += cfg.chargePerBull;
  else if (dart.mult === 3) c += cfg.chargePerTriple;
  else if (dart.mult === 2 || dart.isDouble) c += cfg.chargePerDouble;
  c += dart.value * cfg.chargePerScorePoint;
  return c;
}

// ── Progress helpers ──────────────────────────────────────────────────
//
// Per-chapter gating: level 1 of any chapter is unlocked as soon as the
// chapter itself is unlocked. Each subsequent level requires the previous
// level in the same chapter to be cleared. The flat `highest_level_beaten`
// is kept for backwards compat with badges/titles that read it as a
// cumulative count.

export function isLevelUnlocked(levelId: number, highestBeaten: number): boolean {
  if (levelId <= 1) return true;
  return levelId <= highestBeaten + 1;
}

// Per-chapter version: level 1 is unlocked iff the chapter is unlocked;
// later levels require the previous level in the same chapter to be
// cleared (chapters[chapterId] >= levelId - 1).
export function isLevelUnlockedInChapter(
  chapterId: string,
  levelId: number,
  progress: { chapters?: Record<string, number> } | undefined | null,
): boolean {
  if (levelId <= 1) return true;
  const cleared = progress?.chapters?.[chapterId] ?? 0;
  return levelId <= cleared + 1;
}

export function nextLevelId(levelId: number): number | null {
  const idx = CAMPAIGN_LEVELS.levels.findIndex(l => l.level_id === levelId);
  if (idx < 0 || idx + 1 >= CAMPAIGN_LEVELS.levels.length) return null;
  return CAMPAIGN_LEVELS.levels[idx + 1].level_id;
}

// Returns the next level id within a chapter, or null if this was the last.
export function nextLevelIdInChapter(chapterId: string, levelId: number): number | null {
  const chapter = getChapter(chapterId);
  if (!chapter) return null;
  const idx = chapter.levels.findIndex(l => l.level_id === levelId);
  if (idx < 0 || idx + 1 >= chapter.levels.length) return null;
  return chapter.levels[idx + 1].level_id;
}

// Returns the chapter a level belongs to (by level id, first match wins).
export function chapterForLevel(levelId: number): CampaignChapter | undefined {
  return CAMPAIGN_CHAPTERS.find(ch => ch.levels.some(l => l.level_id === levelId));
}
