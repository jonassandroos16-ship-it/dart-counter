import type { CardDef } from './types';
import { CARD_DEFS } from './cardData';

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
    const lvl = c.levelRequired ?? 1;
    if (!map.has(lvl)) map.set(lvl, []);
    map.get(lvl)!.push(c);
  }
  return map;
}

// Split cards into starter (level 1) and leveled (level 2+) groups.
export function splitStarterAndLeveled(cards: CardDef[]): { starter: CardDef[]; leveled: Map<number, CardDef[]> } {
  const starter = cards.filter(c => (c.levelRequired ?? 1) === 1);
  const leveled = new Map<number, CardDef[]>();
  for (const c of cards) {
    const lvl = c.levelRequired ?? 1;
    if (lvl <= 1) continue;
    if (!leveled.has(lvl)) leveled.set(lvl, []);
    leveled.get(lvl)!.push(c);
  }
  return { starter, leveled };
}
