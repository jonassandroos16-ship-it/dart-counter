import type {
  CoopClassDef,
  CoopClassId,
  CoopPassiveDef,
  CoopPassiveId,
  PlayerCoopProgress,
} from '../types';
import type { Player, Settings } from '../../types';
import { levelFromXP } from '../../logic';
import { COOP_POWER_UPS } from './powerUps';

// ── Coop classes & passives ────────────────────────────────────────────
//
// Three classes, each with five tiers of passives. Every tier offers three
// distinct passives to choose from (15 per class total). Each tier is strictly
// stronger than the one before. Passives grant team-wide stat bonuses while
// the player is in the party. A player equips one passive at a time per class.

export const COOP_CLASSES: CoopClassDef[] = [
  { id: 'warrior', name: 'Warrior', icon: '⚔️', desc: 'A frontline striker. Grants the party flat POWER bonuses, making every dart hit harder.', starterPassive: 'war_power_1' },
  { id: 'priest', name: 'Priest', icon: '✨', desc: 'A guardian healer. Grants the party flat MAX HP bonuses, so the party can soak more damage.', starterPassive: 'pri_hp_1' },
  { id: 'rogue', name: 'Rogue', icon: '🗡️', desc: 'A nimble defender. Grants the party flat ARMOR bonuses, reducing every enemy dart.', starterPassive: 'rog_armor_1' },
];

