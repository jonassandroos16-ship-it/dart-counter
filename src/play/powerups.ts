import type { Game, Settings } from '../types';
import { getPowerUpInfo, planReroll, type RerollPlan } from '../powerups';
import { Sound } from '../sound';

// Activation threshold for a given power-up id. Falls back to `chargeMax`
// when not configured, so existing behavior is unchanged by default.
export function chargesNeededFor(puId: string | null | undefined, settings: Settings): number {
  const cfg = settings.powerUpScaling;
  const cap = cfg.chargeMax;
  if (!puId) return cap;
  const v = cfg.chargesNeeded?.[puId];
  if (!Number.isFinite(v) || v == null) return cap;
  return Math.max(0, Math.min(cap, v as number));
}

export function chargeFromDart(dart: { value: number; isDouble: boolean; mult: number; base: number }, settings: Settings): number {
  const cfg = settings.powerUpScaling;
  let c = 0;
  const isBull = dart.value === 50 || dart.value === 25;
  if (isBull) c += cfg.chargePerBull;
  else if (dart.mult === 3) c += cfg.chargePerTriple;
  else if (dart.mult === 2 || dart.isDouble) c += cfg.chargePerDouble;
  c += dart.value * cfg.chargePerScorePoint;
  return c;
}

export function applyCharge(game: Game, playerIdx: number, charge: number, settings: Settings): Game {
  if (!game.powerUpsEnabled) return game;
  const cap = settings.powerUpScaling.chargeMax;
  const players = game.players.map((pl, i) => {
    if (i !== playerIdx) return pl;
    // Cap the orb at the activation threshold for the equipped power-up so
    // the visual fill matches the readiness state. If the threshold is
    // higher than chargeMax (shouldn't happen, but be safe), use chargeMax.
    const needed = chargesNeededFor(pl.powerUpId, settings);
    const orbCap = Math.min(cap, needed);
    const next = Math.min(orbCap, (pl.powerUpCharge || 0) + charge);
    return { ...pl, powerUpCharge: next };
  });
  return { ...game, players };
}

// Catch-up mechanic: when a player is trailing the leader by more than 50
// (in remaining x01 score, or in accumulated highscore), they earn a small
// bonus to their power-up charge per dart. This lets lagging players get
// back into the game faster.
export function catchUpBoost(game: Game, playerIdx: number, settings: Settings): number {
  if (!game.powerUpsEnabled) return 0;
  const players = game.players;
  if (players.length < 2) return 0;
  const me = players[playerIdx];
  if (!me) return 0;
  const isHighScore = game.mode === 'highscore';
  const TRAIL_THRESHOLD = 50;
  const base = chargesNeededFor(me.powerUpId, settings);
  const BOOST = Math.max(1, Math.round(base * 0.05));
  if (isHighScore) {
    const leader = Math.max(...players.map((p) => p.score));
    if (leader - me.score > TRAIL_THRESHOLD) return BOOST;
  } else {
    // x01-style: lower remaining is better. Leader has the lowest remaining.
    const leader = Math.min(...players.map((p) => p.score));
    if (me.score - leader > TRAIL_THRESHOLD) return BOOST;
  }
  return 0;
}

export interface ActivateOptions {
  // When the equipped power-up is Reroll, the activation flow plans the
  // reroll (computing the chosen dart up-front), then calls this hook so the
  // board can show the suspense overlay. The hook receives the planned
  // result and should resolve to `true` once the overlay has finished
  // animating (or `false` to cancel the activation without consuming the
  // charge). If omitted, reroll applies instantly with no overlay.
  onReroll?: (plan: RerollPlan) => Promise<boolean>;
}

export async function activatePowerUp(game: Game, playerIdx: number, settings: Settings, toast: (m: string) => void, opts: ActivateOptions = {}): Promise<Game | null> {
  if (!game.powerUpsEnabled) return null;
  const pl = game.players[playerIdx];
  if (!pl) { toast('No player'); return null; }
  const needed = chargesNeededFor(pl.powerUpId, settings);
  if ((pl.powerUpCharge || 0) < needed) { toast('Power-up not fully charged'); return null; }
  // Power-up cannot be activated at the start of a visit — at least one dart
  // must be thrown first. This prevents "instant" activation the moment a
  // round begins even when the orb is already at 100%.
  if (!game.darts.length) { toast('Throw at least one dart before activating'); return null; }
  const puId = pl.powerUpId;
  const pu = getPowerUpInfo(puId);
  if (!pu) { toast('No power-up equipped'); return null; }

  // Reroll is special-cased: plan the roll up-front, show the suspense
  // overlay, then apply the planned result. This keeps the game logic pure
  // (the chosen value is fixed before the animation runs) while still
  // giving the player a dramatic reveal.
  if (puId === 'pu_reroll') {
    const plan = planReroll(game, playerIdx);
    if (!plan) { toast('Reroll: no darts to reroll yet.'); return null; }
    if (opts.onReroll) {
      const proceed = await opts.onReroll(plan);
      if (!proceed) return null;
    }
    const darts = [...game.darts];
    darts[plan.idx] = { ...darts[plan.idx], ...plan.newDart };
    const nextGame = { ...game, darts };
    const message = `Reroll! Replaced ${plan.oldLabel} with ${plan.newDart.label} (${plan.newDart.value}).`;
    const withUses = consumeCharge(nextGame, playerIdx, puId);
    toast(message);
    Sound.playSfx('impact', settings);
    return withUses;
  }

  const { game: nextGame, message, ok } = pu.apply(game, playerIdx);
  // If the apply call signalled a failure (ok === false), do NOT consume the
  // charge — the player keeps their full orb and can try again later.
  if (ok === false) { toast(message); return null; }
  const withUses = consumeCharge(nextGame, playerIdx, puId);
  toast(message);
  Sound.playSfx('impact', settings);
  return withUses;
}

function consumeCharge(game: Game, playerIdx: number, puId: string | null | undefined): Game {
  const players = game.players.map((p: any, i: number) => {
    if (i !== playerIdx) return p;
    // Overcharge refills the orb to full instead of draining it — the whole
    // point of the power-up is to chain into another activation next visit.
    const refill = puId === 'pu_overcharge';
    const updated: any = { ...p, powerUpCharge: refill ? (game.powerUpsEnabled ? 100 : 0) : 0, powerUpUses: (p.powerUpUses || 0) + 1 };
    if (puId === 'pu_fourth_dart') updated._fourthDart = true;
    // Track which power-up was used so post-game badges can award the winner.
    if (puId === 'pu_blocker') updated._usedBlocker = true;
    if (puId === 'pu_surge') updated._usedSurge = true;
    if (puId === 'pu_steal') updated._usedSteal = true;
    if (puId === 'pu_freeze') updated._usedFreeze = true;
    if (puId === 'pu_reroll') updated._usedReroll = true;
    if (puId === 'pu_lucky_miss') updated._usedLuckyMiss = true;
    if (puId === 'pu_fourth_dart') updated._usedFourthDart = true;
    if (puId === 'pu_rethrow') updated._usedRethrow = true;
    if (puId === 'pu_cripple') updated._usedCripple = true;
    if (puId === 'pu_double_trouble') updated._usedDoubleTrouble = true;
    if (puId === 'pu_overcharge') updated._usedOvercharge = true;
    if (puId === 'pu_curse') updated._usedCurse = true;
    return updated;
  });
  return { ...game, players };
}
