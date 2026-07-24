import type { Game, PlayedCard, Settings } from '../../types';
import { Sound } from '../../sound';
import type { CardDef, CardPlayState } from '../../cards/types';
import { cardDamage } from '../../cards/definitions';
import {
  playCardFromHand, redrawHand, recycleGraveyard,
} from '../../cards/deck';

export function playCard(params: {
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
  prevHandRef: React.MutableRefObject<number | null>;
  setSelectedCardIdx: (idx: number | null) => void;
  force: (fn: (n: number) => number) => void;
}) {
  const { handIdx, handDefs, state, game, p, settings, toast, setGame, totalCardsPlayed, maxPlays, prevHandRef, setSelectedCardIdx, force } = params;
  const card = handDefs[handIdx];
  if (!card) return;
  if (totalCardsPlayed >= maxPlays) {
    toast('No more card plays this turn');
    return;
  }

  const updated = playCardFromHand(state, handIdx);
  if (!updated) return;

  const effectMessages: Record<string, string> = {
    heal: '✨ {name} — Party healed!',
    heal_over_time: '💚 {name} — Party regenerating HP!',
    crit_buff: '🔮 {name} — Critical hit chance granted to the party!',
    party_shield_flat: '🛡️ {name} — Party shielded!',
    party_shield: '🛡️ {name} — Party damage reduction!',
    enemy_curse: '🔮 {name} — Enemies cursed!',
    enemy_debuff: '💀 {name} — Enemies weakened!',
    enemy_miss: '🌀 {name} — Enemies distracted!',
    bleed: '🩸 {name} — Enemies bleeding!',
    freeze: '❄️ {name} — Enemies frozen!',
    surge: '⚡ {name} — Next visit scores double!',
    hot_streak: '🔥 {name} — Hot streak active!',
    power_buff: '💪 {name} — Party power increased!',
    armor_buff: '🏰 {name} — Party armor increased!',
    reflect: '🪞 {name} — Damage reflection active!',
    draw: '🃏 {name} — Extra cards next turn!',
    blessing: '🙏 {name} — Blessed!',
    bust_protect: '🛡️ {name} — Soul barrier active!',
    double_up: '🌀 {name} — Enemy strike disrupted!',
    extra_dart: '➕ {name} — Extra dart throw granted!',
    extra_slot: '➕ {name} — Extra card slots next turn!',
    redraw: '🔄 {name} — Hand redrawn!',
    recycle: '♻️ {name} — Graveyard recycled!',
    shadowstep: '🌑 {name} — Shadowstep!',
    revive: '❤️ {name} — Party revived!',
  };

  if (card.effect && effectMessages[card.effect]) {
    toast(effectMessages[card.effect].replace('{name}', card.name));
  }

  const base = card.base ?? 0;
  const cardMult = card.mult ?? 1;
  const isBull = base === 50;
  const label = card.name;
  const value = isBull ? 50 : base * (isBull ? 2 : cardMult);

  let nextGame: Game = {
    ...game,
    cardState: { ...game.cardState, [p.id]: updated },
    lastCardPlay: {
      playerId: p.id,
      cardId: card.id,
      upgradeLevel: 0,
      timestamp: Date.now(),
    },
  };

  if (card.effect === 'redraw') {
    const redrawn = redrawHand(updated);
    nextGame = { ...nextGame, cardState: { ...nextGame.cardState, [p.id]: redrawn } };
  } else if (card.effect === 'recycle') {
    const recycled = recycleGraveyard(updated);
    nextGame = { ...nextGame, cardState: { ...nextGame.cardState, [p.id]: recycled } };
  } else if (card.effect === 'extra_dart') {
    nextGame = { ...nextGame, bonusSlots: (nextGame.bonusSlots || 0) + 1 };
  } else if (card.effect === 'extra_slot') {
    nextGame = {
      ...nextGame,
      nextTurnSlots: { ...nextGame.nextTurnSlots, [p.id]: (nextGame.nextTurnSlots?.[p.id] ?? 0) + (card.magnitude ?? 1) },
    };
  } else if (card.effect === 'draw') {
    nextGame = {
      ...nextGame,
      nextTurnDraws: { ...nextGame.nextTurnDraws, [p.id]: (nextGame.nextTurnDraws?.[p.id] ?? 0) + (card.magnitude ?? 1) },
    };
  } else if (card.effect === 'blessing') {
    nextGame = {
      ...nextGame,
      nextTurnDraws: { ...nextGame.nextTurnDraws, [p.id]: (nextGame.nextTurnDraws?.[p.id] ?? 0) + 1 },
    };
  } else if (card.effect === 'shadowstep') {
    nextGame = {
      ...nextGame,
      nextTurnDraws: { ...nextGame.nextTurnDraws, [p.id]: (nextGame.nextTurnDraws?.[p.id] ?? 0) + (card.magnitude ?? 1) },
    };
    if (updated.used.length > 0) {
      const swapBack = updated.used[updated.used.length - 1];
      const shadowstepState: CardPlayState = {
        ...updated,
        hand: [...updated.hand, swapBack],
        used: updated.used.slice(0, -1),
      };
      nextGame = { ...nextGame, cardState: { ...nextGame.cardState, [p.id]: shadowstepState } };
    }
  }

  const playedCards = game.playedCards || [];
  const playedCard: PlayedCard = {
    playerId: p.id,
    playerName: p.name,
    playerColor: p.color,
    cardId: card.id,
    cardName: card.name,
    cardIcon: card.icon,
    cardType: card.type,
    cardRarity: card.rarity,
    value,
    timestamp: Date.now(),
  };
  nextGame = { ...nextGame, playedCards: [...playedCards, playedCard] };

  if (card.type === 'damage') {
    const soundType = 'dart';
    Sound.play(soundType, { score: value }, settings);
    Sound.play('impact', {}, settings);
    nextGame = {
      ...nextGame,
      darts: [...game.darts, { value, label }],
    };
  } else {
    Sound.play('powerup', {}, settings);
  }

  setGame(nextGame);
  setSelectedCardIdx(null);
  prevHandRef.current = handIdx;
  force(n => n + 1);
}
