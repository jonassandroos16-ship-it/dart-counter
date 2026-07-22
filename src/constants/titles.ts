import type { CustomTitle } from '../types';

export interface TitleCtx {
  playerId?: string;
  games?: any[];
  gamesPlayed?: number;
  gamesWon?: number;
  lifetimeVisits?: any[];
  campaignProgress?: { highest_level_beaten: number } | null;
  classLevels?: Record<string, number>;
}

export interface TitleDef {
  id: string;
  name: string;
  desc?: string;
  icon?: string;
  custom?: boolean;
  check: (allVisits: any[], gameVisits: any[], game: any, ctx?: TitleCtx) => boolean;
  progress?: (ctx?: TitleCtx) => { current: number; target: number } | null;
}

const dartsFromVisits = (visits: any[]) => visits.flatMap((v: any) => v.darts || []);
const countHits = (visits: any[], base: number, mult: number) =>
  dartsFromVisits(visits).filter((d: any) => d.base === base && d.mult === mult).length;
const countBulls = (visits: any[]) => dartsFromVisits(visits).filter((d: any) => d.value === 50).length;
const countAnyBulls = (visits: any[]) => dartsFromVisits(visits).filter((d: any) => d.value === 25 || d.value === 50).length;
const countTriples = (visits: any[]) => dartsFromVisits(visits).filter((d: any) => d.mult === 3).length;
const countDoubles = (visits: any[]) => dartsFromVisits(visits).filter((d: any) => d.mult === 2 && d.value !== 50).length;
const scoringVisits = (visits: any[]) => visits.filter((v: any) => !v.bust && !v.atc);
const lifetimeScoreSum = (visits: any[]) => scoringVisits(visits).reduce((a: number, v: any) => a + (v.scored || 0), 0);
const count180s = (visits: any[]) => scoringVisits(visits).filter((v: any) => v.scored === 180).length;
const count140plus = (visits: any[]) => scoringVisits(visits).filter((v: any) => v.scored >= 140 && v.scored < 180).length;
const countTons = (visits: any[]) => scoringVisits(visits).filter((v: any) => v.scored >= 100).length;
const countCheckouts = (visits: any[]) => scoringVisits(visits).filter((v: any) => v.remaining === 0).length;

