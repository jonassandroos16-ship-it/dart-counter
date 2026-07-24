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

// ── Battle initialization ─────────────────────────────────────────────────────

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
    ? Math.max(1, Math.min(healthMax, Math.round(players.reduce((s, p) => s + effectiveAttributes(p, settings).health + passiveBonus.health, startHealth) / players.length)))
    : 100;
  const partyMaxHp = Math.max(1, baseAvg + passiveBonus.health);
  const powerUpCharge = party.length ? party[0].powerUpCharge : 0;
  const enemies: ActiveEnemy[] = level.enemies.map((defId) => {
    const def = db[defId];
    if (!def) throw new Error(`Unknown enemy id: ${defId}`);
    const hp = Math.max(1, def.max_hp);
    return {
      defId,
      name: def.name,
      difficulty: def.difficulty,
      hp,
      maxHp: hp,
      armor: def.armor,
      accuracy: def.accuracy,
      precision: def.precision,
      shields: def.shields,
      defeated: false,
      instanceId: nextInstanceId(),
      weakenedTurns: 0,
      weakenAmount: 0,
    };
  });

  const players2: CoopPlayer[] = party.map((p, i) => ({
    ...p,
    hp: Math.min(p.maxHp, p.hp + startHealth),
    maxHp: Math.min(healthMax, p.maxHp + startHealth),
    power: Math.min(powerMax, p.power),
    armor: Math.min(armorMax, p.armor),
  }));

  return {
    phase: 'player',
    visitNumber: 1,
    playerTurnIdx: 0,
    players: players2,
    enemies,
    targetIdx: 0,
    darts: [],
    resolvedDarts: [],
    pendingEnemyAttacks: [],
    appliedEnemyAttacks: [],
    frozenEnemiesThisRound: [],
    partyHp: partyMaxHp,
    partyMaxHp,
    outcome: 'ongoing',
    powerUpCharge,
    visitEnemiesSnapshot: [],
    stats: { enemiesDefeated: 0, damageDealt: 0 },
  };
}

// ── Player turn: addDart ───────────────────────────────────────────────────────

export function addDart(
  state: CampaignBattleState,
  base: number,
  mult: number,
  label: string,
  isBull: boolean = false,
): CampaignBattleState {
  if (state.phase !== 'player') return state;
  if (state.outcome !== 'ongoing') return state;
  if (state.darts.length >= 3) return state;

  const thrower = state.players[state.playerTurnIdx];
  if (!thrower) return state;

  const powerMax = Number.MAX_SAFE_INTEGER;
  const basePower = thrower ? Math.min(powerMax, thrower.power + thrower.buffs.filter(b => b.kind === 'power').reduce((s, b) => s + b.amount, 0)) : 0;
  const damage = Math.max(0, Math.round(base * mult * (1 + basePower / 100)));

  const dart: CampaignDart = {
    value: base,
    label,
    base,
    mult,
    isDouble: mult === 2,
    isTriple: mult === 3,
    isBull,
    damage,
    throwerId: thrower.id,
    throwerName: thrower.name,
    throwerColor: thrower.color,
  };

  const darts = [...state.darts, dart];
  const resolvedDarts = [...state.resolvedDarts];
  let enemies = state.enemies;
  let stats = state.stats;
  let partyHp = state.partyHp;

  // Resolve immediately against the targeted enemy
  const targetIdx = state.targetIdx;
  const target = enemies[targetIdx];
  if (target && !target.defeated) {
    const dartMatches = dartMatchesShield(dart, target.shields);
    if (dartMatches) {
      let dmg = dart.damage;
      // Apply enemy armor reduction
      dmg = Math.max(1, Math.round(dmg * (1 - target.armor / 100)));
      // Apply weaken debuff (damage reduction)
      if (target.weakenedTurns > 0 && target.weakenAmount > 0) {
        dmg = Math.max(1, Math.round(dmg * (1 - target.weakenAmount / 100)));
      }
      const newHp = Math.max(0, target.hp - dmg);
      enemies = enemies.map((e, i) => i === targetIdx ? { ...e, hp: newHp, defeated: newHp === 0 } : e);
      stats = { ...stats, damageDealt: stats.damageDealt + dmg };
      resolvedDarts.push({ ...dart, resolved: true, damage: dmg, targetIdx });

      if (newHp === 0) {
        stats = { ...stats, enemiesDefeated: stats.enemiesDefeated + 1 };
        // Move target to next undefeated enemy
        const nextIdx = enemies.findIndex((e, i) => i !== targetIdx && !e.defeated);
        if (nextIdx >= 0) {
          // keep targetIdx as is, the UI will show next enemy
        }
        // Check victory
        if (enemies.every(e => e.defeated)) {
          return {
            ...state,
            darts,
            resolvedDarts,
            enemies,
            stats,
            outcome: 'victory',
          };
        }
      }
    } else {
      resolvedDarts.push({ ...dart, resolved: false, damage: 0, targetIdx });
    }
  }

  return {
    ...state,
    darts,
    resolvedDarts,
    enemies,
    stats,
  };
}

// ── Player turn: endVisit (advance to next player or enemy phase) ──────────────

export function endVisit(state: CampaignBattleState): CampaignBattleState {
  if (state.phase !== 'player') return state;
  if (state.outcome !== 'ongoing') return state;

  const nextIdx = state.playerTurnIdx + 1;
  if (nextIdx < state.players.length) {
    return {
      ...state,
      playerTurnIdx: nextIdx,
      darts: [],
      resolvedDarts: [],
      visitNumber: state.visitNumber + 1,
    };
  }
  // All players have thrown — move to the enemy phase.
  return {
    ...state,
    phase: 'enemy',
    playerTurnIdx: 0,
    darts: [],
    resolvedDarts: [],
    visitEnemiesSnapshot: [],
  };
}

// ── Target selection ───────────────────────────────────────────────────────────

export function setTarget(state: CampaignBattleState, targetIdx: number): CampaignBattleState {
  if (targetIdx < 0 || targetIdx >= state.enemies.length) return state;
  if (state.enemies[targetIdx].defeated) return state;
  return { ...state, targetIdx };
}


// ── Utility helpers ────────────────────────────────────────────────────────────

export function effectivePower(player: CoopPlayer): number {
  return player.power + player.buffs.filter(b => b.kind === 'power').reduce((s, b) => s + b.amount, 0);
}
