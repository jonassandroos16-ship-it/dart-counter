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
    desc: 'Add a bonus 4th dart to your current visit — score it before tapping Enter visit.',
    apply: (game, _curIdx) => ({ game, message: 'Fourth Dart active — score your bonus dart!' }),
  },
  {
    id: 'pu_blocker',
    name: 'Blocker',
    icon: '🛡️',
    desc: 'Force every other player to skip their next visit. They keep their score.',
    apply: (game, curIdx) => {
      const players = (game.players || []).map((pl: any, i: number) => i === curIdx ? pl : { ...pl, _blockedNext: true });
      return { game: { ...game, players }, message: 'Blocker! Opponents skip their next visit.' };
    },
  },
  {
    id: 'pu_reroll',
    name: 'Reroll',
    icon: '🎲',
    desc: 'Randomize the value of one of your already-thrown darts this visit (1–60).',
    apply: (game, _curIdx) => {
      const darts = [...(game.darts || [])];
      if (!darts.length) return { game, message: 'Reroll: no darts to reroll yet.', ok: false };
      const idx = Math.floor(Math.random() * darts.length);
      const base = 1 + Math.floor(Math.random() * 20);
      const mult = [1, 1, 1, 2, 3][Math.floor(Math.random() * 5)];
      const value = base * mult;
      const label = (mult === 2 ? 'D' : mult === 3 ? 'T' : '') + base;
      darts[idx] = { ...darts[idx], base, mult, value, label, isDouble: mult === 2 };
      return { game: { ...game, darts }, message: `Reroll! Replaced a dart with ${label} (${value}).` };
    },
  },
  {
    id: 'pu_surge',
    name: 'Surge',
    icon: '⚡',
    desc: 'Your next visit scores double. After the visit, the bonus wears off.',
    apply: (game, curIdx) => {
      const players = (game.players || []).map((pl: any, i: number) => i === curIdx ? { ...pl, _surgeNext: true } : pl);
      return { game: { ...game, players }, message: 'Surge! Your next visit scores double.' };
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
      // Leader = lowest remaining in x01, highest score in highscore.
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
];

export function getPowerUpInfo(id: string | null | undefined): PowerUpDef | undefined {
  if (!id) return undefined;
  return POWER_UPS.find((p) => p.id === id);
}
