import type { CardPlayState } from './types';
import { startTurn, drawCards } from './deck';

export function startTurnWithExtraDraws(
  cs: CardPlayState,
  extraDraw: number,
  extraSlot: number,
  applySlots: (n: number) => void,
): CardPlayState {
  let next = startTurn(cs);
  if (extraDraw > 0) next = drawCards(next, extraDraw);
  if (extraSlot > 0) applySlots(extraSlot);
  return next;
}
