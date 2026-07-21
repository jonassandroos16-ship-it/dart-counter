import { useState } from 'react';
import type { Player } from '../types';
import { initials } from '../store';

interface Props {
  players: Player[];
  onCreate: (name: string, hostPlayer: Player) => void;
  onBack: () => void;
}

export function CreateLobbyView({ players, onCreate, onBack }: Props) {
  const [name, setName] = useState('');
  const [hostId, setHostId] = useState(players.length ? players[0].id : '');

  if (!players.length) {
    return (
      <div className="view-scroll">
        <div className="card">
          <h2 style={{ marginBottom: 14 }}>Create Lobby</h2>
          <div className="card empty">Add a player before creating a lobby.</div>
          <button className="btn ghost block" style={{ marginTop: 12 }} onClick={onBack}>← Back</button>
        </div>
      </div>
    );
  }

  const hostPlayer = players.find(p => p.id === hostId) || players[0];

  return (
    <div className="view-scroll">
      <div className="card">
        <div className="row between" style={{ marginBottom: 14, alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>Create Lobby</h2>
          <button className="btn ghost sm" onClick={onBack}>← Back</button>
        </div>

        <label className="field">
          <span>Lobby Name</span>
          <input
            placeholder="e.g. Friday Night Darts"
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={40}
          />
        </label>

        <span style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>Host Player</span>
        <div className="row wrap" style={{ gap: 8, marginBottom: 16 }}>
          {players.map(p => {
            const on = p.id === hostId;
            return (
              <button key={p.id} className="pill" style={{ background: on ? p.color : 'var(--bg-3)', color: on ? '#0b0e13' : 'var(--text)' }}
                onClick={() => setHostId(p.id)}>
                <span className="avatar" style={{ width: 20, height: 20, fontSize: 10, background: on ? 'rgba(0,0,0,.2)' : p.color }}>{initials(p.name)}</span>{p.name}
              </button>
            );
          })}
        </div>

        <button className="btn primary block" disabled={!name.trim()}
          onClick={() => onCreate(name.trim(), hostPlayer)}>
          Create Lobby
        </button>
      </div>
    </div>
  );
}
