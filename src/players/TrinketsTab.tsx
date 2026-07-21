import type { Player } from '../types';
import { TRINKETS, ALL_TRINKET_IDS } from '../dartlite/trinkets';
import { defaultDartliteStats } from '../dartlite/stats';

export function TrinketsTab({ player }: { player: Player }) {
  const stats = player.dartliteStats || defaultDartliteStats();
  const seen = new Set(stats.seenTrinkets);

  return (
    <div>
      <div className="row between" style={{ marginBottom: 10 }}>
        <h3 style={{ margin: 0 }}>Trinkets</h3>
        <span className="muted small">{seen.size} / {ALL_TRINKET_IDS.length} seen</span>
      </div>
      <div className="muted small" style={{ marginBottom: 12 }}>
        Trinkets are random buffs collected during Dartlite runs. They only last for the run — this tab shows which ones you've discovered.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
        {ALL_TRINKET_IDS.map(id => {
          const t = TRINKETS[id];
          const isSeen = seen.has(id);
          return (
            <div key={id} style={{
              padding: 10, borderRadius: 10,
              background: isSeen ? 'color-mix(in srgb,#7c3aed 12%,var(--bg-3))' : 'var(--bg-3)',
              border: `1px solid ${isSeen ? 'color-mix(in srgb,#7c3aed 40%,var(--border))' : 'var(--border)'}`,
              opacity: isSeen ? 1 : 0.45,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 20 }}>{isSeen ? t.icon : '🔒'}</span>
                <span style={{ fontWeight: 700, fontSize: 13 }}>{isSeen ? t.name : '???'}</span>
              </div>
              <div className="muted" style={{ fontSize: 11, lineHeight: 1.3 }}>
                {isSeen ? t.desc : 'Undiscovered — find it in a Dartlite run.'}
              </div>
              {isSeen && (
                <div className="muted small" style={{ marginTop: 4, fontSize: 10 }}>
                  Tier {t.tier}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
