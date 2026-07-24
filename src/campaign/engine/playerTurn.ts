import type {
  CampaignBattleState,
  CampaignDart,
  CampaignLevel,
  ActiveEnemy,
  CoopPlayer,
  EnemyDatabase,
  PlayerBuff,
  ResolvedDart,
} from '../types';
import type { Player, Settings } from '../../types';
import { ENEMY_DATABASE } from '../enemyDatabase';
import { nextInstanceId } from './instanceIds';
import { computePartyPassiveBonus, type PartyPassiveBonus } from './classes';
import { toCoopPlayer } from './party';
import { dartMatchesShield, describeShield } from './shields';
import { finishEnemyTurn } from './enemyAi';
import { effectiveAttributes } from '../../logic';

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
  const party = players.map(p => {
    const equippedId = p.powerUps?.coopActive ?? null;
    const startCharge = equippedId ? (startMap[equippedId] || 0) : 0;
    return toCoopPlayer(p, settings, Math.max(0, Math.min(chargeCap, startCharge)));
  });
  const passiveBonus = computePartyPassiveBonus(players);
  const healthMax = Number.isFinite(cfg?.healthMax) ? (cfg?.healthMax as number) : Number.MAX_SAFE_INTEGER;
  const armorMax = Number.isFinite(cfg?.armorMax) ? (cfg?.armorMax as number) : Number.MAX_SAFE_INTEGER;
  const powerMax = Number.isFinite(cfg?.powerMax) ? (cfg?.powerMax as number) : Number.MAX_SAFE_INTEGER;
  const startHealth = Number.isFinite(cfg?.attributeStartHealth) ? (cfg?.attributeStartHealth as number) : 0;
  const baseAvg = party.length
    ? Math.max(1, Math.min(healthMax, Math.round(players.reduce((acc, p) => {
        const attrs = effectiveAttributes(p, settings);
        const h = attrs.health;
        return acc + (typeof h === 'number' && Number.isFinite(h) ? Math.max(1, Math.min(healthMax, h)) : startHealth);
      }, 0) / players.length)))
    : 1;
  for (const cp of party) {
    cp.maxHp = Math.min(healthMax, cp.maxHp + passiveBonus.health);
    cp.hp = cp.maxHp;
    cp.power = Math.min(powerMax, cp.power + passiveBonus.power);
    cp.armor = Math.min(armorMax, cp.armor + passiveBonus.armor);
  }
  const partyMaxHp = Math.max(1, baseAvg + passiveBonus.health);
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

