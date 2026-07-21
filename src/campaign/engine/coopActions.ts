import type {
  CampaignBattleState,
  CoopPlayer,
  CoopPowerUpId,
  PlayerBuff,
} from '../types';
import { getCoopPowerUp } from './powerUps';

// How much the Focus Buff subtracts from each alive enemy's accuracy and
// precision while active. 0.2 mirrors the old "+20% accuracy" hint but now
// applies to the AI's throw, where it actually has an in-game effect.
const FOCUS_BUFF_DISTRACT_AMOUNT = 0.2;
const FOCUS_BUFF_TURNS = 3;

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
  const defeatedBefore = state.enemies.filter(e => e.defeated).length;
  const next = applyCoopPowerUp({ ...state, players }, id, thrower, powerUpCharge);
  // A power-up can defeat enemies (meteor, ice lance, …). Run the same
  // end-of-damage check that `addDart` runs so killing the last enemy with
  // an ability still ends the battle. Also credit newly defeated enemies to
  // the stats counter so the post-game summary is correct.
  const anyAlive = next.enemies.some(e => !e.defeated);
  const outcome: CampaignBattleState['outcome'] = !anyAlive ? 'victory' : next.outcome;
  const defeatedAfter = next.enemies.filter(e => e.defeated).length;
  const newlyDefeated = Math.max(0, defeatedAfter - defeatedBefore);
  return {
    ...next,
    outcome,
    stats: {
      ...next.stats,
      powerUpsUsed: next.stats.powerUpsUsed + 1,
      enemiesDefeated: next.stats.enemiesDefeated + newlyDefeated,
    },
  };
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
  // ── Chapter 3 advanced power-ups ────────────────────────────────────
  if (id === 'coop_vine_grasp') {
    // 50 dmg to every alive enemy + freeze 1 turn.
    const enemies = state.enemies.map(e => {
      if (e.defeated) return e;
      const hp = Math.max(0, e.hp - 50);
      return { ...e, hp, defeated: hp <= 0, frozenTurns: Math.max(e.frozenTurns, 1) };
    });
    return { ...state, enemies, powerUpCharge: charge };
  }
  if (id === 'coop_spore_burst') {
    // 60 dmg + distract (-30% acc/precision) for 3 turns on every alive enemy.
    const enemies = state.enemies.map(e => e.defeated ? e : {
      ...e,
      hp: Math.max(0, e.hp - 60),
      defeated: e.hp - 60 <= 0,
      distractedTurns: FOCUS_BUFF_TURNS,
      distractAmount: Math.max(e.distractAmount, 0.3),
    });
    return { ...state, enemies, powerUpCharge: charge };
  }
  if (id === 'coop_thorn_lance') {
    // 160 dmg to the targeted enemy, ignoring shields.
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
      const hp = Math.max(0, e.hp - 160);
      return { ...e, hp, defeated: hp <= 0 };
    });
    return { ...state, enemies, targetIdx, powerUpCharge: charge };
  }
  if (id === 'coop_verdant_bloom') {
    // Heal 100 + clear enemy shields + party +5 power for 3 turns.
    const healed = Math.min(state.partyMaxHp, state.partyHp + 100);
    const enemies = state.enemies.map(e => ({ ...e, shields: [] }));
    const kind: PlayerBuff['kind'] = 'power';
    const buffId = `${kind}_${Date.now()}`;
    const players = state.players.map(p => ({
      ...p,
      buffs: [...p.buffs, { id: buffId, kind, amount: 5, turnsLeft: 3, source: thrower.id }],
    }));
    return { ...state, partyHp: healed, enemies, players, powerUpCharge: charge };
  }
  if (id === 'coop_heart_of_maw') {
    // Boss reward: 220 dmg to every alive enemy + freeze 3 turns + clear shields + full heal.
    const enemies = state.enemies.map(e => {
      if (e.defeated) return e;
      const hp = Math.max(0, e.hp - 220);
      return { ...e, hp, defeated: hp <= 0, frozenTurns: 3, shields: [] };
    });
    return { ...state, enemies, partyHp: state.partyMaxHp, powerUpCharge: charge };
  }
  return state;
}
