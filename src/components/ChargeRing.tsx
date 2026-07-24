import { useState, useEffect, useRef } from 'react';

export interface ChargeRingProps {
  /** Current charge value (0..cap) */
  charge: number;
  /** Maximum charge value (the fill target) */
  cap: number;
  /** Whether the power-up is ready to activate */
  ready: boolean;
  /** Whether the power-up is fully charged but waiting for a precondition (e.g. throw a dart) */
  chargedButWaiting: boolean;
  /** Icon emoji to show in the corner of the ring */
  icon?: string;
  /** Tooltip text */
  title: string;
  /** Size of the ring in px (default 36) */
  size?: number;
  /** Avatar content — rendered inside the ring */
  children: React.ReactNode;
  /** Called when the ring is tapped while ready */
  onActivate: () => void;
  /** Called when the ring is tapped while not ready (e.g. open info modal) */
  onInfo: () => void;
}

export function ChargeRing({
  charge,
  cap,
  ready,
  chargedButWaiting,
  icon,
  title,
  size = 36,
  children,
  onActivate,
  onInfo,
}: ChargeRingProps) {
  const [gainAnim, setGainAnim] = useState(false);
  const prevChargeRef = useRef<number>(0);

  const clamped = Math.max(0, Math.min(cap, charge));
  const pct = cap > 0 ? Math.round((clamped / cap) * 100) : 0;

  useEffect(() => {
    if (clamped > prevChargeRef.current) {
      setGainAnim(true);
      const t = setTimeout(() => setGainAnim(false), 450);
      prevChargeRef.current = clamped;
      return () => clearTimeout(t);
    }
    prevChargeRef.current = clamped;
  }, [clamped]);

  const R = 20;
  const C = 2 * Math.PI * R;
  const dash = C * (pct / 100);

  return (
    <div className="pu-charge-wrap">
      <div
        className={`pu-charge-ring${ready ? ' ready' : ''}${gainAnim ? ' pu-charge-gain' : ''}`}
        onClick={() => { if (ready) { onActivate(); } else { onInfo(); } }}
        title={title}
        style={{ width: size, height: size }}
      >
        <svg width={size} height={size} viewBox="0 0 52 52" style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
          <circle cx="26" cy="26" r={R + 2} fill="none" stroke="var(--border)" strokeWidth="2" />
          <circle cx="26" cy="26" r={R} fill="none"
            stroke={ready || chargedButWaiting ? 'var(--accent)' : 'color-mix(in srgb,var(--accent) 60%,var(--bg-3))'}
            strokeWidth="2.5" strokeDasharray={`${dash} ${C}`} strokeLinecap="round"
            style={{ transition: 'stroke-dasharray .4s ease, stroke .2s ease' }} />
        </svg>
        {children}
        {icon && <span className="pu-charge-icon">{icon}</span>}
      </div>
      <span className={`pu-charge-pct${ready || chargedButWaiting ? ' ready' : ''}`}>{pct}%</span>
    </div>
  );
}
