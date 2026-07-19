import type { Player } from '../types';
import { initials } from '../store';

export interface ModeSelectProps {
  players: Player[];
  onPickCompetitive: () => void;
  onPickCoop: () => void;
}

// Mode selection screen shown before the play setup. Splits the app into
// competitive modes (x01, ATC, Killer, High Score, Battle, etc.) and the
// Co-op Campaign. Designed to accommodate more modes in the future.
export function ModeSelectView({ players, onPickCompetitive, onPickCoop }: ModeSelectProps) {
  return (
    <div className="view-scroll">
      <div className="card">
        <h2 style={{ marginBottom: 14 }}>Choose a Mode</h2>
        <div style={{ display: 'grid', gap: 12 }}>
          <button
            className="btn block"
            style={{
              padding: 16,
              textAlign: 'left',
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
              padding: 16,
              textAlign: 'left',
              background: 'linear-gradient(135deg, color-mix(in srgb,#ef4444 30%,var(--bg-3)) 0%, var(--bg-3) 80%)',
              borderColor: 'color-mix(in srgb,#ef4444 50%,var(--border))',
            }}
            onClick={onPickCoop}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 28 }}>⚔️</span>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>Co-op Campaign</div>
                <div className="muted small" style={{ marginTop: 2 }}>Team up against AI enemies across a level-based campaign</div>
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