export const BUILTIN_TITLES: TitleDef[] = [
  // ── Single-game titles ──
  { id: 't20_king', name: 'T20 King', desc: 'Hit 5+ triple 20s in one game', icon: '🎯',
    check: (_v, gv) => countHits(gv, 20, 3) >= 5,
    progress: (ctx) => ({ current: Math.min(countHits(ctx?.lifetimeVisits || [], 20, 3), 5), target: 5 }) },
  { id: 'bullseye_hunter', name: 'Bullseye Hunter', desc: 'Hit 3+ bullseyes in one game', icon: '🐂',
    check: (_v, gv) => countBulls(gv) >= 3,
    progress: (ctx) => ({ current: Math.min(countBulls(ctx?.lifetimeVisits || []), 3), target: 3 }) },
  { id: 'ton_80', name: 'Ton 80', desc: 'Score a 180', icon: '💯',
    check: (_v, gv) => gv.some((v: any) => v.scored === 180),
    progress: (ctx) => ({ current: Math.min(count180s(ctx?.lifetimeVisits || []), 1), target: 1 }) },
  { id: 'ton_140', name: 'Ton 140', desc: 'Score 140+ in a single visit', icon: '🔥',
    check: (_v, gv) => gv.some((v: any) => v.scored >= 140),
    progress: (ctx) => ({ current: Math.min(count140plus(ctx?.lifetimeVisits || []) + count180s(ctx?.lifetimeVisits || []), 1), target: 1 }) },
  { id: 'ton_100', name: 'Centurion', desc: 'Score 100+ in a single visit', icon: '💯',
    check: (_v, gv) => gv.some((v: any) => v.scored >= 100),
    progress: (ctx) => ({ current: Math.min(countTons(ctx?.lifetimeVisits || []), 1), target: 1 }) },
  { id: 'sharpshooter', name: 'Sharpshooter', desc: 'Hit 10+ triples in one game', icon: '🏹',
    check: (_v, gv) => countTriples(gv) >= 10,
    progress: (ctx) => ({ current: Math.min(countTriples(ctx?.lifetimeVisits || []), 10), target: 10 }) },
  { id: 'double_trouble', name: 'Double Trouble', desc: 'Hit 8+ doubles in one game', icon: '🃏',
    check: (_v, gv) => countDoubles(gv) >= 8,
    progress: (ctx) => ({ current: Math.min(countDoubles(ctx?.lifetimeVisits || []), 8), target: 8 }) },
  { id: 'bull_master', name: 'Bull Master', desc: 'Hit 5+ bulls (25 or 50) in one game', icon: '🐂',
    check: (_v, gv) => countAnyBulls(gv) >= 5,
    progress: (ctx) => ({ current: Math.min(countAnyBulls(ctx?.lifetimeVisits || []), 5), target: 5 }) },
  { id: 'checkout_king', name: 'Checkout King', desc: 'Checkout 3+ times in one game', icon: '👑',
    check: (_v, gv) => countCheckouts(gv) >= 3,
    progress: (ctx) => ({ current: Math.min(countCheckouts(ctx?.lifetimeVisits || []), 3), target: 3 }) },
  { id: 'first_blood', name: 'First Blood', desc: 'Win your first game', icon: '🩸',
    check: (_v, _gv, _g, ctx) => (ctx?.gamesWon || 0) >= 1,
    progress: (ctx) => ({ current: Math.min(ctx?.gamesWon || 0, 1), target: 1 }) },
  { id: 'untouchable', name: 'Untouchable', desc: 'Win a game without losing a leg', icon: '🛡️',
    check: (_v, gv, g) => g.finished && g.winner === (gv[0] as any) && gv.every((v: any) => v.leg === 1),
    progress: () => null },
  { id: 'comeback_kid', name: 'Comeback Kid', desc: 'Win after being down 2+ legs', icon: '🔄',
    check: (_v, gv, g) => g.finished && g.winner && gv.some((v: any) => v.leg === 1 && v.scored === 0),
    progress: () => null },

  // ── Lifetime score titles ──
  { id: 'score_1k', name: 'Rookie', desc: 'Reach 1,000 lifetime score', icon: '🥉',
    check: (v) => lifetimeScoreSum(v) >= 1000,
    progress: (ctx) => ({ current: Math.min(lifetimeScoreSum(ctx?.lifetimeVisits || []), 1000), target: 1000 }) },
  { id: 'score_5k', name: 'Pro', desc: 'Reach 5,000 lifetime score', icon: '🥈',
    check: (v) => lifetimeScoreSum(v) >= 5000,
    progress: (ctx) => ({ current: Math.min(lifetimeScoreSum(ctx?.lifetimeVisits || []), 5000), target: 5000 }) },
  { id: 'score_25k', name: 'Veteran', desc: 'Reach 25,000 lifetime score', icon: '🥇',
    check: (v) => lifetimeScoreSum(v) >= 25000,
    progress: (ctx) => ({ current: Math.min(lifetimeScoreSum(ctx?.lifetimeVisits || []), 25000), target: 25000 }) },
  { id: 'score_100k', name: 'Score Titan', desc: 'Reach 100,000 lifetime score', icon: '💎',
    check: (v) => lifetimeScoreSum(v) >= 100000,
    progress: (ctx) => ({ current: Math.min(lifetimeScoreSum(ctx?.lifetimeVisits || []), 100000), target: 100000 }) },

  // ── Lifetime T20 titles ──
  { id: 't20_25', name: 'T20 Hunter', desc: 'Hit 25 lifetime triple 20s', icon: '🎯',
    check: (v) => countHits(v, 20, 3) >= 25,
    progress: (ctx) => ({ current: Math.min(countHits(ctx?.lifetimeVisits || [], 20, 3), 25), target: 25 }) },
  { id: 't20_100', name: 'T20 Sharp', desc: 'Hit 100 lifetime triple 20s', icon: '🎯',
    check: (v) => countHits(v, 20, 3) >= 100,
    progress: (ctx) => ({ current: Math.min(countHits(ctx?.lifetimeVisits || [], 20, 3), 100), target: 100 }) },
  { id: 't20_500', name: 'T20 Machine', desc: 'Hit 500 lifetime triple 20s', icon: '🎯',
    check: (v) => countHits(v, 20, 3) >= 500,
    progress: (ctx) => ({ current: Math.min(countHits(ctx?.lifetimeVisits || [], 20, 3), 500), target: 500 }) },

  // ── Lifetime 180 titles ──
  { id: 'first_180', name: 'First 180', desc: 'Score your first 180', icon: '💯',
    check: (v) => count180s(v) >= 1,
    progress: (ctx) => ({ current: Math.min(count180s(ctx?.lifetimeVisits || []), 1), target: 1 }) },
  { id: '180_10', name: '180 Club', desc: 'Score 10 lifetime 180s', icon: '💯',
    check: (v) => count180s(v) >= 10,
    progress: (ctx) => ({ current: Math.min(count180s(ctx?.lifetimeVisits || []), 10), target: 10 }) },
  { id: '180_50', name: '180 Maestro', desc: 'Score 50 lifetime 180s', icon: '💯',
    check: (v) => count180s(v) >= 50,
    progress: (ctx) => ({ current: Math.min(count180s(ctx?.lifetimeVisits || []), 50), target: 50 }) },

  // ── Lifetime bull titles ──
  { id: 'bull_10', name: 'Bull Wrangler', desc: 'Hit 10 lifetime bullseyes', icon: '🐂',
    check: (v) => countBulls(v) >= 10,
    progress: (ctx) => ({ current: Math.min(countBulls(ctx?.lifetimeVisits || []), 10), target: 10 }) },
  { id: 'bull_50', name: 'Bull Champion', desc: 'Hit 50 lifetime bullseyes', icon: '🐂',
    check: (v) => countBulls(v) >= 50,
    progress: (ctx) => ({ current: Math.min(countBulls(ctx?.lifetimeVisits || []), 50), target: 50 }) },
  { id: 'bull_100', name: 'Bull Legend', desc: 'Hit 100 lifetime bullseyes', icon: '🐂',
    check: (v) => countBulls(v) >= 100,
    progress: (ctx) => ({ current: Math.min(countBulls(ctx?.lifetimeVisits || []), 100), target: 100 }) },

  // ── Lifetime triple/double titles ──
  { id: 'triples_50', name: 'Triple Threat', desc: 'Hit 50 lifetime triples', icon: '🏹',
    check: (v) => countTriples(v) >= 50,
    progress: (ctx) => ({ current: Math.min(countTriples(ctx?.lifetimeVisits || []), 50), target: 50 }) },
  { id: 'doubles_50', name: 'Double Duty', desc: 'Hit 50 lifetime doubles', icon: '🃏',
    check: (v) => countDoubles(v) >= 50,
    progress: (ctx) => ({ current: Math.min(countDoubles(ctx?.lifetimeVisits || []), 50), target: 50 }) },

  // ── Lifetime checkout titles ──
  { id: 'checkout_10', name: 'Finisher', desc: 'Checkout 10 lifetime times', icon: '🏁',
    check: (v) => countCheckouts(v) >= 10,
    progress: (ctx) => ({ current: Math.min(countCheckouts(ctx?.lifetimeVisits || []), 10), target: 10 }) },
  { id: 'checkout_50', name: 'Checkout Master', desc: 'Checkout 50 lifetime times', icon: '🏁',
    check: (v) => countCheckouts(v) >= 50,
    progress: (ctx) => ({ current: Math.min(countCheckouts(ctx?.lifetimeVisits || []), 50), target: 50 }) },

  // ── Lifetime games played ──
  { id: 'games_10', name: 'Regular', desc: 'Play 10 games', icon: '🎮',
    check: (_v, _gv, _g, ctx) => (ctx?.gamesPlayed || 0) >= 10,
    progress: (ctx) => ({ current: Math.min(ctx?.gamesPlayed || 0, 10), target: 10 }) },
  { id: 'games_50', name: 'Dedicated', desc: 'Play 50 games', icon: '🎮',
    check: (_v, _gv, _g, ctx) => (ctx?.gamesPlayed || 0) >= 50,
    progress: (ctx) => ({ current: Math.min(ctx?.gamesPlayed || 0, 50), target: 50 }) },
  { id: 'games_100', name: 'Centurion Player', desc: 'Play 100 games', icon: '🎮',
    check: (_v, _gv, _g, ctx) => (ctx?.gamesPlayed || 0) >= 100,
    progress: (ctx) => ({ current: Math.min(ctx?.gamesPlayed || 0, 100), target: 100 }) },
  { id: 'games_500', name: 'Dart Addict', desc: 'Play 500 games', icon: '🎮',
    check: (_v, _gv, _g, ctx) => (ctx?.gamesPlayed || 0) >= 500,
    progress: (ctx) => ({ current: Math.min(ctx?.gamesPlayed || 0, 500), target: 500 }) },

  // ── Lifetime wins ──
  { id: 'wins_1', name: 'First Win', desc: 'Win your first game', icon: '🏆',
    check: (_v, _gv, _g, ctx) => (ctx?.gamesWon || 0) >= 1,
    progress: (ctx) => ({ current: Math.min(ctx?.gamesWon || 0, 1), target: 1 }) },
  { id: 'wins_10', name: 'Champion', desc: 'Win 10 games', icon: '🏆',
    check: (_v, _gv, _g, ctx) => (ctx?.gamesWon || 0) >= 10,
    progress: (ctx) => ({ current: Math.min(ctx?.gamesWon || 0, 10), target: 10 }) },
  { id: 'wins_25', name: 'Dart Hero', desc: 'Win 25 games', icon: '🏆',
    check: (_v, _gv, _g, ctx) => (ctx?.gamesWon || 0) >= 25,
    progress: (ctx) => ({ current: Math.min(ctx?.gamesWon || 0, 25), target: 25 }) },
  { id: 'wins_50', name: 'Dart Legend', desc: 'Win 50 games', icon: '🏆',
    check: (_v, _gv, _g, ctx) => (ctx?.gamesWon || 0) >= 50,
    progress: (ctx) => ({ current: Math.min(ctx?.gamesWon || 0, 50), target: 50 }) },
  { id: 'wins_100', name: 'Dart God', desc: 'Win 100 games', icon: '👑',
    check: (_v, _gv, _g, ctx) => (ctx?.gamesWon || 0) >= 100,
    progress: (ctx) => ({ current: Math.min(ctx?.gamesWon || 0, 100), target: 100 }) },

  // ── Killer mode titles ──
  { id: 'killer_first', name: 'First Kill', desc: 'Get your first kill in Killer mode', icon: '💀',
    check: (_v, gv, g) => g.mode === 'killer' && gv.some((v: any) => v.kills?.length),
    progress: () => null },
  { id: 'killer_5', name: 'Killer Instinct', desc: 'Get 5 lifetime kills in Killer mode', icon: '💀',
    check: (v) => v.filter((vis: any) => vis.kills?.length).reduce((a: number, v: any) => a + (v.kills?.length || 0), 0) >= 5,
    progress: () => null },

  // ── Party mode titles ──
  { id: 'party_1', name: 'Party Animal', desc: 'Play a Party mode game', icon: '🎉',
    check: (_v, _gv, g) => g.mode === 'party',
    progress: () => null },
  { id: 'party_10', name: 'Party Host', desc: 'Play 10 Party mode games', icon: '🎉',
    check: (_v, _gv, g, ctx) => g.mode === 'party' && (ctx?.games?.filter((g: any) => g.mode === 'party').length || 0) >= 10,
    progress: (ctx) => ({ current: Math.min(ctx?.games?.filter((g: any) => g.mode === 'party').length || 0, 10), target: 10 }) },

  // ── Battle mode titles ──
  { id: 'battle_1', name: 'Battler', desc: 'Play a Battle mode game', icon: '⚔️',
    check: (_v, _gv, g) => g.mode === 'battle',
    progress: () => null },
  { id: 'battle_win_1', name: 'Battle Victor', desc: 'Win a Battle mode game', icon: '⚔️',
    check: (_v, _gv, g, ctx) => g.mode === 'battle' && (ctx?.gamesWon || 0) >= 1,
    progress: () => null },
  { id: 'battle_win_10', name: 'Battle Commander', desc: 'Win 10 Battle mode games', icon: '⚔️',
    check: (_v, _gv, g, ctx) => g.mode === 'battle' && (ctx?.gamesWon || 0) >= 10,
    progress: () => null },
  { id: 'battle_survive', name: 'Survivor', desc: 'Survive a Battle mode game with 1 HP left', icon: '❤️',
    check: (_v, _gv, g) => g.mode === 'battle' && g.finished && g.players.some((p: any) => p.id === g.winner && p.hp === 1),
    progress: () => null },
  { id: 'battle_5_kills', name: 'Slayer', desc: 'Get 5 kills in one Battle mode game', icon: '💀',
    check: (_v, gv, g) => g.mode === 'battle' && gv.some((v: any) => (v.kills?.length || 0) >= 5),
    progress: () => null },

  // ── Team mode titles ──
  { id: 'team_1', name: 'Team Player', desc: 'Play a Team mode game', icon: '🤝',
    check: (_v, _gv, g) => !!g.teamMode,
    progress: () => null },
  { id: 'team_win_1', name: 'Team Champion', desc: 'Win a Team mode game', icon: '🤝',
    check: (_v, _gv, g, ctx) => !!g.teamMode && (ctx?.gamesWon || 0) >= 1,
    progress: () => null },
  { id: 'team_win_10', name: 'Team Legend', desc: 'Win 10 Team mode games', icon: '🤝',
    check: (_v, _gv, g, ctx) => !!g.teamMode && (ctx?.gamesWon || 0) >= 10,
    progress: () => null },

  // ── Co-op Campaign titles ──
  { id: 'coop_first_clear', name: 'First Strike', desc: 'Clear your first Co-op Campaign level', icon: '⚔️',
    check: (_v, _gv, _g, ctx) => (ctx?.campaignProgress?.highest_level_beaten || 0) >= 1,
    progress: (ctx) => ({ current: Math.min(ctx?.campaignProgress?.highest_level_beaten || 0, 1), target: 1 }) },
  { id: 'coop_5_clear', name: 'Campaigner', desc: 'Clear 5 Co-op Campaign levels', icon: '🗺️',
    check: (_v, _gv, _g, ctx) => (ctx?.campaignProgress?.highest_level_beaten || 0) >= 5,
    progress: (ctx) => ({ current: Math.min(ctx?.campaignProgress?.highest_level_beaten || 0, 5), target: 5 }) },
  { id: 'coop_10_clear', name: 'Boss Slayer', desc: 'Clear 10 Co-op Campaign levels', icon: '🐉',
    check: (_v, _gv, _g, ctx) => (ctx?.campaignProgress?.highest_level_beaten || 0) >= 10,
    progress: (ctx) => ({ current: Math.min(ctx?.campaignProgress?.highest_level_beaten || 0, 10), target: 10 }) },
  { id: 'coop_full_clear', name: 'Campaign Conqueror', desc: 'Clear every Co-op Campaign level across all three chapters', icon: '👑',
    check: (_v, _gv, _g, ctx) => (ctx?.campaignProgress?.highest_level_beaten || 0) >= 15,
    progress: (ctx) => ({ current: Math.min(ctx?.campaignProgress?.highest_level_beaten || 0, 15), target: 15 }) },

  // ============ Class Level Titles ============
  // Awarded when a player reaches a specific class level (3, 5, or 10) in
  // any of the three classes. `ctx.classLevels` maps classId → current level.
  { id: 'warrior_lv3', name: 'Squire of Steel', desc: 'Reach Warrior level 3', icon: '⚔️',
    check: (_v, _gv, _g, ctx) => (ctx?.classLevels?.warrior || 0) >= 3,
    progress: (ctx) => ({ current: Math.min(ctx?.classLevels?.warrior || 0, 3), target: 3 }) },
  { id: 'warrior_lv5', name: 'Blademaster', desc: 'Reach Warrior level 5', icon: '🗡️',
    check: (_v, _gv, _g, ctx) => (ctx?.classLevels?.warrior || 0) >= 5,
    progress: (ctx) => ({ current: Math.min(ctx?.classLevels?.warrior || 0, 5), target: 5 }) },
  { id: 'warrior_lv10', name: 'Warlord Supreme', desc: 'Reach Warrior level 10', icon: '🐉',
    check: (_v, _gv, _g, ctx) => (ctx?.classLevels?.warrior || 0) >= 10,
    progress: (ctx) => ({ current: Math.min(ctx?.classLevels?.warrior || 0, 10), target: 10 }) },
  { id: 'priest_lv3', name: 'Acolyte of Light', desc: 'Reach Priest level 3', icon: '✨',
    check: (_v, _gv, _g, ctx) => (ctx?.classLevels?.priest || 0) >= 3,
    progress: (ctx) => ({ current: Math.min(ctx?.classLevels?.priest || 0, 3), target: 3 }) },
  { id: 'priest_lv5', name: 'High Priest', desc: 'Reach Priest level 5', icon: '🙏',
    check: (_v, _gv, _g, ctx) => (ctx?.classLevels?.priest || 0) >= 5,
    progress: (ctx) => ({ current: Math.min(ctx?.classLevels?.priest || 0, 5), target: 5 }) },
  { id: 'priest_lv10', name: 'Divine Oracle', desc: 'Reach Priest level 10', icon: '😇',
    check: (_v, _gv, _g, ctx) => (ctx?.classLevels?.priest || 0) >= 10,
    progress: (ctx) => ({ current: Math.min(ctx?.classLevels?.priest || 0, 10), target: 10 }) },
  { id: 'rogue_lv3', name: 'Shadow Initiate', desc: 'Reach Rogue level 3', icon: '🗡️',
    check: (_v, _gv, _g, ctx) => (ctx?.classLevels?.rogue || 0) >= 3,
    progress: (ctx) => ({ current: Math.min(ctx?.classLevels?.rogue || 0, 3), target: 3 }) },
  { id: 'rogue_lv5', name: 'Nightblade', desc: 'Reach Rogue level 5', icon: '🌫️',
    check: (_v, _gv, _g, ctx) => (ctx?.classLevels?.rogue || 0) >= 5,
    progress: (ctx) => ({ current: Math.min(ctx?.classLevels?.rogue || 0, 5), target: 5 }) },
  { id: 'rogue_lv10', name: 'Phantom Sovereign', desc: 'Reach Rogue level 10', icon: '🌑',
    check: (_v, _gv, _g, ctx) => (ctx?.classLevels?.rogue || 0) >= 10,
    progress: (ctx) => ({ current: Math.min(ctx?.classLevels?.rogue || 0, 10), target: 10 }) },
];

