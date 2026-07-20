import type { CoopPowerUpDef, CoopPowerUpId } from '../types';

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
