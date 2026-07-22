import type { CampaignChapter } from '../campaign/types';
import type { CampaignBattleState } from '../campaign/types';
import type { Player } from '../types';

export interface LevelUpInfo {
  playerId: string;
  oldLevel: number;
  newLevel: number;
  newCards: { id: string; name: string; icon: string }[];
  newPassives: string[];
}

export interface XpAwardInfo {
  playerId: string;
  classId: string;
  className: string;
  classIcon: string;
  xpGained: number;
  newLevel: number;
}

export interface PostGameInfo {
  chapterId: string;
  levelId: number;
  stats: CampaignBattleState['stats'];
  rewardPowerUpId: string | null;
  coopXpGained?: number;
  xpAwards?: XpAwardInfo[];
  levelUps?: LevelUpInfo[];
}

// Always shown after a Coop campaign level is cleared. Displays the level
// name, a "DEFEATED" callout, the battle stats (visits, darts, damage,
// enemies defeated, power-ups used, party HP lost), and a short story
// beat. If the level granted a new power-up, the power-up card is shown
// below the stats. If this was the chapter's boss, the chapter outro is
// shown as the story beat.
export function PostGameOverlay({
  chapter, levelName, isBoss, stats, rewardPowerUp, chapterComplete, coopXpGained, xpAwards, levelUps, players, onContinue,
}: {
  chapter: CampaignChapter | null;
  levelName: string;
  isBoss: boolean;
  stats: CampaignBattleState['stats'];
  rewardPowerUp: { name: string; icon: string; desc: string; tier: 'starter' | 'advanced' } | null;
  chapterComplete: boolean;
  coopXpGained?: number;
  xpAwards?: XpAwardInfo[];
  levelUps?: LevelUpInfo[];
  players: Player[];
  onContinue: () => void;
}) {
  const theme = chapter?.theme;
  const accent = theme?.accent || 'var(--accent)';
  const storyBit = isBoss
    ? chapter?.story.outro
    : chapter?.levels.find(l => l.name === levelName)?.story_bit;
  return (
    <div className="battle-overlay-bg" style={{ alignItems: 'center', justifyContent: 'center', background: `rgba(0,0,0,.65)` }}>
      <div className="card" style={{ maxWidth: 480, width: '90%', maxHeight: '85vh', overflowY: 'auto', borderColor: accent }}>
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: accent, letterSpacing: 2, textTransform: 'uppercase' }}>Level Cleared</div>
          <h2 style={{ marginTop: 4 }}>{levelName}</h2>
          {isBoss && <div style={{ fontSize: 32, marginTop: 4 }}>👑</div>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
          <Stat label="Visits" value={stats.visitsUsed} />
          <Stat label="Darts" value={stats.dartsThrown} />
          <Stat label="Damage" value={stats.damageDealt} />
          <Stat label="Enemies" value={stats.enemiesDefeated} />
          <Stat label="Power-ups" value={stats.powerUpsUsed} />
          <Stat label="HP Lost" value={stats.partyHpLost} />
        </div>

        {coopXpGained != null && coopXpGained > 0 && (
          <div className="card" style={{ marginTop: 12, padding: 12, background: 'var(--bg-3)' }}>
            <div className="row" style={{ gap: 10, alignItems: 'center', marginBottom: xpAwards && xpAwards.length > 0 ? 10 : 0 }}>
              <div style={{ fontSize: 26 }}>✨</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: 14 }}>+{coopXpGained} XP earned</div>
                <div className="muted small" style={{ marginTop: 2, lineHeight: 1.4 }}>Each party member gained XP toward their class progression. Level up to unlock new cards and class passives.</div>
              </div>
            </div>
            {xpAwards && xpAwards.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {xpAwards.map(xa => {
                  const pl = players.find(p => p.id === xa.playerId);
                  return (
                    <div key={xa.playerId} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', background: 'var(--bg-2)', borderRadius: 6 }}>
                      <span style={{ fontSize: 18 }}>{xa.classIcon}</span>
                      <span style={{ flex: 1, fontWeight: 700, fontSize: 13 }}>{pl?.name || 'Player'} → {xa.className}</span>
                      <span style={{ fontWeight: 900, fontSize: 14, color: 'var(--accent)' }}>+{xa.xpGained} XP</span>
                      <span className="muted small">Lv {xa.newLevel}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {levelUps && levelUps.length > 0 && (
          <div className="card" style={{ marginTop: 12, padding: 12, background: 'var(--bg-3)' }}>
            <h3 style={{ marginBottom: 8, fontSize: 16 }}>📈 Level Up!</h3>
            {levelUps.map(lu => {
              const pl = players.find(p => p.id === lu.playerId);
              return (
                <div key={lu.playerId} style={{ marginBottom: 10 }}>
                  <div style={{ fontWeight: 800, fontSize: 14 }}>{pl?.name || 'Player'} → Level {lu.newLevel}</div>
                  {lu.newCards.length > 0 && (
                    <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {lu.newCards.map(c => (
                        <span key={c.id} style={{ padding: '2px 8px', background: 'var(--bg-2)', borderRadius: 4, fontSize: 12 }}>{c.icon} {c.name}</span>
                      ))}
                    </div>
                  )}
                  {lu.newPassives.length > 0 && (
                    <div style={{ marginTop: 4, fontSize: 12, color: 'var(--accent)' }}>New passives unlocked!</div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {rewardPowerUp && (
          <div className="card" style={{ marginTop: 12, padding: 12, background: 'var(--bg-3)', borderColor: accent }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: accent, marginBottom: 6 }}>🎁 Reward Unlocked</div>
            <div className="row" style={{ gap: 10, alignItems: 'center' }}>
              <div style={{ fontSize: 28 }}>{rewardPowerUp.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: 14 }}>{rewardPowerUp.name}</div>
                <div className="muted small" style={{ marginTop: 2 }}>{rewardPowerUp.desc}</div>
              </div>
            </div>
          </div>
        )}

        {storyBit && (
          <div style={{ marginTop: 12, padding: 12, background: 'var(--bg-3)', borderRadius: 8, borderLeft: `3px solid ${accent}`, fontSize: 14, lineHeight: 1.6, fontStyle: 'italic' }}>
            {storyBit}
          </div>
        )}

        {chapterComplete && (
          <div style={{ marginTop: 12, textAlign: 'center', padding: 12, background: 'var(--bg-3)', borderRadius: 8 }}>
            <div style={{ fontSize: 28, marginBottom: 4 }}>🎉</div>
            <div style={{ fontWeight: 800, fontSize: 16 }}>Chapter Complete!</div>
          </div>
        )}

        <button onClick={onContinue} style={{ marginTop: 16, width: '100%' }}>Continue</button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ padding: 8, background: 'var(--bg-3)', borderRadius: 6, textAlign: 'center' }}>
      <div className="muted small">{label}</div>
      <div style={{ fontWeight: 800, fontSize: 18 }}>{value}</div>
    </div>
  );
}
