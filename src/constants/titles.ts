import type { CustomTitle } from '../types';

export interface TitleCtx {
  playerId?: string;
  games?: any[];
  gamesPlayed?: number;
  gamesWon?: number;
  lifetimeVisits?: any[];
  campaignProgress?: { highest_level_beaten: number } | null;
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
const countOuterBulls = (visits: any[]) => dartsFromVisits(visits).filter((d: any) => d.value === 25).length;
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
  { id: 't20king', name: 'Triple 20 King', desc: 'Hit T20 five times in one game', icon: '👑',
    check: (_v, gv) => countHits(gv, 20, 3) >= 5 },
  { id: 't20trio', name: 'T20 Trio', desc: 'Hit T20 three times in one game', icon: '🎯',
    check: (_v, gv) => countHits(gv, 20, 3) >= 3 },
  { id: 't20marathon', name: 'T20 Marathon', desc: 'Hit T20 ten times in one game', icon: '🏃',
    check: (_v, gv) => countHits(gv, 20, 3) >= 10 },
  { id: 't1master', name: 'Triple 1 Master', desc: 'Hit T1 three times in one game', icon: '🎪',
    check: (_v, gv) => countHits(gv, 1, 3) >= 3 },
  { id: 'cow_tipper', name: 'Cow Tipper', desc: 'Hit a single bull (25) in one game', icon: '🐄',
    check: (_v, gv) => countOuterBulls(gv) >= 1 },
  { id: 'milkman', name: 'The Milkman', desc: 'Hit 3 single bulls (25) in one game', icon: '🥛',
    check: (_v, gv) => countOuterBulls(gv) >= 3 },
  { id: 'cattle_rustler', name: 'Cattle Rustler', desc: 'Hit 5 bulls-or-outer in one game', icon: '🐮',
    check: (_v, gv) => countAnyBulls(gv) >= 5 },
  { id: 'first_bull', name: 'First Blood', desc: 'Hit your first bullseye (50) in a game', icon: '🎯',
    check: (_v, gv) => countBulls(gv) >= 1 },
  { id: 'bullseye', name: 'Bullseye Hunter', desc: 'Hit 3 bullseyes (50) in one game', icon: '🐂',
    check: (_v, gv) => countBulls(gv) >= 3 },
  { id: 'bullseye_pro', name: 'Bullseye Pro', desc: 'Hit 5 bullseyes (50) in one game', icon: '🎖️',
    check: (_v, gv) => countBulls(gv) >= 5 },
  { id: 'ton80', name: 'Ton 80 Hero', desc: 'Score a 180', icon: '💥',
    check: (_v, gv) => count180s(gv) >= 1 },
  { id: 'double_vision', name: 'Double Vision', desc: 'Score two 180s in one game', icon: '👀',
    check: (_v, gv) => count180s(gv) >= 2 },
  { id: 'ton_machine', name: 'Ton Machine', desc: 'Hit 3+ tons (100+) in one game', icon: '💯',
    check: (_v, gv) => countTons(gv) >= 3 },
  { id: 'ton_factory', name: 'Ton Factory', desc: 'Hit 6+ tons (100+) in one game', icon: '🏭',
    check: (_v, gv) => countTons(gv) >= 6 },
  { id: 'big_hitter', name: 'Big Hitter', desc: 'Score 140+ three times in one game', icon: '🔥',
    check: (_v, gv) => count140plus(gv) + count180s(gv) >= 3 },
  { id: 'consistent', name: 'The Consistent', desc: 'Score 60+ in 5 consecutive visits', icon: '📊',
    check: (visits) => { const s = visits.filter((v:any) => !v.bust && !v.atc); for (let i=0; i<=s.length-5; i++) if (s.slice(i,i+5).every((v:any) => v.scored>=60)) return true; return false; } },
  { id: 'checkout_1', name: 'Baby Checkout', desc: 'Checkout with less than 10', icon: '🍼',
    check: (visits) => visits.some((v:any) => v.remaining===0 && v.checkout>0 && v.checkout<10) },
  { id: 'checkout_10', name: 'Tiny Tim', desc: 'Checkout with 10+', icon: '🧸',
    check: (visits) => visits.some((v:any) => v.remaining===0 && v.checkout>=10) },
  { id: 'checkout_25', name: 'Pocket Change', desc: 'Checkout with 25+', icon: '🪙',
    check: (visits) => visits.some((v:any) => v.remaining===0 && v.checkout>=25) },
  { id: 'checkout_40', name: 'Two Darts Wonder', desc: 'Checkout with 40+', icon: '🪄',
    check: (visits) => visits.some((v:any) => v.remaining===0 && v.checkout>=40) },
  { id: 'checkout_60', name: 'Steady Eddie', desc: 'Checkout with 60+', icon: '🧱',
    check: (visits) => visits.some((v:any) => v.remaining===0 && v.checkout>=60) },
  { id: 'checkout_80', name: 'Mid-Pack Mike', desc: 'Checkout with 80+', icon: '🧭',
    check: (visits) => visits.some((v:any) => v.remaining===0 && v.checkout>=80) },
  { id: 'checkout_king', name: 'Checkout King', desc: 'Checkout with 100+', icon: '🎯',
    check: (visits) => visits.some((v:any) => v.remaining===0 && v.checkout>=100) },
  { id: 'big_finish', name: 'Big Finish', desc: 'Checkout with 120+', icon: '🎆',
    check: (visits) => visits.some((v:any) => v.remaining===0 && v.checkout>=120) },
  { id: 'high_ton_out', name: 'High Ton Out', desc: 'Checkout with 150+', icon: '🏆',
    check: (visits) => visits.some((v:any) => v.remaining===0 && v.checkout>=150) },
  { id: 'checkout_170', name: 'Big Fish', desc: 'Checkout with 170 (the max)', icon: '🐳',
    check: (visits) => visits.some((v:any) => v.remaining===0 && v.checkout>=170) },
  { id: 'sharpshooter', name: 'Sharpshooter', desc: 'Hit 10+ triples in one game', icon: '🔫',
    check: (_v, gv) => countTriples(gv) >= 10 },
  { id: 'triple_stack', name: 'Triple Stack', desc: 'Hit 3 triples in one visit', icon: '🥞',
    check: (_v, gv) => gv.some((v:any) => (v.darts||[]).filter((d:any) => d.mult===3).length === 3) },
  { id: 'double_dip', name: 'Double Dip', desc: 'Hit 3 doubles in one visit', icon: '💠',
    check: (_v, gv) => gv.some((v:any) => (v.darts||[]).filter((d:any) => d.mult===2 && d.value !== 50).length === 3) },
  { id: 'double_trouble', name: 'Double Trouble', desc: 'Bust 3 times in one game', icon: '😵',
    check: (_v, gv) => gv.filter((v:any) => v.bust).length >= 3 },
  { id: 'comeback_kid', name: 'Comeback Kid', desc: 'Win a best-of match', icon: '🔄',
    check: (_v, _gv, game) => game && game.players.length > 1 && game.winner && game.legsBestOf > 1 },
  { id: 'first9_flyer', name: 'First 9 Flyer', desc: 'Average 40+ in first 9 darts', icon: '🚀',
    check: (visits) => { const byLeg: Record<number, any[]> = {}; visits.filter((v:any) => !v.bust && !v.atc).forEach((v:any) => { (byLeg[v.leg] = byLeg[v.leg]||[]).push(v); }); return Object.values(byLeg).some((arr:any[]) => arr.slice(0,3).reduce((a,v) => a+v.scored,0) >= 120); } },

