import { useState } from 'react';
import type { CardDef } from './types';
import { getEffectMeta, effectIcon, effectColor } from './effectMeta';

interface EffectPillProps {
  card: CardDef;
}

export function EffectPill({ card }: EffectPillProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const meta = getEffectMeta(card.effect);
  if (!meta || card.type === 'damage') return null;

  return (
    <>
      <button
        className="card-effect-pill"
        style={{ '--effect-color': meta.color } as React.CSSProperties}
        onClick={(e) => {
          e.stopPropagation();
          setShowTooltip(true);
        }}
        title={meta.label}
      >
        <span className="card-effect-pill-icon">{meta.icon}</span>
      </button>
      {showTooltip && (
        <div className="card-effect-tooltip-overlay" onClick={() => setShowTooltip(false)}>
          <div
            className="card-effect-tooltip"
            onClick={(e) => e.stopPropagation()}
            style={{ '--effect-color': meta.color } as React.CSSProperties}
          >
            <div className="card-effect-tooltip-header">
              <span className="card-effect-tooltip-icon">{meta.icon}</span>
              <span className="card-effect-tooltip-label">{meta.label}</span>
              <button className="btn sm ghost" onClick={() => setShowTooltip(false)}>Close</button>
            </div>
            <div className="card-effect-tooltip-desc">{meta.shortDesc}</div>
            <div className="card-effect-tooltip-card">{card.name}</div>
          </div>
        </div>
      )}
    </>
  );
}

export function BuffPill({ icon, label, amount, turnsLeft }: { icon: string; label: string; amount: number; turnsLeft: number }) {
  const [showTooltip, setShowTooltip] = useState(false);
  return (
    <>
      <button
        className="card-effect-pill"
        style={{ '--effect-color': 'var(--accent)' } as React.CSSProperties}
        onClick={(e) => {
          e.stopPropagation();
          setShowTooltip(true);
        }}
        title={label}
      >
        <span className="card-effect-pill-icon">{icon}</span>
        <span className="card-effect-pill-turns">{turnsLeft}</span>
      </button>
      {showTooltip && (
        <div className="card-effect-tooltip-overlay" onClick={() => setShowTooltip(false)}>
          <div
            className="card-effect-tooltip"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="card-effect-tooltip-header">
              <span className="card-effect-tooltip-icon">{icon}</span>
              <span className="card-effect-tooltip-label">{label}</span>
              <button className="btn sm ghost" onClick={() => setShowTooltip(false)}>Close</button>
            </div>
            <div className="card-effect-tooltip-desc">+{amount} for {turnsLeft} turn{turnsLeft !== 1 ? 's' : ''}</div>
          </div>
        </div>
      )}
    </>
  );
}
