import { useMemo, useState } from 'react';
import type { Player, Settings } from '../types';
import { initials } from '../store';
import { partyMaxHpFor, partyArmorFor, partyPowerFor } from './engine';

export interface CoopSetupProps {
  players: Player[];
  settings: Settings;
  onStart: (playerIds: string[]) => void;
  onBack: () => void;
}

// Player selection screen for the Co-op Campaign. The party's combined HP,
// armor and power are computed live from the selected players' attributes
// so the player can see how their team composition affects the upcoming
// battle. Armor and power are averaged (sum / playerCount) so adding more
// players can't push them above the configured caps.
export function CoopSetupView({ players, settings, onStart, onBack }: CoopSetupProps) {
  const [picked, setPicked] = useState<string[]>(players.length ? [players[0].id] : []);

  const selected = useMemo(
    () => picked.map(id => players.find(p => p.id === id)).filter(Boolean) as Player[],
    [picked, players],
  );

  const partyHp = useMemo(() => partyMaxHpFor(selected, settings), [selected, settings]);
  const partyArmor = useMemo(() => partyArmorFor(selected, settings), [selected, settings]);
  const partyPower = useMemo(() => partyPowerFor(selected, settings), [selected, settings]);

  return (
    <div className="view-scroll">
      <div className="row between" style={{ marginBottom: 12 }}>
        <button className="btn ghost sm" onClick={onBack}>← Back</button>
        <h2 style={{ margin: 0 }}>Co-op Campaign</h2>
        <span style={{ width: 64 }} />
      </div>
      <div className="card">
        <span style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>Select your party (1–4 players)</span>
        {!players.length && <div className="muted small">Add players first in the Players tab.</div>}
        <div className="row wrap" style={{ gap: 8, marginBottom: 12 }}>
          {players.map(p => {
            const on = picked.includes(p.id);
            return (
              <button key={p.id} className="pill" style={{ background: on ? p.color : 'var(--bg-3)', color: on ? '#0b0e13' : 'var(--text)' }}
                onClick={() => setPicked(on ? picked.filter(x => x !== p.id) : picked.length >= 4 ? picked : [...picked, p.id])}>
                <span className="avatar" style={{ width: 20, height: 20, fontSize: 10, background: on ? 'rgba(0,0,0,.2)' : p.color }}>{initials(p.name)}</span>{p.name}
              </button>
            );
          })}
        </div>
        <div className="card" style={{ padding: 10, marginBottom: 12, background: 'var(--bg-3)' }}>
          <div className="muted small" style={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>Party preview</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <div>
              <div className="muted small">Party HP</div>
              <div style={{ fontWeight: 900, fontSize: 18, color: '#fca5a5' }}>{partyHp}</div>
            </div>
            <div>
              <div className="muted small">Armor (avg)</div>
              <div style={{ fontWeight: 900, fontSize: 18 }}>{Math.round(partyArmor)}</div>
            </div>
            <div>
              <div className="muted small">Power (avg)</div>
              <div style={{ fontWeight: 900, fontSize: 18 }}>{Math.round(partyPower)}</div>
            </div>
          </div>
          <div className="muted small" style={{ marginTop: 6, fontStyle: 'italic' }}>
            HP is the total of all players' health. Armor & power are averaged so adding more players can't push them above the cap.
          </div>
        </div>
        <button className="btn primary block" disabled={!picked.length} onClick={() => picked.length && onStart(picked)}>
          Continue to level select
        </button>
      </div>
    </div>
  );
}
