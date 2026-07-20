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
  { id: 'coop_ice_nova', name: 'Ice Nova', icon: '🌨️', desc: 'Deal 40 damage to all enemies and freeze them for 1 turn.', cost: 100, tier: 'advanced' },
  { id: 'coop_frost_armor', name: 'Frost Armor', icon: '🧊', desc: 'Party gains 20 armor for 3 turns.', cost: 90, tier: 'advanced' },
  { id: 'coop_blizzard', name: 'Blizzard', icon: '🌪️', desc: 'Deal 80 damage to all enemies and freeze them for 2 turns.', cost: 130, tier: 'advanced' },
  // ── Advanced tier — Chapter 3 (Volcanic Forge) ─────────────────────
  { id: 'coop_lava_burst', name: 'Lava Burst', icon: '🌋', desc: 'Deal 100 damage to a single enemy and 40 splash to all others.', cost: 110, tier: 'advanced' },
  { id: 'coop_magma_armor', name: 'Magma Armor', icon: '🔥', desc: 'Party gains 30 armor for 3 turns and reflects 10 damage per hit.', cost: 120, tier: 'advanced' },
  { id: 'coop_inferno', name: 'Inferno', icon: '💥', desc: 'Deal 120 damage to all enemies and apply burn (10 dmg/turn for 3 turns).', cost: 140, tier: 'advanced' },
];

export const COOP_CLASSES: CoopClassDef[] = [
  { id: 'tank', name: 'Tank', icon: '🛡️', desc: 'High HP and armor. Slower power growth.', bonusHealth: 80, bonusArmor: 10, bonusPower: 0, chargeBonus: 0 },
  { id: 'berserker', name: 'Berserker', icon: '⚔️', desc: 'High power. Lower HP but charges power-ups faster.', bonusHealth: 0, bonusArmor: 0, bonusPower: 10, chargeBonus: 0.2 },
  { id: 'mage', name: 'Mage', icon: '🔮', desc: 'Balanced stats. Charges power-ups faster.', bonusHealth: 20, bonusArmor: 0, bonusPower: 5, chargeBonus: 0.1 },
  { id: 'ranger', name: 'Ranger', icon: '🏹', desc: 'Balanced stats with extra starting armor.', bonusHealth: 10, bonusArmor: 5, bonusPower: 5, chargeBonus: 0 },
];

export const COOP_PASSIVES: CoopPassiveDef[] = [
  { id: 'coop_extra_hp', name: 'Extra HP', icon: '❤️', desc: '+40 starting HP.', bonusHealth: 40 },
  { id: 'coop_extra_armor', name: 'Extra Armor', icon: '🛡️', desc: '+5 starting armor.', bonusArmor: 5 },
  { id: 'coop_extra_power', name: 'Extra Power', icon: '⚡', desc: '+5 starting power.', bonusPower: 5 },
  { id: 'coop_extra_charge', name: 'Quick Charge', icon: '🔋', desc: '+0.2 power-up charge rate.', chargeBonus: 0.2 },
];

// Placeholder — replaced below with a real helper once we know the player's
// progress and the scaling config from settings.
export function chargeFromDart(dart: CampaignDart, settings: Settings): number {
  const cfg = settings.powerUpScaling;
  const base = dart.value > 0 ? 1 : 0.5;
  const big = dart.value >= 40 ? 0.5 : 0;
  return Math.min(cfg.chargeMax, base + big);
}

// Default per-player coop progress used when a player has never played a
// campaign level before.
export function defaultPlayerCoopProgress(): PlayerCoopProgress {
  return {
    unlockedLevels: [],
    completedLevels: [],
    stars: {},
    powerUps: [],
    class: null,
    passives: [],
    attributePoints: { health: 0, armor: 0, power: 0 },
    powerUpCharge: 0,
    coopXP: 0,
    coopLevel: 1,
  };
}

