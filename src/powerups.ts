// Power-up definitions and helpers.
//
// A power up is an optional match modifier a player can unlock and equip.
// During a match, the equipped power up charges from doubles, triples and
// bullseyes; once full, the player can activate it for a one-shot effect.
//
// Power ups are intentionally lightweight: each one has an id, name, icon,
// short description, and an `apply` hook that mutates the in-progress game
// state to perform the effect. The effect is invoked from the play board when
// the player taps Activate.

export interface PowerUpResult {
  game: any;
  message: string;
  // When false, the apply call failed (no effect, no charge should be consumed).
  ok?: boolean;
}

export interface PowerUpDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  // Apply the power up to the in-progress game. `curIdx` is the index of the
  // player activating it. The function returns the mutated game and an
  // optional user-facing message. Set `ok: false` to signal a failed activation
  // (the caller will not consume the charge in that case).
  apply: (game: any, curIdx: number) => PowerUpResult;
}

export const POWER_UPS: PowerUpDef[] = [
  {
    id: 'pu_fourth_dart',
    name: 'Fourth Dart',
    icon: '🎯',
    desc: 'Add a bonus 4th dart to your current visit — score it before tapping Enter Visit.',
    apply: (game, _curIdx) => ({ game, message: 'Fourth Dart active — score your bonus dart!' }),
  },
  {
    id: 'pu_blocker',
    name: 'Blocker',
    icon: '🛡️',
    desc: 'Every other player only gets ONE dart on their next visit (instead of three).',
    apply: (game, curIdx) => {
      const players = (game.players || []).map((pl: any, i: number) => i === curIdx ? pl : { ...pl, _oneDartNext: true });
      return { game: { ...game, players }, message: 'Blocker! Opponents only get one dart next visit.' };
    },
  },
  {
    id: 'pu_reroll',
    name: 'Reroll',
    icon: '🎲',
    desc: 'Re-roll your lowest-scoring dart this visit. The further behind you are, the luckier the roll — and it will never make you finish.',
    apply: (game, curIdx) => {
      const plan = planReroll(game, curIdx);
      if (!plan) return { game, message: 'Reroll: no darts to reroll yet.', ok: false };
      const darts = [...(game.darts || [])];
      darts[plan.idx] = plan.newDart;
      return { game: { ...game, darts }, message: `Reroll! Replaced ${plan.oldLabel} with ${plan.newDart.label} (${plan.newDart.value}).` };
    },
  },
  {
    id: 'pu_rethrow',
    name: 'Re-Throw',
    icon: '🔁',
    desc: 'Take back your last dart this visit and throw it again. Use when you mis-tap a segment.',
    apply: (game, _curIdx) => {
      const darts = [...(game.darts || [])];
      if (!darts.length) return { game, message: 'Re-Throw: no dart to take back yet.', ok: false };
      darts.pop();
      return { game: { ...game, darts }, message: 'Re-Throw! Last dart taken back — throw it again.' };
    },
  },
  {
    id: 'pu_surge',
    name: 'Surge',
    icon: '⚡',
    desc: 'Your NEXT visit scores double (activates on your next turn, not this one).',
    apply: (game, curIdx) => {
      const players = (game.players || []).map((pl: any, i: number) => i === curIdx ? { ...pl, _surgeNext: true, _surgeArmed: true } : pl);
      return { game: { ...game, players }, message: 'Surge armed! Your next visit scores double.' };
    },
  },
  {
    id: 'pu_cripple',
    name: 'Cripple',
    icon: '🦾',
    desc: 'The leading opponent only scores 50% on their next visit. They are warned when they throw.',
    apply: (game, curIdx) => {
      const players = [...(game.players || [])];
      if (players.length < 2) return { game, message: 'Cripple: no opponents to cripple.', ok: false };
      const others = players.map((pl, i) => ({ pl, i })).filter(({ i }) => i !== curIdx);
      const isHighScore = game.mode === 'highscore';
      const target = isHighScore
        ? others.reduce((a, b) => b.pl.score > a.pl.score ? b : a)
        : others.reduce((a, b) => b.pl.score < a.pl.score ? b : a);
      const newPlayers = players.map((pl: any, i: number) => i === target.i ? { ...pl, _crippledNext: true } : pl);
      return { game: { ...game, players: newPlayers }, message: `Cripple! ${target.pl.name} scores 50% next visit.` };
    },
  },
  {
    id: 'pu_steal',
    name: 'Steal',
    icon: '🥷',
    desc: 'Steal 30 points from the leading opponent (added to your score in High Score, subtracted from their remaining in x01).',
    apply: (game, curIdx) => {
      const players = [...(game.players || [])];
      if (players.length < 2) return { game, message: 'Steal: no opponents to steal from.', ok: false };
      const others = players.map((pl, i) => ({ pl, i })).filter(({ i }) => i !== curIdx);
      const isHighScore = game.mode === 'highscore';
      const target = isHighScore
        ? others.reduce((a, b) => b.pl.score > a.pl.score ? b : a)
        : others.reduce((a, b) => b.pl.score < a.pl.score ? b : a);
      const STEAL = 30;
      const newPlayers = players.map((pl: any, i: number) => {
        if (i === curIdx) return isHighScore ? { ...pl, score: pl.score + STEAL } : { ...pl, score: Math.max(0, pl.score - STEAL) };
        if (i === target.i) return isHighScore ? { ...pl, score: Math.max(0, pl.score - STEAL) } : { ...pl, score: pl.score + STEAL };
        return pl;
      });
      return { game: { ...game, players: newPlayers }, message: `Steal! Took ${STEAL} from ${target.pl.name}.` };
    },
  },
  {
    id: 'pu_freeze',
    name: 'Freeze',
    icon: '❄️',
    desc: 'Freeze the leading opponent — their next visit scores 0 and ends immediately.',
    apply: (game, curIdx) => {
      const players = (game.players || []).map((pl: any, i: number) => i === curIdx ? pl : { ...pl, _frozenNext: true });
      return { game: { ...game, players }, message: 'Freeze! The leader misses their next visit.' };
    },
  },
  {
    id: 'pu_lucky_miss',
    name: 'Lucky Miss',
    icon: '🍀',
    desc: 'Cancel your next bust — if you would bust this visit, your score stays instead.',
    apply: (game, curIdx) => {
      const players = (game.players || []).map((pl: any, i: number) => i === curIdx ? { ...pl, _luckyMiss: true } : pl);
      return { game: { ...game, players }, message: 'Lucky Miss armed — your next bust is cancelled.' };
    },
  },
  {
    id: 'pu_double_trouble',
    name: 'Double Trouble',
    icon: '✌️',
    desc: 'Your next visit: only doubles and bulls score — singles and triples count as 0. High risk, high reward for accurate shooters.',
    apply: (game, curIdx) => {
      const players = (game.players || []).map((pl: any, i: number) => i === curIdx ? { ...pl, _doubleTrouble: true } : pl);
      return { game: { ...game, players }, message: 'Double Trouble armed — next visit, only doubles and bulls score!' };
    },
  },
  {
    id: 'pu_overcharge',
    name: 'Overcharge',
    icon: '🔋',
    desc: 'Instantly refill your power-up orb to full AND add +25% to your next visit score. Self-buff for comebacks.',
    apply: (game, curIdx) => {
      const players = (game.players || []).map((pl: any, i: number) => i === curIdx ? { ...pl, _overchargeNext: true } : pl);
      return { game: { ...game, players }, message: 'Overcharge! Orb refilled and next visit scores +25%.' };
    },
  },
  {
    id: 'pu_curse',
    name: 'Curse',
    icon: '💀',
    desc: 'Curse the lowest opponent: their next TWO visits score only 50%. They are warned when they throw.',
    apply: (game, curIdx) => {
      const players = [...(game.players || [])];
      if (players.length < 2) return { game, message: 'Curse: no opponents to curse.', ok: false };
      const others = players.map((pl, i) => ({ pl, i })).filter(({ i }) => i !== curIdx);
      const isHighScore = game.mode === 'highscore';
      // Curse the WEAKEST opponent: in highscore the lowest score, in x01 the
      // highest remaining (furthest from checkout).
      const target = isHighScore
        ? others.reduce((a, b) => b.pl.score < a.pl.score ? b : a)
        : others.reduce((a, b) => b.pl.score > a.pl.score ? b : a);
      const newPlayers = players.map((pl: any, i: number) => i === target.i ? { ...pl, _cursedNext: 2 } : pl);
      return { game: { ...game, players: newPlayers }, message: `Curse! ${target.pl.name} scores 50% on their next 2 visits.` };
    },
  },
];

