import { useState } from 'react';
import type { Player } from '../types';
import { initials } from '../store';
import type { DartliteRun } from './engine';
import type { TrinketId } from './trinkets';
import { getTrinket } from './trinkets';

interface Props {
  run: DartliteRun;
  players: Player[];
  onPick: (trinketId: TrinketId) => void;
}

export function BossVictoryScreen({ run, players, onPick }: Props) {
  const [picked, setPicked] = useState<TrinketId | null>(null);
  if (!run.bossVictory) return null;
  const { bossName, trinketOptions } = run.bossVictory;

  return (
    <div className="view-scroll" style={{
      background: 'radial-gradient(ellipse at top, color-mix(in srgb,#f59e0b 18%,var(--bg)) 0%, var(--bg) 70%)',
      minHeight: '100%',
    }}>
      <div className="card" style={{ maxWidth: 520, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <div style={{ fontSize: 40, marginBottom: 6 }}>🏆</div>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.14em', color: '#fbbf24', textTransform: 'uppercase' }}>Boss Defeated</div>
          <div style={{ fontSize: 26, fontWeight: 900, marginTop: 6 }}>{bossName}</div>
          <div className="muted small" style={{ marginTop: 6 }}>
            The party has been healed to 100%. Choose a boss trinket to empower your run.
          </div>
        </div>

        <div className="muted small" style={{ fontWeight: 700, marginBottom: 8 }}>Boss Trinket Reward</div>
        <div style={{ display: 'grid', gap: 10 }}>
          {trinketOptions.map((id) => {
            const def = getTrinket(id);
            const isPicked = picked === id;
            return (
              <button key={id} className="btn block" style={{
                padding: 14, textAlign: 'left',
                background: isPicked
                  ? 'linear-gradient(135deg, color-mix(in srgb,#f59e0b 28%,var(--bg-3)) 0%, var(--bg-3) 80%)'
                  : 'var(--bg-3)',
                borderColor: isPicked ? '#f59e0b' : 'var(--border)',
                opacity: picked && !isPicked ? 0.5 : 1,
                transition: 'opacity 200ms, border-color 200ms',
              }} onClick={() => setPicked(id)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 28 }}>{def.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: 16 }}>{def.name}</div>
                    <div className="muted small" style={{ marginTop: 2 }}>{def.desc}</div>
                  </div>
                  {isPicked && <span style={{ color: '#fbbf24', fontSize: 20, fontWeight: 900 }}>✓</span>}
                </div>
              </button>
            );
          })}
        </div>

        <button
          className="btn primary block"
          style={{ marginTop: 18 }}
          disabled={!picked}
          onClick={() => picked && onPick(picked)}
        >
          Claim Trinket & Continue
        </button>

        <div style={{ marginTop: 14, display: 'flex', justifyContent: 'center', gap: 6 }}>
          {run.runPlayers.map((rp) => {
            const p = players.find(x => x.id === rp.id);
            return (
              <div key={rp.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span className="avatar" style={{ background: p?.color || rp.color, width: 22, height: 22, fontSize: 10 }}>
                  {initials(p?.name || rp.name)}
                </span>
                <span className="muted small">❤️ {rp.hp}/{rp.maxHp}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