// Resolve a player's current coop stats from their base attributes + class
// and passive bonuses. Used both at battle start and for display in the
// lobby.
export function resolveCoopPlayer(player: Player, settings: Settings): CoopPlayer {
  const cfg = settings.powerUpScaling;
  const progress = player.coopProgress || defaultPlayerCoopProgress();
  const cls = COOP_CLASSES.find(c => c.id === progress.class);
  const passives = COOP_PASSIVES.filter(p => progress.passives.includes(p.id));

  const baseHealth = cfg.attributeStartHealth
    + (progress.attributePoints.health * cfg.healthPerPoint)
    + (cls?.bonusHealth || 0)
    + passives.reduce((a, p) => a + (p.bonusHealth || 0), 0);
  const baseArmor = cfg.attributeStartArmor
    + (progress.attributePoints.armor * cfg.armorPerPoint)
    + (cls?.bonusArmor || 0)
    + passives.reduce((a, p) => a + (p.bonusArmor || 0), 0);
  const basePower = cfg.attributeStartPower
    + (progress.attributePoints.power * cfg.powerPerPoint)
    + (cls?.bonusPower || 0)
    + passives.reduce((a, p) => a + (p.bonusPower || 0), 0);

  return {
    id: player.id,
    name: player.name,
    color: player.color,
    hp: baseHealth,
    maxHp: baseHealth,
    armor: Math.min(cfg.armorMax, baseArmor),
    power: Math.min(cfg.powerMax, basePower),
    class: progress.class,
    passives: progress.passives,
    powerUpCharge: progress.powerUpCharge || 0,
    buffs: [],
    shields: [],
    vulnerableTurns: 0,
    defeated: false,
    coopXP: progress.coopXP || 0,
    coopLevel: progress.coopLevel || 1,
  };
}

// Compute the passive party bonus from unlocked passives across all
// participating players. Used in the lobby to show the party's effective
// stats before entering battle.
export function computePartyPassiveBonus(players: CoopPlayer[], settings: Settings): { health: number; armor: number; power: number } {
  const cfg = settings.powerUpScaling;
  let health = 0, armor = 0, power = 0;
  for (const p of players) {
    const progress = p.class; // class already baked into resolveCoopPlayer
    // Passives are already applied in resolveCoopPlayer per-player. Here we
    // sum the party-wide passive bonuses for display only.
    void progress;
    health += 0;
    armor += 0;
    power += 0;
  }
  void cfg;
  return { health, armor, power };
}

// Initialize a new campaign battle state for a level. Sets up enemies from
// the level definition, players from their resolved coop stats, and the
// starting turn order.
export function initCampaignBattle(
  level: CampaignLevel,
  players: CoopPlayer[],
  settings: Settings,
): CampaignBattleState {
  const enemyDefs = level.enemies.map(def => {
    const base = ENEMY_DATABASE.find(e => e.id === def.enemyId);
    if (!base) throw new Error(`Unknown enemy id: ${def.enemyId}`);
    return { ...base, ...def } as EnemyDef;
  });

  const enemies: ActiveEnemy[] = enemyDefs.map((def, i) => {
    const hp = def.hp || 100;
    return {
      id: `${def.id}-${i}`,
      defId: def.id,
      name: def.name,
      icon: def.icon,
      hp,
      maxHp: hp,
      armor: def.armor || 0,
      accuracy: def.accuracy || 0.5,
      precision: def.precision || 0.5,
      damage: def.damage || 10,
      attackType: def.attackType || 'single',
      shields: [],
      buffs: [],
      defeated: false,
      vulnerableTurns: 0,
      attackCooldown: 0,
    };
  });

  return {
    levelId: level.id,
    chapterId: level.chapterId,
    players: players.map(p => ({ ...p })),
    enemies,
    darts: [],
    resolvedDarts: [],
    targetIdx: 0,
    playerTurnIdx: 0,
    phantomDarts: 0,
    visitEnemiesSnapshot: [],
    outcome: 'ongoing',
    powerUpCharge: 0,
    passiveBonus: { health: 0, armor: 0, power: 0 },
    stats: {
      dartsThrown: 0,
      damageDealt: 0,
      enemiesDefeated: 0,
      turnsTaken: 0,
    },
    turn: 1,
    enemyAttackSteps: [],
    log: [],
  };
}

