import type { CampaignDart, ExactTarget, ShieldLayer, SpanTarget } from '../types';

const DARTBOARD_ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

export function neighborsOf(base: number): number[] {
  const i = DARTBOARD_ORDER.indexOf(base);
  if (i < 0) return [];
  const left = DARTBOARD_ORDER[(i - 1 + DARTBOARD_ORDER.length) % DARTBOARD_ORDER.length];
  const right = DARTBOARD_ORDER[(i + 1) % DARTBOARD_ORDER.length];
  return [left, right];
}

// Each segment's center sits at angle 90° - 18°·i on the board (20 at top,
// clockwise). A segment belongs to a half when its center is strictly on that
// side of the relevant diameter; the four axis segments (20, 3, 6, 11) sit
// exactly on a diameter and belong only to the half they point toward.
export function isTopHalf(base: number): boolean {
  const i = DARTBOARD_ORDER.indexOf(base);
  return i >= 0 && (i < 5 || i > 15);
}
export function isBottomHalf(base: number): boolean {
  const i = DARTBOARD_ORDER.indexOf(base);
  return i >= 6 && i <= 14;
}
export function isLeftHalf(base: number): boolean {
  const i = DARTBOARD_ORDER.indexOf(base);
  return i >= 11;
}
export function isRightHalf(base: number): boolean {
  const i = DARTBOARD_ORDER.indexOf(base);
  return i >= 1 && i <= 9;
}

export function dartMatchesShield(dart: CampaignDart, shield: ShieldLayer): boolean {
  if (shield.type === 'span') {
    const target = shield.target_value as SpanTarget;
    if (dart.base === 0) return false;
    switch (target) {
      case 'TOP_HALF': return isTopHalf(dart.base);
      case 'BOTTOM_HALF': return isBottomHalf(dart.base);
      case 'LEFT_HALF': return isLeftHalf(dart.base);
      case 'RIGHT_HALF': return isRightHalf(dart.base);
      case 'ANY_DOUBLE': return dart.isDouble;
      case 'ANY_TRIPLE': return dart.mult === 3 && !dart.isBull;
      case 'ANY_BULL': return dart.base === 25 || dart.base === 50;
    }
    return false;
  }
  const t = shield.target_value as ExactTarget;
  return matchesExactTarget(dart, t);
}

export function matchesExactTarget(dart: CampaignDart, t: ExactTarget): boolean {
  if (t === 'Bull') return dart.base === 50;
  if (t === '25') return dart.base === 25 && !dart.isBull;
  const m = /^([DT]?)(\d+)$/.exec(t);
  if (!m) return false;
  const mult = m[1] === 'D' ? 2 : m[1] === 'T' ? 3 : 1;
  const base = Number(m[2]);
  if (!Number.isFinite(base)) return false;
  if (dart.base !== base) return false;
  if (base === 25 || base === 50) return true;
  return dart.mult === mult;
}

export function describeShield(shield: ShieldLayer): string {
  if (shield.type === 'span') {
    const map: Record<SpanTarget, string> = {
      TOP_HALF: 'Top Half',
      BOTTOM_HALF: 'Bottom Half',
      LEFT_HALF: 'Left Half',
      RIGHT_HALF: 'Right Half',
      ANY_DOUBLE: 'Any Double',
      ANY_TRIPLE: 'Any Triple',
      ANY_BULL: 'Any Bull',
    };
    return map[shield.target_value as SpanTarget] || String(shield.target_value);
  }
  const t = shield.target_value as ExactTarget;
  if (t === 'Bull') return 'Bullseye';
  if (t === '25') return '25 (outer bull)';
  const m = /^([DT]?)(\d+)$/.exec(t);
  if (!m) return t;
  const prefix = m[1] === 'D' ? 'Double ' : m[1] === 'T' ? 'Triple ' : 'Single ';
  return prefix + m[2];
}
