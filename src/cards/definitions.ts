import type { CardDef, CardMode } from './types';

// ── Card Definitions ─────────────────────────────────────────────────
//
// Three card types:
//   damage  (red)    — act as dart throws, add damage
//   spell   (blue)   — temporary buffs to party / debuffs to enemies
//   utility (blue)   — helpful non-combat effects (draw, reroll, etc.)
//
// Each card has a `mode` field: 'competitive', 'coop', or 'both'.
// Cards with mode 'both' are available in both competitive and coop modes.
// Each card has a `levelRequired` field — the player must reach that level
// before the card appears in their deck builder. Level 1 cards are available
// from the start.
//
// Cards can be upgraded once (upgraded=true) to improve their effect.

export const CARD_DEFS: CardDef[] = [
  // ── Level 1 — Starter damage cards (both modes) ───────────────────
  { id: 'dmg_s20', name: 'Single 20', icon: '🎯', type: 'damage', mode: 'both', class: 'any', rarity: 'common', desc: 'Deal 20 damage.', base: 20, mult: 1, levelRequired: 1 },
  { id: 'dmg_s19', name: 'Single 19', icon: '🎯', type: 'damage', mode: 'both', class: 'any', rarity: 'common', desc: 'Deal 19 damage.', base: 19, mult: 1, levelRequired: 1 },
  { id: 'dmg_s18', name: 'Single 18', icon: '🎯', type: 'damage', mode: 'both', class: 'any', rarity: 'common', desc: 'Deal 18 damage.', base: 18, mult: 1, levelRequired: 1 },
  { id: 'dmg_d20', name: 'Double 20', icon: '🎯', type: 'damage', mode: 'both', class: 'any', rarity: 'common', desc: 'Deal 40 damage.', base: 20, mult: 2, levelRequired: 1 },
  { id: 'dmg_outer_bull', name: 'Outer Bull', icon: '🟢', type: 'damage', mode: 'both', class: 'any', rarity: 'common', desc: 'Deal 25 damage.', base: 25, mult: 1, levelRequired: 1 },

  // ── Level 2 — Improved damage cards ───────────────────────────────
  { id: 'dmg_t20', name: 'Triple 20', icon: '🎯', type: 'damage', mode: 'both', class: 'any', rarity: 'common', desc: 'Deal 60 damage.', base: 20, mult: 3, levelRequired: 2 },
  { id: 'dmg_t19', name: 'Triple 19', icon: '🎯', type: 'damage', mode: 'both', class: 'any', rarity: 'common', desc: 'Deal 57 damage.', base: 19, mult: 3, levelRequired: 2 },
  { id: 'dmg_t18', name: 'Triple 18', icon: '🎯', type: 'damage', mode: 'both', class: 'any', rarity: 'common', desc: 'Deal 54 damage.', base: 18, mult: 3, levelRequired: 2 },
  { id: 'dmg_bull', name: 'Bullseye', icon: '🐂', type: 'damage', mode: 'both', class: 'any', rarity: 'rare', desc: 'Deal 50 damage.', base: 50, mult: 1, levelRequired: 2 },

  // ── Level 3 — Class-specific damage cards ─────────────────────────
  { id: 'dmg_warrior_strike', name: 'Warrior Strike', icon: '⚔️', type: 'damage', mode: 'both', class: 'warrior', rarity: 'rare', desc: 'Deal 65 damage with warrior power.', base: 20, mult: 3, levelRequired: 3 },
  { id: 'dmg_priest_smite', name: 'Holy Smite', icon: '✨', type: 'damage', mode: 'both', class: 'priest', rarity: 'rare', desc: 'Deal 55 damage with divine power.', base: 50, mult: 1, levelRequired: 3 },
  { id: 'dmg_rogue_backstab', name: 'Backstab', icon: '🗡️', type: 'damage', mode: 'both', class: 'rogue', rarity: 'rare', desc: 'Deal 45 damage from the shadows.', base: 20, mult: 2, levelRequired: 3 },

  // ── Level 4 — Epic damage cards ───────────────────────────────────
  { id: 'dmg_meteor', name: 'Meteor Strike', icon: '☄️', type: 'damage', mode: 'both', class: 'any', rarity: 'epic', desc: 'Deal 80 damage in a blazing impact.', base: 80, mult: 1, levelRequired: 4 },
  { id: 'dmg_warrior_cleave', name: 'Cleave', icon: '🪓', type: 'damage', mode: 'both', class: 'warrior', rarity: 'epic', desc: 'Deal 90 damage with a mighty cleave.', base: 90, mult: 1, levelRequired: 4 },
  { id: 'dmg_priest_judgment', name: 'Divine Judgment', icon: '⚖️', type: 'damage', mode: 'both', class: 'priest', rarity: 'epic', desc: 'Deal 85 damage with holy judgment.', base: 85, mult: 1, levelRequired: 4 },
  { id: 'dmg_rogue_assassinate', name: 'Assassinate', icon: '🥷', type: 'damage', mode: 'both', class: 'rogue', rarity: 'epic', desc: 'Deal 95 damage with lethal precision.', base: 95, mult: 1, levelRequired: 4 },

  // ── Level 5 — Legendary damage cards ──────────────────────────────
  { id: 'dmg_apocalypse', name: 'Apocalypse', icon: '🌋', type: 'damage', mode: 'both', class: 'any', rarity: 'epic', desc: 'Deal 120 damage. The board trembles.', base: 120, mult: 1, levelRequired: 5 },

  // ── Spell cards — Level 1-2 (both modes) ──────────────────────────
  { id: 'spell_bust_protect', name: 'Bust Protect', icon: '🛡️', type: 'spell', mode: 'both', class: 'any', rarity: 'rare', desc: 'Prevents going over 0 if you overscore.', effect: 'bust_protect', levelRequired: 1 },
  { id: 'spell_surge', name: 'Surge', icon: '⚡', type: 'spell', mode: 'both', class: 'warrior', rarity: 'rare', desc: 'Your next visit scores double.', effect: 'surge', magnitude: 2, levelRequired: 2 },
  { id: 'spell_hot_streak', name: 'Hot Streak', icon: '🔥', type: 'spell', mode: 'both', class: 'warrior', rarity: 'rare', desc: '+5 per dart cumulative bonus next visit.', effect: 'hot_streak', magnitude: 5, levelRequired: 2 },

  // ── Spell cards — Level 3+ (both modes) ───────────────────────────
  { id: 'spell_power_buff', name: 'Power Infusion', icon: '💪', type: 'spell', mode: 'both', class: 'warrior', rarity: 'rare', desc: 'Party gains +10 power for 3 turns.', effect: 'power_buff', magnitude: 10, levelRequired: 3 },
  { id: 'spell_heal', name: 'Healing Light', icon: '✨', type: 'spell', mode: 'both', class: 'priest', rarity: 'rare', desc: 'Restore 80 HP to the party.', effect: 'heal', magnitude: 80, levelRequired: 3 },
  { id: 'spell_accuracy_buff', name: 'Eagle Eye', icon: '🦅', type: 'spell', mode: 'both', class: 'priest', rarity: 'rare', desc: 'Party gains +20% accuracy for 3 turns.', effect: 'accuracy_buff', magnitude: 20, levelRequired: 3 },
  { id: 'spell_enemy_debuff', name: 'Weaken', icon: '💀', type: 'spell', mode: 'both', class: 'rogue', rarity: 'rare', desc: 'Enemies deal -30% damage for 2 turns.', effect: 'enemy_debuff', magnitude: 30, levelRequired: 3 },
  { id: 'spell_freeze', name: 'Frost Nova', icon: '❄️', type: 'spell', mode: 'both', class: 'rogue', rarity: 'epic', desc: 'Freeze all enemies for 1 turn.', effect: 'freeze', levelRequired: 4 },
  { id: 'spell_double_up', name: 'Double Up', icon: '🔁', type: 'spell', mode: 'both', class: 'any', rarity: 'rare', desc: "Forces an opponent's next Double to count as a miss.", effect: 'double_up', levelRequired: 2 },

  // ── Utility cards — Level 1-2 (both modes) ────────────────────────
  { id: 'util_reroll', name: 'Reroll', icon: '🎲', type: 'utility', mode: 'both', class: 'any', rarity: 'rare', desc: 'Reroll your lowest dart throw this visit.', effect: 'reroll', levelRequired: 1 },
  { id: 'util_draw', name: 'Quick Draw', icon: '🃏', type: 'utility', mode: 'both', class: 'rogue', rarity: 'rare', desc: 'Draw an extra card next turn.', effect: 'draw', magnitude: 1, levelRequired: 2 },
  { id: 'util_reserve', name: 'Reserve', icon: '📥', type: 'utility', mode: 'both', class: 'any', rarity: 'rare', desc: 'Reserve 1 modifier card for a future turn.', effect: 'reserve', levelRequired: 2 },

  // ── Utility cards — Level 3+ (both modes) ────────────────────────
  { id: 'util_shield', name: 'Party Shield', icon: '🛡️', type: 'utility', mode: 'both', class: 'priest', rarity: 'rare', desc: 'Party takes 50% less damage for 2 turns.', effect: 'party_shield', magnitude: 50, levelRequired: 3 },
  { id: 'util_extra_dart', name: 'Extra Throw', icon: '➕', type: 'utility', mode: 'both', class: 'warrior', rarity: 'epic', desc: 'Gain an extra dart throw this turn.', effect: 'extra_dart', levelRequired: 4 },
  { id: 'util_revive', name: 'Phoenix Heart', icon: '❤️', type: 'utility', mode: 'both', class: 'priest', rarity: 'epic', desc: 'Revive the party to 25% HP once.', effect: 'revive', levelRequired: 5 },
];

