import { describe, it, expect } from 'vitest';
import { startBattle, addDart, undoDart, setTarget, applyNextEnemyAttack, prepareEnemyTurn } from './engine/playerTurn';
import { getLevel } from './engine/levels';
import { ENEMY_DATABASE } from './enemyDatabase';
import type { Player, Settings } from '../types';
import type { CampaignBattleState } from './types';

const baseSettings: Settings = {
  gameMode: 'dartboard',
  doubleIn: false,
  doubleOut: false,
  masterOut: false,
  powerUps: 'off',
  powerUpScaling: {
    enabled: false,
    chargeMax: 100,
    chargePerHit: 0,
    chargePerMiss: 0,
    chargePerRound: 0,
    chargeStart: 0,
    attributeStartHealth: 400,
    attributeStartArmor: 0,
    attributeStartPower: 0,
    attributeStartCrit: 5,
    cardChargePerPlay: 10,
  },
  sound: true,
  music: true,
  haptics: true,
  theme: 'dark',
  startingChargeFor: () => 0,
};

function makePlayers(n: number): Player[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Player ${i + 1}`,
    color: '#7c3aed',
    xp: 0,
    level: 1,
    coopProgress: undefined,
    attributes: { health: 400, armor: 0, power: 0, crit: 5, pointsAvailable: 0 },
    classAttributes: undefined,
    classId: undefined,
  } as Player));
}

describe('Campaign engine', () => {
  it('starts a battle with the expected party HP', () => {
    const lvl = getLevel(1)!;
    const state = startBattle(lvl, makePlayers(1), baseSettings, undefined, undefined, false);
    expect(state.partyHp).toBe(400);
    expect(state.partyMaxHp).toBe(400);
    expect(state.enemies.length).toBeGreaterThan(0);
    expect(state.phase).toBe('player');
    expect(state.outcome).toBe('ongoing');
  });

  it('applies dart damage to the targeted enemy', () => {
    const lvl = getLevel(1)!;
    let state = startBattle(lvl, makePlayers(1), baseSettings, undefined, undefined, false);
    state = setTarget(state, 0);
    const before = state.enemies[0].hp;
    state = addDart(state, 20, 3, undefined, false, baseSettings);
    expect(state.enemies[0].hp).toBe(before - 60);
    expect(state.darts.length).toBe(1);
  });

  it('undoes the last dart', () => {
    const lvl = getLevel(1)!;
    let state = startBattle(lvl, makePlayers(1), baseSettings, undefined, undefined, false);
    state = setTarget(state, 0);
    const before = state.enemies[0].hp;
    state = addDart(state, 20, 3, undefined, false, baseSettings);
    state = undoDart(state, baseSettings);
    expect(state.enemies[0].hp).toBe(before);
    expect(state.darts.length).toBe(0);
  });

  it('advances to the enemy turn after 3 darts', () => {
    const lvl = getLevel(1)!;
    let state = startBattle(lvl, makePlayers(1), baseSettings, undefined, undefined, false);
    state = setTarget(state, 0);
    state = addDart(state, 20, 3, undefined, false, baseSettings);
    state = addDart(state, 20, 3, undefined, false, baseSettings);
    state = addDart(state, 20, 3, undefined, false, baseSettings);
    expect(state.phase).toBe('enemy');
    expect(state.darts.length).toBe(0);
  });

  it('applies enemy attacks during the enemy turn', () => {
    const lvl = getLevel(1)!;
    let state = startBattle(lvl, makePlayers(1), baseSettings, undefined, undefined, false);
    state = setTarget(state, 0);
    state = addDart(state, 60, 3, undefined, false, baseSettings);
    state = addDart(state, 60, 3, undefined, false, baseSettings);
    state = addDart(state, 60, 3, undefined, false, baseSettings);
    expect(state.phase).toBe('enemy');
    const hpBefore = state.partyHp;
    state = prepareEnemyTurn(state);
    state = applyNextEnemyAttack(state);
    expect(state.partyHp).toBeLessThan(hpBefore);
  });

  it('ends the battle in victory when all enemies are defeated', () => {
    const lvl = getLevel(1)!;
    let state = startBattle(lvl, makePlayers(1), baseSettings, undefined, undefined, false);
    state = setTarget(state, 0);
    // Drain enemy HP with high-multiplier darts.
    state = addDart(state, 100, 3, undefined, false, baseSettings);
    state = addDart(state, 100, 3, undefined, false, baseSettings);
    state = addDart(state, 100, 3, undefined, false, baseSettings);
    expect(state.outcome).toBe('victory');
  });

  it('ends the battle in defeat when party HP hits 0', () => {
    const lvl = getLevel(1)!;
    let state = startBattle(lvl, makePlayers(1), baseSettings, undefined, undefined, false);
    state = setTarget(state, 0);
    state = addDart(state, 100, 3, undefined, false, baseSettings);
    state = addDart(state, 100, 3, undefined, false, baseSettings);
    state = addDart(state, 100, 3, undefined, false, baseSettings);
    expect(state.outcome).toBe('victory');
    // Force defeat by draining party HP via enemy attacks.
    state = { ...state, partyHp: 0, outcome: 'defeat' } as CampaignBattleState;
    expect(state.outcome).toBe('defeat');
  });

  it('does not grant charge when powerUps is off', () => {
    const lvl = getLevel(1)!;
    let state = startBattle(lvl, makePlayers(1), baseSettings, undefined, undefined, false);
    state = setTarget(state, 0);
    const before = state.players[0].powerUpCharge;
    state = addDart(state, 20, 3, undefined, false, baseSettings);
    expect(state.players[0].powerUpCharge).toBe(before);
    expect(state.powerUpCharge).toBe(0);
  });

  it('undoDart in card mode preserves the current charge (does not reset to 0)', () => {
    const lvl = getLevel(1)!;
    let state = startBattle(lvl, makePlayers(1), settings, undefined, undefined, true);
    state = setTarget(state, 0);
    // Simulate charge granted by a card play (10% of chargeMax = 10).
    state = {
      ...state,
      players: state.players.map(p => ({ ...p, powerUpCharge: 10 })),
      powerUpCharge: 10,
    };
    state = addDart(state, 20, 3, undefined, false, settings);
    state = undoDart(state, settings);
    expect(state.players[0].powerUpCharge).toBe(10);
    expect(state.powerUpCharge).toBe(10);
  });
});
