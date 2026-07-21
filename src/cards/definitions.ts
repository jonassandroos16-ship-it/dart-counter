import type { CardDef } from './types';

// ── Card Definitions ─────────────────────────────────────────────────
//
// Three card types:
//   damage  (red)    — act as dart throws, add damage
//   spell   (blue)   — temporary buffs to party / debuffs to enemies
//   utility (blue)   — helpful non-combat effects (draw, reroll, etc.)
//
// Each card is tagged competitive or coop. Some cards exist in both modes.
// Cards can be upgraded once (upgraded=true) to improve their effect.

export const CARD_DEFS: CardDef[] = [
  // ── Damage cards — Competitive ──────────────────────────────────
  { id: 'dmg_t20', name: 'Triple 20', icon: '🎯', type: 'damage', mode: 'competitive', class: 'any', rarity: 'common', desc: 'Deal 60 damage (Triple 20).', base: 20, mult: 3, levelRequired: 1 },
  { id: 'dmg_t19', name: 'Triple 19', icon: '🎯', type: 'damage', mode: 'competitive', class: 'any', rarity: 'common', desc: 'Deal 57 damage (Triple 19).', base: 19, mult: 3, levelRequired: 1 },
  { id: 'dmg_t18', name: 'Triple 18', icon: '🎯', type: 'damage', mode: 'competitive', class: 'any', rarity: 'common', desc: 'Deal 54 damage (Triple 18).', base: 18, mult: 3, levelRequired: 1 },
  { id: 'dmg_t17', name: 'Triple 17', icon: '🎯', type: 'damage', mode: 'competitive', class: 'any', rarity: 'common', desc: 'Deal 51 damage (Triple 17).', base: 17, mult: 3, levelRequired: 1 },
  { id: 'dmg_d20', name: 'Double 20', icon: '🎯', type: 'damage', mode: 'competitive', class: 'any', rarity: 'common', desc: 'Deal 40 damage (Double 20).', base: 20, mult: 2, levelRequired: 1 },
  { id: 'dmg_bull', name: 'Bullseye', icon: '🐂', type: 'damage', mode: 'competitive', class: 'any', rarity: 'rare', desc: 'Deal 50 damage (Bullseye).', base: 50, mult: 1, levelRequired: 2 },
  { id: 'dmg_outer_bull', name: 'Outer Bull', icon: '🟢', type: 'damage', mode: 'competitive', class: 'any', rarity: 'common', desc: 'Deal 25 damage (Outer Bull).', base: 25, mult: 1, levelRequired: 1 },
  { id: 'dmg_s20', name: 'Single 20', icon: '🎯', type: 'damage', mode: 'competitive', class: 'any', rarity: 'common', desc: 'Deal 20 damage (Single 20).', base: 20, mult: 1, levelRequired: 1 },
  { id: 'dmg_miss', name: 'Miss', icon: '💨', type: 'damage', mode: 'competitive', class: 'any', rarity: 'common', desc: 'A thrown dart that misses (0 damage).', base: 0, mult: 0, levelRequired: 1 },

  // ── Damage cards — Coop ──────────────────────────────────────────
  { id: 'dmg_coop_t20', name: 'Heavy Strike', icon: '⚔️', type: 'damage', mode: 'coop', class: 'warrior', rarity: 'common', desc: 'Deal 60 damage to an enemy.', base: 20, mult: 3, levelRequired: 1 },
  { id: 'dmg_coop_t19', name: 'Warrior Swing', icon: '⚔️', type: 'damage', mode: 'coop', class: 'warrior', rarity: 'common', desc: 'Deal 57 damage to an enemy.', base: 19, mult: 3, levelRequired: 1 },
  { id: 'dmg_coop_bull', name: 'Holy Smite', icon: '✨', type: 'damage', mode: 'coop', class: 'priest', rarity: 'rare', desc: 'Deal 50 damage to an enemy.', base: 50, mult: 1, levelRequired: 2 },
  { id: 'dmg_coop_s20', name: 'Quick Jab', icon: '🗡️', type: 'damage', mode: 'coop', class: 'rogue', rarity: 'common', desc: 'Deal 20 damage to an enemy.', base: 20, mult: 1, levelRequired: 1 },
  { id: 'dmg_coop_d20', name: 'Backstab', icon: '🗡️', type: 'damage', mode: 'coop', class: 'rogue', rarity: 'rare', desc: 'Deal 40 damage to an enemy.', base: 20, mult: 2, levelRequired: 2 },

  // ── Spell cards — Competitive ────────────────────────────────────
  { id: 'spell_bust_protect', name: 'Bust Protect', icon: '🛡️', type: 'spell', mode: 'competitive', class: 'any', rarity: 'rare', desc: 'Prevents going over 0 in a 501 game if you overscore.', effect: 'bust_protect', levelRequired: 1 },
  { id: 'spell_double_up', name: 'Double Up', icon: '🔁', type: 'spell', mode: 'competitive', class: 'any', rarity: 'rare', desc: "Forces an opponent's next Double modifier to count as a Miss.", effect: 'double_up', levelRequired: 2 },
  { id: 'spell_surge', name: 'Surge', icon: '⚡', type: 'spell', mode: 'competitive', class: 'warrior', rarity: 'epic', desc: 'Your next visit scores double.', effect: 'surge', magnitude: 2, levelRequired: 3 },
  { id: 'spell_hot_streak', name: 'Hot Streak', icon: '🔥', type: 'spell', mode: 'competitive', class: 'warrior', rarity: 'rare', desc: '+5 per dart cumulative bonus next visit.', effect: 'hot_streak', magnitude: 5, levelRequired: 2 },

  // ── Spell cards — Coop ───────────────────────────────────────────
  { id: 'spell_coop_power_buff', name: 'Power Infusion', icon: '💪', type: 'spell', mode: 'coop', class: 'warrior', rarity: 'rare', desc: 'Party gains +10 power for 3 turns.', effect: 'power_buff', magnitude: 10, levelRequired: 2 },
  { id: 'spell_coop_heal', name: 'Healing Light', icon: '✨', type: 'spell', mode: 'coop', class: 'priest', rarity: 'rare', desc: 'Restore 80 HP to the party.', effect: 'heal', magnitude: 80, levelRequired: 2 },
  { id: 'spell_coop_accuracy_buff', name: 'Eagle Eye', icon: '🦅', type: 'spell', mode: 'coop', class: 'priest', rarity: 'rare', desc: 'Party gains +20% accuracy for 3 turns.', effect: 'accuracy_buff', magnitude: 20, levelRequired: 3 },
  { id: 'spell_coop_enemy_debuff', name: 'Weaken', icon: '💀', type: 'spell', mode: 'coop', class: 'rogue', rarity: 'rare', desc: 'Enemies deal -30% damage for 2 turns.', effect: 'enemy_debuff', magnitude: 30, levelRequired: 2 },
  { id: 'spell_coop_freeze', name: 'Frost Nova', icon: '❄️', type: 'spell', mode: 'coop', class: 'rogue', rarity: 'epic', desc: 'Freeze all enemies for 1 turn.', effect: 'freeze', levelRequired: 4 },

  // ── Utility cards — Competitive ─────────────────────────────────
  { id: 'util_reroll', name: 'Reroll', icon: '🎲', type: 'utility', mode: 'competitive', class: 'any', rarity: 'rare', desc: 'Reroll your lowest dart throw this visit.', effect: 'reroll', levelRequired: 1 },
  { id: 'util_draw', name: 'Quick Draw', icon: '🃏', type: 'utility', mode: 'competitive', class: 'rogue', rarity: 'rare', desc: 'Draw an extra card next turn.', effect: 'draw', magnitude: 1, levelRequired: 2 },
  { id: 'util_reserve', name: 'Reserve', icon: '📥', type: 'utility', mode: 'competitive', class: 'any', rarity: 'rare', desc: 'Reserve 1 modifier card for a future turn.', effect: 'reserve', levelRequired: 2 },

  // ── Utility cards — Coop ────────────────────────────────────────
  { id: 'util_coop_shield', name: 'Party Shield', icon: '🛡️', type: 'utility', mode: 'coop', class: 'priest', rarity: 'rare', desc: 'Party takes 50% less damage for 2 turns.', effect: 'party_shield', magnitude: 50, levelRequired: 2 },
  { id: 'util_coop_extra_dart', name: 'Extra Throw', icon: '➕', type: 'utility', mode: 'coop', class: 'warrior', rarity: 'epic', desc: 'Gain an extra dart throw this turn.', effect: 'extra_dart', levelRequired: 3 },
  { id: 'util_coop_revive', name: 'Phoenix Heart', icon: '❤️', type: 'utility', mode: 'coop', class: 'priest', rarity: 'epic', desc: 'Revive the party to 25% HP once.', effect: 'revive', levelRequired: 5 },
];

