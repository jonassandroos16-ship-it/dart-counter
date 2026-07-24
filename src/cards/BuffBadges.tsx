import { useState } from 'react';
import { Modal } from '../Popups';
import { effectIcon, effectLabel, effectShortDesc, effectColor } from './effectMeta';

export interface BuffInfo {
  id: string;
  kind: string;
  amount: number;
  turnsLeft: number;
}

export function PartyBuffBadges({ buffs }: { buffs: BuffInfo[] }) {
  const [selected, setSelected] = useState<BuffInfo | null>(null);

  if (!buffs || buffs.length === 0) return null;

  return (
    <>
      <span style={{ display: 'inline-flex', gap: 3, flexWrap: 'wrap' }}>
        {buffs.map(b => {
          const color = effectColor(b.kind);
          return (
            <button
              key={b.id}
              onClick={(e) => { e.stopPropagation(); setSelected(b); }}
              title={effectLabel(b.kind)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 2,
                padding: '1px 5px', borderRadius: 999,
                background: `color-mix(in srgb, ${color} 25%, transparent)`,
                border: `1px solid ${color}`,
                cursor: 'pointer', fontSize: 9, fontWeight: 700,
                color: color, lineHeight: 1.2,
              }}
            >
              <span style={{ fontSize: 11 }}>{effectIcon(b.kind)}</span>
              <span>{b.turnsLeft}</span>
            </button>
          );
        })}
      </span>
      {selected && (
        <Modal onClose={() => setSelected(null)}>
          <div style={{ padding: 16, maxWidth: 300 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 28 }}>{effectIcon(selected.kind)}</span>
              <h3 style={{ margin: 0, flex: 1 }}>{effectLabel(selected.kind)}</h3>
            </div>
            <div className="muted" style={{ fontSize: 14, lineHeight: 1.5, marginBottom: 8 }}>{effectShortDesc(selected.kind)}</div>
            <div className="muted small" style={{ marginBottom: 12 }}>
              {selected.amount > 0 && <span>Amount: +{selected.amount}<br /></span>}
              Duration: {selected.turnsLeft} turn{selected.turnsLeft !== 1 ? 's' : ''} remaining
            </div>
            <button className="btn block ghost" onClick={() => setSelected(null)}>Close</button>
          </div>
        </Modal>
      )}
    </>
  );
}