  { id: 'life_score_1k', name: 'Rookie Scorer', desc: 'Score 1,000 points across all games', icon: '🥉',
    check: (_v, _gv, _g, ctx) => lifetimeScoreSum(ctx?.lifetimeVisits || []) >= 1000,
    progress: (ctx) => ({ current: lifetimeScoreSum(ctx?.lifetimeVisits || []), target: 1000 }) },
  { id: 'life_score_5k', name: 'Regular Scorer', desc: 'Score 5,000 points across all games', icon: '🥈',
    check: (_v, _gv, _g, ctx) => lifetimeScoreSum(ctx?.lifetimeVisits || []) >= 5000,
    progress: (ctx) => ({ current: lifetimeScoreSum(ctx?.lifetimeVisits || []), target: 5000 }) },
  { id: 'life_score_10k', name: 'Serious Scorer', desc: 'Score 10,000 points across all games', icon: '🥇',
    check: (_v, _gv, _g, ctx) => lifetimeScoreSum(ctx?.lifetimeVisits || []) >= 10000,
    progress: (ctx) => ({ current: lifetimeScoreSum(ctx?.lifetimeVisits || []), target: 10000 }) },
  { id: 'life_score_25k', name: 'Score Grinder', desc: 'Score 25,000 points across all games', icon: '⚔️',
    check: (_v, _gv, _g, ctx) => lifetimeScoreSum(ctx?.lifetimeVisits || []) >= 25000,
    progress: (ctx) => ({ current: lifetimeScoreSum(ctx?.lifetimeVisits || []), target: 25000 }) },
  { id: 'life_score_50k', name: 'Score Legend', desc: 'Score 50,000 points across all games', icon: '🌟',
    check: (_v, _gv, _g, ctx) => lifetimeScoreSum(ctx?.lifetimeVisits || []) >= 50000,
    progress: (ctx) => ({ current: lifetimeScoreSum(ctx?.lifetimeVisits || []), target: 50000 }) },
  { id: 'life_score_100k', name: 'Score Titan', desc: 'Score 100,000 points across all games', icon: '💎',
    check: (_v, _gv, _g, ctx) => lifetimeScoreSum(ctx?.lifetimeVisits || []) >= 100000,
    progress: (ctx) => ({ current: lifetimeScoreSum(ctx?.lifetimeVisits || []), target: 100000 }) },