// Add a player's dart to the battle. Resolves damage, shields, and
// power-up charge. Returns the new state.
export function addDart(
  state: CampaignBattleState,
  dart: CampaignDart,
  settings: Settings,
): CampaignBattleState {
  if (state.outcome !== 'ongoing') return state;

  const players = state.players.map(p => ({ ...p }));
  const enemies = state.enemies.map(e => ({ ...e, shields: e.shields.map(s => ({ ...s })) }));
  const throwerIdx = state.playerTurnIdx;
  const thrower = players[throwerIdx];
  const power = effectivePower(thrower);
  const targetIdx = state.targetIdx;
  const t = enemies[targetIdx];
  const phantomDarts = state.phantomDarts;

  // Snapshot enemies at the start of this player's visit (first dart of
  // the visit) so undo can restore shields/hp.
  const visitEnemiesSnapshot = state.darts.length === 0
    ? enemies.map(e => ({ ...e, shields: e.shields.map(s => ({ ...s })) }))
    : state.visitEnemiesSnapshot;

  let step: ResolvedDart;

  if (phantomDarts > 0) {
    // Phantom darts auto-hit bullseye (50) and ignore shields.
    const dmg = computePlayerDartDamage({ ...dart, value: 50, hit: true }, power, t.armor);
    const finalDmg = t.vulnerableTurns > 0 ? Math.round(dmg * 1.5) : dmg;
    t.hp = Math.max(0, t.hp - finalDmg);
    const defeated = t.hp <= 0;
    if (defeated) t.defeated = true;
    step = {
      dart: { ...dart, value: 50, hit: true }, damage: finalDmg, kind: defeated ? 'defeated' : 'damage',
      enemyId: t.id, enemyName: t.name, hpAfter: t.hp,
    };
  } else if (!dart.hit) {
    step = {
      dart, damage: 0, kind: 'miss',
      enemyId: t.id, enemyName: t.name, hpAfter: t.hp,
    };
  } else if (t.shields.length > 0) {
    // Hit a shield. Matching segment breaks it (0 dmg); non-matching is
    // absorbed (0 dmg).
    const shield = t.shields[0];
    const seg = dart.segment;
    const matches = shield.segment === seg || (shield.segment === 'any' && seg !== undefined);
    if (matches) {
      t.shields = t.shields.slice(1);
    }
    step = {
      dart, damage: 0, kind: matches ? 'shield-break' : 'shield-absorb',
      enemyId: t.id, enemyName: t.name, hpAfter: t.hp,
    };
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

// Per-dart damage = round((dartValue + power) * (1 − armor/100)), min 1 on a
// hit. Armor is a percentage (e.g. armor 10 reduces damage by 10%). Misses
// deal 0.
export function computePlayerDartDamage(dart: CampaignDart, attackerPower: number, targetArmor: number): number {
  if (dart.value <= 0) return 0;
  const base = Math.max(0, dart.value + attackerPower);
  const armorPct = Math.max(0, targetArmor);
  const mitigated = base * (1 - armorPct / 100);
  return Math.max(1, Math.round(mitigated));
}

// After a player has thrown all their darts (and the damage has already
// been applied dart-by-dart via `addDart`), `resolvePlayerVisit` finalizes
// the visit: clears the snapshot, advances the turn, and triggers enemy
// attacks if all players have thrown.
export function resolvePlayerVisit(state: CampaignBattleState): CampaignBattleState {
  return {
    ...state,
    visitEnemiesSnapshot: [],
    playerTurnIdx: (state.playerTurnIdx + 1) % state.players.length,
  };
}

// Enemy turn: each alive enemy attacks the party. Returns a new state with
// the enemy attack steps and updated player HP.
export function enemyTurn(state: CampaignBattleState, settings: Settings): CampaignBattleState {
  const cfg = settings.powerUpScaling;
  const players = state.players.map(p => ({ ...p }));
  const attackSteps: EnemyAttackStep[] = [];
  const log: VisitLogEntry[] = [];

  for (const e of state.enemies) {
    if (e.defeated || e.attackCooldown > 0) continue;

    // Pick a target — lowest HP alive player.
    const alive = players.filter(p => !p.defeated);
    if (!alive.length) break;
    const target = alive.reduce((a, b) => a.hp < b.hp ? a : b);

    // Roll for hit based on accuracy.
    const hit = Math.random() < e.accuracy;
    if (!hit) {
      attackSteps.push({ enemyId: e.id, targetId: target.id, hit: false, damage: 0 });
      continue;
    }

    // Roll for damage based on precision (variance).
    const variance = 1 + (Math.random() * 2 - 1) * (1 - e.precision);
    const raw = e.damage * variance;
    // Apply player armor (percentage reduction).
    const armorPct = Math.min(cfg.armorMax, target.armor);
    const mitigated = raw * (1 - armorPct / 100);
    const dmg = Math.max(1, Math.round(mitigated));

    // Apply party shield (absorb) first.
    let remaining = dmg;
    const partyShield = players.find(p => p.shields.length > 0);
    if (partyShield) {
      const shield = partyShield.shields[0];
      const absorbed = Math.min(shield.amount, remaining);
      shield.amount -= absorbed;
      remaining -= absorbed;
      if (shield.amount <= 0) partyShield.shields = partyShield.shields.slice(1);
    }

    if (remaining > 0) {
      target.hp = Math.max(0, target.hp - remaining);
      if (target.hp <= 0) target.defeated = true;
    }

    attackSteps.push({ enemyId: e.id, targetId: target.id, hit: true, damage: dmg });
    log.push({ enemyId: e.id, enemyName: e.name, targetId: target.id, targetName: target.name, damage: dmg });
  }

  const anyAlive = players.some(p => !p.defeated);
  const outcome: CampaignBattleState['outcome'] = !anyAlive ? 'defeat' : state.outcome;

  return {
    ...state,
    players,
    enemyAttackSteps: attackSteps,
    log: [...state.log, ...log],
    outcome,
    turn: state.turn + 1,
  };
}

// Activate a power-up. Applies its effect immediately and deducts the
// charge.
export function activatePowerUp(state: CampaignBattleState, powerUpId: CoopPowerUpId, settings: Settings): CampaignBattleState {
  const cfg = settings.powerUpScaling;
  const def = COOP_POWER_UPS.find(p => p.id === powerUpId);
  if (!def) return state;

  const throwerIdx = state.playerTurnIdx;
  const players = state.players.map(p => ({ ...p }));
  const thrower = players[throwerIdx];
  const needed = chargesNeededFor(thrower, settings);
  if (thrower.powerUpCharge < needed) return state;

  thrower.powerUpCharge -= needed;
  const enemies = state.enemies.map(e => ({ ...e, shields: e.shields.map(s => ({ ...s })) }));

  switch (powerUpId) {
    case 'coop_heal': {
      const heal = 80;
      for (const p of players) {
        if (p.defeated) continue;
        p.hp = Math.min(p.maxHp, p.hp + heal);
      }
      break;
    }
    case 'coop_buff_power': {
      for (const p of players) {
        if (p.defeated) continue;
        p.buffs.push({ kind: 'power', amount: 10, turns: FOCUS_BUFF_TURNS });
      }
      break;
    }
    case 'coop_buff_acc': {
      for (const e of enemies) {
        if (e.defeated) continue;
        e.buffs.push({ kind: 'distract', amount: FOCUS_BUFF_DISTRACT_AMOUNT, turns: FOCUS_BUFF_TURNS });
      }
      break;
    }
    case 'coop_freeze': {
      for (const e of enemies) {
        if (e.defeated) continue;
        e.attackCooldown = 2;
      }
      break;
    }
    case 'coop_shield': {
      const shield: ShieldLayer = { amount: 40, segment: 'any' };
      for (const p of players) {
        if (p.defeated) continue;
        p.shields.push({ ...shield });
      }
      break;
    }
    case 'coop_meteor': {
      for (const e of enemies) {
        if (e.defeated) continue;
        e.hp = Math.max(0, e.hp - 60);
        if (e.hp <= 0) e.defeated = true;
      }
      break;
    }
    case 'coop_phantom': {
      // Phantom darts are tracked on the state; addDart consumes them.
      // We bump the thrower's phantomDarts counter via a buff.
      thrower.buffs.push({ kind: 'phantom', amount: 3, turns: 1 });
      break;
    }
    case 'coop_time_warp': {
      for (const e of enemies) {
        if (e.defeated) continue;
        e.vulnerableTurns = 3;
      }
      break;
    }
    case 'coop_ressurect': {
      for (const p of players) {
        p.hp = p.maxHp;
        p.defeated = false;
        p.shields = [];
      }
      for (const e of enemies) {
        e.shields = [];
      }
      break;
    }
    case 'coop_apocalypse': {
      for (const e of enemies) {
        if (e.defeated) continue;
        e.hp = Math.max(0, e.hp - 150);
        if (e.hp <= 0) e.defeated = true;
        e.attackCooldown = 2;
      }
      for (const p of players) {
        if (p.defeated) continue;
        p.hp = p.maxHp;
      }
      break;
    }
    case 'coop_ice_nova': {
      for (const e of enemies) {
        if (e.defeated) continue;
        e.hp = Math.max(0, e.hp - 40);
        if (e.hp <= 0) e.defeated = true;
        e.attackCooldown = Math.max(e.attackCooldown, 1);
      }
      break;
    }
    case 'coop_frost_armor': {
      for (const p of players) {
        if (p.defeated) continue;
        p.buffs.push({ kind: 'armor', amount: 20, turns: 3 });
      }
      break;
    }
    case 'coop_blizzard': {
      for (const e of enemies) {
        if (e.defeated) continue;
        e.hp = Math.max(0, e.hp - 80);
        if (e.hp <= 0) e.defeated = true;
        e.attackCooldown = 2;
      }
      break;
    }
    case 'coop_lava_burst': {
      const target = enemies[state.targetIdx];
      if (target && !target.defeated) {
        target.hp = Math.max(0, target.hp - 100);
        if (target.hp <= 0) target.defeated = true;
      }
      for (const e of enemies) {
        if (e.defeated || e.id === target?.id) continue;
        e.hp = Math.max(0, e.hp - 40);
        if (e.hp <= 0) e.defeated = true;
      }
      break;
    }
    case 'coop_magma_armor': {
      for (const p of players) {
        if (p.defeated) continue;
        p.buffs.push({ kind: 'armor', amount: 30, turns: 3 });
        p.buffs.push({ kind: 'reflect', amount: 10, turns: 3 });
      }
      break;
    }
    case 'coop_inferno': {
      for (const e of enemies) {
        if (e.defeated) continue;
        e.hp = Math.max(0, e.hp - 120);
        if (e.hp <= 0) e.defeated = true;
        e.buffs.push({ kind: 'burn', amount: 10, turns: 3 });
      }
      break;
    }
  }

  void cfg;
  const anyAlive = enemies.some(e => !e.defeated);
  const outcome: CampaignBattleState['outcome'] = !anyAlive ? 'victory' : state.outcome;

  return {
    ...state,
    players,
    enemies,
    outcome,
  };
}

// Helper: per-power-up charges needed to activate, falling back to
// chargeMax when unset.
function chargesNeededFor(player: CoopPlayer, settings: Settings): number {
  const cfg = settings.powerUpScaling;
  const needed = cfg.chargesNeeded && cfg.chargesNeeded['coop_' + (player.class || '')]
    ? cfg.chargesNeeded['coop_' + (player.class || '')]
    : cfg.chargeMax;
  return Math.min(cfg.chargeMax, Math.max(1, needed));
}
