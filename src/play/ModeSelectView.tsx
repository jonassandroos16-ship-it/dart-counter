import { useState } from 'react';
import { Globe } from 'lucide-react';
import type { Player } from '../types';
import { initials } from '../store';

export interface ModeSelectProps {
  players: Player[];
  onPickCompetitive: () => void;
  onPickCoop: () => void;
  onPickDartlite: () => void;
  onPickMultiplayer: () => void;
}

// Mode selection screen shown before the play setup. Splits the app into
// competitive modes (x01, ATC, Killer, High Score, Battle, etc.), Coop
// (campaign + rogue-lite), and Dartlite (rogue-lite mode).
export function ModeSelectView({ players, onPickCompetitive, onPickCoop, onPickDartlite, onPickMultiplayer }: ModeSelectProps) {
  const [coopOpen, setCoopOpen] = useState(false);

  if (coopOpen) {
    return (
      <div className="view-scroll">
        <div className="card">
          <h2 style={{ marginBottom: 14 }}>Coop Modes</h2>
          <div style={{ display: 'grid', gap: 12 }}>
            <button
              className="btn block"
              style={{
                padding: 16, textAlign: 'left',
                background: 'linear-gradient(135deg, color-mix(in srgb,#ef4444 30%,var(--bg-3)) 0%, var(--bg-3) 80%)',
                borderColor: 'color-mix(in srgb,#ef4444 50%,var(--border))',
              }}
              onClick={onPickCoop}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 28 }}>⚔️</span>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>Coop Campaign</div>
                  <div className="muted small" style={{ marginTop: 2 }}>Team up against AI enemies across a level-based campaign</div>
                </div>
              </div>
            </button>
            <button
              className="btn block"
              style={{
                padding: 16, textAlign: 'left',
                background: 'linear-gradient(135deg, color-mix(in srgb,#7c3aed 30%,var(--bg-3)) 0%, var(--bg-3) 80%)',
                borderColor: 'color-mix(in srgb,#7c3aed 50%,var(--border))',
              }}
              onClick={onPickDartlite}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 28 }}>🎲</span>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>Dartlite</div>
                  <div className="muted small" style={{ marginTop: 2 }}>Rogue-lite endless run. Choose boons, collect trinkets, survive as long as you can.</div>
                </div>
              </div>
            </button>
          </div>
          <button className="btn block ghost" style={{ marginTop: 12 }} onClick={() => setCoopOpen(false)}>Back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="view-scroll">
      <div className="card">
        <h2 style={{ marginBottom: 14 }}>Choose a Mode</h2>
        <div style={{ display: 'grid', gap: 12 }}>
          <button
            className="btn block"
            style={{
              padding: 16, textAlign: 'left',
              background: 'linear-gradient(135deg, color-mix(in srgb,var(--accent) 22%,var(--bg-3)) 0%, var(--bg-3) 80%)',
              borderColor: 'color-mix(in srgb,var(--accent) 50%,var(--border))',
            }}
            onClick={onPickCompetitive}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 28 }}>🎯</span>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>Competitive</div>
                <div className="muted small" style={{ marginTop: 2 }}>501, 301, Around the Clock, Killer, High Score, Battle & more</div>
              </div>
            </div>
          </button>
          <button
            className="btn block"
            style={{
              padding: 16, textAlign: 'left',
              background: 'linear-gradient(135deg, color-mix(in srgb,#ef4444 30%,var(--bg-3)) 0%, var(--bg-3) 80%)',
              borderColor: 'color-mix(in srgb,#ef4444 50%,var(--border))',
            }}
            onClick={() => setCoopOpen(true)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 28 }}>⚔️</span>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>Coop</div>
                <div className="muted small" style={{ marginTop: 2 }}>Campaign & Dartlite rogue-lite — team up against AI enemies</div>
              </div>
              <span style={{ marginLeft: 'auto', color: 'var(--muted)' }}>›</span>
            </div>
          </button>
          <button
            className="btn block"
            style={{
              padding: 16, textAlign: 'left',
              background: 'linear-gradient(135deg, color-mix(in srgb,#0ea5e9 22%,var(--bg-3)) 0%, var(--bg-3) 80%)',
              borderColor: 'color-mix(in srgb,#0ea5e9 50%,var(--border))',
            }}
            onClick={onPickMultiplayer}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Globe size={28} style={{ color: '#0ea5e9' }} />
              <div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>Multiplayer</div>
                <div className="muted small" style={{ marginTop: 2 }}>Create or join a lobby — play across devices in real time</div>
              </div>
            </div>
          </button>
        </div>
        {players.length > 0 && (
          <div className="muted small" style={{ marginTop: 14 }}>
            {players.length} player{players.length === 1 ? '' : 's'} available: {players.slice(0, 6).map(p => initials(p.name)).join(' · ')}{players.length > 6 ? ' …' : ''}
          </div>
        )}
      </div>
    </div>
  );
}