export function getPowerUpInfo(id: string | null | undefined): PowerUpDef | undefined {
  if (!id) return undefined;
  return POWER_UPS.find((p) => p.id === id);
}

export interface RerollPlan {
  idx: number;
  oldLabel: string;
  newDart: { value: number; label: string; base: number; mult: number; isDouble: boolean; isOuter?: boolean };
  behindFactor: number; // 0..1 — how far behind the player is (1 = far behind)
}

// Compute the dart to reroll and the replacement value, WITHOUT mutating the
// game. The reroll always picks the lowest-scoring dart this visit (misses
// count as 0, so they're picked first). The new value is biased by how far
// behind the player is — the further behind, the higher the expected value.
// The reroll never lets the player finish (checkout) the game: in x01 modes
// the new value is clamped so the remaining score stays > 0.
export function planReroll(game: any, curIdx: number): RerollPlan | null {
  const darts: any[] = [...(game.darts || [])];
  if (!darts.length) return null;

  // Pick the lowest-value dart. Ties broken by earliest thrown (so the player
  // sees a consistent choice and can plan around it).
  let idx = 0;
  for (let i = 1; i < darts.length; i++) {
    if (darts[i].value < darts[idx].value) idx = i;
  }
  const oldLabel = darts[idx].label || 'dart';

  // Compute how far behind the player is, on a 0..1 scale.
  // x01 (lower remaining is better): behind = me.remaining - leader.remaining
  // highscore (higher score is better): behind = leader.score - me.score
  const players: any[] = game.players || [];
  const me = players[curIdx];
  let behind = 0;
  let maxBehind = 100;
  if (players.length > 1 && me) {
    if (game.mode === 'highscore') {
      const leader = Math.max(...players.map((p) => p.score));
      behind = Math.max(0, leader - me.score);
      maxBehind = 200;
    } else {
      // x01 — leader has the LOWEST remaining score
      const leader = Math.min(...players.map((p) => p.score));
      behind = Math.max(0, me.score - leader);
      maxBehind = 200;
    }
  }
  const behindFactor = Math.max(0, Math.min(1, behind / maxBehind));

  // The current remaining (x01) before this visit is scored. We need to make
  // sure the rerolled dart does not bring remaining to exactly 0 (which would
  // be a checkout). For highscore there's no finish condition, so no clamp.
  const remainingBefore = me?.score ?? 0;
  const otherDartsValue = darts.reduce((s, d, i) => i === idx ? s : s + (d.value || 0), 0);
  const doubleOut = !!game.doubleOut;

  const newDart = rollRerollDart(behindFactor, remainingBefore, otherDartsValue, doubleOut);
  return { idx, oldLabel, newDart, behindFactor };
}