export const COOP_PASSIVES: CoopPassiveDef[] = [
  // Warrior — tier 1 (starter)
  { id: 'war_power_1', classId: 'warrior', tier: 1, name: 'Battle Cry', icon: '⚔️', desc: 'Party +3 power (flat per dart).', bonus: { power: 3 }, levelRequired: 1 },
  { id: 'war_crit_1', classId: 'warrior', tier: 1, name: 'Keen Edge', icon: '🎯', desc: 'Party +2 power and +1 armor (flat).', bonus: { power: 2, armor: 1 }, levelRequired: 1 },
  { id: 'war_fury_1', classId: 'warrior', tier: 1, name: 'Iron Will', icon: '💪', desc: 'Party +2 power and +30 max HP.', bonus: { power: 2, health: 30 }, levelRequired: 1 },
  // Warrior — tier 2
  { id: 'war_power_2', classId: 'warrior', tier: 2, name: 'War Banner', icon: '🚩', desc: 'Party +8 power (flat per dart).', bonus: { power: 8 }, levelRequired: 2 },
  { id: 'war_crit_2', classId: 'warrior', tier: 2, name: 'Bloodlust', icon: '🩸', desc: 'Party +6 power and +2 armor (flat).', bonus: { power: 6, armor: 2 }, levelRequired: 2 },
  { id: 'war_fury_2', classId: 'warrior', tier: 2, name: 'Raging Roar', icon: '🦁', desc: 'Party +6 power and +80 max HP.', bonus: { power: 6, health: 80 }, levelRequired: 2 },
  // Warrior — tier 3
  { id: 'war_power_3', classId: 'warrior', tier: 3, name: 'Berserker Aura', icon: '🔥', desc: 'Party +15 power (flat per dart).', bonus: { power: 15 }, levelRequired: 3 },
  { id: 'war_crit_3', classId: 'warrior', tier: 3, name: 'Executioner', icon: '🪓', desc: 'Party +12 power and +4 armor (flat).', bonus: { power: 12, armor: 4 }, levelRequired: 3 },
  { id: 'war_fury_3', classId: 'warrior', tier: 3, name: 'Unbreakable', icon: '🛡️', desc: 'Party +12 power and +180 max HP.', bonus: { power: 12, health: 180 }, levelRequired: 3 },
  // Warrior — tier 4
  { id: 'war_power_4', classId: 'warrior', tier: 4, name: 'Warlord\'s Roar', icon: '🐉', desc: 'Party +22 power (flat per dart).', bonus: { power: 22 }, levelRequired: 4 },
  { id: 'war_crit_4', classId: 'warrior', tier: 4, name: 'Crimson Reaper', icon: '🩸', desc: 'Party +18 power and +6 armor (flat).', bonus: { power: 18, armor: 6 }, levelRequired: 4 },
  { id: 'war_fury_4', classId: 'warrior', tier: 4, name: 'Iron Tide', icon: '🌊', desc: 'Party +18 power and +260 max HP.', bonus: { power: 18, health: 260 }, levelRequired: 4 },
  // Warrior — tier 5
  { id: 'war_power_5', classId: 'warrior', tier: 5, name: 'Apex Predator', icon: '🦖', desc: 'Party +32 power (flat per dart).', bonus: { power: 32 }, levelRequired: 5 },
  { id: 'war_crit_5', classId: 'warrior', tier: 5, name: 'Doombringer', icon: '☠️', desc: 'Party +26 power and +9 armor (flat).', bonus: { power: 26, armor: 9 }, levelRequired: 5 },
  { id: 'war_fury_5', classId: 'warrior', tier: 5, name: 'Titan\'s Vigor', icon: '🗿', desc: 'Party +26 power and +380 max HP.', bonus: { power: 26, health: 380 }, levelRequired: 5 },
  // Priest — tier 1 (starter)
  { id: 'pri_hp_1', classId: 'priest', tier: 1, name: 'Blessing', icon: '✨', desc: 'Party +60 max HP.', bonus: { health: 60 }, levelRequired: 1 },
  { id: 'pri_regen_1', classId: 'priest', tier: 1, name: 'Mending', icon: '💧', desc: 'Party +40 max HP and +1 armor (flat).', bonus: { health: 40, armor: 1 }, levelRequired: 1 },
  { id: 'pri_shield_1', classId: 'priest', tier: 1, name: 'Ward', icon: '🧿', desc: 'Party +40 max HP and +2 power (flat).', bonus: { health: 40, power: 2 }, levelRequired: 1 },
  // Priest — tier 2
  { id: 'pri_hp_2', classId: 'priest', tier: 2, name: 'Sanctuary', icon: '🙏', desc: 'Party +150 max HP.', bonus: { health: 150 }, levelRequired: 2 },
  { id: 'pri_regen_2', classId: 'priest', tier: 2, name: 'Holy Renewal', icon: '🌿', desc: 'Party +110 max HP and +3 armor (flat).', bonus: { health: 110, armor: 3 }, levelRequired: 2 },
  { id: 'pri_shield_2', classId: 'priest', tier: 2, name: 'Sacred Barrier', icon: '🔰', desc: 'Party +110 max HP and +5 power (flat).', bonus: { health: 110, power: 5 }, levelRequired: 2 },
  // Priest — tier 3
  { id: 'pri_hp_3', classId: 'priest', tier: 3, name: 'Divine Aegis', icon: '😇', desc: 'Party +300 max HP.', bonus: { health: 300 }, levelRequired: 3 },
  { id: 'pri_regen_3', classId: 'priest', tier: 3, name: 'Eternal Spring', icon: '⛲', desc: 'Party +240 max HP and +6 armor (flat).', bonus: { health: 240, armor: 6 }, levelRequired: 3 },
  { id: 'pri_shield_3', classId: 'priest', tier: 3, name: 'Celestial Bulwark', icon: '🌟', desc: 'Party +240 max HP and +10 power (flat).', bonus: { health: 240, power: 10 }, levelRequired: 3 },
  // Priest — tier 4
  { id: 'pri_hp_4', classId: 'priest', tier: 4, name: 'Heaven\'s Embrace', icon: '🙏', desc: 'Party +440 max HP.', bonus: { health: 440 }, levelRequired: 4 },
  { id: 'pri_regen_4', classId: 'priest', tier: 4, name: 'Lifewell Spring', icon: '💧', desc: 'Party +340 max HP and +9 armor (flat).', bonus: { health: 340, armor: 9 }, levelRequired: 4 },
  { id: 'pri_shield_4', classId: 'priest', tier: 4, name: 'Seraphic Aegis', icon: '🛡️', desc: 'Party +340 max HP and +15 power (flat).', bonus: { health: 340, power: 15 }, levelRequired: 4 },
  // Priest — tier 5
  { id: 'pri_hp_5', classId: 'priest', tier: 5, name: 'Eternal Covenant', icon: '✨', desc: 'Party +640 max HP.', bonus: { health: 640 }, levelRequired: 5 },
  { id: 'pri_regen_5', classId: 'priest', tier: 5, name: 'Font of Life', icon: '⛲', desc: 'Party +500 max HP and +13 armor (flat).', bonus: { health: 500, armor: 13 }, levelRequired: 5 },
  { id: 'pri_shield_5', classId: 'priest', tier: 5, name: 'Radiant Bastion', icon: '🌟', desc: 'Party +500 max HP and +22 power (flat).', bonus: { health: 500, power: 22 }, levelRequired: 5 },
  // Rogue — tier 1 (starter)
  { id: 'rog_armor_1', classId: 'rogue', tier: 1, name: 'Light Steps', icon: '🗡️', desc: 'Party +2 armor (flat per enemy dart).', bonus: { armor: 2 }, levelRequired: 1 },
  { id: 'rog_dodge_1', classId: 'rogue', tier: 1, name: 'Nimble', icon: '💨', desc: 'Party +1 armor and +30 max HP.', bonus: { armor: 1, health: 30 }, levelRequired: 1 },
  { id: 'rog_thorns_1', classId: 'rogue', tier: 1, name: 'Bristling', icon: '🌵', desc: 'Party +1 armor and +2 power (flat).', bonus: { armor: 1, power: 2 }, levelRequired: 1 },
  // Rogue — tier 2
  { id: 'rog_armor_2', classId: 'rogue', tier: 2, name: 'Shadow Veil', icon: '🌫️', desc: 'Party +5 armor (flat per enemy dart).', bonus: { armor: 5 }, levelRequired: 2 },
  { id: 'rog_dodge_2', classId: 'rogue', tier: 2, name: 'Flicker', icon: '⚡', desc: 'Party +3 armor and +80 max HP.', bonus: { armor: 3, health: 80 }, levelRequired: 2 },
  { id: 'rog_thorns_2', classId: 'rogue', tier: 2, name: 'Razor Edge', icon: '🔪', desc: 'Party +3 armor and +6 power (flat).', bonus: { armor: 3, power: 6 }, levelRequired: 2 },
  // Rogue — tier 3
  { id: 'rog_armor_3', classId: 'rogue', tier: 3, name: 'Phantom Guard', icon: '👻', desc: 'Party +10 armor (flat per enemy dart).', bonus: { armor: 10 }, levelRequired: 3 },
  { id: 'rog_dodge_3', classId: 'rogue', tier: 3, name: 'Afterimage', icon: '🌀', desc: 'Party +11 armor and +180 max HP.', bonus: { armor: 7, health: 180 }, levelRequired: 3 },
  { id: 'rog_thorns_3', classId: 'rogue', tier: 3, name: 'Spike Mail', icon: '🦔', desc: 'Party +7 armor and +12 power (flat).', bonus: { armor: 7, power: 12 }, levelRequired: 3 },
  // Rogue — tier 4
  { id: 'rog_armor_4', classId: 'rogue', tier: 4, name: 'Umbral Bulwark', icon: '🌑', desc: 'Party +15 armor (flat per enemy dart).', bonus: { armor: 15 }, levelRequired: 4 },
  { id: 'rog_dodge_4', classId: 'rogue', tier: 4, name: 'Mirror Step', icon: '🪞', desc: 'Party +11 armor and +260 max HP.', bonus: { armor: 11, health: 260 }, levelRequired: 4 },
  { id: 'rog_thorns_4', classId: 'rogue', tier: 4, name: 'Razor Barb', icon: '🔪', desc: 'Party +11 armor and +18 power (flat).', bonus: { armor: 11, power: 18 }, levelRequired: 4 },
  // Rogue — tier 5
  { id: 'rog_armor_5', classId: 'rogue', tier: 5, name: 'Eclipse Aegis', icon: '🌑', desc: 'Party +22 armor (flat per enemy dart).', bonus: { armor: 22 }, levelRequired: 5 },
  { id: 'rog_dodge_5', classId: 'rogue', tier: 5, name: 'Phantasm', icon: '🌫️', desc: 'Party +16 armor and +380 max HP.', bonus: { armor: 16, health: 380 }, levelRequired: 5 },
  { id: 'rog_thorns_5', classId: 'rogue', tier: 5, name: 'Maw of Thorns', icon: '🐉', desc: 'Party +16 armor and +26 power (flat).', bonus: { armor: 16, power: 26 }, levelRequired: 5 },
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
// passives. Each player's equipped passive contributes its bonus to the
// party independently — multiple players running the same passive (e.g.
// two priests both equipping `pri_hp_1`) stack, granting +120 HP rather
// than +60. Distinct passives (e.g. `pri_hp_1` and `pri_hp_2`) each
// contribute independently as well, so a party with priests running
// different tiers still benefits from every equipped passive.
export interface PartyPassiveBonus {
  power: number;
  health: number;
  armor: number;
  sources: { playerId: string; playerName: string; passiveName: string; icon: string; bonus: CoopPassiveDef['bonus'] }[];
}

export function computePartyPassiveBonus(players: Player[]): PartyPassiveBonus {
  const bonus: PartyPassiveBonus = { power: 0, health: 0, armor: 0, sources: [] };
  for (const p of players) {
    const prog = p.coopProgress;
    if (!prog || !prog.classId) continue;
    const equipped = prog.equippedPassives || [];
    if (!equipped.length) continue;
    for (const pid of equipped) {
      const def = getCoopPassive(pid);
      if (!def) continue;
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
// This XP is added to the player's currently selected class via `awardClassXp`.
export function coopXpForBattle(stats: { dartsThrown: number; enemiesDefeated: number }, won: boolean): number {
  const base = won ? 20 : 5;
  const dartBonus = Math.min(20, Math.floor(stats.dartsThrown / 3));
  const defeatBonus = Math.min(15, stats.enemiesDefeated * 3);
  return base + dartBonus + defeatBonus;
}

// Get the XP for a specific class from a player's coop progress.
export function getClassXp(prog: PlayerCoopProgress | undefined | null, classId: CoopClassId | null | undefined): number {
  if (!prog || !classId) return 0;
  return prog.classXp?.[classId] ?? 0;
}

// Add XP to a specific class. Returns the updated progress.
export function addClassXp(prog: PlayerCoopProgress | undefined | null, classId: CoopClassId | null | undefined, xp: number): PlayerCoopProgress {
  const cur = prog || defaultCoopProgress();
  if (!classId) return cur;
  const classXp = { ...(cur.classXp || {}) };
  classXp[classId] = (classXp[classId] || 0) + xp;
  return { ...cur, classXp };
}

// Get the level for a specific class from XP, using the same curve as levelFromXP.
export function classLevelFromXp(prog: PlayerCoopProgress | undefined | null, classId: CoopClassId | null | undefined, settings: Settings): { level: number; xpIntoLevel: number; xpNeeded: number } {
  const xp = getClassXp(prog, classId);
  return levelFromXP(xp, settings);
}

// Returns the list of passives a player can unlock/equip given their player level.
// XP is now unified — see `Player.xp` / `Player.level`.
export function unlockedPassivesForPlayer(prog: PlayerCoopProgress | undefined | null, playerLevel: number = 1): CoopPassiveId[] {
  if (!prog || !prog.classId) return [];
  const classPassives = passivesForClass(prog.classId);
  return classPassives.filter(p => playerLevel >= p.levelRequired).map(p => p.id);
}

// Default coop progress for a brand-new player: warrior class, no passives.
// XP is now unified — see `Player.xp` / `Player.level`. The warrior class is
// set by default so new players can immediately use class-based features.
export function defaultCoopProgress(): PlayerCoopProgress {
  return { classId: 'warrior', unlockedPassives: [], equippedPassives: [] };
}

// When a player picks a class, auto-equip the class's starter passive
// (the first tier-1 passive for that class). All tier-1 passives are
// unlocked by default so the player can switch between them freely.
export function selectClassForPlayer(prog: PlayerCoopProgress, classId: CoopClassId): PlayerCoopProgress {
  const cls = getCoopClass(classId);
  const starterId = cls?.starterPassive;
  const tier1Ids = COOP_PASSIVES.filter(p => p.classId === classId && p.tier === 1).map(p => p.id);
  return {
    ...prog,
    classId,
    unlockedPassives: Array.from(new Set<CoopPassiveId>([...(prog.unlockedPassives || []), ...tier1Ids])),
    equippedPassives: starterId ? [starterId] : [],
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

// Add Coop XP to a player's progress. With the unified XP system, Coop XP
// is now added directly to `Player.xp` via `awardXP` in rewards.ts. This
// function is kept for backward compatibility but is a no-op for XP — it
// only returns the current progress. Passive unlocking is now driven by
// `Player.level` and handled in `reconcileCoopPassivesForPlayer`.
export function addCoopXpForPlayer(prog: PlayerCoopProgress | undefined | null, _xp: number): { progress: PlayerCoopProgress; newlyUnlocked: CoopPassiveId[] } {
  const cur = prog || defaultCoopProgress();
  return { progress: cur, newlyUnlocked: [] };
}

// Reconcile a player's unlocked passives based on their current player level.
// Call this after XP/level changes to auto-unlock any passives whose level
// threshold the player now meets. Returns the updated progress and the list
// of newly unlocked passive ids.
export function reconcileCoopPassivesForPlayer(prog: PlayerCoopProgress | undefined | null, playerLevel: number): { progress: PlayerCoopProgress; newlyUnlocked: CoopPassiveId[] } {
  const cur = prog || defaultCoopProgress();
  if (!cur.classId) return { progress: cur, newlyUnlocked: [] };
  const classPassives = passivesForClass(cur.classId);
  const newlyUnlocked: CoopPassiveId[] = [];
  const unlockedSet = new Set(cur.unlockedPassives || []);
  for (const p of classPassives) {
    if (playerLevel >= p.levelRequired && !unlockedSet.has(p.id)) {
      newlyUnlocked.push(p.id);
      unlockedSet.add(p.id);
    }
  }
  return {
    progress: { ...cur, unlockedPassives: Array.from(unlockedSet) },
    newlyUnlocked,
  };
}

// Starter power-ups are always available. Advanced power-ups unlock as level
// rewards. This helper returns the full list of ids a player can equip given
// their campaign progress.
export function unlockedCoopPowerUps(progress: { unlockedPowerUps?: string[] } | undefined | null): string[] {
  const starter = COOP_POWER_UPS.filter(p => p.tier === 'starter').map(p => p.id);
  const advanced = (progress?.unlockedPowerUps || []) as string[];
  return [...starter, ...advanced];
}
