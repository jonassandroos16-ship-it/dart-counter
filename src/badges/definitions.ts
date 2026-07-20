import type { BadgeDef } from './types';
import { dartsOf, isBull, isMiss, pickExtreme, pickPowerUpWinner } from './helpers';
import {
  lifetimeBulls, lifetime20s, lifetimeClassic26, lifetimeTons, lifetimeBigTons,
  lifetime180s, lifetimeHatTricks, lifetimeTripleTriples, lifetimeDoubleDips,
  lifetimeBusts, lifetimeTriples, lifetimeFirstBloods, lifetimeMisses,
  lifetimeHighScore, lifetimeComebacks, lifetimeHighCheckout, lifetimeKills,
  lifetimeFullyCharged, lifetimeUnleashed, lifetimePowerUpWins,
} from './lifetime';

export const BADGES: BadgeDef[] = [
  { id: 'b_hit_bull', name: 'Hit Bull', desc: 'Hit any bull (25 or 50) during the game', icon: '🎯', kind: 'in-game',
    check: (v) => dartsOf(v).some(isBull),
    context: lifetimeBulls, contextLabel: 'bulls' },
  { id: 'b_hit_20', name: 'Hit 20', desc: 'Hit a 20 segment during the game', icon: '💥', kind: 'in-game',
    check: (v) => dartsOf(v).some((d: any) => d.base === 20),
    context: lifetime20s, contextLabel: '20s' },
  { id: 'b_classic_26', name: 'Classic 26', desc: 'Score a 26 with 20, 1, 5 in a single visit', icon: '🃏', kind: 'in-game',
    check: (v) => v.some((visit: any) => {
      if (visit.bust || visit.atc) return false;
      const darts = visit.darts || [];
      if (darts.length !== 3) return false;
      const bases = darts.map((d: any) => d.base).sort((a: number, b: number) => a - b);
      return bases[0] === 1 && bases[1] === 5 && bases[2] === 20 && visit.scored === 26;
    }),
    context: lifetimeClassic26, contextLabel: '26s' },
  { id: 'b_ton', name: 'Ton', desc: 'Score 100+ in a single visit', icon: '💯', kind: 'in-game',
    check: (v) => v.some((visit: any) => !visit.bust && !visit.atc && visit.scored >= 100),
    context: lifetimeTons, contextLabel: 'tons' },
  { id: 'b_ton40', name: 'Big Ton', desc: 'Score 140+ in a single visit', icon: '🔥', kind: 'in-game',
    check: (v) => v.some((visit: any) => !visit.bust && !visit.atc && visit.scored >= 140),
    context: lifetimeBigTons, contextLabel: 'big tons' },
  { id: 'b_ton80', name: 'Maximum', desc: 'Score a 180', icon: '💥', kind: 'in-game',
    check: (v) => v.some((visit: any) => !visit.bust && !visit.atc && visit.scored === 180),
    context: lifetime180s, contextLabel: '180s' },
  { id: 'b_hat_trick', name: 'Hat Trick', desc: 'Hit 3 bulls in one visit', icon: '🎩', kind: 'in-game',
    check: (v) => v.some((visit: any) => (visit.darts || []).filter(isBull).length >= 3),
    context: lifetimeHatTricks, contextLabel: 'hat tricks' },
  { id: 'b_triple_triple', name: 'Triple Triple', desc: 'Land 3 triples in one visit', icon: '🥞', kind: 'in-game',
    check: (v) => v.some((visit: any) => (visit.darts || []).filter((d: any) => d.mult === 3).length >= 3),
    context: lifetimeTripleTriples, contextLabel: 'triple-triples' },
  { id: 'b_double_dip', name: 'Double Dip', desc: 'Land 3 doubles in one visit', icon: '💠', kind: 'in-game',
    check: (v) => v.some((visit: any) => (visit.darts || []).filter((d: any) => d.mult === 2).length >= 3),
    context: lifetimeDoubleDips, contextLabel: 'double dips' },
  { id: 'b_buster', name: 'Buster', desc: 'Bust at least once', icon: '😵', kind: 'in-game',
    check: (v) => v.some((visit: any) => visit.bust),
    context: lifetimeBusts, contextLabel: 'busts' },
  { id: 'b_shark', name: 'Shark', desc: 'Hit 5+ triples in the game', icon: '🦈', kind: 'in-game',
    check: (v) => dartsOf(v).filter((d: any) => d.mult === 3).length >= 5,
    context: lifetimeTriples, contextLabel: 'triples' },
  { id: 'b_first_blood', name: 'First Blood', desc: 'Be the first player to check out a leg', icon: '🩸', kind: 'in-game',
    check: (v, game) => {
      if (!game || game.practice || game.atc) return false;
      if (!game.legsBestOf || game.legsBestOf <= 1) return false;
      let earliest: { pid: string; date: number } | null = null;
      for (const pl of game.players || []) {
        for (const visit of pl.visits || []) {
          if (visit.remaining === 0 && !visit.bust) {
            const t = new Date(visit.date || 0).getTime();
            if (!earliest || t < earliest.date) earliest = { pid: pl.id, date: t };
          }
        }
      }
      if (!earliest) return false;
      return v.some((visit: any) => visit.remaining === 0 && !visit.bust &&
        new Date(visit.date || 0).getTime() === earliest!.date);
    },
    context: lifetimeFirstBloods, contextLabel: 'first bloods' },

  { id: 'b_most_misses', name: 'Wild Throw', desc: 'Missed the most darts in the game', icon: '🌪️', kind: 'post-game',
    pick: (game) => pickExtreme(game, (pl) => dartsOf(pl.visits || []).filter(isMiss).length, 'max'),
    context: lifetimeMisses, contextLabel: 'misses' },
  { id: 'b_most_busts', name: 'Bust Master', desc: 'Busted the most times in the game', icon: '🚫', kind: 'post-game',
    pick: (game) => pickExtreme(game, (pl) => (pl.visits || []).filter((v: any) => v.bust).length, 'max'),
    context: lifetimeBusts, contextLabel: 'busts' },
  { id: 'b_highest_score', name: 'Top Scorer', desc: 'Had the highest single-visit score', icon: '📈', kind: 'post-game',
    pick: (game) => pickExtreme(game, (pl) => Math.max(0, ...(pl.visits || []).filter((v: any) => !v.bust && !v.atc).map((v: any) => v.scored || 0)), 'max'),
    context: lifetimeHighScore, contextLabel: 'high score' },
  { id: 'b_best_comeback', name: 'Comeback Kid', desc: 'Won after trailing by 50+, or threw a 150+ visit to level the scores', icon: '🔄', kind: 'post-game',
    pick: (game) => {
      if (!game || game.practice || game.atc) return null;
      if (!game.winner) return null;
      const winner = (game.players || []).find((p: any) => p.id === game.winner);
      if (!winner) return null;
      const hadBigVisit = (winner.visits || []).some((v: any) => !v.bust && !v.atc && v.scored >= 150);
      const players = game.players || [];
      let trailedBy50 = false;
      const totals: Record<string, number> = {};
      players.forEach((p: any) => (totals[p.id] = 0));
      const timeline: { pid: string; date: number; scored: number; bust: boolean; atc: boolean }[] = [];
      players.forEach((p: any) => (p.visits || []).forEach(function (v: any) { timeline.push({ pid: p.id, date: new Date(v.date || 0).getTime(), scored: v.scored || 0, bust: !!v.bust, atc: !!v.atc }); }));
      timeline.sort((a, b) => a.date - b.date);
      let winnerScored = 0;
      for (const ev of timeline) {
        if (ev.bust || ev.atc) continue;
        const leaderScored = Math.max(...players.map((p: any) => totals[p.id] || 0));
        if (ev.pid === winner.id && winnerScored + 50 <= leaderScored) trailedBy50 = true;
        totals[ev.pid] = (totals[ev.pid] || 0) + ev.scored;
        if (ev.pid === winner.id) winnerScored += ev.scored;
      }
      if (hadBigVisit || trailedBy50) return winner.id;
      return null;
    },
    context: lifetimeComebacks, contextLabel: 'comebacks' },
  { id: 'b_clutch', name: 'Clutch', desc: 'Checked out the winning leg from 100+ remaining', icon: '🏆', kind: 'post-game',
    pick: (game) => {
      if (!game || game.practice || game.atc) return null;
      if (!game.winner) return null;
      const winner = (game.players || []).find((p: any) => p.id === game.winner);
      if (!winner) return null;
      const checkout = (winner.visits || []).find((v: any) => v.remaining === 0 && !v.bust);
      if (checkout && (checkout.checkout || 0) >= 100) return winner.id;
      return null;
    },
    context: lifetimeHighCheckout, contextLabel: 'high checkout' },

  { id: 'b_slayer', name: 'Slayer', desc: 'Eliminate at least one opponent in a Killer game', icon: '💀', kind: 'post-game',
    pick: (game) => {
      if (!game || game.mode !== 'killer') return null;
      const slayers = (game.players || []).filter((p: any) => (p.kills || []).length >= 1);
      if (!slayers.length) return null;
      return slayers.length === 1 ? slayers[0].id : slayers.map((p: any) => p.id);
    },
    context: lifetimeKills, contextLabel: 'kills' },

  { id: 'b_power_charged', name: 'Fully Charged', desc: 'Charge your power-up to full during a power-up match', icon: '🔋', kind: 'post-game', powerUpOnly: true,
    pick: (game) => {
      if (!game || !game.powerUpsEnabled) return null;
      const charged = (game.players || []).filter((p: any) => (p.powerUpCharge || 0) >= 100 || (p.powerUpUses || 0) > 0).map((p: any) => p.id);
      if (!charged.length) return null;
      return charged.length === 1 ? charged[0] : charged;
    },
    context: lifetimeFullyCharged, contextLabel: 'charges' },
  { id: 'b_power_used', name: 'Unleashed', desc: 'Activate your equipped power-up during a power-up match', icon: '⚡', kind: 'post-game', powerUpOnly: true,
    pick: (game) => {
      if (!game || !game.powerUpsEnabled) return null;
      const used = (game.players || []).filter((p: any) => p.powerUpUsed || (p.powerUpUses || 0) > 0).map((p: any) => p.id);
      if (!used.length) return null;
      return used.length === 1 ? used[0] : used;
    },
    context: lifetimeUnleashed, contextLabel: 'activations' },
  { id: 'b_power_blocker', name: 'Wall Builder', desc: 'Win a power-up match after activating Blocker', icon: '🛡️', kind: 'post-game', powerUpOnly: true,
    pick: (game) => pickPowerUpWinner(game, 'pu_blocker'),
    context: (pid, games) => lifetimePowerUpWins(pid, games, 'pu_blocker'), contextLabel: 'wins' },
  { id: 'b_power_surge', name: 'Surge Rider', desc: 'Win a power-up match after activating Surge', icon: '⚡', kind: 'post-game', powerUpOnly: true,
    pick: (game) => pickPowerUpWinner(game, 'pu_surge'),
    context: (pid, games) => lifetimePowerUpWins(pid, games, 'pu_surge'), contextLabel: 'wins' },
  { id: 'b_power_steal', name: 'Thief', desc: 'Win a power-up match after activating Steal', icon: '🥷', kind: 'post-game', powerUpOnly: true,
    pick: (game) => pickPowerUpWinner(game, 'pu_steal'),
    context: (pid, games) => lifetimePowerUpWins(pid, games, 'pu_steal'), contextLabel: 'wins' },
  { id: 'b_power_freeze', name: 'Cold Snap', desc: 'Win a power-up match after activating Freeze', icon: '❄️', kind: 'post-game', powerUpOnly: true,
    pick: (game) => pickPowerUpWinner(game, 'pu_freeze'),
    context: (pid, games) => lifetimePowerUpWins(pid, games, 'pu_freeze'), contextLabel: 'wins' },
  { id: 'b_power_reroll', name: 'Lucky Hand', desc: 'Win a power-up match after activating Reroll', icon: '🎲', kind: 'post-game', powerUpOnly: true,
    pick: (game) => pickPowerUpWinner(game, 'pu_reroll'),
    context: (pid, games) => lifetimePowerUpWins(pid, games, 'pu_reroll'), contextLabel: 'wins' },
  { id: 'b_power_lucky', name: 'Saved', desc: 'Win a power-up match after activating Lucky Miss', icon: '🍀', kind: 'post-game', powerUpOnly: true,
    pick: (game) => pickPowerUpWinner(game, 'pu_lucky_miss'),
    context: (pid, games) => lifetimePowerUpWins(pid, games, 'pu_lucky_miss'), contextLabel: 'wins' },
  { id: 'b_power_fourth', name: 'Quad Squad', desc: 'Win a power-up match after activating Fourth Dart', icon: '🎯', kind: 'post-game', powerUpOnly: true,
    pick: (game) => pickPowerUpWinner(game, 'pu_fourth_dart'),
    context: (pid, games) => lifetimePowerUpWins(pid, games, 'pu_fourth_dart'), contextLabel: 'wins' },
  { id: 'b_power_rethrow', name: 'Second Chance', desc: 'Win a power-up match after activating Re-Throw', icon: '🔁', kind: 'post-game', powerUpOnly: true,
    pick: (game) => pickPowerUpWinner(game, 'pu_rethrow'),
    context: (pid, games) => lifetimePowerUpWins(pid, games, 'pu_rethrow'), contextLabel: 'wins' },
  { id: 'b_power_cripple', name: 'Saboteur', desc: 'Win a power-up match after activating Cripple', icon: '🦾', kind: 'post-game', powerUpOnly: true,
    pick: (game) => pickPowerUpWinner(game, 'pu_cripple'),
    context: (pid, games) => lifetimePowerUpWins(pid, games, 'pu_cripple'), contextLabel: 'wins' },

  { id: 'b_coop_first_clear', name: 'First Strike', desc: 'Clear your first Co-op Campaign level', icon: '🛡️', kind: 'in-game', coopOnly: true,
    check: (_v, _game) => false,
    context: (_playerId, _games, ctx?: any) => (ctx?.campaignProgress?.highest_level_beaten || 0) >= 1 ? 1 : 0,
    contextLabel: 'levels' },
  { id: 'b_coop_boss_slayer', name: 'Boss Slayer', desc: 'Defeat a Co-op Campaign boss', icon: '☠️', kind: 'in-game', coopOnly: true,
    check: (_v, _game) => false,
    context: (_playerId, _games, ctx?: any) => (ctx?.campaignProgress?.highest_level_beaten || 0) >= 5 ? 1 : 0,
    contextLabel: 'boss' },
  { id: 'b_coop_healer', name: 'Field Medic', desc: 'Use the Heal power-up in a Co-op battle', icon: '❤️', kind: 'in-game', coopOnly: true,
    check: (_v, _game) => false,
    context: (_playerId, _games, ctx?: any) => (ctx?.coopStats?.healsUsed || 0),
    contextLabel: 'heals' },
  { id: 'b_coop_freezer', name: 'Cold Front', desc: 'Use the Freeze power-up in a Co-op battle', icon: '❄️', kind: 'in-game', coopOnly: true,
    check: (_v, _game) => false,
    context: (_playerId, _games, ctx?: any) => (ctx?.coopStats?.freezesUsed || 0),
    contextLabel: 'freezes' },
];