  { id: 'life_t20_25', name: 'T20 Hunter', desc: 'Hit 25 triple 20s in a lifetime', icon: '🎯',
    check: (_v, _gv, _g, ctx) => countHits(ctx?.lifetimeVisits || [], 20, 3) >= 25,
    progress: (ctx) => ({ current: countHits(ctx?.lifetimeVisits || [], 20, 3), target: 25 }) },
  { id: 'life_t20_100', name: 'T20 Sniper', desc: 'Hit 100 triple 20s in a lifetime', icon: '🏹',
    check: (_v, _gv, _g, ctx) => countHits(ctx?.lifetimeVisits || [], 20, 3) >= 100,
    progress: (ctx) => ({ current: countHits(ctx?.lifetimeVisits || [], 20, 3), target: 100 }) },
  { id: 'life_t20_500', name: 'T20 Machine', desc: 'Hit 500 triple 20s in a lifetime', icon: '🤖',
    check: (_v, _gv, _g, ctx) => countHits(ctx?.lifetimeVisits || [], 20, 3) >= 500,
    progress: (ctx) => ({ current: countHits(ctx?.lifetimeVisits || [], 20, 3), target: 500 }) },

  { id: 'life_180_1', name: 'First 180', desc: 'Score your first 180', icon: '💥',
    check: (_v, _gv, _g, ctx) => count180s(ctx?.lifetimeVisits || []) >= 1,
    progress: (ctx) => ({ current: count180s(ctx?.lifetimeVisits || []), target: 1 }) },
  { id: 'life_180_10', name: '180 Collector', desc: 'Score ten 180s in a lifetime', icon: '🧨',
    check: (_v, _gv, _g, ctx) => count180s(ctx?.lifetimeVisits || []) >= 10,
    progress: (ctx) => ({ current: count180s(ctx?.lifetimeVisits || []), target: 10 }) },
  { id: 'life_180_25', name: '180 Addict', desc: 'Score twenty-five 180s in a lifetime', icon: '🎰',
    check: (_v, _gv, _g, ctx) => count180s(ctx?.lifetimeVisits || []) >= 25,
    progress: (ctx) => ({ current: count180s(ctx?.lifetimeVisits || []), target: 25 }) },
  { id: 'life_180_50', name: '180 Maestro', desc: 'Score fifty 180s in a lifetime', icon: '🎼',
    check: (_v, _gv, _g, ctx) => count180s(ctx?.lifetimeVisits || []) >= 50,
    progress: (ctx) => ({ current: count180s(ctx?.lifetimeVisits || []), target: 50 }) },

