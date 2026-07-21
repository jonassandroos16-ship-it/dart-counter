import type { TitleDef } from '../constants/titles';
import type { BadgeDef } from '../badges/types';

// ── Card-mode exclusive titles ──────────────────────────────────────────
//
// These titles are only achievable in card-based mode. They track
// card-related metrics like cards played, spell usage, upgrades, etc.

export const CARD_TITLES: TitleDef[] = [
  { id: 'card_first_win', name: 'Card Shark', icon: '🃏', desc: 'Win your first card-based game.',
    check: (_all, _gv, game, _ctx) => !!(game && !game.practice && game.winner && game.mode !== 'battle') },
  { id: 'card_10_wins', name: 'Deck Master', icon: '🎴', desc: 'Win 10 card-based games.',
    check: (_all, _gv, _game, ctx) => ((ctx as any)?.gamesWon || 0) >= 10 },
  { id: 'card_spellcaster', name: 'Spellcaster', icon: '✨', desc: 'Play 5 spell cards in a single game.',
    check: (_all, gv) => gv?.reduce((a: number, v: any) => a + (v.darts.filter((d: any) => d.label?.includes('Spell') || (d.value === 0 && d.label !== 'Miss' && d.label !== '0')).length || 0), 0) >= 5 },
  { id: 'card_upgrade_master', name: 'Arcane Smith', icon: '⚒️', desc: 'Upgrade 3 cards.',
    check: (_all, _gv, _game, ctx) => ((ctx as any)?.cardsUpgraded || 0) >= 3 },
  { id: 'card_collector', name: 'Collector', icon: '📦', desc: 'Own 10 different cards.',
    check: (_all, _gv, _game, ctx) => ((ctx as any)?.cardsOwned || 0) >= 10 },
  { id: 'card_perfect_visit', name: 'Perfect Hand', icon: '💎', desc: 'Score 180 in a single visit using cards.',
    check: (_all, gv) => gv?.some((v: any) => v.scored >= 180) || false },
  { id: 'card_no_miss', name: 'Flawless Deck', icon: '🎯', desc: 'Win a card-based game without playing a Miss card.',
    check: (_all, gv, game) => {
      if (!game || game.practice || !game.winner) return false;
      const allDarts = (gv || []).flatMap((v: any) => v.darts);
      return !allDarts.some((d: any) => d.label === 'Miss' || d.value === 0);
    } },
  { id: 'card_bull_master', name: 'Bull Tamer', icon: '🐂', desc: 'Play 3 Bullseye cards in one game.',
    check: (_all, gv) => gv?.reduce((a: number, v: any) => a + v.darts.filter((d: any) => d.label === 'Bullseye' || d.value === 50).length, 0) >= 3 || false },
];

// ── Card-mode exclusive badges ──────────────────────────────────────────

export const CARD_BADGES: BadgeDef[] = [
  { id: 'cb_card_rookie', name: 'Card Rookie', icon: '🃏', desc: 'Complete your first card-based game.', kind: 'post-game', contextLabel: 'Card games', context: (_pid, games) => games.filter((g: any) => !g.practice && g.mode !== 'battle').length },
  { id: 'cb_card_veteran', name: 'Card Veteran', icon: '🎴', desc: 'Complete 25 card-based games.', kind: 'post-game', contextLabel: 'Card games', context: (_pid, games) => games.filter((g: any) => !g.practice && g.mode !== 'battle').length },
  { id: 'cb_card_champion', name: 'Card Champion', icon: '🏆', desc: 'Win 10 card-based games.', kind: 'post-game', contextLabel: 'Card wins', context: (_pid, games) => games.filter((g: any) => !g.practice && g.mode !== 'battle' && g.winner).length },
  { id: 'cb_spell_master', name: 'Spell Master', icon: '✨', desc: 'Play 50 spell cards across all games.', kind: 'post-game', contextLabel: 'Spells cast', context: (_pid, games) => games.reduce((a: number, g: any) => a + g.players.reduce((pa: number, pl: any) => pa + (pl.visits || []).reduce((va: number, v: any) => va + (v.darts || []).filter((d: any) => d.label?.includes('Spell')).length, 0), 0), 0), 0) },
  { id: 'cb_card_collector', name: 'Card Collector', icon: '📦', desc: 'Collect 15 different cards.', kind: 'post-game', contextLabel: 'Cards owned', context: (pid, _games, players) => {
    const p = (players as any[])?.find((pl: any) => pl.id === pid);
    return p?.cards?.length || 0;
  } },
];