// Roll a single dart value biased by `behindFactor` (0..1). The roll is built
// from a base (1..20) and a multiplier (1,1,2,3). When behind, we skew toward
// higher bases and higher multipliers. The result is clamped so it never
// finishes the player: in x01 the visit total must not equal remaining (and
// for double-out, a non-double cannot be the finishing dart anyway — but we
// also forbid a double that would checkout).
function rollRerollDart(behindFactor: number, remainingBefore: number, otherDartsValue: number, doubleOut: boolean): RerollPlan['newDart'] {
  // Try a handful of times to roll something that doesn't finish the game.
  for (let attempt = 0; attempt < 24; attempt++) {
    // Bias: when behindFactor is high, weight higher bases and triples.
    // baseWeight(i) = 1 + behindFactor * (i / 20)
    const bases = Array.from({ length: 20 }, (_, i) => i + 1);
    const baseWeights = bases.map((b) => 1 + behindFactor * (b / 20));
    const base = weightedPick(bases, baseWeights);

    // Multiplier distribution shifts with behind factor.
    // behind=0   -> [1,1,1,1,2,3]  (mostly singles, occasional big hit)
    // behind=1   -> [1,1,2,2,3,3]  (lots of doubles/triples)
    const r = Math.random();
    let mult: number;
    const tripleChance = 0.10 + 0.35 * behindFactor;
    const doubleChance = 0.20 + 0.25 * behindFactor;
    if (r < tripleChance) mult = 3;
    else if (r < tripleChance + doubleChance) mult = 2;
    else mult = 1;

    const value = base * mult;
    const label = (mult === 2 ? 'D' : mult === 3 ? 'T' : '') + base;
    const isDouble = mult === 2;

    // Never make the player finish.
    // For x01: remainingBefore - (otherDartsValue + value) must not be 0.
    // (We also forbid going below 0 — that's a bust — but a bust doesn't
    // finish, so it's allowed. Only the exact-zero case is blocked.)
    const newRemaining = remainingBefore - (otherDartsValue + value);
    if (newRemaining === 0) {
      // For double-out, only a double can finish — so a non-double roll is
      // naturally safe. A double that hits 0 is the only blocked case.
      if (doubleOut && !isDouble) continue;
      continue;
    }
    return { value, label, base, mult, isDouble, isOuter: false };
  }

  // Fallback: a modest single that won't finish (since we couldn't roll one
  // in the loop, clamp the value to stay strictly above 0 remaining).
  const maxSafe = Math.max(1, remainingBefore - otherDartsValue - 1);
  const base = Math.max(1, Math.min(20, maxSafe));
  const value = base;
  const label = String(base);
  return { value, label, base, mult: 1, isDouble: false, isOuter: false };
}

function weightedPick<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}
