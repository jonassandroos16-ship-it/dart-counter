import { useState, useEffect } from 'react';
import type { Player } from '../types';
import { initials } from '../store';
import type { DartliteRun } from './engine';
import type { TrinketId } from './trinkets';
import { getTrinket } from './trinkets';
import { BOSS_VICTORY_STORIES } from './bossStories';

interface Props {
  run: DartliteRun;
  players: Player[];
  onPick: (trinketId: TrinketId) => void;
  /** When false (multiplayer non-owner), show a read-only waiting state. */
  canChoose?: boolean;
}

export function BossVictoryScreen({ run, players, onPick, canChoose = true }: Props) {
  const [picked, setPicked] = useState<TrinketId | null>(null);
  const [showStory, setShowStory] = useState(true);
  const [storyText, setStoryText] = useState('');

  useEffect(() => {
    if (!run.bossVictory) return;
    const story = BOSS_VICTORY_STORIES[Math.floor(Math.random() * BOSS_VICTORY_STORIES.length)];
    setStoryText(story.replace('{name}', run.bossVictory.bossName));
  }, []);

  if (!run.bossVictory) return null;
  const { bossName, trinketOptions } = run.bossVictory;

  // Boss story / drop reveal popup shown first
  if (showStory) {
    return (
      <div className="view-scroll" style={{
        background: 'radial-gradient(ellipse at top, color-mix(in srgb,#f59e0b 22%,var(--bg)) 0%, var(--bg) 70%)',
        minHeight: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div className="card" style={{ maxWidth: 520, margin: '0 auto', textAlign: 'center', border: '2px solid #f59e0b' }}>
          <div style={{ fontSize: 56, marginBottom: 8 }}>🏆</div>
          <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: '.14em', color: '#fbbf24', textTransform: 'uppercase' }}>
            Boss Slain
          </div>
          <div style={{ fontSize: 26, fontWeight: 900, marginTop: 6, color: '#f59e0b' }}>{bossName}</div>
          <div style={{ marginTop: 16, fontSize: 15, lineHeight: 1.7, color: 'var(--text)', fontStyle: 'italic', padding: '0 8px' }}>
            {storyText}
          </div>

          {/* Trinket teaser */}
          <div style={{ marginTop: 20, padding: '12px 16px', borderRadius: 12, background: 'color-mix(in srgb,#f59e0b 10%,var(--bg-3))', border: '1px solid color-mix(in srgb,#f59e0b 30%,var(--border))' }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.12em', color: '#fbbf24', textTransform: 'uppercase', marginBottom: 6 }}>
              Boss Trinket Dropped!
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
              {trinketOptions.map(tid => {
                const t = getTrinket(tid);
                return t ? (
                  <div key={tid} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 22 }}>{t.icon}</span>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>{t.name}</span>
                  </div>
                ) : null;
              })}
            </div>
            <div className="muted small" style={{ marginTop: 6 }}>Choose one to empower your run</div>
          </div>

          <button
            className="btn primary block"
            style={{ marginTop: 22, background: '#f59e0b', borderColor: '#f59e0b', color: '#0b0e13', fontWeight: 900 }}
            onClick={() => setShowStory(false)}
          >
            Claim Your Reward
          </button>
        </div>
      </div>
    );
  }

  // Trinket selection screen
  return (
    <div className="view-scroll" style={{
      background: 'radial-gradient(ellipse at top, color-mix(in srgb,#f59e0b 18%,var(--bg)) 0%, var(--bg) 70%)',
      minHeight: '100%',
    }}>
      <div className="card" style={{ maxWidth: 520, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <div style={{ fontSize: 40, marginBottom: 6 }}>🏆</div>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.14em', color: '#fbbf24', textTransform: 'uppercase' }}>Boss Trinket</div>
          <div style={{ fontSize: 22, fontWeight: 900, marginTop: 6 }}>{bossName} Defeated</div>
          <div className="muted small" style={{ marginTop: 6 }}>
            {canChoose
              ? 'The party has been healed to full. Choose a boss trinket to empower your run.'
              : 'Waiting for the host to claim a boss trinket\u2026'}
          </div>
        </div>

        <div className="muted small" style={{ fontWeight: 700, marginBottom: 8 }}>Choose Your Reward</div>
        <div style={{ display: 'grid', gap: 10 }}>
          {trinketOptions.map((id) => {
            const def = getTrinket(id);
            const isPicked = picked === id;
            if (!def) return null;
            return (
              <button key={id} className="btn block" style={{
                padding: 14, textAlign: 'left',
                background: isPicked
                  ? 'linear-gradient(135deg, color-mix(in srgb,#f59e0b 28%,var(--bg-3)) 0%, var(--bg-3) 80%)'
                  : 'var(--bg-3)',
                borderColor: isPicked ? '#f59e0b' : 'var(--border)',
                opacity: (picked && !isPicked) || !canChoose ? 0.5 : 1,
                transition: 'opacity 200ms, border-color 200ms',
                cursor: canChoose ? 'pointer' : 'default',
                pointerEvents: canChoose ? 'auto' : 'none',
              }} onClick={() => canChoose && setPicked(id)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 28 }}>{def.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: 16 }}>{def.name}</div>
                    <div className="muted small" style={{ marginTop: 2 }}>{def.desc}</div>
                  </div>
                  {isPicked && <span style={{ color: '#fbbf24', fontSize: 20, fontWeight: 900 }}>✓</span>}
                </div>
              </button>
            );
          })}
        </div>

        <button
          className="btn primary block"
          style={{ marginTop: 18, background: picked ? '#f59e0b' : undefined, borderColor: picked ? '#f59e0b' : undefined, color: picked ? '#0b0e13' : undefined }}
          disabled={!picked || !canChoose}
          onClick={() => canChoose && picked && onPick(picked)}
        >
          Claim Trinket & Continue
        </button>

        <div style={{ marginTop: 14, display: 'flex', justifyContent: 'center', gap: 6 }}>
          {run.runPlayers.map((rp) => {
            const p = players.find(x => x.id === rp.id);
            return (
              <div key={rp.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span className="avatar" style={{ background: p?.color || rp.color, width: 22, height: 22, fontSize: 10 }}>
                  {initials(p?.name || rp.name)}
                </span>
                <span className="muted small">❤️ {rp.hp}/{rp.maxHp}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