const CARD_MAP: Record<string, CardDef> = Object.fromEntries(CARD_DEFS.map(c => [c.id, c]));

export function getCard(id: string): CardDef | undefined {
  return CARD_MAP[id];
}

export function cardsForMode(mode: 'competitive' | 'coop'): CardDef[] {
  return CARD_DEFS.filter(c => c.mode === mode);
}

export function cardsForClass(cls: 'warrior' | 'priest' | 'rogue' | 'any', mode: 'competitive' | 'coop'): CardDef[] {
  return CARD_DEFS.filter(c => c.mode === mode && (c.class === cls || c.class === 'any'));
}

// ── Upgrades ──────────────────────────────────────────────────────────
//
// Each card can be upgraded once. The upgrade improves the card's effect —
// typically +50% damage, +50% magnitude, or a stronger effect variant.

export function upgradedCardDef(card: CardDef): CardDef {
  if (card.type === 'damage') {
    const base = card.base ?? 0;
    const mult = card.mult ?? 1;
    return {
      ...card,
      upgraded: true,
      name: card.name + '+',
      desc: card.desc.replace(/Deal (\d+) damage/, (_, n) => `Deal ${Math.round(+n * 1.5)} damage`),
      base: Math.round(base * 1.5),
      mult,
    };
  }
  if (card.type === 'spell' || card.type === 'utility') {
    return {
      ...card,
      upgraded: true,
      name: card.name + '+',
      desc: card.desc,
      magnitude: card.magnitude ? Math.round(card.magnitude * 1.5) : card.magnitude,
    };
  }
  return { ...card, upgraded: true, name: card.name + '+' };
}

export function cardDamage(card: CardDef): number {
  if (card.type !== 'damage') return 0;
  return (card.base ?? 0) * (card.mult ?? 1);
}

export function cardRarityColor(rarity: CardDef['rarity']): string {
  switch (rarity) {
    case 'common': return 'var(--border)';
    case 'rare': return '#3b82f6';
    case 'epic': return '#f59e0b';
  }
}

export function cardTypeColor(type: CardDef['type']): string {
  switch (type) {
    case 'damage': return '#ef4444';
    case 'spell': return '#3b82f6';
    case 'utility': return '#3b82f6';
  }
}
