import type { Game, PlayedCard, Settings } from '../../types';
import { Sound } from '../../sound';
import type { CardDef, CardPlayState } from '../../cards/types';
import { cardDamage } from '../../cards/definitions';
import {
  playCardFromHand, redrawHand, recycleGraveyard,
} from '../../cards/deck';

const EFFECT_MESSAGES: Record<string, string> = {
  heal: '✨ {name} — Party healed!',
  heal_over_time: '💚 {name} — Party regenerating HP!',
  party_shield_flat: '🛡️ {name} — Party shielded from flat damage!',
  party_shield: '🛡️ {name} — Party takes less damage!',
  enemy_curse: '🔮 {name} — Enemies cursed!',
  enemy_debuff: '💀 {name} — Enemies weakened!',
  enemy_miss: '🌀 {name} — Enemies debuffed, may miss!',
  bleed: '🩸 {name} — Enemies bleeding!',
  freeze: '❄️ {name} — Enemies frozen!',
  surge: '⚡ {name} — Next visit scores double!',
  hot_streak: '🔥 {name} — Cumulative bonus active!',
  power_buff: '💪 {name} — Party power increased!',
  accuracy_buff: '🔮 {name} — Divine sight granted to the party!',
  armor_buff: '🏰 {name} — Party armor fortified!',
  reflect: '🪞 {name} — Damage reflection active!',
  draw: '🃏 {name} — Extra cards drawn!',
  reroll: '🎲 {name} — Reroll available!',
  shadowstep: '🌑 {name} — Shadowstep active!',
  blessing: '🙏 {name} — Blessed!',
  bust_protect: '🛡️ {name} — Soul barrier active!',
  double_up: '🌀 {name} — Enemy strike disrupted!',
  extra_dart: '➕ {name} — Extra throw granted!',
  redraw: '🔄 {name} — Hand discarded, fresh cards drawn!',
  recycle: '♻️ {name} — Graveyard shuffled into deck!',
  revive: '❤️ {name} — Party revived!',
};

export function effectToastMessage(card: CardDef): string {
  const template = EFFECT_MESSAGES[card.effect || ''];
  if (!template) return `${card.name}: ${card.desc}`;
  return template.replace('{name}', card.name);
}

export interface PlayCardParams {
  handIdx: number;
  handDefs: CardDef[];
  state: CardPlayState;
  game: Game;
  p: { id: string; name: string; color: string };
  settings: Settings;
  toast: (m: string) => void;
  setGame: (g: Game) => void;
  totalCardsPlayed: number;
  maxPlays: number;
  bonusSlots: number;
  prevHandRef: { current: number | null };
  setSelectedCardIdx: (idx: number | null) => void;
  force: (fn: (n: number) => number) => void;
}