export function conditionLabel(t: CustomTitle): string {
  if (!t.condition) return 'No condition';
  if (t.condition.type === 'sum') return `Turn total ≥ ${t.condition.value}`;
  if (t.condition.type === 'combo') {
    const multLabel = t.condition.mult === 3 ? 'Triple' : t.condition.mult === 2 ? 'Double' : 'Single';
    const baseLabel = t.condition.base === 50 ? 'Bull' : t.condition.base === 25 ? '25' : `${t.condition.base}`;
    return `${multLabel} ${baseLabel} ×${t.condition.count}`;
  }
  if (t.condition.type === 'sequence') {
    return `Sequence: ${t.condition.darts.map((d) => {
      const m = d.mult === 3 ? 'T' : d.mult === 2 ? 'D' : 'S';
      const b = d.base === 50 ? 'Bull' : d.base === 25 ? '25' : `${d.base}`;
      return `${m}${b}`;
    }).join(', ')}`;
  }
  return 'Unknown condition';
}

export function buildTitleCheck(t: CustomTitle): (allVisits: any[], gameVisits: any[], game: any, ctx?: TitleCtx) => boolean {
  const cond = t.condition;
  if (!cond) return () => false;
  if (cond.type === 'sum') {
    const target = cond.value;
    return (allVisits) => scoringVisits(allVisits).some((v: any) => (v.scored || 0) >= target);
  }
  if (cond.type === 'combo') {
    const target = cond.count;
    const base = cond.base;
    const mult = cond.mult;
    return (allVisits) => {
      const darts = dartsFromVisits(allVisits);
      return darts.some((_d: any, i: number) => {
        if (i + target > darts.length) return false;
        const slice = darts.slice(i, i + target);
        return slice.every((d: any) => d.base === base && d.mult === mult);
      });
    };
  }
  if (cond.type === 'sequence') {
    const seq = cond.darts;
    return (allVisits) => {
      const darts = dartsFromVisits(allVisits);
      return darts.some((_d: any, i: number) => {
        if (i + seq.length > darts.length) return false;
        return seq.every((s: any, j: number) => {
          const d = darts[i + j];
          return d.base === s.base && d.mult === s.mult;
        });
      });
    };
  }
  return () => false;
}

export function allTitles(customTitles: CustomTitle[]): TitleDef[] {
  return [...BUILTIN_TITLES, ...customTitles.map(t => ({ ...t, custom: true, check: buildTitleCheck(t) as any }))];
}

export function getTitleInfo(titleId: string, customTitles: CustomTitle[]): TitleDef | undefined {
  return allTitles(customTitles).find(t => t.id === titleId);
}

export function titleProgressInfo(t: TitleDef, ctx: TitleCtx): { current: number; target: number; pct: number } | null {
  if (!t.progress) return null;
  try {
    const p = t.progress(ctx);
    if (!p) return null;
    return { ...p, pct: p.target > 0 ? Math.min(100, Math.round(p.current / p.target * 100)) : 0 };
  } catch {
    return null;
  }
}