  { id: 'life_bulls_10', name: 'Bull Wrangler', desc: 'Hit 10 bullseyes (50) in a lifetime', icon: '🐃',
    check: (_v, _gv, _g, ctx) => countBulls(ctx?.lifetimeVisits || []) >= 10,
    progress: (ctx) => ({ current: countBulls(ctx?.lifetimeVisits || []), target: 10 }) },
  { id: 'life_bulls_50', name: 'Bull Master', desc: 'Hit 50 bullseyes (50) in a lifetime', icon: '👑',
    check: (_v, _gv, _g, ctx) => countBulls(ctx?.lifetimeVisits || []) >= 50,
    progress: (ctx) => ({ current: countBulls(ctx?.lifetimeVisits || []), target: 50 }) },
  { id: 'life_bulls_75', name: 'Bull Whisperer', desc: 'Hit 75 bullseyes (50) in a lifetime', icon: '🤫',
    check: (_v, _gv, _g, ctx) => countBulls(ctx?.lifetimeVisits || []) >= 75,
    progress: (ctx) => ({ current: countBulls(ctx?.lifetimeVisits || []), target: 75 }) },
  { id: 'life_bulls_100', name: 'Bull Legend', desc: 'Hit 100 bullseyes (50) in a lifetime', icon: '🏅',
    check: (_v, _gv, _g, ctx) => countBulls(ctx?.lifetimeVisits || []) >= 100,
    progress: (ctx) => ({ current: countBulls(ctx?.lifetimeVisits || []), target: 100 }) },

  { id: 'life_triples_50', name: 'Triple Threat', desc: 'Hit 50 triples in a lifetime', icon: '3️⃣',
    check: (_v, _gv, _g, ctx) => countTriples(ctx?.lifetimeVisits || []) >= 50,
    progress: (ctx) => ({ current: countTriples(ctx?.lifetimeVisits || []), target: 50 }) },
  { id: 'life_triples_500', name: 'Triple Titan', desc: 'Hit 500 triples in a lifetime', icon: '🔱',
    check: (_v, _gv, _g, ctx) => countTriples(ctx?.lifetimeVisits || []) >= 500,
    progress: (ctx) => ({ current: countTriples(ctx?.lifetimeVisits || []), target: 500 }) },
  { id: 'life_doubles_50', name: 'Double Down', desc: 'Hit 50 doubles in a lifetime', icon: '2️⃣',
    check: (_v, _gv, _g, ctx) => countDoubles(ctx?.lifetimeVisits || []) >= 50,
    progress: (ctx) => ({ current: countDoubles(ctx?.lifetimeVisits || []), target: 50 }) },
  { id: 'life_doubles_500', name: 'Double Dynasty', desc: 'Hit 500 doubles in a lifetime', icon: '♊',
    check: (_v, _gv, _g, ctx) => countDoubles(ctx?.lifetimeVisits || []) >= 500,
    progress: (ctx) => ({ current: countDoubles(ctx?.lifetimeVisits || []), target: 500 }) },

  { id: 'life_checkouts_10', name: 'Finisher', desc: 'Complete 10 checkouts in a lifetime', icon: '✅',
    check: (_v, _gv, _g, ctx) => countCheckouts(ctx?.lifetimeVisits || []) >= 10,
    progress: (ctx) => ({ current: countCheckouts(ctx?.lifetimeVisits || []), target: 10 }) },
  { id: 'life_checkouts_50', name: 'The Closer', desc: 'Complete 50 checkouts in a lifetime', icon: '🚪',
    check: (_v, _gv, _g, ctx) => countCheckouts(ctx?.lifetimeVisits || []) >= 50,
    progress: (ctx) => ({ current: countCheckouts(ctx?.lifetimeVisits || []), target: 50 }) },
  { id: 'life_checkouts_100', name: 'Checkout Machine', desc: 'Complete 100 checkouts in a lifetime', icon: '🏭',
    check: (_v, _gv, _g, ctx) => countCheckouts(ctx?.lifetimeVisits || []) >= 100,
    progress: (ctx) => ({ current: countCheckouts(ctx?.lifetimeVisits || []), target: 100 }) },
  { id: 'life_checkouts_500', name: 'The Terminator', desc: 'Complete 500 checkouts in a lifetime', icon: '🤖',
    check: (_v, _gv, _g, ctx) => countCheckouts(ctx?.lifetimeVisits || []) >= 500,
    progress: (ctx) => ({ current: countCheckouts(ctx?.lifetimeVisits || []), target: 500 }) },

