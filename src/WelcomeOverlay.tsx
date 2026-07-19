import { useState } from 'react';

export function WelcomeOverlay({ onDone }: { onDone?: () => void }) {
  const [gone, setGone] = useState(false);
  const [hidden, setHidden] = useState(false);

  const dismiss = () => {
    setGone(true);
    setTimeout(() => { setHidden(true); onDone?.(); }, 700);
  };

  if (hidden) return null;

  return (
    <div className={`welcome-overlay ${gone ? 'welcome-gone' : ''}`}>
      <div className="welcome-stage">
        <div className="welcome-rings" aria-hidden>
          <span className="ring r1" />
          <span className="ring r2" />
          <span className="ring r3" />
        </div>
        <div className="welcome-burst" aria-hidden>
          {Array.from({ length: 14 }).map((_, i) => (
            <span key={i} className="spark" style={{ ['--i' as any]: i }} />
          ))}
        </div>
        <h1 className="welcome-title">
          <span className="word w1">Dart</span>
          <span className="word w2">Wars</span>
        </h1>
        <p className="welcome-sub">Aim. Score. Conquer.</p>
        <button className="welcome-cta" onClick={dismiss}>
          <span className="welcome-cta-inner">Press to continue</span>
        </button>
      </div>
    </div>
  );
}
