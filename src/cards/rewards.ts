import type { TitleDef } from '../constants/titles';
import type { BadgeDef } from '../badges/types';
import { getPlayerCards } from './deck';

export interface CardRewardDef {
  id: string;
  title: string;
  desc: string;
  icon: string;
  check: (player: any) => boolean;
}

export const CARD_REWARDS: CardRewardDef[] = [
  {
    id: 'card_collector_10',
    title: 'Card Collector',
    desc: 'Collect 10 unique cards.',
    icon: '🃏',
    check: (p) => getPlayerCards(p).length >= 10,
  },
  {
    id: 'card_collector_25',
    title: 'Master Collector',
    desc: 'Collect 25 unique cards.',
    icon: '🎴',
    check: (p) => getPlayerCards(p).length >= 25,
  },
  {
    id: 'card_upgrader',
    title: 'Card Upgrader',
    desc: 'Upgrade a card for the first time.',
    icon: '⬆️',
    check: (p) => (getPlayerCards(p).some(c => c.upgraded)),
  },
];

export function checkCardRewards(player: any): string[] {
  return CARD_REWARDS.filter(r => r.check(player)).map(r => r.id);
}