  { id: 'life_games_10', name: 'Getting Started', desc: 'Play 10 games', icon: '🎮',
    check: (_v, _gv, _g, ctx) => (ctx?.gamesPlayed || 0) >= 10,
    progress: (ctx) => ({ current: ctx?.gamesPlayed || 0, target: 10 }) },
  { id: 'life_games_50', name: 'Regular Player', desc: 'Play 50 games', icon: '📅',
    check: (_v, _gv, _g, ctx) => (ctx?.gamesPlayed || 0) >= 50,
    progress: (ctx) => ({ current: ctx?.gamesPlayed || 0, target: 50 }) },
  { id: 'life_games_100', name: 'Half Centurion', desc: 'Play 100 games', icon: '💯',
    check: (_v, _gv, _g, ctx) => (ctx?.gamesPlayed || 0) >= 100,
    progress: (ctx) => ({ current: ctx?.gamesPlayed || 0, target: 100 }) },
  { id: 'life_games_250', name: 'Veteran', desc: 'Play 250 games', icon: '🎖️',
    check: (_v, _gv, _g, ctx) => (ctx?.gamesPlayed || 0) >= 250,
    progress: (ctx) => ({ current: ctx?.gamesPlayed || 0, target: 250 }) },
  { id: 'life_games_500', name: 'Dart Hermit', desc: 'Play 500 games', icon: '🧙',
    check: (_v, _gv, _g, ctx) => (ctx?.gamesPlayed || 0) >= 500,
    progress: (ctx) => ({ current: ctx?.gamesPlayed || 0, target: 500 }) },

  { id: 'life_wins_1', name: 'First Win', desc: 'Win your first game', icon: '🏆',
    check: (_v, _gv, _g, ctx) => (ctx?.gamesWon || 0) >= 1,
    progress: (ctx) => ({ current: ctx?.gamesWon || 0, target: 1 }) },
  { id: 'life_wins_5', name: 'Winner', desc: 'Win 5 games', icon: '🏆',
    check: (_v, _gv, _g, ctx) => (ctx?.gamesWon || 0) >= 5,
    progress: (ctx) => ({ current: ctx?.gamesWon || 0, target: 5 }) },
  { id: 'life_wins_10', name: 'Double Digits', desc: 'Win 10 games', icon: '🥈',
    check: (_v, _gv, _g, ctx) => (ctx?.gamesWon || 0) >= 10,
    progress: (ctx) => ({ current: ctx?.gamesWon || 0, target: 10 }) },
  { id: 'life_wins_25', name: 'Champion', desc: 'Win 25 games', icon: '🏆',
    check: (_v, _gv, _g, ctx) => (ctx?.gamesWon || 0) >= 25,
    progress: (ctx) => ({ current: ctx?.gamesWon || 0, target: 25 }) },
  { id: 'life_wins_50', name: 'Dominator', desc: 'Win 50 games', icon: '👑',
    check: (_v, _gv, _g, ctx) => (ctx?.gamesWon || 0) >= 50,
    progress: (ctx) => ({ current: ctx?.gamesWon || 0, target: 50 }) },
  { id: 'life_wins_100', name: 'Dart Legend', desc: 'Win 100 games', icon: '🌠',
    check: (_v, _gv, _g, ctx) => (ctx?.gamesWon || 0) >= 100,
    progress: (ctx) => ({ current: ctx?.gamesWon || 0, target: 100 }) },