export function addDart(
  state: CampaignBattleState,
  base: number,
  mult: number,
  labelOverride?: string,
  isBull?: boolean,
  settings?: Settings,
  maxDarts?: number,
): CampaignBattleState {
  if (state.phase !== 'player') return state;
  if (state.darts.length >= (maxDarts ?? 3)) return state;
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
  if (phantomDarts > 0 && base !== 0) {
    dart = { value: 50, label: '👻 Bull', base: 50, mult: 2, isDouble: true, isBull: true };
    phantomDarts = phantomDarts - 1;
  }
  const chargeCap = settings?.powerUpScaling?.chargeMax ?? 100;
  const gained = settings ? chargeFromDart(dart, settings) : 0;
  const throwerIdx = state.playerTurnIdx;
  const players = state.players.map((p, i) => i === throwerIdx
    ? { ...p, powerUpCharge: Math.min(chargeCap, p.powerUpCharge + gained) }
    : p);
  const powerUpCharge = players[throwerIdx].powerUpCharge;
  const visitEnemiesSnapshot = state.darts.length === 0
    ? state.enemies.map(e => ({ ...e, shields: e.shields.map(s => ({ ...s })) }))
    : state.visitEnemiesSnapshot;
  const thrower = players[throwerIdx];
  if (!thrower) {
    return { ...state, players, darts: [...state.darts, dart], phantomDarts, visitEnemiesSnapshot, powerUpCharge };
  }
  const power = effectivePower(thrower);
  // Crit: chance to double flat damage (before armor mitigation).
  // Sources: player's base crit attribute + crit buffs (percentage bonus).
  // crit_guarantee buffs force the next N damage cards to crit.
  // crit_multiplier buffs increase the crit multiplier (e.g. 3x instead of 2x).
  const critBuff = thrower.buffs.find(b => b.kind === 'crit');
  const critBonus = critBuff ? critBuff.amount : 0;
  const baseCritChance = thrower.crit + critBonus;
  const guaranteeBuff = thrower.buffs.find(b => b.kind === 'crit_guarantee');
  const isGuaranteed = !!guaranteeBuff && guaranteeBuff.amount > 0;
  const critMultBuff = thrower.buffs.find(b => b.kind === 'crit_multiplier');
  const critMult = critMultBuff ? critMultBuff.amount : 2;
  const surgeBuff = thrower.buffs.find(b => b.kind === 'surge');
  const surgeMult = surgeBuff ? surgeBuff.amount : 1;
  const hotStreakBuff = thrower.buffs.find(b => b.kind === 'hot_streak');
  const hotStreakBonus = hotStreakBuff ? hotStreakBuff.amount * (state.darts.length + 1) : 0;
  const adjustedPower = power + hotStreakBonus;
  let targetIdx = state.targetIdx;
  let target = state.enemies[targetIdx];
  if (!target || target.defeated) {
    const firstAlive = state.enemies.findIndex(e => !e.defeated);
    if (firstAlive < 0) {
      return { ...state, players, darts: [...state.darts, dart], phantomDarts, visitEnemiesSnapshot, powerUpCharge };
    }
    targetIdx = firstAlive;
    target = state.enemies[targetIdx];
  }
  const enemies = state.enemies.map(e => ({ ...e, shields: [...e.shields] }));
  const t = enemies[targetIdx];
  let step: ResolvedDart;
  let playersAfterHit = players;
  if (t.shields.length > 0) {
    const shieldIdx = 0;
    const shield = t.shields[shieldIdx];
    if (dartMatchesShield(dart, shield)) {
      t.shields = t.shields.filter((_, i) => i !== shieldIdx);
      step = { dart, damage: 0, kind: 'shield_break', shieldTarget: describeShield(shield), enemyId: t.id, enemyName: t.name, hpAfter: t.hp, attackerPower: power, targetArmor: t.armor, vulnerable: t.vulnerableTurns > 0 };
    } else {
      step = { dart, damage: 0, kind: 'miss', enemyId: t.id, enemyName: t.name, hpAfter: t.hp, attackerPower: power, targetArmor: t.armor, vulnerable: t.vulnerableTurns > 0 };
    }
  } else {
    const isCrit = isGuaranteed || (Math.random() * 100) < baseCritChance;
    const flatDmg = isCrit ? dart.value * critMult : dart.value;
    const dmg = computePlayerDartDamage({ ...dart, value: flatDmg }, adjustedPower, t.armor);
    const vulnerable = t.vulnerableTurns > 0;
    const surgeDmg = Math.round(dmg * surgeMult);
    const finalDmg = vulnerable ? Math.round(surgeDmg * 1.5) : surgeDmg;
    t.hp = Math.max(0, t.hp - finalDmg);
    const defeated = t.hp <= 0;
    if (defeated) t.defeated = true;
    // Consume one guaranteed-crit charge on a damage hit.
    if (isGuaranteed) {
      playersAfterHit = players.map((p, i) => i === throwerIdx
        ? { ...p, buffs: p.buffs.map(b => b.id === guaranteeBuff!.id ? { ...b, amount: b.amount - 1 } : b).filter(b => !(b.kind === 'crit_guarantee' && b.amount <= 0)) }
        : p);
    }
    step = { dart, damage: finalDmg, kind: defeated ? 'defeated' : 'damage', enemyId: t.id, enemyName: t.name, hpAfter: t.hp, attackerPower: power, targetArmor: t.armor, vulnerable, crit: isCrit, critMult: isCrit ? critMult : undefined };
  }
  const anyAlive = enemies.some(e => !e.defeated);
  const outcome: CampaignBattleState['outcome'] = !anyAlive ? 'victory' : state.outcome;
  const dartDamage = step.kind === 'damage' || step.kind === 'defeated' ? step.damage : 0;
  const dartKill = step.kind === 'defeated' ? 1 : 0;
  const playersWithStats = playersAfterHit.map((p, i) => i === throwerIdx
    ? { ...p, kills: (p.kills ?? 0) + dartKill, damageDealt: (p.damageDealt ?? 0) + dartDamage }
    : p);
  return {
    ...state,
    players: playersWithStats,
    enemies,
    darts: [...state.darts, dart],
    resolvedDarts: [...state.resolvedDarts, step],
    targetIdx,
    phantomDarts,
    visitEnemiesSnapshot,
    outcome,
    powerUpCharge,
    stats: { ...state.stats, dartsThrown: state.stats.dartsThrown + 1, damageDealt: state.stats.damageDealt + dartDamage, enemiesDefeated: state.stats.enemiesDefeated + dartKill },
  };
}

