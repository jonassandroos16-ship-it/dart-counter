import { describe, it, expect } from 'vitest';
import { CARD_DEFS, getCard, cardDamage, upgradedCardDef, cardsForMode, cardsForClass, cardRarityColor, cardTypeColor } from './definitions';
import type { CardDef } from './types';

describe('Card Definitions', () => {
  it('has cards with valid types', () => {
    for (const c of CARD_DEFS) {
      expect(['damage', 'spell', 'utility']).toContain(c.type);
      expect(['competitive', 'coop']).toContain(c.mode);
      expect(['warrior', 'priest', 'rogue', 'any']).toContain(c.class);
      expect(['common', 'rare', 'epic']).toContain(c.rarity);
    }
  });

  it('has damage, spell, and utility cards', () => {
    expect(CARD_DEFS.some(c => c.type === 'damage')).toBe(true);
    expect(CARD_DEFS.some(c => c.type === 'spell')).toBe(true);
    expect(CARD_DEFS.some(c => c.type === 'utility')).toBe(true);
  });

  it('has both competitive and coop cards', () => {
    expect(CARD_DEFS.some(c => c.mode === 'competitive')).toBe(true);
    expect(CARD_DEFS.some(c => c.mode === 'coop')).toBe(true);
  });

  it('getCard returns definition by id', () => {
    const t20 = getCard('dmg_t20');
    expect(t20).toBeDefined();
    expect(t20?.name).toBe('Triple 20');
    expect(t20?.type).toBe('damage');
  });

  it('getCard returns undefined for unknown id', () => {
    expect(getCard('nonexistent')).toBeUndefined();
  });

  it('cardDamage computes base * mult', () => {
    expect(cardDamage(getCard('dmg_t20')!)).toBe(60);
    expect(cardDamage(getCard('dmg_d20')!)).toBe(40);
    expect(cardDamage(getCard('dmg_miss')!)).toBe(0);
  });

  it('cardDamage returns 0 for non-damage cards', () => {
    expect(cardDamage(getCard('spell_bust_protect')!)).toBe(0);
    expect(cardDamage(getCard('util_reroll')!)).toBe(0);
  });

  it('upgradedCardDef increases damage by 50%', () => {
    const base = getCard('dmg_t20')!;
    const upgraded = upgradedCardDef(base);
    expect(upgraded.upgraded).toBe(true);
    expect(upgraded.name).toBe('Triple 20+');
    expect(cardDamage(upgraded)).toBe(90);
  });

  it('upgradedCardDef increases magnitude by 50%', () => {
    const base = getCard('spell_coop_heal')!;
    const upgraded = upgradedCardDef(base);
    expect(upgraded.magnitude).toBe(120);
  });

  it('cardsForMode filters by mode', () => {
    const comp = cardsForMode('competitive');
    const coop = cardsForMode('coop');
    expect(comp.every(c => c.mode === 'competitive')).toBe(true);
    expect(coop.every(c => c.mode === 'coop')).toBe(true);
  });

  it('cardsForClass filters by class and includes any', () => {
    const warriorCards = cardsForClass('warrior', 'coop');
    expect(warriorCards.every(c => c.class === 'warrior' || c.class === 'any')).toBe(true);
    expect(warriorCards.length).toBeGreaterThan(0);
  });

  it('cardRarityColor returns correct colors', () => {
    expect(cardRarityColor('common')).toBe('var(--border)');
    expect(cardRarityColor('rare')).toBe('#3b82f6');
    expect(cardRarityColor('epic')).toBe('#f59e0b');
  });

  it('cardTypeColor returns red for damage, blue for spell and utility', () => {
    expect(cardTypeColor('damage')).toBe('#ef4444');
    expect(cardTypeColor('spell')).toBe('#3b82f6');
    expect(cardTypeColor('utility')).toBe('#3b82f6');
  });
});