  { id: 'killer_first', name: 'First Kill', desc: 'Eliminate a player in Killer', icon: '💀',
    check: (_v, _gv, g) => g && g.mode === 'killer' && g.players.some((p:any) => (p.kills||[]).length >= 1) },
  { id: 'killer_3', name: 'Killing Spree', desc: 'Eliminate 3 players in one Killer game', icon: '🔫',
    check: (_v, _gv, g) => g && g.mode === 'killer' && g.players.some((p:any) => (p.kills||[]).length >= 3) },
  { id: 'killer_survivor', name: 'Last One Standing', desc: 'Win a Killer game', icon: '🥇',
    check: (_v, _gv, g) => g && g.mode === 'killer' && g.players.length >= 2 && g.winner && g.players.some((p:any) => p.id === g.winner) },
  { id: 'killer_marked', name: 'Marked for Death', desc: 'Become a Killer (5 hits on your number)', icon: '🔪',
    check: (_v, _gv, g) => g && g.mode === 'killer' && g.players.some((p:any) => (p.killerHits||0) >= 5) },
  { id: 'killer_flawless', name: 'Flawless Victory', desc: 'Win Killer without losing a life', icon: '✨',
    check: (_v, _gv, g) => g && g.mode === 'killer' && g.players.length >= 2 && g.winner && g.players.some((p:any) => p.id === g.winner && (p.lives||0) >= 3) },

  { id: 'speed_demon', name: 'Speed Demon', desc: 'Win a Speed 101 game', icon: '⚡',
    check: (_v, _gv, g) => g && g.mode === 'speed101' && g.players.length >= 2 && g.winner && g.players.some((p:any) => p.id === g.winner) },
  { id: 'speed_blur', name: 'Blur', desc: 'Checkout 101 in a single visit', icon: '💨',
    check: (_v, gv) => gv.some((v:any) => v.mode === 'speed101' && v.remaining === 0 && (v.darts||[]).length <= 3) },
  { id: 'high_roller', name: 'High Roller', desc: 'Win a High Score game', icon: '🎰',
    check: (_v, _gv, g) => g && g.mode === 'highscore' && g.players.length >= 2 && g.winner && g.players.some((p:any) => p.id === g.winner) },
  { id: 'jackpot', name: 'Jackpot', desc: 'Score 400+ in a High Score game', icon: '💰',
    check: (_v, gv, g) => g && g.mode === 'highscore' && gv.filter((v:any) => v.mode === 'highscore').reduce((a:number,v:any) => a + (v.scored||0), 0) >= 400 },
  { id: 'party_animal', name: 'Party Animal', desc: 'Play 5 party-mode games', icon: '🎉',
    check: (_v, _gv, _g, ctx) => (ctx?.games || []).filter((g:any) => g.mode === 'speed101' || g.mode === 'highscore').length >= 5,
    progress: (ctx) => ({ current: (ctx?.games || []).filter((g:any) => g.mode === 'speed101' || g.mode === 'highscore').length, target: 5 }) },

