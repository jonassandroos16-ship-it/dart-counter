import { useState, useEffect, useRef } from 'react';
import type { Player } from '../types';
import { initials } from '../store';
import { Modal } from '../Popups';
import { getCoopPowerUp } from './engine';

export function CoopChargedPlayerIcon({
  player,
  players,
  canActivate,
  onActivate,
}: {
  player: { id: string; name: string; color: string; powerUpCharge: number };
  players: Player[];
  canActivate: boolean;
  onActivate: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [gainAnim, setGainAnim] = useState(false);
  const prevChargeRef = useRef<number>(0);

  const srcPlayer = players.find(p => p.id === player.id);
  const equippedId = srcPlayer?.powerUps?.coopActive ?? null;
  const pu = equippedId ? getCoopPowerUp(equippedId as any) : null;
  if (!pu) return null;

  const cap = 100;
  const clamped = Math.max(0, Math.min(cap, player.powerUpCharge));
  const pct = Math.round((clamped / cap) * 100);
  const ready = canActivate && !!pu;
  const chargedButWaiting = !!pu && clamped >= (pu.cost || cap) && !canActivate;

  useEffect(() => {
    if (clamped > prevChargeRef.current) {
      setGainAnim(true);
      const t = setTimeout(() => setGainAnim(false), 450);
      prevChargeRef.current = clamped;
      return () => clearTimeout(t);
    }
    prevChargeRef.current = clamped;
  }, [clamped]);

  const size = 36;
  const R = 20;
  const C = 2 * Math.PI * R;
  const dash = C * (pct / 100);

  return (
    <>
      <div className="pu-charge-wrap">
        <div
          className={`pu-charge-ring${ready ? ' ready' : ''}${gainAnim ? ' pu-charge-gain' : ''}`}
          onClick={() => { if (ready) { onActivate(); } else { setOpen(true); } }}
          title={pu ? `${pu.name} (${pct}% charged${chargedButWaiting ? ' — throw a dart to activate' : ''})` : 'No power-up equipped'}
          style={{ width: size, height: size }}
        >
          <svg width={size} height={size} viewBox="0 0 52 52" style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
            <circle cx="26" cy="26" r={R + 2} fill="none" stroke="var(--border)" strokeWidth="2" />
            <circle cx="26" cy="26" r={R} fill="none"
              stroke={ready || chargedButWaiting ? 'var(--accent)' : 'color-mix(in srgb,var(--accent) 60%,var(--bg-3))'}
              strokeWidth="2.5" strokeDasharray={`${dash} ${C}`} strokeLinecap="round"
              style={{ transition: 'stroke-dasharray .4s ease, stroke .2s ease' }} />
          </svg>
          <span className="avatar" style={{ width: 28, height: 28, fontSize: 13, background: player.color, borderRadius: '50%' }}>{initials(player.name)}</span>
          {pu && <span className="pu-charge-icon">{pu.icon}</span>}
        </div>
        <span className={`pu-charge-pct${ready || chargedButWaiting ? ' ready' : ''}`}>{pct}%</span>
      </div>
      {open && pu ? (
        <Modal onClose={() => setOpen(false)}>
          <div style={{ textAlign: 'center', padding: 8 }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>{pu.icon}</div>
            <h3 style={{ margin: '0 0 6px' }}>{pu.name}</h3>
            <div className="muted" style={{ fontSize: 13, lineHeight: 1.4, marginBottom: 12, maxWidth: 280 }}>{pu.desc}</div>
            <div className="muted small" style={{ marginBottom: 12 }}>
              {ready ? `Fully charged — ready to activate! (Costs ${pu.cost} charge.)` : chargedButWaiting ? 'Fully charged — throw at least one dart this visit to activate.' : `${pct}% charged — need ${pu.cost} to activate. Land doubles, triples and bulls to charge.`}
            </div>
            <div className="row" style={{ gap: 8, justifyContent: 'center' }}>
              <button className="btn ghost" onClick={() => setOpen(false)}>Close</button>
              <button className="btn primary" disabled={!ready} onClick={() => { setOpen(false); onActivate(); }}>Use Power-Up</button>
            </div>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