export function undoDart(state: CampaignBattleState, settings?: Settings): CampaignBattleState {
  if (!state.darts.length) return state;
  const enemies = state.visitEnemiesSnapshot.length
    ? state.visitEnemiesSnapshot.map(e => ({ ...e, shields: e.shields.map(s => ({ ...s })) }))
    : state.enemies;
  const resolvedDarts = state.resolvedDarts.slice(0, -1);
  const darts = state.darts.slice(0, -1);
  const visitEnemiesSnapshot = darts.length === 0 ? [] : state.visitEnemiesSnapshot;
  const anyAlive = enemies.some(e => !e.defeated);
  const outcome: CampaignBattleState['outcome'] = !anyAlive ? 'victory' : 'ongoing';
  const undoneDart = state.darts[state.darts.length - 1];
  const revert = settings ? chargeFromDart(undoneDart, settings) : 0;
  const throwerIdx = state.playerTurnIdx;
  const players = state.players.map((p, i) => i === throwerIdx
    ? { ...p, powerUpCharge: Math.max(0, p.powerUpCharge - revert) }
    : p);
  const powerUpCharge = Math.max(0, state.powerUpCharge - revert);
  return { ...state, players, enemies, darts, resolvedDarts, visitEnemiesSnapshot, outcome, powerUpCharge };
}

export function setTarget(state: CampaignBattleState, enemyId: string): CampaignBattleState {
  const idx = state.enemies.findIndex(e => e.id === enemyId);
  if (idx < 0) return state;
  return { ...state, targetIdx: idx };
}

export function effectivePower(player: CoopPlayer): number {
  const buff = player.buffs.filter(b => b.kind === 'power').reduce((a, b) => a + b.amount, 0);
  return Math.max(0, player.power + buff);
}

export function computePlayerDartDamage(dart: CampaignDart, attackerPower: number, targetArmor: number): number {
  if (dart.value <= 0) return 0;
  const base = Math.max(0, dart.value + attackerPower);
  const armorPct = Math.max(0, targetArmor);
  const mitigated = base * (1 - armorPct / 100);
  return Math.max(1, Math.round(mitigated));
}

export function resolvePlayerVisit(state: CampaignBattleState, hasPlayedCards = false): CampaignBattleState {
  if (state.phase !== 'player') return state;
  if (!state.darts.length && !hasPlayedCards) return state;
  // Consume one-time visit buffs (surge, hot_streak) after the visit.
  const thrower = state.players[state.playerTurnIdx];
  const players = thrower
    ? state.players.map(p => p.id === thrower.id
        ? { ...p, buffs: p.buffs.filter(b => b.kind !== 'surge' && b.kind !== 'hot_streak') }
        : p)
    : state.players;
  return advanceAfterPlayerVisit({
    ...state,
    players,
    darts: [],
    resolvedDarts: [],
    visitEnemiesSnapshot: [],
    stats: { ...state.stats, visitsUsed: state.stats.visitsUsed + 1 },
  });
}

function advanceAfterPlayerVisit(state: CampaignBattleState): CampaignBattleState {
  if (state.outcome === 'victory') {
    return { ...state, phase: 'player', darts: [], resolvedDarts: [], visitEnemiesSnapshot: [], awaitContinue: false };
  }
  const nextIdx = state.playerTurnIdx + 1;
  if (nextIdx < state.players.length) {
    return { ...state, playerTurnIdx: nextIdx, darts: [], resolvedDarts: [], visitEnemiesSnapshot: [], awaitContinue: false };
  }
  return { ...state, phase: 'enemy', darts: [], resolvedDarts: [], visitEnemiesSnapshot: [], awaitContinue: false };
}

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

export { finishEnemyTurn };
export type { PlayerBuff, PartyPassiveBonus };