const CARD_MAP: Record<string, CardDef> = Object.fromEntries(CARD_DEFS.map(c => [c.id, c]));

export function getCard(id: string): CardDef | undefined {
  return CARD_MAP[id];
}

export function cardsForMode(mode: 'competitive' | 'coop'): CardDef[] {
  return CARD_DEFS.filter(c => c.mode === mode || c.mode === 'both');
}

export function cardsForClass(cls: 'warrior' | 'priest' | 'rogue' | 'any', mode: 'competitive' | 'coop'): CardDef[] {
  return CARD_DEFS.filter(c => (c.mode === mode || c.mode === 'both') && (c.class === cls || c.class === 'any'));
}

export function cardMatchesMode(card: CardDef, mode: 'competitive' | 'coop'): boolean {
  return card.mode === mode || card.mode === 'both';
}

// ── Upgrades ──────────────────────────────────────────────────────────

export function upgradedCardDef(card: CardDef): CardDef {
  if (card.type === 'damage') {
    const base = card.base ?? 0;
    const mult = card.mult ?? 1;
    const originalDmg = base * mult;
    const upgradedDmg = Math.round(originalDmg * 1.5);
    return {
      ...card,
      upgraded: true,
      name: card.name + '+',
      desc: card.desc.replace(/Deal (\d+) damage/, (_, n) => `Deal ${Math.round(+n * 1.5)} damage`),
      base: mult > 1 ? Math.round(base * 1.5) : upgradedDmg,
      mult: mult > 1 ? mult : 1,
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
    case 'utility': return '#10b981';
  }
}

// Group cards by levelRequired for UI display.
export function cardsByLevel(cards: CardDef[]): Map<number, CardDef[]> {
  const map = new Map<number, CardDef[]>();
  for (const c of cards) {
    const lvl = c.levelRequired;
    if (!map.has(lvl)) map.set(lvl, []);
    map.get(lvl)!.push(c);
  }
  return map;
}
