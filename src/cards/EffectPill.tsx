import { useState } from 'react';
import type { CardDef } from './types';
import { getEffectMeta } from './effectMeta';

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