export function playCard(params: PlayCardParams): void {
  const { handIdx, handDefs, state, game, p, settings, toast, setGame, totalCardsPlayed, maxPlays, bonusSlots, prevHandRef, setSelectedCardIdx, force } = params;
  const card = handDefs[handIdx];
  if (!card) return;
  if (totalCardsPlayed >= maxPlays) { toast(`Only ${maxPlays} cards per visit`); return; }
  if (card.type !== 'damage') {
    const msg = effectToastMessage(card);
    toast(msg);
    const soundType = card.type === 'spell' ? 'card_spell' : 'card_utility';
    Sound.play(soundType, {}, settings);
    let updated = playCardFromHand(state, handIdx);
    if (!updated) return;

    let gameUpdates: Partial<Game> = {};
    const applyGame = (updates: Partial<Game>) => { gameUpdates = { ...gameUpdates, ...updates }; };

    if (card.effect === 'redraw') {
      updated = redrawHand(updated);
    } else if (card.effect === 'recycle') {
      updated = recycleGraveyard(updated);
    } else if (card.effect === 'extra_dart') {
      applyGame({ bonusSlots: bonusSlots + 1 });
    } else if (card.effect === 'extra_slot') {
      const slots = { ...(game.nextTurnSlots || {}) };
      slots[p.id] = (slots[p.id] ?? 0) + (card.magnitude ?? 1);
      applyGame({ nextTurnSlots: slots });
    } else if (card.effect === 'draw' || card.effect === 'blessing') {
      const drawCount = card.effect === 'blessing' ? 1 : (card.magnitude ?? 1);
      const draws1 = { ...(game.nextTurnDraws || {}) };
      draws1[p.id] = (draws1[p.id] ?? 0) + drawCount;
      applyGame({ nextTurnDraws: draws1 });
    } else if (card.effect === 'shadowstep') {
      const drawCount = card.magnitude ?? 1;
      const draws2 = { ...(game.nextTurnDraws || {}) };
      draws2[p.id] = (draws2[p.id] ?? 0) + drawCount;
      applyGame({ nextTurnDraws: draws2 });
      if (updated.used.length > 0) {
        const swapBack = updated.used[updated.used.length - 1];
        updated = {
          ...updated,
          hand: [...updated.hand, swapBack],
          used: updated.used.slice(0, -1),
        };
      }
    } else if (card.effect === 'surge') {
      applyGame({ players: game.players.map((pl, i) => i === game.turn ? { ...pl, _surgeNext: true } as any : pl) });
    } else if (card.effect === 'hot_streak') {
      applyGame({ players: game.players.map((pl, i) => i === game.turn ? { ...pl, _hotStreak: true } as any : pl) });
    } else if (card.effect === 'heal') {
      if (game.mode === 'battle') {
        applyGame({ players: game.players.map((pl, i) => i === game.turn ? { ...pl, hp: Math.min((pl as any).maxHp || 100, (pl.hp || 0) + (card.magnitude ?? 0)) } as any : pl) });
      }
    } else if (card.effect === 'bust_protect') {
      applyGame({ players: game.players.map((pl, i) => i === game.turn ? { ...pl, _luckyMiss: true } as any : pl) });
    }

    const playedCard: PlayedCard = {
      playerId: p.id, playerName: p.name, playerColor: p.color,
      cardId: card.id, upgradeLevel: state.hand[handIdx]?.upgradeLevel ?? 0,
      turn: game.turn, timestamp: Date.now(),
    };
    const pc = state.hand[handIdx];
    setGame({
      ...game,
      ...gameUpdates,
      cardState: { ...game.cardState, [p.id]: updated },
      playedCards: [...(game.playedCards || []), playedCard],
      lastCardPlay: { playerId: p.id, cardId: card.id, upgradeLevel: pc?.upgradeLevel ?? 0, timestamp: playedCard.timestamp },
    } as Game);
    force(n => n + 1);
    return;
  }
  if (game.darts.length >= maxPlays) { toast(`Only ${maxPlays} cards per visit`); return; }
  const updated = playCardFromHand(state, handIdx);
  if (!updated) return;
  const base = card.base ?? 0;
  const mult = card.mult ?? 1;
  const isBull = base === 50;
  const value = cardDamage(card);
  const label = card.name;
  const dart = { value, label, base, mult: isBull ? 2 : (base === 25 && value === 50 ? 2 : mult), isDouble: !!(isBull || (base === 25 && value === 50) || mult === 2), isOuter: false };
  Sound.play('card_damage', {}, settings);
  prevHandRef.current = handIdx;
  setSelectedCardIdx(null);
  const playedCard: PlayedCard = {
    playerId: p.id, playerName: p.name, playerColor: p.color,
    cardId: card.id, upgradeLevel: state.hand[handIdx]?.upgradeLevel ?? 0,
    turn: game.turn, timestamp: Date.now(),
  };
  const pc = state.hand[handIdx];
  setGame({
    ...game,
    darts: [...game.darts, dart],
    mult: 1,
    cardState: { ...game.cardState, [p.id]: updated },
    playedCards: [...(game.playedCards || []), playedCard],
    lastCardPlay: { playerId: p.id, cardId: card.id, upgradeLevel: pc?.upgradeLevel ?? 0, timestamp: playedCard.timestamp },
  } as Game);
  force(n => n + 1);
}
