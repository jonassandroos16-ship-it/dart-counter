import { useEffect, useMemo, useRef, useState } from 'react';
import { Star } from 'lucide-react';
import type { Dart, GamePlayer, Settings } from '../types';
import { computeBattleDartDamage } from '../logic';
import { initials } from '../store';
import { Sound } from '../sound';

export interface BattleVisitStep {
  dart: Dart;
  damage: number;
  hpAfter: number;
  formula: string;
  isCrit: boolean;
}

export interface BattleVisitOverlayProps {
  attacker: GamePlayer;
  target: GamePlayer;
  darts: Dart[];
  settings: Settings;
  surgeActive?: boolean;
  onDone: () => void;
}

// Animated overlay that walks through each dart of a battle visit one at a
// time, showing the per-dart damage formula, draining the target's HP bar in
// step, and shaking the target card with intensity proportional to the
// damage dealt by that dart. The overlay auto-advances through the darts but
// stays open after the final dart until the player closes it.
export function BattleVisitOverlay({ attacker, target, darts, settings, surgeActive, onDone }: BattleVisitOverlayProps) {
  const cfg = settings.powerUpScaling;
  const power = Math.min(cfg.powerMax, Math.max(0, attacker.powerPct || 0));
  const armor = Math.min(cfg.armorMax, Math.max(0, target.armorPct || 0));

  const steps = useMemo<BattleVisitStep[]>(() => {
    let hp = target.hp ?? target.maxHp ?? 0;
    return darts.map((dart) => {
      const isCrit = !!surgeActive && dart.value > 0;
      const dartValue = isCrit ? dart.value * 2 : dart.value;
      const damage = computeBattleDartDamage(dartValue, power, armor, settings);
      hp = Math.max(0, hp - damage);
      let formula: string;
      if (dartValue <= 0) {
        formula = `Miss · 0 dmg`;
      } else if (isCrit) {
        formula = armor > 0
          ? `${dart.value} × 2 + ${power} × (1 − ${armor}%) = ${damage} dmg`
          : `${dart.value} × 2 + ${power} = ${damage} dmg`;
      } else {
        formula = armor > 0
          ? `${dartValue} + ${power} × (1 − ${armor}%) = ${damage} dmg`
          : `${dartValue} + ${power} = ${damage} dmg`;
      }
      return { dart, damage, hpAfter: hp, formula, isCrit };
    });
  }, [darts, power, armor, settings, cfg.battleMinDamage, target.hp, target.maxHp, surgeActive]);

  const [stepIdx, setStepIdx] = useState(0);
  const [displayedHp, setDisplayedHp] = useState(target.hp ?? target.maxHp ?? 0);
  const [shakeKey, setShakeKey] = useState(0);
  const [shakeIntensity, setShakeIntensity] = useState(0);
  const startHpRef = useRef(target.hp ?? target.maxHp ?? 0);

  // Total damage for the visit (for the summary footer).
  const totalDamage = steps.reduce((s, st) => s + st.damage, 0);
  const finalHp = steps.length ? steps[steps.length - 1].hpAfter : startHpRef.current;
  const defeated = finalHp <= 0;
  const anyCrit = steps.some((s) => s.isCrit && s.damage > 0);

  // Advance through each dart with a small delay so the user can read the
  // formula and see the HP bar animate. After the last dart, the overlay
  // stays open until the player presses the Close button (or clicks the
  // backdrop) — it no longer auto-dismisses.
  useEffect(() => {
    if (stepIdx >= steps.length) return;
    const step = steps[stepIdx];
    const t = setTimeout(() => {
      setDisplayedHp(step.hpAfter);
      // Intensity bucket: 0 = miss/no shake, 1 = light, 2 = medium, 3 = heavy.
      const d = step.damage;
      const intensity = d <= 0 ? 0 : d < 20 ? 1 : d < 50 ? 2 : 3;
      setShakeIntensity(intensity);
      setShakeKey((k) => k + 1);
      // Play a hit sound scaled to the damage of this dart.
      Sound.playHit(d, settings);
      setStepIdx((i) => i + 1);
    }, 650);
    return () => clearTimeout(t);
  }, [stepIdx, steps, defeated, settings]);

  const maxHp = target.maxHp || 1;
  const hpPct = Math.max(0, Math.min(100, (displayedHp / maxHp) * 100));
  const startPct = Math.max(0, Math.min(100, (startHpRef.current / maxHp) * 100));
  const done = stepIdx >= steps.length;

  const shakeClass = shakeIntensity === 0
    ? ''
    : shakeIntensity === 1
      ? 'battle-shake-light'
      : shakeIntensity === 2
        ? 'battle-shake-medium'
        : 'battle-shake-heavy';

  return (
    <div className="battle-overlay-bg" onClick={onDone}>
      <div className="battle-overlay" onClick={(e) => e.stopPropagation()}>
        <div className="bo-header">
          <span className="bo-attacker">
            <span className="avatar" style={{ width: 28, height: 28, fontSize: 12, background: attacker.color }}>{initials(attacker.name)}</span>
            <span className="bo-name">{attacker.name}</span>
          </span>
          <span className="bo-vs">→</span>
          <span className="bo-target">
            <span className="avatar" style={{ width: 28, height: 28, fontSize: 12, background: target.color }}>{initials(target.name)}</span>
            <span className="bo-name">{target.name}</span>
          </span>
        </div>

        <div
          key={shakeKey}
          className={`bo-target-card ${shakeClass}`}
          style={{ borderColor: target.color }}
        >
          <div className="bo-hp-row">
            <span className="bo-hp-label">HP</span>
            <span className="bo-hp-value">{Math.round(displayedHp)}<span className="muted small"> / {maxHp}</span></span>
          </div>
          <div className="bo-hp-track">
            <div
              className="bo-hp-fill"
              style={{
                width: `${hpPct}%`,
                background: target.color,
                transition: 'width .55s cubic-bezier(.22,.61,.36,1)',
              }}
            />
            {/* ghost marker showing where HP started this visit */}
            <div className="bo-hp-ghost" style={{ left: `${startPct}%` }} />
          </div>
          {defeated && done ? (
            <div className="bo-defeated">☠</div>
          ) : null}
        </div>

        <div className="bo-steps">
          {steps.map((s, i) => {
            const isCurrent = i === stepIdx && !done;
            const isPast = i < stepIdx || done;
            const isFuture = i > stepIdx && !done;
            return (
              <div
                key={i}
                className={`bo-step ${isCurrent ? 'current' : ''} ${isPast ? 'past' : ''} ${isFuture ? 'future' : ''} ${s.damage <= 0 ? 'miss' : ''}`}
              >
                <span className="bo-step-dart">{s.dart.label}</span>
                <span className="bo-step-formula" style={s.isCrit && s.damage > 0 ? { color: '#facc15' } : undefined}>
                  {s.isCrit && s.damage > 0 && (
                    <span style={{ fontWeight: 700, color: '#facc15', marginRight: 3 }}>CRIT ×2 ·</span>
                  )}
                  {s.formula}
                </span>
                <span
                  className="bo-step-dmg"
                  style={s.isCrit && s.damage > 0 ? { color: '#facc15', display: 'flex', alignItems: 'center', gap: 2 } : undefined}
                >
                  {s.damage <= 0 ? '—' : (
                    <>
                      {`−${s.damage}`}
                      {s.isCrit && (
                        <Star size={11} fill="#facc15" color="#facc15" style={{ marginLeft: 2, flexShrink: 0 }} />
                      )}
                    </>
                  )}
                </span>
              </div>
            );
          })}
        </div>

        <div className="bo-footer">
          <span className="muted small">Total this visit</span>
          <span className="bo-total" style={anyCrit && done ? { color: '#facc15', display: 'flex', alignItems: 'center', gap: 4 } : undefined}>
            {`−${totalDamage} HP`}
            {anyCrit && done && (
              <Star size={13} fill="#facc15" color="#facc15" />
            )}
          </span>
        </div>

        <button className="btn ghost sm block" style={{ marginTop: 10 }} onClick={onDone}>
          {done ? 'Close' : 'Skip'}
        </button>
      </div>
    </div>
  );
}
