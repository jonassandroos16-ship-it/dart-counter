import { useEffect, useMemo, useState } from 'react';
import type { Settings } from '../types';
import type { RerollPlan } from '../powerups';
import { Sound } from '../sound';

// Animated overlay shown when a player activates the Reroll power-up. A
// sequence of random dart values flicker on screen for a couple of seconds
// to build suspense before the chosen value lands. The chosen value is
// computed up-front (so the game logic stays pure) and the overlay just
// reveals it dramatically.
//
// The flicker cadence slows down toward the end (ease-out) so the final
// value feels earned rather than random.

const FLICKER_TOTAL_MS = 2200;
const FLICKER_MIN_INTERVAL = 55;
const FLICKER_MAX_INTERVAL = 240;

function randomDartLabel(): string {
  const base = 1 + Math.floor(Math.random() * 20);
  const r = Math.random();
  const mult = r < 0.15 ? 3 : r < 0.4 ? 2 : 1;
  return (mult === 2 ? 'D' : mult === 3 ? 'T' : '') + base;
}

export function RerollOverlay({ plan, settings, onDone }: { plan: RerollPlan; settings: Settings; onDone: () => void }) {
  const [display, setDisplay] = useState<string>('?');
  const [revealed, setRevealed] = useState(false);
  const [punch, setPunch] = useState(0);

  // Build a schedule of flicker intervals that ease out (slow down) over the
  // total duration, so the final value lands with a beat of suspense.
  const schedule = useMemo(() => {
    const steps: number[] = [];
    let t = 0;
    let interval = FLICKER_MIN_INTERVAL;
    while (t < FLICKER_TOTAL_MS) {
      steps.push(t);
      // Ease the interval toward the max as time progresses.
      const progress = t / FLICKER_TOTAL_MS;
      interval = FLICKER_MIN_INTERVAL + (FLICKER_MAX_INTERVAL - FLICKER_MIN_INTERVAL) * Math.pow(progress, 1.6);
      t += interval;
    }
    return steps;
  }, []);

  useEffect(() => {
    let stepIdx = 0;
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      if (stepIdx >= schedule.length) {
        setDisplay(plan.newDart.label);
        setRevealed(true);
        setPunch((p) => p + 1);
        Sound.playSfx('milestone', settings);
        return;
      }
      setDisplay(randomDartLabel());
      const next = schedule[stepIdx] - (stepIdx === 0 ? 0 : schedule[stepIdx - 1]);
      stepIdx++;
      setTimeout(tick, Math.max(FLICKER_MIN_INTERVAL, next));
    };
    const first = setTimeout(tick, schedule[0] || FLICKER_MIN_INTERVAL);
    return () => { cancelled = true; clearTimeout(first); };
  }, [schedule, plan.newDart.label]);

  // Auto-close shortly after reveal. Player can also tap to dismiss early.
  useEffect(() => {
    if (!revealed) return;
    const t = setTimeout(onDone, 1300);
    return () => clearTimeout(t);
  }, [revealed, onDone]);

  const behindPct = Math.round(plan.behindFactor * 100);

  return (
    <div className="reroll-overlay-bg" onClick={onDone}>
      <div className="reroll-overlay" onClick={(e) => e.stopPropagation()}>
        <div className="reroll-header">
          <span className="reroll-icon">🎲</span>
          <span className="reroll-title">Reroll</span>
        </div>
        <div className="reroll-sub">Replacing your lowest dart: <b>{plan.oldLabel}</b></div>
        <div
          key={punch}
          className={`reroll-value${revealed ? ' revealed' : ''}`}
        >
          {display}
        </div>
        <div className={`reroll-value-num${revealed ? ' revealed' : ''}`}>{revealed ? plan.newDart.value : '—'}</div>
        {behindPct > 0 ? (
          <div className="reroll-behind">Behind by {behindPct}% · luck bonus active</div>
        ) : (
          <div className="reroll-behind muted">No catch-up bonus — straight roll</div>
        )}
        <button className="btn ghost sm block" style={{ marginTop: 14 }} onClick={onDone}>
          {revealed ? 'Close' : 'Skip'}
        </button>
      </div>
    </div>
  );
}
