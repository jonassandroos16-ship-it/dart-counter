import { useState } from 'react';
import type { Player } from '../types';
import { initials } from '../store';
import type { DartliteRun } from './engine';
import { PlayerDetailModal } from './PlayerDetailModal';

export function ProgressScreen({ run, players, onContinue }: { run: DartliteRun; players: Player[]; onContinue: () => void }) {
  const [detailId, setDetailId] = useState<string | null>(null);

  return (
    <div className="view-scroll" style={{ background: 'radial-gradient(ellipse at top, color-mix(in srgb,#7c3aed 12%,var(--bg)) 0%, var(--bg) 70%)', minHeight: '100%' }}>
      <div className="card" style={{ maxWidth: 520, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.14em', color: '#c4b5fd', textTransform: 'uppercase' }}>Run Progress</div>
          <div style={{ fontSize: 22, fontWeight: 900, marginTop: 4 }}>Round {run.round} Complete</div>
          <div className="muted small" style={{ marginTop: 4 }}>
            {run.stats.roundsCleared} rounds cleared · {run.stats.enemiesDefeated} kills · Round {run.round + 1} next
          </div>
        </div>

        <div className="muted small" style={{ fontWeight: 700, marginBottom: 8 }}>Tap a player for details</div>
        <div style={{ display: 'grid', gap: 8 }}>
          {run.playerIds.map((pid) => {
            const p = players.find(x => x.id === pid);
            if (!p) return null;
            const ps = run.playerStats.find(s => s.playerId === pid);
            const rp = run.runPlayers.find(r => r.id === pid);
            return (
              <button key={pid} className="btn block" style={{ padding: 12, textAlign: 'left', background: 'var(--bg-3)', borderColor: 'var(--border)' }}
                onClick={() => setDetailId(pid)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="avatar" style={{ background: p.color, width: 30, height: 30, fontSize: 12 }}>{initials(p.name)}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800 }}>{p.name}</div>
                    <div className="muted small">
                      {ps?.kills ?? 0} kills · {ps?.damageDealt ?? 0} dmg · {ps?.trinkets.length ?? 0} trinkets
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: '#c4b5fd', fontWeight: 700 }}>{ps?.rewards.length ?? 0} rewards</div>
                    <div className="muted small">HP {rp?.hp ?? 0}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <button className="btn primary block" style={{ marginTop: 18 }} onClick={onContinue}>
          Continue to Round {run.round + 1}
        </button>
      </div>

      {detailId && (
        <PlayerDetailModal playerId={detailId} run={run} players={players} onClose={() => setDetailId(null)} />
      )}
    </div>
  );
}
