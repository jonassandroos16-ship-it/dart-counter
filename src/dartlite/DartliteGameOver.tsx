import { useEffect, useState } from 'react';
import type { Player } from '../types';
import { initials } from '../store';
import type { DartliteRun } from './engine';
import { getTrinket, TRINKETS } from './trinkets';
import { recordDartliteRun } from './stats';
import { Modal } from '../Popups';
import type { TrinketId } from './trinkets';

interface Props {
  run: DartliteRun;
  players?: Player[];
  setPlayers: (updater: (prev: any[]) => any[]) => void;
  onContinue: () => void;
}

export function DartliteGameOver({ run, players = [], setPlayers, onContinue }: Props) {
  const [trinketInfo, setTrinketInfo] = useState<TrinketId | null>(null);
  const [tab, setTab] = useState<'overview' | 'players'>('overview');

  useEffect(() => {
    recordDartliteRun(run, setPlayers as any);
  }, []); // run once on mount

  const seenTrinkets = run.stats.trinketsCollected.filter(
    (v, i, a) => a.indexOf(v) === i && (v as string) !== 'trk_phoenix_heart_used',
  );

  const reachedRound = run.round;

  return (
    <div className="view-scroll" style={{
      background: 'radial-gradient(ellipse at top, color-mix(in srgb,#dc2626 12%,var(--bg)) 0%, var(--bg) 65%)',
      minHeight: '100%',
    }}>
      <div className="card" style={{ maxWidth: 540, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 48, marginBottom: 6 }}>☠</div>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.14em', color: '#fca5a5', textTransform: 'uppercase' }}>
            Run Over
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, marginTop: 4 }}>
            Reached Round {reachedRound}
          </div>
          <div className="muted small" style={{ marginTop: 6 }}>
            {run.stats.roundsCleared} rounds cleared · {run.stats.enemiesDefeated} enemies defeated
          </div>
        </div>

        {/* Tab switcher */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {(['overview', 'players'] as const).map(t => (
            <button key={t} className="btn block" style={{
              flex: 1, padding: '8px 0', fontWeight: 800, fontSize: 12,
              background: tab === t ? 'var(--accent)' : 'var(--bg-3)',
              color: tab === t ? '#0b0e13' : 'var(--text)',
              borderColor: tab === t ? 'var(--accent)' : 'var(--border)',
              textTransform: 'capitalize',
            }} onClick={() => setTab(t)}>
              {t === 'overview' ? 'Overview' : 'Per Player'}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <>
            {/* Global stats grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
              <StatTile label="Rounds" value={run.stats.roundsCleared} color="#c4b5fd" />
              <StatTile label="Kills" value={run.stats.enemiesDefeated} color="#86efac" />
              <StatTile label="Damage" value={run.stats.damageDealt} color="#fbbf24" />
              <StatTile label="Mini-Bosses" value={run.stats.miniBossesDefeated} color="#f97316" />
              <StatTile label="Bosses" value={run.stats.bossesDefeated} color="#ef4444" />
              <StatTile label="XP Gained" value={run.stats.xpGained} color="#38bdf8" />
            </div>

            {/* Trinkets */}
            {seenTrinkets.length > 0 && (
              <div style={{ marginBottom: 4 }}>
                <div className="muted small" style={{ fontWeight: 700, marginBottom: 8 }}>
                  Trinkets Collected ({seenTrinkets.length})
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {seenTrinkets.map((tid, i) => {
                    const t = getTrinket(tid);
                    return t ? (
                      <button key={i} className="pill" style={{
                        fontSize: 11, background: 'color-mix(in srgb,#7c3aed 18%,var(--bg-3))',
                        color: '#c4b5fd', borderColor: 'transparent', cursor: 'pointer', padding: '4px 10px',
                      }} onClick={() => setTrinketInfo(tid)}>
                        {t.icon} {t.name}
                      </button>
                    ) : null;
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {tab === 'players' && (
          <div style={{ display: 'grid', gap: 14 }}>
            {run.playerIds.map(pid => {
              const player = players.find(p => p.id === pid);
              const ps = run.playerStats.find(s => s.playerId === pid);
              const rp = run.runPlayers.find(r => r.id === pid);
              const name = player?.name || rp?.name || pid;
              const color = player?.color || rp?.color || '#7c3aed';
              const playerTrinkets = (ps?.trinkets ?? []).filter(
                (v, i, a) => a.indexOf(v) === i && (v as string) !== 'trk_phoenix_heart_used',
              );
              const rewards = ps?.rewards ?? [];

              return (
                <div key={pid} style={{
                  borderRadius: 12, padding: 14,
                  background: 'var(--bg-3)',
                  border: `1px solid color-mix(in srgb, ${color} 35%, var(--border))`,
                }}>
                  {/* Player header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <span className="avatar" style={{ background: color, width: 34, height: 34, fontSize: 14 }}>
                      {initials(name)}
                    </span>
                    <div>
                      <div style={{ fontWeight: 900, fontSize: 16 }}>{name}</div>
                      <div className="muted small">
                        {ps?.kills ?? 0} kills · {ps?.damageDealt ?? 0} dmg · {rp?.hp ?? 0}/{rp?.maxHp ?? 0} HP
                      </div>
                    </div>
                    <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                      <div style={{ fontSize: 11, color: '#c4b5fd', fontWeight: 800 }}>
                        {playerTrinkets.length} trinkets
                      </div>
                      {run.stats.bossesDefeated > 0 && (
                        <div className="muted small">{run.stats.bossesDefeated} boss{run.stats.bossesDefeated !== 1 ? 'es' : ''}</div>
                      )}
                    </div>
                  </div>

                  {/* Stats row */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
                    <MiniStat label="Kills" value={ps?.kills ?? 0} />
                    <MiniStat label="Damage" value={ps?.damageDealt ?? 0} />
                    <MiniStat label="HP Left" value={rp?.hp ?? 0} />
                    <MiniStat label="Max HP" value={rp?.maxHp ?? 0} />
                    <MiniStat label="Armor" value={`${rp?.armor ?? 0}%`} />
                    <MiniStat label="Power" value={rp?.power ?? 0} />
                  </div>

                  {/* Trinkets */}
                  {playerTrinkets.length > 0 && (
                    <div style={{ marginBottom: 10 }}>
                      <div className="muted small" style={{ fontWeight: 700, marginBottom: 6 }}>Trinkets</div>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        {playerTrinkets.map((tid, i) => {
                          const t = getTrinket(tid);
                          return t ? (
                            <button key={i} className="pill" style={{
                              fontSize: 10, padding: '3px 8px',
                              background: 'color-mix(in srgb,#7c3aed 18%,var(--bg-2))',
                              color: '#c4b5fd', borderColor: 'transparent', cursor: 'pointer',
                            }} onClick={() => setTrinketInfo(tid)}>
                              {t.icon} {t.name}
                            </button>
                          ) : null;
                        })}
                      </div>
                    </div>
                  )}

                  {/* Rewards */}
                  {rewards.length > 0 && (
                    <div>
                      <div className="muted small" style={{ fontWeight: 700, marginBottom: 6 }}>
                        Rewards ({rewards.length})
                      </div>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        {rewards.map((r, i) => (
                          <span key={i} className="pill" style={{
                            fontSize: 10, padding: '3px 8px',
                            background: 'color-mix(in srgb,#22c55e 12%,var(--bg-2))',
                            color: '#86efac', borderColor: 'transparent',
                          }}>
                            {r.icon} {r.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <button className="btn primary block" style={{ marginTop: 24 }} onClick={onContinue}>
          Back to Menu
        </button>
      </div>

      {trinketInfo && TRINKETS[trinketInfo] && (
        <Modal onClose={() => setTrinketInfo(null)}>
          <div style={{ padding: 16, textAlign: 'center', maxWidth: 360 }}>
            <div style={{ fontSize: 40 }}>{TRINKETS[trinketInfo].icon}</div>
            <div style={{ fontSize: 18, fontWeight: 900, marginTop: 6 }}>{TRINKETS[trinketInfo].name}</div>
            <div className="pill" style={{ marginTop: 6, display: 'inline-flex', background: 'color-mix(in srgb,#7c3aed 18%,var(--bg-3))', color: '#c4b5fd', borderColor: 'transparent' }}>
              Tier {TRINKETS[trinketInfo].tier}
            </div>
            <div className="muted" style={{ marginTop: 10, fontSize: 13, lineHeight: 1.5 }}>
              {TRINKETS[trinketInfo].desc}
            </div>
            <button className="btn primary block" style={{ marginTop: 14 }} onClick={() => setTrinketInfo(null)}>Close</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function StatTile({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div style={{
      padding: '10px 8px', borderRadius: 10, textAlign: 'center',
      background: `color-mix(in srgb, ${color} 10%, var(--bg-3))`,
      border: `1px solid color-mix(in srgb, ${color} 25%, var(--border))`,
    }}>
      <div style={{ fontSize: 22, fontWeight: 900, color }}>{value}</div>
      <div className="muted small" style={{ marginTop: 2 }}>{label}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div style={{ textAlign: 'center', padding: '6px 4px', borderRadius: 8, background: 'var(--bg-2)' }}>
      <div style={{ fontWeight: 800, fontSize: 15 }}>{value}</div>
      <div className="muted small" style={{ marginTop: 1, fontSize: 10 }}>{label}</div>
    </div>
  );
}