  { id: 'battle_first_win', name: 'First Blood', desc: 'Win your first Battle match', icon: '🩸',
    check: (_v, _gv, g, ctx) => {
      if (g?.mode === 'battle' && g.players.length >= 2 && g.winner && g.players.some((p:any) => p.id === g.winner)) return true;
      return (ctx?.games || []).some((gm:any) => gm.mode === 'battle' && gm.players.length >= 2 && gm.winner === ctx?.playerId);
    },
    progress: (ctx) => ({ current: (ctx?.games || []).filter((g:any) => g.mode === 'battle' && g.winner === ctx?.playerId).length, target: 1 }) },
  { id: 'battle_5_wins', name: 'Brawler', desc: 'Win 5 Battle matches', icon: '🥊',
    check: (_v, _gv, _g, ctx) => (ctx?.games || []).filter((g:any) => g.mode === 'battle' && g.winner === ctx?.playerId).length >= 5,
    progress: (ctx) => ({ current: (ctx?.games || []).filter((g:any) => g.mode === 'battle' && g.winner === ctx?.playerId).length, target: 5 }) },
  { id: 'battle_25_wins', name: 'Warlord', desc: 'Win 25 Battle matches', icon: '⚔️',
    check: (_v, _gv, _g, ctx) => (ctx?.games || []).filter((g:any) => g.mode === 'battle' && g.winner === ctx?.playerId).length >= 25,
    progress: (ctx) => ({ current: (ctx?.games || []).filter((g:any) => g.mode === 'battle' && g.winner === ctx?.playerId).length, target: 25 }) },
  { id: 'battle_titan', name: 'Battle Titan', desc: 'Win 100 Battle matches', icon: '🌋',
    check: (_v, _gv, _g, ctx) => (ctx?.games || []).filter((g:any) => g.mode === 'battle' && g.winner === ctx?.playerId).length >= 100,
    progress: (ctx) => ({ current: (ctx?.games || []).filter((g:any) => g.mode === 'battle' && g.winner === ctx?.playerId).length, target: 100 }) },
  { id: 'battle_knockout', name: 'Knockout', desc: 'Defeat an opponent in a Battle match', icon: '💀',
    check: (_v, _gv, g) => g && g.mode === 'battle' && g.players.some((p:any) => (p.defeated || (p.hp ?? 0) <= 0)) },
  { id: 'battle_flawless', name: 'Flawless Victory', desc: 'Win a Battle match without dropping below half HP', icon: '✨',
    check: (_v, _gv, g) => g && g.mode === 'battle' && g.players.length >= 2 && g.winner && g.players.some((p:any) => p.id === g.winner && (p.hp ?? 0) >= (p.maxHp ?? 1) * 0.5) },
  { id: 'battle_3v1', name: 'Last Stand', desc: 'Win a Battle match against 3+ opponents', icon: '🏰',
    check: (_v, _gv, g) => g && g.mode === 'battle' && g.players.length >= 4 && g.winner && g.players.some((p:any) => p.id === g.winner) },
  { id: 'battle_bruiser', name: 'Bruiser', desc: 'Deal 500+ total damage in a single Battle match', icon: '💥',
    check: (_v, _gv, g) => g && g.mode === 'battle' && g.players.some((p:any) => (p.damageDealt || 0) >= 500) },
  { id: 'battle_ironhide', name: 'Ironhide', desc: 'Have max armor equipped for a Battle match', icon: '🛡️',
    check: (_v, _gv, g) => g && g.mode === 'battle' && g.players.some((p:any) => (p.armorPct || 0) >= 25) },
  { id: 'battle_powerhouse', name: 'Powerhouse', desc: 'Have max power equipped for a Battle match', icon: '⚡',
    check: (_v, _gv, g) => g && g.mode === 'battle' && g.players.some((p:any) => (p.powerPct || 0) >= 30) },

  { id: 'team_first_win', name: 'Team Player', desc: 'Win your first team match', icon: '🤝',
    check: (_v, _gv, g, ctx) => {
      if (g?.teamMode && g.winningTeam != null && g.players.some((p:any) => p.id === ctx?.playerId && p.team === g.winningTeam)) return true;
      return (ctx?.games || []).some((gm:any) => gm.teamMode && gm.winningTeam != null && gm.players.some((p:any) => p.id === ctx?.playerId && p.team === gm.winningTeam));
    },
    progress: (ctx) => ({ current: (ctx?.games || []).filter((g:any) => g.teamMode && g.winningTeam != null && g.players.some((p:any) => p.id === ctx?.playerId && p.team === g.winningTeam)).length, target: 1 }) },
  { id: 'team_5_wins', name: 'Squad Up', desc: 'Win 5 team matches', icon: '👥',
    check: (_v, _gv, _g, ctx) => (ctx?.games || []).filter((g:any) => g.teamMode && g.winningTeam != null && g.players.some((p:any) => p.id === ctx?.playerId && p.team === g.winningTeam)).length >= 5,
    progress: (ctx) => ({ current: (ctx?.games || []).filter((g:any) => g.teamMode && g.winningTeam != null && g.players.some((p:any) => p.id === ctx?.playerId && p.team === g.winningTeam)).length, target: 5 }) },
  { id: 'team_25_wins', name: 'Dream Team', desc: 'Win 25 team matches', icon: '🌟',
    check: (_v, _gv, _g, ctx) => (ctx?.games || []).filter((g:any) => g.teamMode && g.winningTeam != null && g.players.some((p:any) => p.id === ctx?.playerId && p.team === g.winningTeam)).length >= 25,
    progress: (ctx) => ({ current: (ctx?.games || []).filter((g:any) => g.teamMode && g.winningTeam != null && g.players.some((p:any) => p.id === ctx?.playerId && p.team === g.winningTeam)).length, target: 25 }) },
  { id: 'team_4stack', name: 'Four Stack', desc: 'Win a team match with 4 teams playing', icon: '🟦',
    check: (_v, _gv, g) => !!(g?.teamMode && g.teamCount === 4 && g.winningTeam != null && g.players.some((p:any) => p.team === g.winningTeam)) },
  { id: 'team_clutch', name: 'Clutch Team', desc: 'Win a best-of team match (3+ legs)', icon: '🛡️',
    check: (_v, _gv, g) => !!(g?.teamMode && g.legsBestOf > 1 && g.winningTeam != null && g.players.some((p:any) => p.team === g.winningTeam)) },
  { id: 'team_rivalry', name: 'Rivalry', desc: 'Play a team match against at least 2 other teams', icon: '⚔️',
    check: (_v, _gv, g) => !!(g?.teamMode && (g.teamCount || 0) >= 2 && g.players.some((p:any) => p.id === (g.players.find((pp:any) => pp.team === g.winningTeam)?.id))) },

