import type { CampaignProgress } from './types';
import { CAMPAIGN_LEVELS } from './campaignLevels';
import { ENEMY_DATABASE } from './enemyDatabase';
import { isLevelUnlocked } from './engine';

export function CampaignMap({ progress, onPick, onBack }: {
  progress: CampaignProgress;
  onPick: (levelId: number) => void;
  onBack: () => void;
}) {
  const levels = CAMPAIGN_LEVELS.levels;
  const hpPct = Math.max(0, Math.min(100, (progress.current_party_hp / progress.party_max_hp) * 100));
  return (
    <div className="view-scroll">
      <div className="row between" style={{ marginBottom: 12 }}>
        <button className="btn ghost sm" onClick={onBack}>← Back</button>
        <h2 style={{ margin: 0 }}>Co-op Campaign</h2>
        <span className="pill" style={{ background: 'color-mix(in srgb,#ef4444 18%,var(--bg-3))', color: '#fca5a5', borderColor: 'transparent' }}>
          ❤️ {progress.current_party_hp}/{progress.party_max_hp}
        </span>
      </div>
      <div className="card" style={{ padding: 10 }}>
        <div className="muted small" style={{ marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>Party HP</div>
        <div style={{ width: '100%', height: 10, borderRadius: 5, background: 'var(--bg-3)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${hpPct}%`, background: '#ef4444', transition: 'width .4s' }} />
        </div>
        <div className="muted small" style={{ marginTop: 8 }}>Highest level beaten: <b style={{ color: 'var(--text)' }}>{progress.highest_level_beaten}</b></div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
        {levels.map((lvl, i) => {
          const unlocked = isLevelUnlocked(lvl.level_id, progress.highest_level_beaten);
          const beaten = lvl.level_id <= progress.highest_level_beaten;
          const isBoss = lvl.is_boss;
          return (
            <div key={lvl.level_id} style={{ position: 'relative' }}>
              {i > 0 && (
                <div style={{ position: 'absolute', top: -10, left: 24, width: 2, height: 10, background: 'var(--border)' }} />
              )}
              <button
                className="card"
                disabled={!unlocked}
                onClick={() => unlocked && onPick(lvl.level_id)}
                style={{
                  cursor: unlocked ? 'pointer' : 'not-allowed',
                  opacity: unlocked ? 1 : 0.45,
                  display: 'flex', alignItems: 'center', gap: 12, padding: 14, margin: 0,
                  background: isBoss
                    ? 'linear-gradient(135deg, color-mix(in srgb,#ef4444 28%,var(--bg-2)) 0%, var(--bg-2) 70%)'
                    : 'var(--bg-2)',
                  borderColor: isBoss ? 'color-mix(in srgb,#ef4444 60%,var(--border))' : 'var(--border)',
                  boxShadow: isBoss ? '0 0 18px color-mix(in srgb,#ef4444 22%,transparent)' : 'var(--shadow)',
                }}
              >
                <div style={{
                  width: 44, height: 44, borderRadius: '50%',
                  background: beaten ? 'var(--accent)' : isBoss ? '#ef4444' : 'var(--bg-3)',
                  color: beaten ? '#04150a' : isBoss ? '#fff' : 'var(--muted)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 900, fontSize: 18, flex: '0 0 auto',
                  border: isBoss ? '2px solid #fff' : 'none',
                }}>
                  {beaten ? '✓' : isBoss ? '☠' : lvl.level_id}
                </div>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ fontWeight: 800, fontSize: 16, color: isBoss ? '#fca5a5' : 'var(--text)' }}>
                    {isBoss ? 'BOSS · ' : ''}{lvl.name}
                  </div>
                  <div className="muted small" style={{ marginTop: 2 }}>
                    {lvl.enemies.map(id => ENEMY_DATABASE[id]?.name || id).join(' · ')}
                  </div>
                </div>
                <div style={{ flex: '0 0 auto' }}>
                  {unlocked ? (
                    <span className="pill" style={{ background: 'var(--accent)', color: '#04150a' }}>Play</span>
                  ) : (
                    <span className="pill" style={{ background: 'var(--bg-3)', color: 'var(--muted)' }}>🔒</span>
                  )}
                </div>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
