import { useState } from 'react';
import type { Player } from '../types';
import { initials } from '../store';

interface Props {
  players: Player[];
  onStart: (ids: string[]) => void;
  onBack: () => void;
}

export function DartliteSetup({ players, onStart, onBack }: Props) {
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const canStart = selected.length >= 1;

  return (
    <div className="view-scroll">
      <div className="card" style={{ maxWidth: 520, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.14em', color: '#c4b5fd', textTransform: 'uppercase' }}>Dartlite</div>
          <div style={{ fontSize: 22, fontWeight: 900, marginTop: 4 }}>Rogue-Lite Run</div>
          <div className="muted small" style={{ marginTop: 6, maxWidth: 360, margin: '6px auto 0' }}>
            Endless rounds of enemies. Mini-boss every 5 rounds, boss every 10. Choose a boon after each round. Trinkets and stats don't carry over.
          </div>
        </div>

        <div className="muted small" style={{ fontWeight: 700, marginBottom: 8 }}>Select party ({selected.length} chosen)</div>
        {!players.length && <div className="empty">No players yet. Add players from the Players tab first.</div>}
        <div style={{ display: 'grid', gap: 8 }}>
          {players.map(p => {
            const isSel = selected.includes(p.id);
            const attrs = p.attributes;
            return (
              <button key={p.id} className="btn block" style={{
                padding: 12, textAlign: 'left',
                background: isSel ? 'linear-gradient(135deg, color-mix(in srgb,#7c3aed 22%,var(--bg-3)) 0%, var(--bg-3) 80%)' : 'var(--bg-3)',
                borderColor: isSel ? '#7c3aed' : 'var(--border)',
              }} onClick={() => toggle(p.id)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="avatar" style={{ background: p.color, width: 28, height: 28, fontSize: 12 }}>{initials(p.name)}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700 }}>{p.name}</div>
                    <div className="muted small">
                      ❤️ {attrs?.health ?? 0} HP · 🛡 {attrs?.armor ?? 0}% · ⚡ {attrs?.power ?? 0}
                    </div>
                  </div>
                  {isSel && <span style={{ color: '#c4b5fd', fontSize: 18 }}>✓</span>}
                </div>
              </button>
            );
          })}
        </div>

        <div className="row" style={{ gap: 10, marginTop: 16 }}>
          <button className="btn block ghost" onClick={onBack}>Back</button>
          <button className="btn block primary" disabled={!canStart} onClick={() => onStart(selected)}>Start Run</button>
        </div>
      </div>
    </div>
  );
}