  // ============ Co-op Campaign ============
  // Coop titles are awarded based on campaign progress stored under the
  // `dc_campaign_progress` localStorage key. We read it via the ctx's
  // `campaignProgress` field (passed in by the caller). Since campaign
  // progress isn't tied to a specific game record, these titles use the
  // lifetime/ctx form of the check.
  { id: 'coop_first_clear', name: 'First Strike', desc: 'Clear your first Co-op Campaign level', icon: '🛡️',
    check: (_v, _gv, _g, ctx) => (ctx?.campaignProgress?.highest_level_beaten || 0) >= 1,
    progress: (ctx) => ({ current: Math.min(ctx?.campaignProgress?.highest_level_beaten || 0, 1), target: 1 }) },
  { id: 'coop_3_clears', name: 'Campaigner', desc: 'Clear 3 Co-op Campaign levels', icon: '🗺️',
    check: (_v, _gv, _g, ctx) => (ctx?.campaignProgress?.highest_level_beaten || 0) >= 3,
    progress: (ctx) => ({ current: Math.min(ctx?.campaignProgress?.highest_level_beaten || 0, 3), target: 3 }) },
  { id: 'coop_boss_slayer', name: 'Boss Slayer', desc: 'Defeat the final boss of Chapter I', icon: '☠️',
    check: (_v, _gv, _g, ctx) => (ctx?.campaignProgress?.highest_level_beaten || 0) >= 5,
    progress: (ctx) => ({ current: Math.min(ctx?.campaignProgress?.highest_level_beaten || 0, 5), target: 5 }) },
  { id: 'coop_ch2_clear', name: 'Thronebreaker', desc: 'Clear all of Chapter II · The Frozen Throne', icon: '❄️',
    check: (_v, _gv, _g, ctx) => (ctx?.campaignProgress?.highest_level_beaten || 0) >= 10,
    progress: (ctx) => ({ current: Math.min(ctx?.campaignProgress?.highest_level_beaten || 0, 10), target: 10 }) },
  { id: 'coop_ch3_clear', name: 'Mawtamer', desc: 'Clear all of Chapter III · The Verdant Maw', icon: '🌿',
    check: (_v, _gv, _g, ctx) => (ctx?.campaignProgress?.highest_level_beaten || 0) >= 15,
    progress: (ctx) => ({ current: Math.min(ctx?.campaignProgress?.highest_level_beaten || 0, 15), target: 15 }) },
  { id: 'coop_full_clear', name: 'Campaign Conqueror', desc: 'Clear every Co-op Campaign level across all three chapters', icon: '👑',
    check: (_v, _gv, _g, ctx) => (ctx?.campaignProgress?.highest_level_beaten || 0) >= 15,
    progress: (ctx) => ({ current: Math.min(ctx?.campaignProgress?.highest_level_beaten || 0, 15), target: 15 }) },
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

export function titleProgressInfo(t: TitleDef, ctx: TitleCtx): { current: number; target: number; pct: number } | null {
  if (!t.progress) return null;
  try {
    const r = t.progress(ctx);
    if (!r || r.target <= 0) return null;
    const current = Math.max(0, Math.min(r.current, r.target));
    return { current, target: r.target, pct: Math.max(0, Math.min(100, (current / r.target) * 100)) };
  } catch { return null; }
}
