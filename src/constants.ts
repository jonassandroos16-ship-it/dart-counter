import type { CustomTitle, Settings } from './types';

export const COLORS = ['#22c55e','#3b82f6','#f59e0b','#ef4444','#06b6d4','#ec4899','#a855f7','#84cc16'];

export const CHECKOUTS: Record<number, string[]> = {
  170:['T20','T20','Bull'],167:['T20','T19','Bull'],164:['T20','T18','Bull'],161:['T20','T17','Bull'],
  160:['T20','T20','D20'],158:['T20','T20','D19'],157:['T20','T19','D20'],156:['T20','T20','D18'],
  155:['T20','T19','D19'],154:['T20','T18','D20'],153:['T20','T19','D18'],152:['T20','T20','D16'],
  151:['T20','T17','D20'],150:['T20','T18','D18'],149:['T20','T19','D16'],148:['T20','T20','D14'],
  147:['T20','T17','D18'],146:['T20','T18','D16'],145:['T20','T19','D14'],144:['T20','T20','D12'],
  143:['T20','T17','D16'],142:['T20','T14','D20'],141:['T20','T19','D12'],140:['T20','T20','D10'],
  139:['T20','T13','D20'],138:['T20','T18','D12'],137:['T20','T19','D10'],136:['T20','T20','D8'],
  135:['Bull','T15','D20'],134:['T20','T14','D16'],133:['T20','T19','D8'],132:['Bull','T14','D20'],
  131:['T20','T13','D16'],130:['T20','T18','D8'],129:['T19','T16','D12'],128:['T18','T14','D16'],
  127:['T20','T17','D8'],126:['T19','T19','D6'],125:['Bull','T20','D8'],124:['T20','T16','D8'],
  123:['T19','T16','D9'],122:['T18','T20','D4'],121:['T20','T11','D14'],120:['T20','20','D20'],
  110:['T20','10','D20'],107:['T19','10','D20'],104:['T18','10','D20'],100:['T20','D20'],
  98:['T20','D19'],97:['T19','D20'],96:['T20','D18'],95:['T19','D19'],94:['T18','D20'],
  92:['T20','D16'],90:['T20','D15'],89:['T19','D16'],86:['T18','D16'],84:['T20','D12'],
  81:['T19','D12'],80:['T20','D10'],76:['T20','D8'],72:['T16','D12'],70:['T18','D8'],
  68:['T20','D4'],67:['T17','D8'],64:['T16','D8'],61:['T15','D8'],60:['20','D20'],
  58:['18','D20'],57:['17','D20'],56:['16','D20'],54:['14','D20'],52:['12','D20'],
  50:['Bull'],48:['16','D16'],46:['6','D20'],44:['12','D16'],42:['10','D16'],40:['D20'],
  38:['D19'],36:['D18'],34:['D17'],32:['D16'],30:['D15'],28:['D14'],26:['D13'],24:['D12'],
  22:['D11'],20:['D10'],18:['D9'],16:['D8'],14:['D7'],12:['D6'],10:['D5'],8:['D4'],6:['D3'],4:['D2'],2:['D1'],
};

export const MODES: Record<string, { start: number; label: string; atc?: boolean; practice?: boolean }> = {
  '501': { start: 501, label: '501' },
  '301': { start: 301, label: '301' },
  '701': { start: 701, label: '701' },
  '101': { start: 101, label: '101' },
  'atc': { start: 0, label: 'Around the Clock', atc: true },
  'practice': { start: 0, label: 'Practice', practice: true },
};

export const ATC_TARGETS = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,'Bull'];
export const atcLabel = (i: number) => i >= ATC_TARGETS.length ? 'Done' : String(ATC_TARGETS[i]);

export const DARTBOARD_NUMBERS = [20,1,18,4,13,6,10,15,2,17,3,19,7,16,8,11,14,9,12,5];

export const SCORE_POPUPS = [
  { min: 180, emoji: '💥', title: 'ONE HUNDRED AND EIGHTY!', sub: 'Maximum score!' },
  { min: 140, emoji: '🔥', title: 'Big Score!', sub: '140+ with 3 darts' },
  { min: 120, emoji: '⚡', title: 'Ton+', sub: '120+ with 3 darts' },
  { min: 100, emoji: '💯', title: 'Ton!', sub: '100+ with 3 darts' },
  { min: 80, emoji: '🎯', title: '80+', sub: 'Solid visit' },
  { min: 60, emoji: '👍', title: '60+', sub: 'Steady scoring' },
];

export const MILESTONES = [
  { threshold: 200, emoji: '🎯', title: 'Below 200!', sub: 'On the finish' },
  { threshold: 150, emoji: '🔥', title: 'Below 150!', sub: 'Checkout range' },
  { threshold: 100, emoji: '⚡', title: 'Below 100!', sub: 'Closing in' },
];

export interface TitleDef {
  id: string;
  name: string;
  desc?: string;
  icon?: string;
  custom?: boolean;
  check: (allVisits: any[], gameVisits: any[], game: any) => boolean;
}

