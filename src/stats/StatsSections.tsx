import type { Player } from '../types';
import { loadDartliteGlobalStats } from '../dartlite/stats';
import { ALL_TRINKET_IDS, getTrinket } from '../dartlite/trinkets';

export function CoopStatsSection({ players }: { players: Player[] }) {
  const campaignKills = players.reduce((a, p) => a + ((p as any).campaignKills || 0), 0);
  const levelsCleared = players.reduce((a, p) => a + (p.campaignProgress?.highest_level_beaten || 0), 0);

  return (
    <div className="card" style={{ marginTop: 12 }}>
      <h3 style={{ marginBottom: 8 }}>⚔️ Co-op Campaign</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>
        <div style={{ padding: 10, background: 'var(--bg-3)', borderRadius: 8 }}>
          <div style={{ fontSize: 20, fontWeight: 900 }}>{campaignKills}</div>
          <div className="muted small">Campaign Kills</div>
        </div>
        <div style={{ padding: 10, background: 'var(--bg-3)', borderRadius: 8 }}>
          <div style={{ fontSize: 20, fontWeight: 900 }}>{levelsCleared}</div>
          <div className="muted small">Levels Cleared</div>
        </div>
      </div>
    </div>
  );
}

export function DartliteStatsSection({ players }: { players: Player[] }) {
  const g = loadDartliteGlobalStats();
  const totalSeen = players.reduce((a, p) => a + (p.dartliteStats?.seenTrinkets.length || 0), 0);
  const uniqueSeen = new Set(players.flatMap(p => p.dartliteStats?.seenTrinkets || [])).size;

  return (
    <div className="card" style={{ marginTop: 12 }}>
      <h3 style={{ marginBottom: 8 }}>🎲 Dartlite</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>
        <div style={{ padding: 10, background: 'var(--bg-3)', borderRadius: 8 }}>
          <div style={{ fontSize: 20, fontWeight: 900 }}>{g.totalKills}</div>
          <div className="muted small">Total Kills</div>
        </div>
        <div style={{ padding: 10, background: 'var(--bg-3)', borderRadius: 8 }}>
          <div style={{ fontSize: 20, fontWeight: 900 }}>{g.totalBattles}</div>
          <div className="muted small">Battles Won</div>
        </div>
        <div style={{ padding: 10, background: 'var(--bg-3)', borderRadius: 8 }}>
          <div style={{ fontSize: 20, fontWeight: 900 }}>{g.totalMiniBosses}</div>
          <div className="muted small">Mini-Bosses</div>
        </div>
        <div style={{ padding: 10, background: 'var(--bg-3)', borderRadius: 8 }}>
          <div style={{ fontSize: 20, fontWeight: 900 }}>{g.totalBosses}</div>
          <div className="muted small">Bosses</div>
        </div>
        <div style={{ padding: 10, background: 'var(--bg-3)', borderRadius: 8 }}>
          <div style={{ fontSize: 20, fontWeight: 900 }}>{g.bestRound}</div>
          <div className="muted small">Best Round</div>
        </div>
        <div style={{ padding: 10, background: 'var(--bg-3)', borderRadius: 8 }}>
          <div style={{ fontSize: 20, fontWeight: 900 }}>{g.totalRuns}</div>
          <div className="muted small">Runs</div>
        </div>
        <div style={{ padding: 10, background: 'var(--bg-3)', borderRadius: 8 }}>
          <div style={{ fontSize: 20, fontWeight: 900 }}>{g.totalXp}</div>
          <div className="muted small">XP Gained</div>
        </div>
        <div style={{ padding: 10, background: 'var(--bg-3)', borderRadius: 8 }}>
          <div style={{ fontSize: 20, fontWeight: 900 }}>{uniqueSeen}/{ALL_TRINKET_IDS.length}</div>
          <div className="muted small">Trinkets Seen</div>
        </div>
      </div>
      {uniqueSeen > 0 && (
        <div style={{ marginTop: 12 }}>
          <div className="muted small" style={{ fontWeight: 700, marginBottom: 6 }}>Discovered Trinkets</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {ALL_TRINKET_IDS.filter(id => players.some(p => p.dartliteStats?.seenTrinkets.includes(id))).map(id => {
              const t = getTrinket(id);
              return (
                <span key={id} title={t.desc} className="pill" style={{ fontSize: 11, background: 'color-mix(in srgb,#7c3aed 18%,var(--bg-3))', color: '#c4b5fd', borderColor: 'transparent' }}>
                  {t.icon} {t.name}
                </span>
              );
            })}
          </div>
        </div>
      )}
      <div className="muted small" style={{ marginTop: 8 }}>Total trinket discoveries across all players: {totalSeen}</div>
    </div>
  );
}
