import type { CampaignProgress } from './types';
import type { Player as AppPlayer } from '../types';
import { getChapter } from './campaignLevels';
import { ENEMY_DATABASE } from './enemyDatabase';
import { isLevelUnlockedForParty, getCoopPowerUp, playerCampaignProgress, partyAllClearedLevel, partyMissingClearForLevel } from './engine';
import { initials } from '../store';

export function CampaignMap({
  progress,
  players,
  chapterId,
  onPick,
  onBack,
}: {
  progress: CampaignProgress;
  players: AppPlayer[];
  chapterId: string;
  onPick: (levelId: number) => void;
  onBack: () => void;
}) {
  const chapter = getChapter(chapterId);
  if (!chapter) {
    return (
      <div className="view-scroll">
        <div className="muted">Unknown chapter.</div>
        <button className="btn ghost sm" onClick={onBack} style={{ marginTop: 12 }}>← Back</button>
      </div>
    );
  }
  const levels = chapter.levels;
  // Aggregate per-player progress for the chapter header (max cleared
  // across the party). The shared `progress` is kept for backwards
  // compat with badges but is no longer the source of truth for unlocks.
  const cleared = Math.max(
    progress.chapters?.[chapterId] ?? 0,
    ...players.map(p => playerCampaignProgress(p).chapters?.[chapterId] ?? 0),
  );
  const theme = chapter.theme;
  return (
    <div className="view-scroll" style={{ background: theme.background, borderRadius: 14, margin: -2, padding: 14 }}>
      <div className="row between" style={{ marginBottom: 12 }}>
        <button className="btn ghost sm" onClick={onBack}>← Back</button>
        <h2 style={{ margin: 0, color: theme.accent }}>{chapter.name}</h2>
        <span className="pill" style={{ background: `color-mix(in srgb, ${theme.accent} 18%, var(--bg-3))`, color: theme.accent, borderColor: 'transparent' }}>
          ⭐ {cleared} cleared
        </span>
      </div>

      <div className="card" style={{ padding: 12, marginBottom: 12, background: theme.cardTint, borderColor: `color-mix(in srgb, ${theme.accent} 40%, var(--border))` }}>
        <div className="muted" style={{ fontSize: 13, lineHeight: 1.5, fontStyle: 'italic' }}>{chapter.story.intro}</div>
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
          const unlocked = isLevelUnlockedForParty(chapterId, lvl.level_id, players);
          const beaten = partyAllClearedLevel(players, chapterId, i);
          const missingClear = partyMissingClearForLevel(players, chapterId, i);
          const isBoss = lvl.is_boss;
          const reward = lvl.reward_power_up ? getCoopPowerUp(lvl.reward_power_up as any) : null;
          // A reward is "unlocked for everyone" only when every party member
          // has cleared this level. If some members are missing the clear,
          // the info box calls that out instead of claiming unlocked.
          const rewardUnlocked = reward ? beaten : false;
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
                    ? `linear-gradient(135deg, color-mix(in srgb, ${theme.accent} 28%, var(--bg-2)) 0%, var(--bg-2) 70%)`
                    : 'var(--bg-2)',
                  borderColor: isBoss ? `color-mix(in srgb, ${theme.accent} 60%, var(--border))` : 'var(--border)',
                  boxShadow: isBoss ? `0 0 18px color-mix(in srgb, ${theme.accent} 22%, transparent)` : 'var(--shadow)',
                }}
              >
                <div style={{
                  width: 44, height: 44, borderRadius: '50%',
                  background: beaten ? theme.accent : isBoss ? theme.accent : 'var(--bg-3)',
                  color: beaten ? '#04150a' : isBoss ? '#04150a' : 'var(--muted)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 900, fontSize: 18, flex: '0 0 auto',
                  border: isBoss ? `2px solid ${theme.accent}` : 'none',
                }}>
                  {beaten ? '✓' : isBoss ? '☠' : lvl.level_id}
                </div>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ fontWeight: 800, fontSize: 16, color: isBoss ? theme.accent : 'var(--text)' }}>
                    {isBoss ? 'BOSS · ' : ''}{lvl.name}
                  </div>
                  <div className="muted small" style={{ marginTop: 2 }}>
                    {lvl.enemies.map(id => ENEMY_DATABASE[id]?.name || id).join(' · ')}
                  </div>
                  {reward && (
                    <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span className="pill" style={{
                          fontSize: 10, padding: '2px 8px', borderColor: 'transparent',
                          background: rewardUnlocked ? `color-mix(in srgb, ${theme.accent} 22%, var(--bg-3))` : isBoss ? `color-mix(in srgb, ${theme.accent} 18%, var(--bg-3))` : 'var(--bg-3)',
                          color: rewardUnlocked ? 'var(--text)' : isBoss ? theme.accent : 'var(--muted)',
                        }}>
                          {rewardUnlocked ? `${reward.icon} ${reward.name} (unlocked)` : `🎁 Reward: ${reward.icon} ${reward.name}`}
                        </span>
                      </div>
                      {!rewardUnlocked && missingClear.length > 0 && (
                        <div className="muted small" style={{ fontSize: 11, fontStyle: 'italic', lineHeight: 1.4 }}>
                          Not unlocked for everyone — {missingClear.join(', ')} still need{missingClear.length === 1 ? 's' : ''} to clear this level.
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div style={{ flex: '0 0 auto' }}>
                  {unlocked ? (
                    <span className="pill" style={{ background: theme.accent, color: '#04150a' }}>Play</span>
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
