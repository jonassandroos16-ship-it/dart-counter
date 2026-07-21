export type CardType = 'damage' | 'spell' | 'utility';
export type CardMode = 'competitive' | 'coop';
export type CardClass = 'warrior' | 'priest' | 'rogue' | 'any';

export interface CardDef {
  id: string;
  name: string;
  icon: string;
  type: CardType;
  mode: CardMode;
  class: CardClass;
  rarity: 'common' | 'rare' | 'epic';
  desc: string;
  /** Damage cards: dart sector base value (1-20, 25 for outer bull, 50 for bullseye) */
  base?: number;
  /** Damage cards: multiplier (1=single, 2=double, 3=triple) */
  mult?: number;
  /** Spell/utility cards: effect identifier for the engine */
  effect?: string;
  /** Spell/utility cards: numeric magnitude for the effect */
  magnitude?: number;
  /** Upgrade level: 0 = base, 1 = upgraded */
  upgraded?: boolean;
  /** Class level at which this card becomes available in the deck */
  levelRequired?: number;
}

export interface PlayerCard {
  cardId: string;
  upgraded: boolean;
}

// ── Deck-builder play state ────────────────────────────────────────────
//
// Per-player runtime state for the card-based mode. The player's collection
// is split into a draw deck, a hand of cards drawn for the current turn, a
// used pile (cards played this turn that cannot be replayed), and a
// graveyard (used cards from previous turns). When the deck runs out, the
// graveyard is shuffled back into the deck to form a new one.

export interface CardPlayState {
  deck: PlayerCard[];
  hand: PlayerCard[];
  used: PlayerCard[];
  graveyard: PlayerCard[];
}

export interface CardRewardOption {
  cardId: string;
  isNew: boolean;
}

export interface CardUpgradeOption {
  cardId: string;
  name: string;
  icon: string;
}
