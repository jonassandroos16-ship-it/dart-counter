import type { CardDef } from './types';

// Effects whose `magnitude` is a percentage (0..100). These must never reach
// 100%+ through upgrades — that would make the party invulnerable
// (party_shield) or strip all enemy damage/accuracy (enemy_debuff/curse/miss).
// Cap upgrades at 80% so the card stays powerful but never broken.
const PERCENTAGE_EFFECTS = new Set([
  'party_shield',
  'enemy_debuff',
  'enemy_curse',
  'enemy_miss',
]);

const PERCENTAGE_CAP = 80;

function updateMagnitudeInDesc(desc: string, oldMag: number | undefined, newMag: number | undefined): string {
  if (oldMag === undefined || newMag === undefined || oldMag === newMag) return desc;
  return desc.split(String(oldMag)).join(String(newMag));
}

export function upgradedCardDef(card: CardDef): CardDef {
  const stripPlus = (name: string) => name.replace(/\+*$/, '');
  if (card.type === 'damage') {
    const base = card.base ?? 0;
    const mult = card.mult ?? 1;
    const originalDmg = base * mult;
    const upgradedDmg = Math.round(originalDmg * 1.3);
    return {
      ...card,
      upgraded: true,
      name: stripPlus(card.name) + '+',
      desc: card.desc.replace(/Deal (\d+) damage/, (_, n) => `Deal ${Math.round(+n * 1.3)} damage`),
      base: mult > 1 ? Math.round(base * 1.3) : upgradedDmg,
      mult: mult > 1 ? mult : 1,
    };
  }
  if (card.type === 'spell' || card.type === 'utility') {
    const isPercentage = !!card.effect && PERCENTAGE_EFFECTS.has(card.effect);
    let newMag = card.magnitude ? Math.round(card.magnitude * 1.3) : card.magnitude;
    if (isPercentage && typeof newMag === 'number') {
      newMag = Math.min(newMag, PERCENTAGE_CAP);
    }
    return {
      ...card,
      upgraded: true,
      name: stripPlus(card.name) + '+',
      desc: updateMagnitudeInDesc(card.desc, card.magnitude, newMag),
      magnitude: newMag,
    };
  }
  return { ...card, upgraded: true, name: stripPlus(card.name) + '+' };
}
