import type { CampaignDart, ExactTarget, ShieldLayer, SpanTarget } from '../types';
// flatHp assigned per shield layer in card mode — span shields (easier to hit
// on a real board) absorb 40, exact shields (harder) absorb 60.

const TOP_HALF = [20, 1, 18, 4, 13, 6, 10, 15];
const BOTTOM_HALF = [2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
const LEFT_HALF = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
const RIGHT_HALF: number[] = [];

export function isTopHalf(base: number): boolean {
  return TOP_HALF.includes(base);
}

export function isBottomHalf(base: number): boolean {
  return BOTTOM_HALF.includes(base);
}

export function isLeftHalf(base: number): boolean {
  return LEFT_HALF.includes(base);
}

export function isRightHalf(base: number): boolean {
  return RIGHT_HALF.includes(base);
}

export function neighborsOf(base: number): number[] {
  const idx = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5].indexOf(base);
  if (idx < 0) return [base];
  const left = idx > 0 ? idx - 1 : 19;
  const right = idx < 19 ? idx + 1 : 0;
  return [
    [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5][left],
    [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5][right],
  ];
}

export function dartMatchesShield(dart: CampaignDart, shield: ShieldLayer): boolean {
  if (shield.type === 'span') {
    const target = shield.target_value as SpanTarget;
    if (target === 'TOP_HALF') return isTopHalf(dart.base);
    if (target === 'BOTTOM_HALF') return isBottomHalf(dart.base);
    if (target === 'LEFT_HALF') return isLeftHalf(dart.base);
    if (target === 'RIGHT_HALF') return isRightHalf(dart.base);
    return false;
  }
  const t = shield.target_value as ExactTarget;
  return matchesExactTarget(dart, t);
}

export function matchesExactTarget(dart: CampaignDart, target: ExactTarget): boolean {
  if (target === 'Bull') return dart.isBull;
  if (target === '25') return dart.base === 25;
  const m = target.match(/^([TD])(\d+)$/);
  if (!m) return false;
  const mult = m[1] === 'T' ? 3 : 2;
  const base = parseInt(m[2], 10);
  return dart.base === base && dart.mult >= mult;
}

export function flatHpForShield(shield: ShieldLayer): number {
  return shield.type === 'exact' ? 60 : 40;
}

export function describeShield(shield: ShieldLayer): string {
  if (shield.flatHp != null) return `${shield.flatHp}HP shield`;
  if (shield.type === 'span') {
    const map: Record<string, string> = {
      TOP_HALF: 'Top Half',
      BOTTOM_HALF: 'Bottom Half',
      LEFT_HALF: 'Left Half',
      RIGHT_HALF: 'Right Half',
    };
    return map[shield.target_value as SpanTarget] || String(shield.target_value);
  }
  const t = shield.target_value as ExactTarget;
  if (t === 'Bull') return 'Bullseye';
  return t;
}