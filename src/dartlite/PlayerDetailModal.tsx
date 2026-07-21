import { useState } from 'react';
import type { Player } from '../types';
import { initials } from '../store';
import { Modal } from '../Popups';
import type { DartliteRun } from './engine';
import { getTrinket, TRINKETS } from './trinkets';

export function PlayerDetailModal({ playerId, run, players, onClose }: { playerId: string; run: DartliteRun; players: Player[]; onClose: () => void }) {
  const [trinketInfo, setTrinketInfo] = useState<keyof typeof TRINKETS | null>(null);
  const p = players.find(x => x.id === playerId);
  if (!p) return null;
  const ps = run.playerStats.find(s => s.playerId === playerId);
  const rp = run.runPlayers.find(r => r.id === playerId);

  return (
    <Modal onClose={onClose}>
      <div style={{ padding: 8, maxWidth: 420 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <span className="avatar" style={{ background: p.color, width: 36, height: 36, fontSize: 14 }}>{initials(p.name)}</span>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900 }}>{p.name}</div>
            <div className="muted small">Round {run.round} · Dartlite Run</div>
          </div>
        </div>

        <div className="card" style={{ padding: 12, background: 'var(--bg-3)', marginBottom: 12 }}>
          <div className="muted small" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 8 }}>Stats</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <DetailStat label="Kills" value={ps?.kills ?? 0} />
            <DetailStat label="Damage" value={ps?.damageDealt ?? 0} />
            <DetailStat label="HP" value={rp?.hp ?? 0} />
            <DetailStat label="Max HP" value={rp?.maxHp ?? 0} />
            <DetailStat label="Armor" value={`${rp?.armor ?? 0}%`} />
            <DetailStat label="Power" value={rp?.power ?? 0} />
          </div>
        </div>

        <div className="card" style={{ padding: 12, background: 'var(--bg-3)', marginBottom: 12 }}>
          <div className="muted small" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 8 }}>Chosen Rewards ({ps?.rewards.length ?? 0})</div>
          {ps && ps.rewards.length > 0 ? (
            <div style={{ display: 'grid', gap: 6 }}>
              {ps.rewards.map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 18 }}>{r.icon}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{r.label}</div>
                    <div className="muted small">{r.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="muted small">No rewards chosen yet.</div>
          )}
        </div>

        <div className="card" style={{ padding: 12, background: 'var(--bg-3)' }}>
          <div className="muted small" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 8 }}>Trinkets ({ps?.trinkets.length ?? 0})</div>
          {ps && ps.trinkets.length > 0 ? (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {ps.trinkets.map((tid, i) => {
                const t = getTrinket(tid);
                return t ? (
                  <button key={i} className="pill" style={{ fontSize: 11, background: 'color-mix(in srgb,#7c3aed 18%,var(--bg-3))', color: '#c4b5fd', borderColor: 'transparent', cursor: 'pointer', padding: '4px 10px' }}
                    onClick={() => setTrinketInfo(tid)}>
                    {t.icon} {t.name}
                  </button>
                ) : null;
              })}
            </div>
          ) : (
            <div className="muted small">No trinkets acquired yet.</div>
          )}
        </div>

        <button className="btn primary block" style={{ marginTop: 16 }} onClick={onClose}>Close</button>
      </div>

      {trinketInfo && (
        <Modal onClose={() => setTrinketInfo(null)}>
          <div style={{ padding: 16, textAlign: 'center', maxWidth: 360 }}>
            <div style={{ fontSize: 40 }}>{TRINKETS[trinketInfo].icon}</div>
            <div style={{ fontSize: 18, fontWeight: 900, marginTop: 6 }}>{TRINKETS[trinketInfo].name}</div>
            <div className="pill" style={{ marginTop: 6, display: 'inline-flex', background: 'color-mix(in srgb,#7c3aed 18%,var(--bg-3))', color: '#c4b5fd', borderColor: 'transparent' }}>
              Tier {TRINKETS[trinketInfo].tier}
            </div>
            <div className="muted" style={{ marginTop: 10, fontSize: 13, lineHeight: 1.5 }}>{TRINKETS[trinketInfo].desc}</div>
            <button className="btn primary block" style={{ marginTop: 14 }} onClick={() => setTrinketInfo(null)}>Close</button>
          </div>
        </Modal>
      )}
    </Modal>
  );
}

function DetailStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontWeight: 900, fontSize: 16 }}>{value}</div>
      <div className="muted small" style={{ marginTop: 2 }}>{label}</div>
    </div>
  );
}
