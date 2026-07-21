import type { DartliteRun } from './engine';
import { getTrinket } from './trinkets';
import { recordDartliteRun } from './stats';

interface Props {
  run: DartliteRun;
  setPlayers: (updater: (prev: any[]) => any[]) => void;
  onContinue: () => void;
}

export function DartliteGameOver({ run, setPlayers, onContinue }: Props) {
  recordDartliteRun(run, setPlayers as any);

  const seenTrinkets = run.stats.trinketsCollected.filter((v, i, a) => a.indexOf(v) === i);

  return (
    <div className="view-scroll">
      <div className="card" style={{ maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.14em', color: '#c4b5fd', textTransform: 'uppercase' }}>Dartlite Run Over</div>
        <div style={{ fontSize: 26, fontWeight: 900, marginTop: 4 }}>You reached Round {run.round}</div>
        <div className="muted small" style={{ marginTop: 6 }}>
          {run.stats.roundsCleared} rounds cleared · {run.stats.enemiesDefeated} enemies defeated
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 16 }}>
          <div className="card" style={{ padding: 12, background: 'var(--bg-3)' }}>
            <div style={{ fontSize: 22, fontWeight: 900 }}>{run.stats.roundsCleared}</div>
            <div className="muted small">Rounds</div>
          </div>
          <div className="card" style={{ padding: 12, background: 'var(--bg-3)' }}>
            <div style={{ fontSize: 22, fontWeight: 900 }}>{run.stats.enemiesDefeated}</div>
            <div className="muted small">Kills</div>
          </div>
          <div className="card" style={{ padding: 12, background: 'var(--bg-3)' }}>
            <div style={{ fontSize: 22, fontWeight: 900 }}>{run.stats.miniBossesDefeated}</div>
            <div className="muted small">Mini-Bosses</div>
          </div>
          <div className="card" style={{ padding: 12, background: 'var(--bg-3)' }}>
            <div style={{ fontSize: 22, fontWeight: 900 }}>{run.stats.bossesDefeated}</div>
            <div className="muted small">Bosses</div>
          </div>
          <div className="card" style={{ padding: 12, background: 'var(--bg-3)' }}>
            <div style={{ fontSize: 22, fontWeight: 900 }}>{run.stats.damageDealt}</div>
            <div className="muted small">Damage</div>
          </div>
          <div className="card" style={{ padding: 12, background: 'var(--bg-3)' }}>
            <div style={{ fontSize: 22, fontWeight: 900 }}>{run.stats.xpGained}</div>
            <div className="muted small">XP Gained</div>
          </div>
        </div>

        {seenTrinkets.length > 0 && (
          <div style={{ marginTop: 16, textAlign: 'left' }}>
            <div className="muted small" style={{ fontWeight: 700, marginBottom: 6 }}>Trinkets Collected</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {seenTrinkets.map((tid, i) => {
                const t = getTrinket(tid);
                return t ? (
                  <span key={i} title={`${t.name}: ${t.desc}`} className="pill" style={{ fontSize: 11, background: 'color-mix(in srgb,#7c3aed 18%,var(--bg-3))', color: '#c4b5fd', borderColor: 'transparent' }}>
                    {t.icon} {t.name}
                  </span>
                ) : null;
              })}
            </div>
          </div>
        )}

        <button className="btn primary block" style={{ marginTop: 20 }} onClick={onContinue}>Back to Menu</button>
      </div>
    </div>
  );
}
