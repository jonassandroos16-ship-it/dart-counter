import type { CampaignProgress } from './types';
import type { Player as AppPlayer } from '../types';
import { CAMPAIGN_LEVELS } from './campaignLevels';
import { ENEMY_DATABASE } from './enemyDatabase';
import { isLevelUnlocked, getCoopPowerUp } from './engine';
import { initials } from '../store';

export function CampaignMap({
  progress,
  players,
  onPick,
  onBack,
}: {
  progress: CampaignProgress;
  players: AppPlayer[];
  onPick: (levelId: number) => void;
  onBack: () => void;
}) {
  const levels = CAMPAIGN_LEVELS.levels;
  const unlockedPowerUps = progress.unlockedPowerUps || [];
  return (
    <div className="view-scroll">
      <div className="row between" style={{ marginBottom: 12 }}>
        <button className="btn ghost sm" onClick={onBack}>← Back</button>
        <h2 style={{ margin: 0 }}>Co-op Campaign</h2>
        <span className="pill" style={{ background: 'color-mix(in srgb,#ef4444 18%,var(--bg-3))', color: '#fca5a5', borderColor: 'transparent' }}>
          ⭐ {progress.highest_level_beaten} cleared
        </span>
      </div>

      {players.length > 0 && (
        <div className="card" style={{ padding: 10, marginBottom: 12 }}>
          <div className="muted small" style={{ marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>Your party</div>
          <div className="row wrap" style={{ gap: 6 }}>
            {players.map(p => (
              <span key={p.id} className="pill" style={{ background: p.color, color: '#0b0e13', borderColor: 'transparent' }}>
                <span className="avatar" style={{ width: 18, height: 18, fontSize: 9, background: 'rgba(0,0,0,.25)' }}>{initials(p.name)}</span>
                {p.name}
              </span>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {levels.map((lvl, i) => {
          const unlocked = isLevelUnlocked(lvl.level_id, progress.highest_level_beaten);
          const beaten = lvl.level_id <= progress.highest_level_beaten;
          const isBoss = lvl.is_boss;
          const reward = lvl.reward_power_up ? getCoopPowerUp(lvl.reward_power_up as any) : null;
          const rewardUnlocked = reward ? unlockedPowerUps.includes(reward.id) : false;
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
                  {reward && (
                    <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="pill" style={{
                        fontSize: 10, padding: '2px 8px', borderColor: 'transparent',
                        background: rewardUnlocked ? 'color-mix(in srgb,var(--accent) 22%,var(--bg-3))' : isBoss ? 'color-mix(in srgb,#ef4444 18%,var(--bg-3))' : 'var(--bg-3)',
                        color: rewardUnlocked ? 'var(--text)' : isBoss ? '#fca5a5' : 'var(--muted)',
                      }}>
                        {rewardUnlocked ? `${reward.icon} ${reward.name} (unlocked)` : `🎁 Reward: ${reward.icon} ${reward.name}`}
                      </span>
                    </div>
                  )}
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
