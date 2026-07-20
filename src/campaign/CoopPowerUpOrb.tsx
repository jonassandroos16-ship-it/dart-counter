import { useState } from 'react';
import type { CoopPowerUpDef } from './types';
import { Modal } from '../Popups';

export function CoopPowerUpOrb({ charge, pu, canActivate, onActivate }: {
  charge: number;
  pu: CoopPowerUpDef | null;
  canActivate: boolean;
  onActivate: () => void;
}) {
  const [open, setOpen] = useState(false);
  const cap = 100;
  const clamped = Math.max(0, Math.min(cap, charge));
  const pct = Math.round((clamped / cap) * 100);
  const ready = canActivate && !!pu;
  const chargedButWaiting = !!pu && clamped >= (pu.cost || cap) && !canActivate;
  const R = 22;
  const C = 2 * Math.PI * R;
  const dash = C * (pct / 100);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title={pu ? `${pu.name} (${pct}% charged)` : 'No coop power-up equipped'}
        className={chargedButWaiting ? 'pu-orb-charged-waiting' : undefined}
        style={{
          position: 'relative', width: 52, height: 52, borderRadius: '50%',
          background: ready || chargedButWaiting ? 'color-mix(in srgb,var(--accent) 18%,var(--bg-3))' : 'var(--bg-3)',
          border: `2px solid ${ready || chargedButWaiting ? 'var(--accent)' : 'var(--border)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', padding: 0, color: 'inherit', flex: '0 0 auto',
          boxShadow: ready || chargedButWaiting ? '0 0 12px color-mix(in srgb,var(--accent) 50%,transparent)' : 'none',
          transition: 'box-shadow .2s, border-color .2s',
        }}
      >
        <svg width="52" height="52" viewBox="0 0 52 52" style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
          <circle cx="26" cy="26" r={R} fill="none" stroke="var(--border)" strokeWidth="3" />
          <circle cx="26" cy="26" r={R} fill="none"
            stroke={ready ? 'var(--accent)' : 'color-mix(in srgb,var(--accent) 60%,var(--bg-3))'}
            strokeWidth="3" strokeDasharray={`${dash} ${C}`} strokeLinecap="round"
            style={{ transition: 'stroke-dasharray .4s ease' }} />
        </svg>
        <span style={{ fontSize: 20, zIndex: 1 }}>{pu ? pu.icon : '🔒'}</span>
        <span style={{ position: 'absolute', bottom: -3, right: -3, fontSize: 9, fontWeight: 800, padding: '1px 5px', borderRadius: 8, background: ready ? 'var(--accent)' : 'var(--bg-2)', color: ready ? '#04150a' : 'var(--muted)', border: '1px solid var(--border)' }}>{pct}%</span>
      </button>
      {open && pu ? (
        <Modal onClose={() => setOpen(false)}>
          <div style={{ textAlign: 'center', padding: 8 }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>{pu.icon}</div>
            <h3 style={{ margin: '0 0 6px' }}>{pu.name}</h3>
            <div className="muted" style={{ fontSize: 13, lineHeight: 1.4, marginBottom: 12, maxWidth: 280 }}>{pu.desc}</div>
            <div className="muted small" style={{ marginBottom: 12 }}>
              {ready ? `Fully charged — ready to activate! (Costs ${pu.cost} charge.)` : `${pct}% charged — need ${pu.cost} to activate. Land doubles, triples and bulls to charge.`}
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
