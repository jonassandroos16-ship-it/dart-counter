import { describe, it, expect } from 'vitest';
import { cardChargeAmount } from './cardHelpers';
import { getCard } from './definitions';

describe('cardChargeAmount', () => {
  it('defaults to 10% (0.1) when the card omits `charge`', () => {
    const card = getCard('dmg_s20')!;
    expect(cardChargeAmount(card)).toBeCloseTo(0.1);
  });

  it('returns the explicit `charge` value when set', () => {
    const card = { ...getCard('dmg_s20')!, charge: 0.25 };
    expect(cardChargeAmount(card)).toBeCloseTo(0.25);
  });

  it('falls back to 10% for spell and utility cards without charge', () => {
    const spell = getCard('spell_heal')!;
    const util = getCard('util_focus')!;
    expect(cardChargeAmount(spell)).toBeCloseTo(0.1);
    expect(cardChargeAmount(util)).toBeCloseTo(0.1);
  });
});
