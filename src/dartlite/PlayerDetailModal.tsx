import type { DartliteRun } from './engine';
import { getTrinket } from './trinkets';
import { playerPowerInfo } from './trinketEffects';
import type { Player } from '../types';
import { initials } from '../store';
import { Modal } from '../Popups';

function DetailStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4px 0' }}>
      <span className="muted" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</span>
      <span style={{ fontSize: 16, fontWeight: 900 }}>{value}</span>
    </div>
  );
}

export function PlayerDetailModal({ run, playerId, players, onClose }: {
  run: DartliteRun;
  playerId: string;
  players: Player[];
  onClose: () => void;
}) {
  const p = players.find(pp => pp.id === playerId);
  if (!p) return null;
  const ps = run.playerStats.find(s => s.playerId === playerId);
  const rp = run.runPlayers.find(r => r.id === playerId);
  const powerInfo = playerPowerInfo(run, playerId);

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
            <DetailStat label="Power" value={powerInfo.total} />
          </div>
          {powerInfo.extra > 0 && (
            <div className="muted small" style={{ marginTop: 6, textAlign: 'center' }}>
              {rp?.power ?? 0} base + {powerInfo.extra} from trinkets
            </div>
          )}
        </div>

        <div className="card" style={{ padding: 12, background: 'var(--bg-3)', marginBottom: 12 }}>
          <div className="muted small" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 8 }}>Chosen Rewards ({ps?.rewards.length ?? 0})</div>
          {ps && ps.rewards.length > 0 ? (
            <div style={{ display: 'grid', gap: 6 }}>
              {ps.rewards.map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 18 }}>{r.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{r.label}</div>
                    <div className="muted" style={{ fontSize: 11 }}>{r.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="muted small">No rewards chosen yet.</div>
          )}
        </div>

        <div className="card" style={{ padding: 12, background: 'var(--bg-3)' }}>
          <div className="muted small" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 8 }}>Trinkets ({rp?.trinkets.length ?? 0})</div>
          {rp && rp.trinkets.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {rp.trinkets.map((tid, i) => {
                const t = getTrinket(tid);
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px', borderRadius: 8, background: 'var(--bg)' }}>
                    <span style={{ fontSize: 16 }}>{t.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</div>
                      <div className="muted" style={{ fontSize: 9 }}>{t.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="muted small">No trinkets collected yet.</div>
          )}
        </div>
      </div>
    </Modal>
  );
}
