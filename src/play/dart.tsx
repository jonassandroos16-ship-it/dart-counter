import type { Game, Settings } from '../types';
import { Sound } from '../sound';
import { applyCharge, chargeFromDart, catchUpBoost } from './powerups';

// Shared dart-construction helper used by every board that records darts via
// the numeric keypad. Returns a new Game with the dart appended and the
// power-up charge updated when power-ups are enabled.
export function addDartToGame(game: Game, base: number, mult: number, labelOverride: string | undefined, isBull: boolean | undefined, settings: Settings, toast: (m: string) => void): Game | null {
  const cur = game.players[game.turn] as any;
  let maxDarts = 3;
  if (game.powerUpsEnabled && cur._fourthDart) maxDarts = 4;
  if (game.powerUpsEnabled && cur._oneDartNext) maxDarts = 1;
  if (game.darts.length >= maxDarts) { toast(`${maxDarts} dart${maxDarts === 1 ? '' : 's'} already`); return null; }
  let value: number, label: string;
  if (isBull) { value = 50; label = 'Bull'; }
  else if (base === 25) { value = mult === 2 ? 50 : 25; label = mult === 2 ? 'Bull' : '25'; }
  else if (base === 0) { value = 0; label = 'Miss'; }
  else { value = base * mult; label = (mult === 2 ? 'D' : mult === 3 ? 'T' : '') + base; }
  const dart = { value, label: labelOverride || label, base, mult: isBull ? 2 : (base === 25 && value === 50 ? 2 : mult), isDouble: !!(isBull || (base === 25 && value === 50) || mult === 2), isOuter: false };
  Sound.play('dart', { score: value }, settings);
  let next: Game = { ...game, darts: [...game.darts, dart], mult: 1 };
  if (game.powerUpsEnabled) {
    const baseCharge = chargeFromDart(dart, settings);
    const boost = catchUpBoost(game, game.turn, settings);
    next = applyCharge(next, game.turn, baseCharge + boost, settings);
  }
  return next;
}

export function undoDart(game: Game): Game {
  if (!game.darts.length) return game;
  return { ...game, darts: game.darts.slice(0, -1) };
}

// One-visit power-up flags that must be cleared once a player's visit is
// resolved — whether they actually threw or were skipped (e.g. frozen). If
// these linger, effects like Blocker (_oneDartNext) permanently stunt the
// player. Always clear the whole set together so stacked stun-locks
// (freeze + blocker + cripple) all expire at once.
const VISIT_POWERUP_FLAGS = ['_oneDartNext', '_crippledNext', '_surgeNext', '_surgeArmed', '_fourthDart', '_frozenNext', '_luckyMiss', '_doubleTrouble', '_overchargeNext'] as const;

export function clearVisitPowerUpFlags(pl: any): any {
  let changed = false;
  const next: any = { ...pl };
  for (const f of VISIT_POWERUP_FLAGS) {
    if (f in next) { delete next[f]; changed = true; }
  }
  return changed ? next : pl;
}

// Shared keypad/multiplier input block. `onAdd` is called with the chosen base
// and current multiplier; `onUndo` and `onEnter` are wired to the action row.
export function KeypadPad({ game, setGame, onAdd, onUndo, onEnter, enterLabel = 'Enter visit' }: {
  game: Game;
  setGame: (g: Game) => void;
  onAdd: (base: number, mult: number, labelOverride?: string, isBull?: boolean) => void;
  onUndo: () => void;
  onEnter: () => void;
  enterLabel?: string;
}) {
  return (
    <div className="pad-card">
      <div className="mult">
        <button className={game.mult === 1 ? 'on' : ''} onClick={() => setGame({ ...game, mult: 1 })}>Single</button>
        <button className={game.mult === 2 ? 'on' : ''} onClick={() => setGame({ ...game, mult: 2 })}>Double</button>
        <button className={game.mult === 3 ? 'on' : ''} onClick={() => setGame({ ...game, mult: 3 })}>Triple</button>
      </div>
      <div className="keypad">
        {[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20].map(n => (
          <button key={n} className="key" onClick={() => onAdd(n, game.mult)}>{n}</button>
        ))}
        <button className="key" style={{ background: 'color-mix(in srgb,var(--accent) 20%,var(--bg-3))' }} onClick={() => onAdd(25, game.mult === 2 ? 2 : 1)}>25</button>
        <button className="key" style={{ gridColumn: 'span 2', background: 'color-mix(in srgb,var(--accent) 30%,var(--bg-3))' }} onClick={() => onAdd(50, 1, 'Bull', true)}>Bull<br /><small>50</small></button>
        <button className="key" style={{ gridColumn: 'span 2', color: 'var(--muted)' }} onClick={() => onAdd(0, 1, '0')}>Miss</button>
      </div>
      <div className="row" style={{ gap: 8, marginTop: 8 }}>
        <button className="btn block ghost" onClick={onUndo}>↶ Undo dart</button>
        <button className="btn block primary" onClick={onEnter}>{enterLabel}</button>
      </div>
    </div>
  );
}
