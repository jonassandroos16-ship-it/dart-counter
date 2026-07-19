import type { Game, Settings } from '../types';
import { getPowerUpInfo } from '../powerups';
import { Sound } from '../sound';

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
    const next = Math.min(cap, (pl.powerUpCharge || 0) + charge);
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
  const BOOST = Math.max(1, Math.round(settings.powerUpScaling.chargeMax * 0.05));
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

export function activatePowerUp(game: Game, playerIdx: number, settings: Settings, toast: (m: string) => void): Game | null {
  if (!game.powerUpsEnabled) return null;
  const pl = game.players[playerIdx];
  if (!pl) { toast('No player'); return null; }
  const cap = settings.powerUpScaling.chargeMax;
  if ((pl.powerUpCharge || 0) < cap) { toast('Power-up not fully charged'); return null; }
  // Power-up cannot be activated at the start of a visit — at least one dart
  // must be thrown first. This prevents "instant" activation the moment a
  // round begins even when the orb is already at 100%.
  if (!game.darts.length) { toast('Throw at least one dart before activating'); return null; }
  const puId = pl.powerUpId;
  const pu = getPowerUpInfo(puId);
  if (!pu) { toast('No power-up equipped'); return null; }
  const { game: nextGame, message, ok } = pu.apply(game, playerIdx);
  // If the apply call signalled a failure (ok === false), do NOT consume the
  // charge — the player keeps their full orb and can try again later.
  if (ok === false) { toast(message); return null; }
  const players = nextGame.players.map((p: any, i: number) => {
    if (i !== playerIdx) return p;
    const updated: any = { ...p, powerUpCharge: 0, powerUpUses: (p.powerUpUses || 0) + 1 };
    if (puId === 'pu_fourth_dart') updated._fourthDart = true;
    // Track which power-up was used so post-game badges can award the winner.
    if (puId === 'pu_blocker') updated._usedBlocker = true;
    if (puId === 'pu_surge') updated._usedSurge = true;
    if (puId === 'pu_steal') updated._usedSteal = true;
    if (puId === 'pu_freeze') updated._usedFreeze = true;
    if (puId === 'pu_reroll') updated._usedReroll = true;
    if (puId === 'pu_lucky_miss') updated._usedLuckyMiss = true;
    if (puId === 'pu_fourth_dart') updated._usedFourthDart = true;
    return updated;
  });
  toast(message);
  Sound.playSfx('impact', settings);
  return { ...nextGame, players };
}
