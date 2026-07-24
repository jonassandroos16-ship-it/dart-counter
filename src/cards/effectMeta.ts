export interface EffectMeta {
  icon: string;
  label: string;
  shortDesc: string;
  color: string;
}

const EFFECT_META: Record<string, EffectMeta> = {
  heal:           { icon: '✨', label: 'Heal',           shortDesc: 'Restores HP to the party',           color: '#22c55e' },
  heal_over_time: { icon: '💚', label: 'Regen',          shortDesc: 'Party regenerates HP over 3 turns',    color: '#22c55e' },
  crit_buff:      { icon: '🔮', label: 'Critical Vision',shortDesc: '20% chance to score critical hits (double damage) for 3 turns', color: '#a78bfa' },
  crit_guarantee: { icon: '🎯', label: 'Guaranteed Crit', shortDesc: 'Next damage cards are guaranteed to critically hit', color: '#a78bfa' },
  crit_multiplier: { icon: '💥', label: 'Brutal Crit',    shortDesc: 'Critical hits deal 3x damage instead of 2x',   color: '#ef4444' },
  party_shield_flat: { icon: '🛡️', label: 'Shield',     shortDesc: 'Absorbs flat damage for the party',   color: '#3b82f6' },
  party_shield:   { icon: '🛡️', label: 'Damage Reduction',shortDesc: 'Party takes reduced damage',         color: '#3b82f6' },
  enemy_curse:    { icon: '🔮', label: 'Curse',          shortDesc: 'Enemies are cursed, dealing less damage', color: '#a78bfa' },
  enemy_debuff:   { icon: '💀', label: 'Weaken',         shortDesc: 'Enemies are weakened',                color: '#ef4444' },
  enemy_miss:     { icon: '🌀', label: 'Distract',       shortDesc: 'Enemies may miss their attacks',      color: '#f59e0b' },
  bleed:          { icon: '🩸', label: 'Bleed',          shortDesc: 'Enemies take damage over time',       color: '#ef4444' },
  freeze:         { icon: '❄️', label: 'Freeze',         shortDesc: 'Enemies are frozen for 2 turns',      color: '#60a5fa' },
  surge:          { icon: '⚡', label: 'Surge',          shortDesc: 'Next visit scores double',            color: '#fbbf24' },
  hot_streak:     { icon: '🔥', label: 'Hot Streak',     shortDesc: 'Cumulative bonus per consecutive hit',color: '#f97316' },
  power_buff:     { icon: '💪', label: 'Power Up',       shortDesc: 'Party power increased for 3 turns',   color: '#fbbf24' },
  armor_buff:     { icon: '🏰', label: 'Fortify',        shortDesc: 'Party armor increased for 3 turns',   color: '#64748b' },
  reflect:        { icon: '🪞', label: 'Reflect',        shortDesc: 'Reflects damage back to attackers',   color: '#06b6d4' },
  draw:           { icon: '🃏', label: 'Draw',           shortDesc: 'Draw extra cards next turn',          color: '#10b981' },
  blessing:       { icon: '🙏', label: 'Blessing',        shortDesc: 'Draw 1 extra card next turn',         color: '#22c55e' },
  bust_protect:   { icon: '🛡️', label: 'Aegis Ward',     shortDesc: 'Party gains a flat damage shield',    color: '#3b82f6' },
  double_up:      { icon: '🌀', label: 'Hexbolt',        shortDesc: 'Curses enemies, reducing their damage', color: '#a78bfa' },
  extra_dart:     { icon: '➕', label: 'Extra Throw',    shortDesc: 'Grants an extra dart slot this turn', color: '#10b981' },
  extra_slot:     { icon: '➕', label: 'Extra Slots',    shortDesc: 'Grants extra card slots next turn',   color: '#10b981' },
  redraw:         { icon: '🔄', label: 'Redraw',         shortDesc: 'Discard hand and draw fresh cards',   color: '#06b6d4' },
  recycle:        { icon: '♻️', label: 'Recycle',        shortDesc: 'Shuffle graveyard back into deck',     color: '#10b981' },
  shadowstep:     { icon: '🌑', label: 'Shadowstep',     shortDesc: 'Swap last played card and draw extra',color: '#6366f1' },
  revive:         { icon: '❤️', label: 'Revive',         shortDesc: 'Revive defeated party members',       color: '#ef4444' },
};

export function getEffectMeta(effect?: string): EffectMeta | null {
  if (!effect) return null;
  return EFFECT_META[effect] ?? null;
}

export function effectIcon(effect?: string): string {
  return getEffectMeta(effect)?.icon ?? '✨';
}

export function effectLabel(effect?: string): string {
  return getEffectMeta(effect)?.label ?? 'Effect';
}

export function effectShortDesc(effect?: string): string {
  return getEffectMeta(effect)?.shortDesc ?? '';
}

export function effectColor(effect?: string): string {
  return getEffectMeta(effect)?.color ?? '#10b981';
}
