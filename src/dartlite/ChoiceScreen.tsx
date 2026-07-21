import type { Player } from '../types';
import { initials } from '../store';
import type { DartliteRun, ChoiceOption } from './engine';

export function ChoiceScreen({ run, players, options, onPick }: { run: DartliteRun; players: Player[]; options: ChoiceOption[]; onPick: (opt: ChoiceOption) => void }) {
  const chooserIdx = run.choicePlayerIdx;
  const chooserId = run.playerIds[chooserIdx];
  const chooser = players.find(p => p.id === chooserId);
  const chooserName = chooser?.name || `Player ${chooserIdx + 1}`;
  const chooserColor = chooser?.color || '#7c3aed';

  return (
    <div className="view-scroll" style={{ background: 'radial-gradient(ellipse at top, color-mix(in srgb,#7c3aed 15%,var(--bg)) 0%, var(--bg) 70%)', minHeight: '100%' }}>
      <div className="card" style={{ maxWidth: 480, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.14em', color: '#c4b5fd', textTransform: 'uppercase' }}>Round {run.round} Cleared</div>
          <div style={{ fontSize: 22, fontWeight: 900, marginTop: 4 }}>Choose a Boon</div>
          <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 999, background: `color-mix(in srgb, ${chooserColor} 22%, var(--bg-3))`, border: `1px solid ${chooserColor}` }}>
            <span className="avatar" style={{ background: chooserColor, width: 22, height: 22, fontSize: 10 }}>{initials(chooserName)}</span>
            <span style={{ fontWeight: 800, fontSize: 14 }}>{chooserName} is choosing</span>
          </div>
          <div className="muted small" style={{ marginTop: 6 }}>
            {'Choose one boon for this round.'}
          </div>
        </div>
        <div style={{ display: 'grid', gap: 10 }}>
          {options.map((opt, i) => (
            <button key={i} className="btn block" style={{ padding: 14, textAlign: 'left', background: `linear-gradient(135deg, color-mix(in srgb, ${chooserColor} 18%, var(--bg-3)) 0%, var(--bg-3) 80%)`, borderColor: `color-mix(in srgb, ${chooserColor} 40%, var(--border))` }}
              onClick={() => onPick(opt)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 26 }}>{opt.icon}</span>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>{opt.label}</div>
                  <div className="muted small" style={{ marginTop: 2 }}>{opt.desc}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
