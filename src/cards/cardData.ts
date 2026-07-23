import type { CardDef } from './types';

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
// Cards can be upgraded up to 5 times (upgradeLevel 0-5). Each upgrade
// increases damage or magnitude by 30%.
//
// Class themes:
//   Warrior: raw power (high damage) + party buffs (shields, tankiness)
//   Priest:  dark curses (enemy debuffs) + healing/buffing the party
//   Rogue:   traps & bleed (enemy weakens over time) + debuffing (miss/skip)

export const CARD_DEFS: CardDef[] = [
  // ── Starter shared attack cards (Level 1, class 'any') ────────────
  { id: 'dmg_s20', name: 'Single 20', icon: '🎯', type: 'damage', mode: 'both', class: 'any', rarity: 'common', desc: 'Deal 20 damage.', base: 20, mult: 1, levelRequired: 1 },
  { id: 'dmg_d20', name: 'Double 20', icon: '🎯', type: 'damage', mode: 'both', class: 'any', rarity: 'common', desc: 'Deal 40 damage.', base: 20, mult: 2, levelRequired: 1 },
  { id: 'dmg_outer_bull', name: 'Outer Bull', icon: '🟢', type: 'damage', mode: 'both', class: 'any', rarity: 'common', desc: 'Deal 25 damage.', base: 25, mult: 1, levelRequired: 1 },
  // ── Starter shared utility cards (Level 1, class 'any') ───────────
  { id: 'util_redraw', name: 'Redraw', icon: '🔄', type: 'utility', mode: 'both', class: 'any', rarity: 'common', desc: 'Discard your hand and draw the same number of fresh cards.', effect: 'redraw', levelRequired: 1 },
  { id: 'util_recycle', name: 'Recycle', icon: '♻️', type: 'utility', mode: 'both', class: 'any', rarity: 'common', desc: 'Shuffle your graveyard back into your deck.', effect: 'recycle', levelRequired: 1 },
  { id: 'util_focus', name: 'Focus', icon: '🧠', type: 'utility', mode: 'both', class: 'any', rarity: 'common', desc: 'Play 1 more card next turn (4 instead of 3). Stacks.', effect: 'extra_slot', magnitude: 1, levelRequired: 1 },
  // ── Starter warrior cards (Level 1) ──────────────────────────────
  { id: 'dmg_warrior_slam', name: 'Mighty Slam', icon: '⚔️', type: 'damage', mode: 'both', class: 'warrior', rarity: 'common', desc: 'Deal 30 damage with brute force.', base: 30, mult: 1, levelRequired: 1 },
  { id: 'dmg_warrior_cleave', name: 'Cleave', icon: '🪓', type: 'damage', mode: 'both', class: 'warrior', rarity: 'common', desc: 'Deal 45 damage with a wide swing.', base: 45, mult: 1, levelRequired: 1 },
  { id: 'spell_surge', name: 'Surge', icon: '⚡', type: 'spell', mode: 'both', class: 'warrior', rarity: 'common', desc: 'Your next visit scores double.', effect: 'surge', magnitude: 2, levelRequired: 1 },
  { id: 'spell_hot_streak', name: 'Hot Streak', icon: '🔥', type: 'spell', mode: 'both', class: 'warrior', rarity: 'common', desc: '+5 per dart cumulative bonus next visit.', effect: 'hot_streak', magnitude: 5, levelRequired: 1 },
  { id: 'util_warrior_rage', name: 'Battle Rage', icon: '💢', type: 'utility', mode: 'both', class: 'warrior', rarity: 'common', desc: 'Draw 2 extra cards next turn.', effect: 'draw', magnitude: 2, levelRequired: 1 },
  // ── Starter priest cards (Level 1) ───────────────────────────────
  { id: 'dmg_priest_smite', name: 'Holy Smite', icon: '✨', type: 'damage', mode: 'both', class: 'priest', rarity: 'common', desc: 'Deal 35 damage with divine power.', base: 35, mult: 1, levelRequired: 1 },
  { id: 'dmg_priest_judgment', name: 'Divine Judgment', icon: '⚖️', type: 'damage', mode: 'both', class: 'priest', rarity: 'common', desc: 'Deal 50 damage with holy judgment.', base: 50, mult: 1, levelRequired: 1 },
  { id: 'spell_heal', name: 'Healing Light', icon: '✨', type: 'spell', mode: 'both', class: 'priest', rarity: 'common', desc: 'Restore 80 HP to the party.', effect: 'heal', magnitude: 80, levelRequired: 1 },
  { id: 'spell_accuracy_buff', name: 'Divine Foresight', icon: '🔮', type: 'spell', mode: 'both', class: 'priest', rarity: 'common', desc: 'Bless the party with divine sight: +20% hit chance for 3 turns.', effect: 'accuracy_buff', magnitude: 20, levelRequired: 1 },
  { id: 'util_priest_blessing', name: 'Divine Blessing', icon: '🙏', type: 'utility', mode: 'both', class: 'priest', rarity: 'common', desc: 'Restore 40 HP and draw 1 extra card.', effect: 'blessing', magnitude: 40, levelRequired: 1 },
  // ── Starter rogue cards (Level 1) ────────────────────────────────
  { id: 'dmg_rogue_backstab', name: 'Backstab', icon: '🗡️', type: 'damage', mode: 'both', class: 'rogue', rarity: 'common', desc: 'Deal 40 damage from the shadows.', base: 40, mult: 1, levelRequired: 1 },
  { id: 'dmg_rogue_poison', name: 'Poison Strike', icon: '🐍', type: 'damage', mode: 'both', class: 'rogue', rarity: 'common', desc: 'Deal 30 damage plus 10 poison next turn.', base: 30, mult: 1, levelRequired: 1 },
  { id: 'spell_enemy_debuff', name: 'Weaken', icon: '💀', type: 'spell', mode: 'both', class: 'rogue', rarity: 'common', desc: 'Enemies deal -30% damage for 2 turns.', effect: 'enemy_debuff', magnitude: 30, levelRequired: 1 },
  { id: 'spell_freeze', name: 'Frost Nova', icon: '❄️', type: 'spell', mode: 'both', class: 'rogue', rarity: 'common', desc: 'Freeze all enemies for 1 turn.', effect: 'freeze', levelRequired: 1 },
  { id: 'util_rogue_shadowstep', name: 'Shadowstep', icon: '🌑', type: 'utility', mode: 'both', class: 'rogue', rarity: 'common', desc: 'Draw 1 extra card and swap a used card back.', effect: 'shadowstep', magnitude: 1, levelRequired: 1 },
  // ── Level 2 — Improved damage cards ───────────────────────────────
  { id: 'dmg_t20', name: 'Triple 20', icon: '🎯', type: 'damage', mode: 'both', class: 'any', rarity: 'rare', desc: 'Deal 60 damage.', base: 20, mult: 3, levelRequired: 2 },
  { id: 'dmg_t19', name: 'Triple 19', icon: '🎯', type: 'damage', mode: 'both', class: 'any', rarity: 'rare', desc: 'Deal 57 damage.', base: 19, mult: 3, levelRequired: 2 },
  { id: 'dmg_t18', name: 'Triple 18', icon: '🎯', type: 'damage', mode: 'both', class: 'any', rarity: 'rare', desc: 'Deal 54 damage.', base: 18, mult: 3, levelRequired: 2 },
  { id: 'dmg_bull', name: 'Bullseye', icon: '🐂', type: 'damage', mode: 'both', class: 'any', rarity: 'rare', desc: 'Deal 50 damage.', base: 50, mult: 1, levelRequired: 2 },
  { id: 'dmg_s19', name: 'Single 19', icon: '🎯', type: 'damage', mode: 'both', class: 'any', rarity: 'common', desc: 'Deal 19 damage.', base: 19, mult: 1, levelRequired: 2 },
  { id: 'dmg_s18', name: 'Single 18', icon: '🎯', type: 'damage', mode: 'both', class: 'any', rarity: 'common', desc: 'Deal 18 damage.', base: 18, mult: 1, levelRequired: 2 },
  // ── Level 2 — Spells & utility ────────────────────────────────────
  { id: 'spell_bust_protect', name: 'Soul Barrier', icon: '🛡️', type: 'spell', mode: 'both', class: 'any', rarity: 'rare', desc: 'A protective ward absorbs overflow damage, preventing self-harm from overkill strikes.', effect: 'bust_protect', levelRequired: 2 },
  { id: 'spell_double_up', name: 'Spell Disruption', icon: '🌀', type: 'spell', mode: 'both', class: 'any', rarity: 'rare', desc: 'Disrupt enemy focus: their next empowered strike fizzles to nothing.', effect: 'double_up', levelRequired: 2 },
  { id: 'util_draw', name: 'Quick Draw', icon: '🃏', type: 'utility', mode: 'both', class: 'any', rarity: 'rare', desc: 'Draw an extra card next turn.', effect: 'draw', magnitude: 1, levelRequired: 2 },
  // ── Level 2 — Class-specific cards ────────────────────────────────
  { id: 'dmg_warrior_mighty_blow', name: 'Mighty Blow', icon: '💥', type: 'damage', mode: 'both', class: 'warrior', rarity: 'rare', desc: 'Deal 70 damage with overwhelming force.', base: 70, mult: 1, levelRequired: 2 },
  { id: 'spell_warrior_shield_wall', name: 'Shield Wall', icon: '🛡️', type: 'spell', mode: 'both', class: 'warrior', rarity: 'rare', desc: 'Party gains a shield that absorbs 60 flat damage for 2 turns.', effect: 'party_shield_flat', magnitude: 60, levelRequired: 2 },
  { id: 'spell_priest_curse', name: 'Hex of Frailty', icon: '🔮', type: 'spell', mode: 'both', class: 'priest', rarity: 'rare', desc: 'Curses all enemies: -25% damage for 3 turns.', effect: 'enemy_curse', magnitude: 25, levelRequired: 2 },
  { id: 'spell_priest_renew', name: 'Renew', icon: '💚', type: 'spell', mode: 'both', class: 'priest', rarity: 'rare', desc: 'Party heals 30 HP per turn for 3 turns.', effect: 'heal_over_time', magnitude: 30, levelRequired: 2 },
  { id: 'spell_rogue_bleed', name: 'Rupture', icon: '🩸', type: 'spell', mode: 'both', class: 'rogue', rarity: 'rare', desc: 'Enemies bleed for 25 damage per turn for 3 turns.', effect: 'bleed', magnitude: 25, levelRequired: 2 },
  { id: 'spell_rogue_trap', name: 'Snare Trap', icon: '🪤', type: 'spell', mode: 'both', class: 'rogue', rarity: 'rare', desc: 'Enemies have 30% chance to miss next turn.', effect: 'enemy_miss', magnitude: 30, levelRequired: 2 },
  // ── Level 3 — Class-specific damage cards ─────────────────────────
  { id: 'dmg_warrior_strike', name: 'Warrior Strike', icon: '⚔️', type: 'damage', mode: 'both', class: 'warrior', rarity: 'rare', desc: 'Deal 60 damage with warrior power.', base: 20, mult: 3, levelRequired: 3 },
  { id: 'dmg_priest_smite_greater', name: 'Greater Smite', icon: '✨', type: 'damage', mode: 'both', class: 'priest', rarity: 'rare', desc: 'Deal 50 damage with divine power.', base: 50, mult: 1, levelRequired: 3 },
  { id: 'dmg_rogue_assassinate', name: 'Assassinate', icon: '🥷', type: 'damage', mode: 'both', class: 'rogue', rarity: 'rare', desc: 'Deal 70 damage with lethal precision.', base: 70, mult: 1, levelRequired: 3 },
  // ── Level 3 — Spells ──────────────────────────────────────────────
  { id: 'spell_power_buff', name: 'Power Infusion', icon: '💪', type: 'spell', mode: 'both', class: 'warrior', rarity: 'rare', desc: 'Party gains +10 power for 3 turns.', effect: 'power_buff', magnitude: 10, levelRequired: 3 },
  // ── Level 3 — Utility ─────────────────────────────────────────────
  { id: 'util_shield', name: 'Party Shield', icon: '🛡️', type: 'utility', mode: 'both', class: 'priest', rarity: 'rare', desc: 'Party takes 50% less damage for 2 turns.', effect: 'party_shield', magnitude: 50, levelRequired: 3 },
  // ── Level 3 — Common shared cards ─────────────────────────────────
  { id: 'dmg_t17', name: 'Triple 17', icon: '🎯', type: 'damage', mode: 'both', class: 'any', rarity: 'rare', desc: 'Deal 51 damage.', base: 17, mult: 3, levelRequired: 3 },
  { id: 'util_lucky_draw', name: 'Lucky Draw', icon: '🍀', type: 'utility', mode: 'both', class: 'any', rarity: 'rare', desc: 'Draw 2 extra cards next turn.', effect: 'draw', magnitude: 2, levelRequired: 3 },
  // ── Level 4 — Epic damage cards ───────────────────────────────────
  { id: 'dmg_meteor', name: 'Meteor Strike', icon: '☄️', type: 'damage', mode: 'both', class: 'any', rarity: 'epic', desc: 'Deal 80 damage in a blazing impact.', base: 80, mult: 1, levelRequired: 4 },
  { id: 'dmg_warrior_cleave_epic', name: 'Whirlwind', icon: '🌀', type: 'damage', mode: 'both', class: 'warrior', rarity: 'epic', desc: 'Deal 90 damage with a mighty whirlwind.', base: 90, mult: 1, levelRequired: 4 },
  { id: 'dmg_priest_judgment_epic', name: 'Armageddon', icon: '🌋', type: 'damage', mode: 'both', class: 'priest', rarity: 'epic', desc: 'Deal 85 damage with holy judgment.', base: 85, mult: 1, levelRequired: 4 },
  { id: 'dmg_rogue_assassinate_epic', name: 'Death Strike', icon: '💀', type: 'damage', mode: 'both', class: 'rogue', rarity: 'epic', desc: 'Deal 95 damage with lethal precision.', base: 95, mult: 1, levelRequired: 4 },
  // ── Level 4 — Epic utility ────────────────────────────────────────
  { id: 'util_extra_dart', name: 'Extra Throw', icon: '➕', type: 'utility', mode: 'both', class: 'warrior', rarity: 'epic', desc: 'Gain an extra dart throw this turn.', effect: 'extra_dart', levelRequired: 4 },
  // ── Level 4 — Common shared cards ─────────────────────────────────
  { id: 'dmg_t16', name: 'Triple 16', icon: '🎯', type: 'damage', mode: 'both', class: 'any', rarity: 'rare', desc: 'Deal 48 damage.', base: 16, mult: 3, levelRequired: 4 },
  { id: 'spell_fortify', name: 'Fortify', icon: '🏰', type: 'spell', mode: 'both', class: 'any', rarity: 'rare', desc: 'Party gains +15% armor for 3 turns.', effect: 'armor_buff', magnitude: 15, levelRequired: 4 },
  // ── Level 5 — Legendary cards ─────────────────────────────────────
  { id: 'dmg_apocalypse', name: 'Apocalypse', icon: '🌋', type: 'damage', mode: 'both', class: 'any', rarity: 'epic', desc: 'Deal 120 damage. The board trembles.', base: 120, mult: 1, levelRequired: 5 },
  { id: 'util_revive', name: 'Phoenix Heart', icon: '❤️', type: 'utility', mode: 'both', class: 'priest', rarity: 'epic', desc: 'Revive the party to 25% HP once.', effect: 'revive', levelRequired: 5 },
  // ── Level 5 — Class-specific cards ────────────────────────────────
  { id: 'dmg_warrior_execute', name: 'Execute', icon: '⚔️', type: 'damage', mode: 'both', class: 'warrior', rarity: 'epic', desc: 'Deal 100 damage. Double damage if enemy is below 50% HP.', base: 100, mult: 1, levelRequired: 5 },
  { id: 'spell_warrior_bulwark', name: 'Bulwark', icon: '🛡️', type: 'spell', mode: 'both', class: 'warrior', rarity: 'epic', desc: 'Party gains a shield absorbing 150 flat damage for 3 turns.', effect: 'party_shield_flat', magnitude: 150, levelRequired: 5 },
  { id: 'spell_priest_doom', name: 'Doom', icon: '☠️', type: 'spell', mode: 'both', class: 'priest', rarity: 'epic', desc: 'Curses enemies: -50% damage and -20% armor for 3 turns.', effect: 'enemy_curse', magnitude: 50, levelRequired: 5 },
  { id: 'spell_priest_sanctuary', name: 'Sanctuary', icon: '⛪', type: 'spell', mode: 'both', class: 'priest', rarity: 'epic', desc: 'Party heals 50 HP per turn for 3 turns and gains +20% armor.', effect: 'heal_over_time', magnitude: 50, levelRequired: 5 },
  { id: 'spell_rogue_hemorrhage', name: 'Hemorrhage', icon: '🩸', type: 'spell', mode: 'both', class: 'rogue', rarity: 'epic', desc: 'Enemies bleed for 50 damage per turn for 4 turns.', effect: 'bleed', magnitude: 50, levelRequired: 5 },
  { id: 'spell_rogue_confusion', name: 'Confusion', icon: '🌀', type: 'spell', mode: 'both', class: 'rogue', rarity: 'epic', desc: 'Enemies have 50% chance to miss and deal -30% damage for 2 turns.', effect: 'enemy_miss', magnitude: 50, levelRequired: 5 },
  // ── Level 5 — Common shared cards ─────────────────────────────────
  { id: 'dmg_double_bull', name: 'Double Bullseye', icon: '🐂', type: 'damage', mode: 'both', class: 'any', rarity: 'epic', desc: 'Deal 100 damage with a perfect double bull.', base: 50, mult: 2, levelRequired: 5 },
  { id: 'util_pocket_sand', name: 'Pocket Sand', icon: '🏜️', type: 'utility', mode: 'both', class: 'any', rarity: 'rare', desc: 'Blind enemies: 25% miss chance for 2 turns.', effect: 'enemy_miss', magnitude: 25, levelRequired: 5 },
  // ── Level 6 — Class-specific cards ────────────────────────────────
  { id: 'dmg_warrior_titan_slam', name: 'Titan Slam', icon: '💪', type: 'damage', mode: 'both', class: 'warrior', rarity: 'epic', desc: 'Deal 130 damage with titanic force.', base: 130, mult: 1, levelRequired: 6 },
  { id: 'spell_warrior_rally', name: 'Rally Cry', icon: '📢', type: 'spell', mode: 'both', class: 'warrior', rarity: 'epic', desc: 'Party gains +15 power and +10% armor for 3 turns.', effect: 'power_buff', magnitude: 15, levelRequired: 6 },
  { id: 'spell_priest_plague', name: 'Plague', icon: '🦠', type: 'spell', mode: 'both', class: 'priest', rarity: 'epic', desc: 'Inflicts plague: enemies take 40 damage per turn and -30% healing for 3 turns.', effect: 'bleed', magnitude: 40, levelRequired: 6 },
  { id: 'spell_priest_divine_favor', name: 'Divine Favor', icon: '🌟', type: 'spell', mode: 'both', class: 'priest', rarity: 'epic', desc: 'Party heals 40 HP per turn for 3 turns and draws 2 extra cards next turn.', effect: 'heal_over_time', magnitude: 40, levelRequired: 6 },
  { id: 'spell_rogue_caltrops', name: 'Caltrops', icon: '🔺', type: 'spell', mode: 'both', class: 'rogue', rarity: 'epic', desc: 'Scatter caltrops: enemies bleed 35 damage/turn and have 20% miss chance for 3 turns.', effect: 'bleed', magnitude: 35, levelRequired: 6 },
  { id: 'spell_rogue_blind', name: 'Blinding Powder', icon: '💨', type: 'spell', mode: 'both', class: 'rogue', rarity: 'epic', desc: 'Blinds enemies: 40% miss chance and -20% damage for 3 turns.', effect: 'enemy_miss', magnitude: 40, levelRequired: 6 },
  // ── Level 6 — Common shared cards ─────────────────────────────────
  { id: 'dmg_triple_bull', name: 'Triple Bullseye', icon: '🎯', type: 'damage', mode: 'both', class: 'any', rarity: 'epic', desc: 'Deal 150 damage with a legendary triple bull.', base: 50, mult: 3, levelRequired: 6 },
  { id: 'spell_reflect', name: 'Reflect', icon: '🪞', type: 'spell', mode: 'both', class: 'any', rarity: 'epic', desc: 'Reflect 50% of enemy damage back for 2 turns.', effect: 'reflect', magnitude: 50, levelRequired: 6 },
  // ── Level 7 — Class-specific cards ────────────────────────────────
  { id: 'dmg_warrior_godslayer', name: 'Godslayer', icon: '⚔️', type: 'damage', mode: 'both', class: 'warrior', rarity: 'epic', desc: 'Deal 160 damage. Ignores 50% of enemy armor.', base: 160, mult: 1, levelRequired: 7 },
  { id: 'spell_warrior_aegis', name: 'Aegis', icon: '🛡️', type: 'spell', mode: 'both', class: 'warrior', rarity: 'epic', desc: 'Party gains a shield absorbing 250 flat damage for 3 turns and +20% armor.', effect: 'party_shield_flat', magnitude: 250, levelRequired: 7 },
  { id: 'spell_priest_banish', name: 'Banish', icon: '🌑', type: 'spell', mode: 'both', class: 'priest', rarity: 'epic', desc: 'Banishes enemies: -60% damage, -30% armor, and 20% miss chance for 2 turns.', effect: 'enemy_curse', magnitude: 60, levelRequired: 7 },
  { id: 'spell_priest_miracle', name: 'Miracle', icon: '✨', type: 'spell', mode: 'both', class: 'priest', rarity: 'epic', desc: 'Party heals 80 HP per turn for 3 turns. Revive any defeated ally to 50% HP.', effect: 'heal_over_time', magnitude: 80, levelRequired: 7 },
  { id: 'spell_rogue_garrote', name: 'Garrote', icon: '🩸', type: 'spell', mode: 'both', class: 'rogue', rarity: 'epic', desc: 'Strangle: enemies bleed 70 damage per turn for 3 turns and -40% damage.', effect: 'bleed', magnitude: 70, levelRequired: 7 },
  { id: 'spell_rogue_stun_trap', name: 'Stun Trap', icon: '⚡', type: 'spell', mode: 'both', class: 'rogue', rarity: 'epic', desc: 'Enemies are stunned: 60% chance to skip their next turn and 30% miss chance for 2 turns.', effect: 'enemy_miss', magnitude: 60, levelRequired: 7 },
  // ── Level 7 — Common shared cards ─────────────────────────────────
  { id: 'dmg_nova', name: 'Nova Strike', icon: '💫', type: 'damage', mode: 'both', class: 'any', rarity: 'epic', desc: 'Deal 140 damage in a blinding flash.', base: 140, mult: 1, levelRequired: 7 },
  { id: 'util_time_warp', name: 'Time Warp', icon: '⏰', type: 'utility', mode: 'both', class: 'any', rarity: 'epic', desc: 'Draw 3 extra cards and gain an extra dart throw next turn.', effect: 'draw', magnitude: 3, levelRequired: 7 },
  // ── Level 8 — Class-specific cards ────────────────────────────────
  { id: 'dmg_warrior_earthquake', name: 'Earthquake', icon: '🌍', type: 'damage', mode: 'both', class: 'warrior', rarity: 'epic', desc: 'Deal 180 damage. All enemies lose 10% armor.', base: 180, mult: 1, levelRequired: 8 },
  { id: 'spell_warrior_fortress', name: 'Fortress', icon: '🏰', type: 'spell', mode: 'both', class: 'warrior', rarity: 'epic', desc: 'Party gains +25% armor, a 300-damage shield, and +20 power for 3 turns.', effect: 'party_shield_flat', magnitude: 300, levelRequired: 8 },
  { id: 'spell_priest_wither', name: 'Wither', icon: '枯', type: 'spell', mode: 'both', class: 'priest', rarity: 'epic', desc: 'Withers enemies: -70% damage, -40% armor, and 30% miss chance for 3 turns.', effect: 'enemy_curse', magnitude: 70, levelRequired: 8 },
  { id: 'spell_priest_feast', name: 'Divine Feast', icon: '🍷', type: 'spell', mode: 'both', class: 'priest', rarity: 'epic', desc: 'Party heals 100 HP per turn for 3 turns, gains +30% damage, and draws 3 extra cards.', effect: 'heal_over_time', magnitude: 100, levelRequired: 8 },
  { id: 'spell_rogue_death_mark', name: 'Death Mark', icon: '💀', type: 'spell', mode: 'both', class: 'rogue', rarity: 'epic', desc: 'Marks all enemies: bleed 90 damage per turn for 4 turns and -50% healing.', effect: 'bleed', magnitude: 90, levelRequired: 8 },
  { id: 'spell_rogue_paranoia', name: 'Paranoia', icon: '😱', type: 'spell', mode: 'both', class: 'rogue', rarity: 'epic', desc: 'Enemies panic: 70% miss chance, -40% damage, and 40% chance to skip turns for 2 turns.', effect: 'enemy_miss', magnitude: 70, levelRequired: 8 },
  // ── Level 8 — Common shared cards ─────────────────────────────────
  { id: 'dmg_annihilation', name: 'Annihilation', icon: '💥', type: 'damage', mode: 'both', class: 'any', rarity: 'epic', desc: 'Deal 200 damage. Devastating.', base: 200, mult: 1, levelRequired: 8 },
  { id: 'spell_mirror_image', name: 'Mirror Image', icon: '🪞', type: 'spell', mode: 'both', class: 'any', rarity: 'epic', desc: 'Create illusions: 40% enemy miss chance and reflect 40% damage for 3 turns.', effect: 'reflect', magnitude: 40, levelRequired: 8 },
  // ── Level 9 — Class-specific cards ────────────────────────────────
  { id: 'dmg_warrior_ragnarok', name: 'Ragnarok', icon: '🌋', type: 'damage', mode: 'both', class: 'warrior', rarity: 'epic', desc: 'Deal 220 damage. Ignores all enemy armor.', base: 220, mult: 1, levelRequired: 9 },
  { id: 'spell_warrior_last_stand', name: 'Last Stand', icon: '🛡️', type: 'spell', mode: 'both', class: 'warrior', rarity: 'epic', desc: 'Party gains a 500-damage shield, +30% armor, and +25 power for 3 turns.', effect: 'party_shield_flat', magnitude: 500, levelRequired: 9 },
  { id: 'spell_priest_apocalypse_curse', name: 'Apocalypse Curse', icon: '☠️', type: 'spell', mode: 'both', class: 'priest', rarity: 'epic', desc: 'Apocalyptic curse: -80% damage, -50% armor, 40% miss chance, and 50 damage/turn for 3 turns.', effect: 'enemy_curse', magnitude: 80, levelRequired: 9 },
  { id: 'spell_priest_ascension', name: 'Ascension', icon: '👼', type: 'spell', mode: 'both', class: 'priest', rarity: 'epic', desc: 'Party ascends: heals 120 HP/turn for 3 turns, +50% damage, and full card draw each turn.', effect: 'heal_over_time', magnitude: 120, levelRequired: 9 },
  { id: 'spell_rogue_inferno_bleed', name: 'Inferno Bleed', icon: '🔥', type: 'spell', mode: 'both', class: 'rogue', rarity: 'epic', desc: 'Sets enemies ablaze: 120 bleed damage per turn for 4 turns and -60% healing.', effect: 'bleed', magnitude: 120, levelRequired: 9 },
  { id: 'spell_rogue_nightmare', name: 'Nightmare', icon: '😴', type: 'spell', mode: 'both', class: 'rogue', rarity: 'epic', desc: 'Enemies trapped in nightmares: 80% miss chance, 50% skip chance, -50% damage for 2 turns.', effect: 'enemy_miss', magnitude: 80, levelRequired: 9 },
  // ── Level 9 — Common shared cards ─────────────────────────────────
  { id: 'dmg_supernova', name: 'Supernova', icon: '🌟', type: 'damage', mode: 'both', class: 'any', rarity: 'epic', desc: 'Deal 250 damage. A star goes supernova.', base: 250, mult: 1, levelRequired: 9 },
  { id: 'spell_mass_haste', name: 'Mass Haste', icon: '💨', type: 'spell', mode: 'both', class: 'any', rarity: 'epic', desc: 'Party draws 4 extra cards and gains 2 extra dart throws next turn.', effect: 'draw', magnitude: 4, levelRequired: 9 },
  // ── Level 10 — Class-specific cards ──────────────────────────────
  { id: 'dmg_warrior_omega_slash', name: 'Omega Slash', icon: '⚔️', type: 'damage', mode: 'both', class: 'warrior', rarity: 'epic', desc: 'Deal 300 damage. The ultimate strike. Ignores all armor.', base: 300, mult: 1, levelRequired: 10 },
  { id: 'spell_warrior_impenetrable', name: 'Impenetrable', icon: '🛡️', type: 'spell', mode: 'both', class: 'warrior', rarity: 'epic', desc: 'Party becomes invulnerable for 1 turn, then gains a 600-damage shield for 2 more turns.', effect: 'party_shield_flat', magnitude: 600, levelRequired: 10 },
  { id: 'spell_priest_eternal_damnation', name: 'Eternal Damnation', icon: '😈', type: 'spell', mode: 'both', class: 'priest', rarity: 'epic', desc: 'Ultimate curse: -90% damage, -60% armor, 50% miss chance, 80 bleed damage/turn for 3 turns.', effect: 'enemy_curse', magnitude: 90, levelRequired: 10 },
  { id: 'spell_priest_holy_revelation', name: 'Holy Revelation', icon: '🌟', type: 'spell', mode: 'both', class: 'priest', rarity: 'epic', desc: 'Party heals 150 HP/turn for 3 turns, gains +75% damage, full revive, and 4 extra cards each turn.', effect: 'heal_over_time', magnitude: 150, levelRequired: 10 },
  { id: 'spell_rogue_arterial_spray', name: 'Arterial Spray', icon: '🩸', type: 'spell', mode: 'both', class: 'rogue', rarity: 'epic', desc: 'Massive bleed: 150 damage per turn for 5 turns. -70% healing. Stacks with other bleeds.', effect: 'bleed', magnitude: 150, levelRequired: 10 },
  { id: 'spell_rogue_total_disruption', name: 'Total Disruption', icon: '🌀', type: 'spell', mode: 'both', class: 'rogue', rarity: 'epic', desc: 'Complete disruption: 90% miss chance, 60% skip chance, -70% damage for 3 turns.', effect: 'enemy_miss', magnitude: 90, levelRequired: 10 },
  // ── Level 10 — Common shared cards ────────────────────────────────
  { id: 'dmg_big_bang', name: 'Big Bang', icon: '🌌', type: 'damage', mode: 'both', class: 'any', rarity: 'epic', desc: 'Deal 350 damage. The universe itself shatters.', base: 350, mult: 1, levelRequired: 10 },
  { id: 'spell_armageddon', name: 'Armageddon', icon: '☄️', type: 'spell', mode: 'both', class: 'any', rarity: 'epic', desc: 'Enemies take 100 damage/turn, -80% damage, 40% miss chance for 3 turns. Party heals 80 HP/turn.', effect: 'reflect', magnitude: 100, levelRequired: 10 },
];
