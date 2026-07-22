import { useState } from 'react';
import type { Game, GameRecord, Player, Settings } from '../types';
import { getPowerUpInfo } from '../powerups';
import { getBadgeInfo, getBadgeContext, buildCoopBadgeCtx } from '../badges';
import { getPlayerXPById, effectiveAttributes } from '../logic';
import { initials } from '../store';
import { Modal } from '../Popups';
import { chargesNeededFor } from './powerups';

// Avatar that shows the player's equipped badge icon (if any) and, when the
// player has "show badge context" enabled, a small overlay pill with the
// lifetime context value. Used across all game boards so the badge context
// is visible everywhere the profile icon appears, not just in PlayersView.
export function BadgeAvatar({ playerId, players, games, size = 32, fontSize, color, shape = 'circle' }: {
  playerId: string; players: Player[]; games?: GameRecord[]; size?: number; fontSize?: number; color: string;
  shape?: 'circle' | 'square';
}) {
  const xp = getPlayerXPById(playerId, players);
  const bi = getBadgeInfo(xp.selectedBadge);
  const ctx = xp.showBadgeContext && games ? getBadgeContext(xp.selectedBadge, playerId, games as any, buildCoopBadgeCtx()) : null;
  const content = bi ? bi.icon : initials(players.find(p => p.id === playerId)?.name || '');
  const radius = shape === 'circle' ? '50%' : '6px';
  return (
    <div style={{ position: 'relative', width: size, height: size, flex: '0 0 auto' }}>
      <span
        className="avatar"
        style={{ width: size, height: size, fontSize: fontSize ?? (bi ? Math.max(12, size * 0.5) : undefined), background: color, borderRadius: radius }}
      >{content}</span>
      {ctx ? (
        <span
          title={`${ctx.label}: ${ctx.value}`}
          style={{
            position: 'absolute', bottom: -3, right: -3, minWidth: Math.max(16, size * 0.5), height: Math.max(14, size * 0.45),
            padding: '0 4px', borderRadius: 999, background: 'var(--accent)', color: '#04150a',
            fontSize: Math.max(8, Math.round(size * 0.32)), fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid var(--bg-2)', lineHeight: 1, boxSizing: 'border-box',
          }}
        >{ctx.value}</span>
      ) : null}
    </div>
  );
}


export function PowerUpOrb({ game, curIdx, settings, onActivate }: { game: Game; curIdx: number; settings: Settings; onActivate: () => void; toast: (m: string) => void }) {
  const [open, setOpen] = useState(false);
  if (!game.powerUpsEnabled) return null;
  const pl = game.players[curIdx];
  if (!pl) return null;
  const pu = getPowerUpInfo(pl.powerUpId);
  const needed = chargesNeededFor(pl.powerUpId, settings);
  const charge = Math.min(needed, pl.powerUpCharge || 0);
  const pct = needed > 0 ? Math.round((charge / needed) * 100) : 0;
  const ready = charge >= needed && !!pu && game.darts.length > 0;
  const chargedButWaiting = charge >= needed && !!pu && game.darts.length === 0;
  const uses = pl.powerUpUses || 0;
  const R = 22;
  const C = 2 * Math.PI * R;
  const dash = C * (pct / 100);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title={pu ? `${pu.name} (${pct}% charged${chargedButWaiting ? ' — throw a dart to activate' : ''})` : 'No power-up equipped'}
        className={chargedButWaiting ? 'pu-orb-charged-waiting' : undefined}
        style={{
          position: 'relative', width: 52, height: 52, borderRadius: '50%',
          background: ready || chargedButWaiting ? 'color-mix(in srgb,var(--accent) 18%,var(--bg-3))' : 'var(--bg-3)',
          border: `2px solid ${ready || chargedButWaiting ? 'var(--accent)' : 'var(--border)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', padding: 0, color: 'inherit',
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
              {ready ? `Fully charged — ready to activate!${uses ? ` (Used ${uses}× this match.)` : ''}` : chargedButWaiting ? 'Fully charged — throw at least one dart this visit to activate.' : `${pct}% charged — keep hitting doubles, triples and bulls to charge.${uses ? ` (Used ${uses}× this match.)` : ''}`}
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

export function AttributeStrip({ playerId, players, mode, settings }: { playerId: string; players: Player[]; mode: string; settings: Settings }) {
  if (mode !== 'battle') return null;
  const player = players.find(p => p.id === playerId);
  if (!player) return null;
  const attrs = effectiveAttributes(player, settings);
  if (!attrs) return null;
  return (
    <div className="row wrap" style={{ gap: 4, marginTop: 2 }}>
      <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--muted)' }}>❤️ {attrs.health}</span>
      <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--muted)' }}>🛡️ {attrs.armor}%</span>
      <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--muted)' }}>⚡ {attrs.power}%</span>
    </div>
  );
}
