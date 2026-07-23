import type { Player } from '../types';
import type { DartliteRun } from './engine';
import type { ChoiceOption } from './engine';
import { getTrinket } from './trinkets';
import { initials } from '../store';

export function RewardRevealOverlay({
  run, players, onContinue,
}: {
  run: DartliteRun;
  players: Player[];
  onContinue: () => void;
}) {
  const choosers = run.playerIds.map((pid, i) => {
    const p = players.find(pl => pl.id === pid);
    const choice = run.playerChoices[i];
    const trinket = choice?.trinketId ? getTrinket(choice.trinketId) : null;
    return { name: p?.name || `Player ${i + 1}`, color: p?.color || '#7c3aed', choice, trinket };
  }).filter(c => c.choice);

  if (!choosers.length && run.bossVictory && run.bossVictory.claimedTrinket) {
    const t = getTrinket(run.bossVictory.claimedTrinket);
    if (t) {
      return (
        <div onClick={onContinue}
          style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.82)', cursor: 'pointer' }}>
          <div style={{ textAlign: 'center', maxWidth: 440, padding: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.14em', color: '#fbbf24', textTransform: 'uppercase' }}>Boss Trinket Claimed</div>
            <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 12, background: 'color-mix(in srgb,#f59e0b 18%, var(--bg-3))', border: '1px solid #f59e0b' }}>
              <span style={{ fontSize: 28 }}>{t.icon}</span>
              <div style={{ textAlign: 'left', flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{t.name}</div>
                <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{t.desc}</div>
              </div>
            </div>
            <div className="muted small" style={{ marginTop: 28, fontStyle: 'italic' }}>Tap anywhere to continue</div>
          </div>
        </div>
      );
    }
  }

  if (!choosers.length) return null;

  return (
    <div onClick={onContinue}
      style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.82)', cursor: 'pointer' }}>
      <div style={{ textAlign: 'center', maxWidth: 440, padding: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.14em', color: '#c4b5fd', textTransform: 'uppercase' }}>Rewards Chosen</div>
        <div style={{ marginTop: 16, display: 'grid', gap: 12 }}>
          {choosers.map((c, i) => {
            const icon = c.trinket ? c.trinket.icon : c.choice!.icon;
            const label = c.trinket ? c.trinket.name : c.choice!.label;
            const desc = c.trinket ? c.trinket.desc : c.choice!.desc;
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 12, background: `color-mix(in srgb, ${c.color} 18%, var(--bg-3))`, border: `1px solid ${c.color}` }}>
                <span className="avatar" style={{ background: c.color, width: 24, height: 24, fontSize: 11 }}>{initials(c.name)}</span>
                <span style={{ fontWeight: 800, fontSize: 14, minWidth: 64, textAlign: 'left' }}>{c.name}</span>
                <span style={{ fontSize: 28 }}>{icon}</span>
                <div style={{ textAlign: 'left', flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{label}</div>
                  <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{desc}</div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="muted small" style={{ marginTop: 28, fontStyle: 'italic' }}>Tap anywhere to continue</div>
      </div>
    </div>
  );
}
