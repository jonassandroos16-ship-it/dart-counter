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

export interface PostGameInfo {
  chapterId: string;
  levelId: number;
  stats: CampaignBattleState['stats'];
  rewardPowerUpId: string | null;
  coopXpGained?: number;
  levelUps?: LevelUpInfo[];
}

// Always shown after a Coop campaign level is cleared. Displays the level
// name, a "DEFEATED" callout, the battle stats (visits, darts, damage,
// enemies defeated, power-ups used, party HP lost), and a short story
// beat. If the level granted a new power-up, the power-up card is shown
// below the stats. If this was the chapter's boss, the chapter outro is
// shown as the story beat.
export function PostGameOverlay({
  chapter, levelName, isBoss, stats, rewardPowerUp, chapterComplete, coopXpGained, levelUps, players, onContinue,
}: {
  chapter: CampaignChapter | null;
  levelName: string;
  isBoss: boolean;
  stats: CampaignBattleState['stats'];
  rewardPowerUp: { name: string; icon: string; desc: string; tier: 'starter' | 'advanced' } | null;
  chapterComplete: boolean;
  coopXpGained?: number;
  levelUps?: LevelUpInfo[];
  players: Player[];
  onContinue: () => void;
}) {
  const theme = chapter?.theme;
  const accent = theme?.accent || 'var(--accent)';
  const bg = theme?.background || 'var(--bg)';
  const storyBit = isBoss
    ? chapter?.story.outro
    : chapter?.levels.find(l => l.name === levelName)?.story_bit;
  return (
    <div className="battle-overlay-bg" style={{ alignItems: 'center', justifyContent: 'center', background: `rgba(0,0,0,.65)` }}>
      <div className="battle-overlay" style={{ maxWidth: 440, padding: 20, background: `linear-gradient(180deg, ${bg} 0%, var(--bg-2) 100%)` }} onClick={(e) => e.stopPropagation()}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.18em', color: accent, textTransform: 'uppercase' }}>
            {chapter?.name}
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, marginTop: 4 }}>{levelName}</div>
          <div style={{
            margin: '10px auto 6px',
            width: 80, height: 80, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 40,
            background: `radial-gradient(circle at 30% 30%, color-mix(in srgb, ${accent} 45%, var(--bg-3)) 0%, var(--bg-3) 80%)`,
            border: `2px solid ${accent}`,
            boxShadow: `0 0 18px color-mix(in srgb, ${accent} 45%, transparent)`,
          }}>
            {isBoss ? '☠' : '✓'}
          </div>
          <div style={{ fontSize: 16, fontWeight: 900, color: accent, letterSpacing: '.04em' }}>
            DEFEATED
          </div>
        </div>

        <div className="card" style={{ padding: 12, marginTop: 14, background: 'var(--bg-3)' }}>
          <div className="muted small" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 8 }}>Battle stats</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <Stat label="Visits" value={stats.visitsUsed} />
            <Stat label="Darts" value={stats.dartsThrown} />
            <Stat label="Damage" value={stats.damageDealt} />
            <Stat label="Enemies" value={stats.enemiesDefeated} />
            <Stat label="Power-ups" value={stats.powerUpsUsed} />
            <Stat label="HP lost" value={stats.partyHpLost} />
          </div>
        </div>

        {rewardPowerUp && (
          <div className="card" style={{ marginTop: 12, padding: 14, background: `color-mix(in srgb, ${accent} 14%, var(--bg-3))`, borderColor: `color-mix(in srgb, ${accent} 50%, var(--border))` }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.14em', color: accent, textTransform: 'uppercase', marginBottom: 6 }}>
              {isBoss ? 'Boss Reward Unlocked' : 'New Power-Up Unlocked'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ fontSize: 32 }}>{rewardPowerUp.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 900, fontSize: 16 }}>{rewardPowerUp.name}</div>
                <div className="muted small" style={{ marginTop: 2, lineHeight: 1.4 }}>{rewardPowerUp.desc}</div>
              </div>
            </div>
            <div className="muted small" style={{ marginTop: 8, fontStyle: 'italic' }}>
              Equip it from Players → Power-Ups → Coop section.
            </div>
          </div>
        )}

        {coopXpGained != null && coopXpGained > 0 && (
          <div className="card" style={{ marginTop: 12, padding: 12, background: 'var(--bg-3)' }}>
            <div className="row" style={{ gap: 10, alignItems: 'center' }}>
              <div style={{ fontSize: 26 }}>✨</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: 14 }}>+{coopXpGained} XP earned</div>
                <div className="muted small" style={{ marginTop: 2, lineHeight: 1.4 }}>Each party member gained unified XP toward leveling up. Level up to unlock new cards and class passives.</div>
              </div>
            </div>
          </div>
        )}

        {levelUps && levelUps.length > 0 && (
          <div className="card" style={{ marginTop: 12, padding: 14, background: `color-mix(in srgb, ${accent} 14%, var(--bg-3))`, borderColor: `color-mix(in srgb, ${accent} 50%, var(--border))` }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.14em', color: accent, textTransform: 'uppercase', marginBottom: 8 }}>
              Level Up!
            </div>
            {levelUps.map(lu => {
              const pl = players.find(p => p.id === lu.playerId);
              return (
                <div key={lu.playerId} style={{ marginBottom: 10 }}>
                  <div style={{ fontWeight: 800, fontSize: 14 }}>
                    {pl?.name || 'Player'} reached Level {lu.newLevel}
                  </div>
                  {lu.newCards.length > 0 && (
                    <div style={{ marginTop: 6 }}>
                      <div className="muted small" style={{ fontWeight: 700, marginBottom: 4 }}>New cards unlocked:</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {lu.newCards.map(c => (
                          <div key={c.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '6px 8px', borderRadius: 8, background: 'var(--bg-3)', border: '1px solid var(--border)', minWidth: 56 }}>
                            <span style={{ fontSize: 20 }}>{c.icon}</span>
                            <span style={{ fontSize: 10, fontWeight: 800, textAlign: 'center' }}>{c.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {lu.newPassives.length > 0 && (
                    <div className="muted small" style={{ marginTop: 4 }}>{lu.newPassives.length} new class passive{lu.newPassives.length > 1 ? 's' : ''} unlocked — check Players → Class.</div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {storyBit && (
          <div className="muted" style={{ marginTop: 14, fontSize: 13, lineHeight: 1.55, fontStyle: 'italic', textAlign: 'center' }}>
            {storyBit}
          </div>
        )}

        {chapterComplete && (
          <div className="pill" style={{ marginTop: 12, display: 'inline-flex', alignSelf: 'center', background: accent, color: '#04150a', borderColor: 'transparent' }}>
            Chapter complete
          </div>
        )}

        <button className="btn primary block" style={{ marginTop: 16 }} onClick={onContinue}>
          Continue
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontWeight: 900, fontSize: 18 }}>{value}</div>
      <div className="muted small" style={{ marginTop: 2 }}>{label}</div>
    </div>
  );
}