export const BUILTIN_TITLES: TitleDef[] = [
  { id: 't20king', name: 'Triple 20 King', desc: 'Hit T20 five times in one game', icon: '👑',
    check: (_v, gv) => gv.flatMap((v:any) => v.darts||[]).filter((d:any) => d.base===20 && d.mult===3).length >= 5 },
  { id: 't1master', name: 'Triple 1 Master', desc: 'Hit T1 three times in one game', icon: '🎪',
    check: (_v, gv) => gv.flatMap((v:any) => v.darts||[]).filter((d:any) => d.base===1 && d.mult===3).length >= 3 },
  { id: 'bullseye', name: 'Bullseye Hunter', desc: 'Hit 3 bulls in one game', icon: '🐂',
    check: (_v, gv) => gv.flatMap((v:any) => v.darts||[]).filter((d:any) => d.value===50).length >= 3 },
  { id: 'ton80', name: 'Ton 80 Hero', desc: 'Score a 180', icon: '💥',
    check: (_v, gv) => gv.some((v:any) => v.scored===180) },
  { id: 'consistent', name: 'The Consistent', desc: 'Score 60+ in 5 consecutive visits', icon: '📊',
    check: (visits) => { const s = visits.filter((v:any) => !v.bust && !v.atc); for (let i=0; i<=s.length-5; i++) if (s.slice(i,i+5).every((v:any) => v.scored>=60)) return true; return false; } },
  { id: 'checkout_king', name: 'Checkout King', desc: 'Checkout with 100+', icon: '🎯',
    check: (visits) => visits.some((v:any) => v.remaining===0 && v.checkout>=100) },
  { id: 'sharpshooter', name: 'Sharpshooter', desc: 'Hit 10+ triples in one game', icon: '🔫',
    check: (_v, gv) => gv.flatMap((v:any) => v.darts||[]).filter((d:any) => d.mult===3).length >= 10 },
  { id: 'double_trouble', name: 'Double Trouble', desc: 'Bust 3 times in one game', icon: '😵',
    check: (_v, gv) => gv.filter((v:any) => v.bust).length >= 3 },
  { id: 'comeback_kid', name: 'Comeback Kid', desc: 'Win after being 2 legs behind', icon: '🔄',
    check: (_v, _gv, game) => game && game.players.length > 1 && game.winner && game.legsBestOf > 1 },
  { id: 'first9_flyer', name: 'First 9 Flyer', desc: 'Average 40+ in first 9 darts', icon: '🚀',
    check: (visits) => { const byLeg: Record<number, any[]> = {}; visits.filter((v:any) => !v.bust && !v.atc).forEach((v:any) => { (byLeg[v.leg] = byLeg[v.leg]||[]).push(v); }); return Object.values(byLeg).some((arr:any[]) => arr.slice(0,3).reduce((a,v) => a+v.scored,0) >= 120); } },
];

export function buildTitleCheck(t: CustomTitle): (allVisits: any[], gameVisits: any[]) => boolean {
  const c = t.condition || { type: 'combo' as const, base: t.base || 20, mult: t.mult || 1, count: t.count || 1 };
  if (c.type === 'sum') {
    return (_allVisits, gameVisits) => gameVisits.some((v:any) => !v.atc && v.scored === c.value);
  }
  if (c.type === 'sequence') {
    const need = c.darts.map(d => ({ base: d.base, mult: d.mult })).sort((a, b) => a.base - b.base || a.mult - b.mult);
    return (_allVisits, gameVisits) => gameVisits.some((v:any) => {
      if (v.atc) return false;
      const have = (v.darts||[]).map((d:any) => ({ base: d.base, mult: d.mult })).sort((a:any, b:any) => a.base - b.base || a.mult - b.mult);
      if (have.length < need.length) return false;
      const needCounts: Record<string, number> = {};
      need.forEach(d => { const k = d.base + ':' + d.mult; needCounts[k] = (needCounts[k]||0) + 1; });
      const haveCounts: Record<string, number> = {};
      have.forEach((d:any) => { const k = d.base + ':' + d.mult; haveCounts[k] = (haveCounts[k]||0) + 1; });
      return Object.entries(needCounts).every(([k, n]) => (haveCounts[k]||0) >= n);
    });
  }
  return (_allVisits, gameVisits) => gameVisits.flatMap((v:any) => v.darts||[]).filter((d:any) => d.base === c.base && d.mult === c.mult).length >= (c.count || 1);
}

export function conditionLabel(t: CustomTitle): string {
  const c = t.condition || { type: 'combo' as const, base: t.base || 20, mult: t.mult || 1, count: t.count || 1 };
  if (c.type === 'sum') return `Turn total = ${c.value}`;
  if (c.type === 'sequence') {
    const parts = c.darts.map(d => (d.mult === 3 ? 'T' : d.mult === 2 ? 'D' : '') + d.base);
    return `Visit: ${parts.join(' + ')} (any order)`;
  }
  return `${c.mult||1}×${c.base} × ${c.count||1} in a game`;
}

export function allTitles(customTitles: CustomTitle[]): TitleDef[] {
  return [...BUILTIN_TITLES, ...customTitles.map(t => ({ ...t, custom: true, check: buildTitleCheck(t) as any }))];
}

export function getTitleInfo(titleId: string | null, customTitles: CustomTitle[]): TitleDef | undefined {
  return allTitles(customTitles).find(t => t.id === titleId);
}

export function defaultSettings(): Settings {
  return {
    theme: 'dark', accent: '#22c55e', confirmReset: true, sound: true, music: true,
    musicSetupTrack: 'setup_calm', musicMatchTrack: 'match_drive',
    xpConfig: { win: 50, visit60: 5, visit80: 10, visit100: 15, visit120: 20, visit140: 25, visit180: 50, checkout: 10, perDart: 1, levelMult: 1.5, baseLevelXp: 100 },
    customTitles: [],
    popups: { scores: true, milestones: true, xp: true, titles: true },
  };
}
