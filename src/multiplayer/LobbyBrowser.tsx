import { useEffect, useState, useCallback } from 'react';
import { Globe, Plus, ArrowRight, RefreshCw } from 'lucide-react';
import type { Player } from '../types';
import type { Lobby } from '../multiplayer/client';
import { fetchOpenLobbies, fetchLobbyByCode, subscribeToLobbyList } from '../multiplayer/client';
import { initials } from '../store';

interface Props {
  players: Player[];
  onCreate: () => void;
  onJoin: (lobby: Lobby, player: Player) => void;
  onBack: () => void;
}

export function LobbyBrowser({ players, onCreate, onJoin, onBack }: Props) {
  const [lobbies, setLobbies] = useState<Lobby[]>([]);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [selectedPlayerId, setSelectedPlayerId] = useState(players.length ? players[0].id : '');

  const refresh = useCallback(async () => {
    setLoading(true);
    const list = await fetchOpenLobbies();
    setLobbies(list);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
    const unsub = subscribeToLobbyList(() => void refresh());
    return unsub;
  }, [refresh]);

  const joinByCode = async () => {
    if (!code.trim()) return;
    setCodeError('');
    const lobby = await fetchLobbyByCode(code.trim());
    if (!lobby) {
      setCodeError('No open lobby with that code');
      return;
    }
    onJoin(lobby, selectedPlayer);
  };

  if (!players.length) {
    return (
      <div className="view-scroll">
        <div className="card">
          <h2 style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Globe size={22} /> Multiplayer
          </h2>
          <div className="card empty">Add a player before joining a lobby.</div>
          <button className="btn ghost block" style={{ marginTop: 12 }} onClick={onBack}>← Back</button>
        </div>
      </div>
    );
  }

  const selectedPlayer = players.find(p => p.id === selectedPlayerId) || players[0];

  return (
    <div className="view-scroll">
      <div className="card">
        <div className="row between" style={{ marginBottom: 14, alignItems: 'center' }}>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Globe size={22} /> Multiplayer
          </h2>
          <button className="btn ghost sm" onClick={onBack}>← Back</button>
        </div>

        <span style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>Join As</span>
        <div className="row wrap" style={{ gap: 8, marginBottom: 16 }}>
          {players.map(p => {
            const on = p.id === selectedPlayerId;
            return (
              <button key={p.id} className="pill" style={{ background: on ? p.color : 'var(--bg-3)', color: on ? '#0b0e13' : 'var(--text)' }}
                onClick={() => setSelectedPlayerId(p.id)}>
                <span className="avatar" style={{ width: 20, height: 20, fontSize: 10, background: on ? 'rgba(0,0,0,.2)' : p.color }}>{initials(p.name)}</span>{p.name}
              </button>
            );
          })}
        </div>

        <button className="btn primary block" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          onClick={onCreate}>
          <Plus size={18} /> Create Lobby
        </button>

        <div className="row" style={{ gap: 8, marginBottom: 16 }}>
          <input
            placeholder="Enter code (e.g. ABCD)"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase().slice(0, 4))}
            onKeyDown={e => { if (e.key === 'Enter') void joinByCode(); }}
            style={{ flex: 1, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}
          />
          <button className="btn" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => void joinByCode()} disabled={!code.trim()}>
            Join <ArrowRight size={16} />
          </button>
        </div>
        {codeError && <div className="muted small" style={{ color: 'var(--danger)', marginBottom: 10 }}>{codeError}</div>}

        <div className="row between" style={{ marginBottom: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>Open Lobbies</span>
          <button className="btn ghost sm" style={{ display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => void refresh()}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {loading ? (
          <div className="muted small center" style={{ padding: 20 }}>Loading…</div>
        ) : lobbies.length === 0 ? (
          <div className="muted small center" style={{ padding: 20 }}>No open lobbies. Create one to get started!</div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {lobbies.map(l => (
              <button key={l.id} className="btn block" style={{ padding: 14, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12 }}
                onClick={() => onJoin(l, selectedPlayer)}>
                <div style={{
                  width: 44, height: 44, borderRadius: 10, background: 'color-mix(in srgb, var(--accent) 15%, var(--bg-3))',
                  border: '1px solid color-mix(in srgb, var(--accent) 40%, var(--border))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 800, fontSize: 14, letterSpacing: '0.08em', color: 'var(--accent)',
                }}>
                  {l.code}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700 }}>{l.name}</div>
                  <div className="muted small" style={{ marginTop: 2 }}>Waiting for players</div>
                </div>
                <ArrowRight size={18} style={{ color: 'var(--muted)' }} />
              </button>
            ))}
          </div>
        )}


      </div>
    </div>
  );
}
