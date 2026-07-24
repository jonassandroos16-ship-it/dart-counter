import { useState } from 'react';
import { Modal } from '../Popups';
import { effectIcon, effectLabel, effectShortDesc, effectColor } from './effectMeta';

export interface DebuffInfo {
  id: string;
  kind: string;
  amount: number;
  turnsLeft: number;
}

export interface EnemyDebuffBadgesProps {
  enemy: {
    defeated?: boolean;
    frozenTurns: number;
    distractedTurns: number;
    distractAmount: number;
    vulnerableTurns: number;
    weakenedTurns: number;
    weakenAmount: number;
    buffs?: DebuffInfo[];
  };
}

interface DebadgeEntry {
  icon: string;
  label: string;
  desc: string;
  color: string;
  turnsLeft: number;
  amount: number;
}

function collectDebuffs(enemy: EnemyDebuffBadgesProps['enemy']): DebadgeEntry[] {
  const entries: DebadgeEntry[] = [];
  if (enemy.frozenTurns > 0) {
    entries.push({ icon: '❄️', label: 'Frozen', desc: 'Enemy is frozen and cannot attack', color: '#60a5fa', turnsLeft: enemy.frozenTurns, amount: 0 });
  }
  if (enemy.weakenedTurns > 0) {
    entries.push({ icon: '💀', label: 'Weakened', desc: `Enemy deals ${Math.round(enemy.weakenAmount * 100)}% less damage`, color: '#ef4444', turnsLeft: enemy.weakenedTurns, amount: enemy.weakenAmount });
  }
  if (enemy.distractedTurns > 0) {
    entries.push({ icon: '🌀', label: 'Distracted', desc: `Enemy accuracy reduced by ${Math.round(enemy.distractAmount * 100)}%`, color: '#f59e0b', turnsLeft: enemy.distractedTurns, amount: enemy.distractAmount });
  }
  if (enemy.vulnerableTurns > 0) {
    entries.push({ icon: '⏳', label: 'Vulnerable', desc: 'Enemy takes 50% more damage', color: '#fbbf24', turnsLeft: enemy.vulnerableTurns, amount: 0 });
  }
  if (enemy.buffs) {
    for (const b of enemy.buffs) {
      const meta = effectColor(b.kind);
      entries.push({
        icon: effectIcon(b.kind),
        label: effectLabel(b.kind),
        desc: effectShortDesc(b.kind),
        color: meta,
        turnsLeft: b.turnsLeft,
        amount: b.amount,
      });
    }
  }
  return entries;
}

export function EnemyDebuffBadges({ enemy }: EnemyDebuffBadgesProps) {
  const [selected, setSelected] = useState<DebadgeEntry | null>(null);
  const debuffs = collectDebuffs(enemy);
  if (debuffs.length === 0) return null;

  return (
    <>
      <span style={{ display: 'inline-flex', gap: 3, flexWrap: 'wrap' }}>
        {debuffs.map((d, i) => (
          <button
            key={i}
            onClick={(e) => { e.stopPropagation(); setSelected(d); }}
            title={d.label}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 2,
              padding: '1px 5px', borderRadius: 999,
              background: `color-mix(in srgb, ${d.color} 25%, transparent)`,
              border: `1px solid ${d.color}`,
              cursor: 'pointer', fontSize: 9, fontWeight: 700,
              color: d.color, lineHeight: 1.2,
            }}
          >
            <span style={{ fontSize: 11 }}>{d.icon}</span>
            <span>{d.turnsLeft}</span>
          </button>
        ))}
      </span>
      {selected && (
        <Modal onClose={() => setSelected(null)}>
          <div style={{ padding: 16, maxWidth: 300 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 28 }}>{selected.icon}</span>
              <h3 style={{ margin: 0, flex: 1 }}>{selected.label}</h3>
            </div>
            <div className="muted" style={{ fontSize: 14, lineHeight: 1.5, marginBottom: 8 }}>{selected.desc}</div>
            <div className="muted small" style={{ marginBottom: 12 }}>
              {selected.amount > 0 && <span>Amount: {Math.round(selected.amount * 100)}%<br /></span>}
              Duration: {selected.turnsLeft} turn{selected.turnsLeft !== 1 ? 's' : ''} remaining
            </div>
            <button className="btn block ghost" onClick={() => setSelected(null)}>Close</button>
          </div>
        </Modal>
      )}
    </>
  );
}
