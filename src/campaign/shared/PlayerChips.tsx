import { useState } from 'react';
import type { CampaignBattleState, CoopPlayer, CoopPowerUpId } from '../types';
import type { Player } from '../../types';
import { initials } from '../../store';
import { effectivePower } from '../engine/playerTurn';
import { PartyBuffBadges } from '../../cards/BuffBadges';
import { getCoopPowerUp, canActivateCoopPowerUp } from '../engine';
import { ChargeRing } from '../../components/ChargeRing';
import { Modal } from '../../Popups';

export interface PlayerChipExtra {
  icon?: string;
  iconTitle?: string;
  badge?: { label: string; title: string };
}

export interface PlayerChipsProps {
  state: CampaignBattleState;
  players: Player[];
  onPlayerClick?: (playerId: string) => void;
  playerClickTitle?: string;
  extras?: Record<string, PlayerChipExtra>;
  /** Called when a player activates their coop power-up from the chip. */
  onActivatePowerUp?: (id: CoopPowerUpId) => void;
}

export function PlayerChips({ state, players, onPlayerClick, playerClickTitle, extras, onActivatePowerUp }: PlayerChipsProps) {
  const [infoPlayer, setInfoPlayer] = useState<string | null>(null);

  const { infoPu, infoReady, infoChargedButWaiting, infoCharge } = (() => {
    if (!infoPlayer) return { infoPu: null, infoReady: false, infoChargedButWaiting: false, infoCharge: 0 };
    const p = state.players.find(pl => pl.id === infoPlayer);
    if (!p) return { infoPu: null, infoReady: false, infoChargedButWaiting: false, infoCharge: 0 };
    const srcPlayer = players.find(sp => sp.id === p.id);
    const equippedId = srcPlayer?.powerUps?.coopActive ?? null;
    const pu = equippedId ? getCoopPowerUp(equippedId as CoopPowerUpId) : null;
    if (!pu) return { infoPu: null, infoReady: false, infoChargedButWaiting: false, infoCharge: 0 };
    const can = canActivateCoopPowerUp(state, pu.id);
    return { infoPu: pu, infoReady: can, infoChargedButWaiting: p.powerUpCharge >= (pu.cost || 100) && !can, infoCharge: p.powerUpCharge };
  })();

  return (
    <>
      <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
        {state.players.map((p: CoopPlayer, i: number) => {
          const isThrower = state.phase === 'player' && i === state.playerTurnIdx;
          const extra = extras?.[p.id];
          const srcPlayer = players.find(sp => sp.id === p.id);
          const equippedId = srcPlayer?.powerUps?.coopActive ?? null;
          const pu = equippedId ? getCoopPowerUp(equippedId as CoopPowerUpId) : null;
          const can = pu ? canActivateCoopPowerUp(state, pu.id) : false;
          const ready = can && !!pu;
          const chargedButWaiting = !!pu && p.powerUpCharge >= (pu.cost || 100) && !can;
          const showRing = !!pu && isThrower;

          return (
            <div
              key={p.id}
              onClick={onPlayerClick ? () => onPlayerClick(p.id) : undefined}
              title={playerClickTitle}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '4px 8px', borderRadius: 999,
                background: isThrower ? p.color : 'var(--bg-3)',
                color: isThrower ? '#0b0e13' : 'var(--text)',
                border: isThrower ? '2px solid var(--accent)' : '1px solid var(--border)',
                fontWeight: isThrower ? 800 : 600, fontSize: 12,
                cursor: onPlayerClick ? 'pointer' : 'default',
              }}
            >
              {showRing ? (
                <ChargeRing
                  charge={p.powerUpCharge}
                  cap={pu!.cost || 100}
                  ready={ready}
                  chargedButWaiting={chargedButWaiting}
                  icon={pu!.icon}
                  title={pu ? `${pu.name} (${Math.round(p.powerUpCharge)}% charged${chargedButWaiting ? ' — throw a dart to activate' : ''})` : 'No power-up equipped'}
                  size={28}
                  onActivate={() => { if (onActivatePowerUp && pu) onActivatePowerUp(pu.id); }}
                  onInfo={() => setInfoPlayer(p.id)}
                >
                  <span className="avatar" style={{ width: 20, height: 20, fontSize: 9, background: 'rgba(0,0,0,.25)', borderRadius: '50%' }}>{initials(p.name)}</span>
                </ChargeRing>
              ) : (
                <span className="avatar" style={{ width: 18, height: 18, fontSize: 9, background: isThrower ? 'rgba(0,0,0,.25)' : p.color }}>{initials(p.name)}</span>
              )}
              {p.name}
              {extra?.icon && (
                <span title={extra.iconTitle} style={{ fontSize: 11, marginLeft: 2 }}>
                  {extra.icon}
                </span>
              )}
              {!showRing && extra?.badge && (
                <span title={extra.badge.title} style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  minWidth: 22, padding: '1px 5px', borderRadius: 8, fontSize: 9, fontWeight: 800,
                  background: isThrower ? 'rgba(0,0,0,.2)' : 'var(--bg-2)',
                  color: isThrower ? '#0b0e13' : 'var(--muted)',
                  border: '1px solid var(--border)',
                  marginLeft: 2,
                }}>
                  {extra.badge.label}
                </span>
              )}
              <span style={{ fontSize: 10, opacity: 0.8 }}>⚡{effectivePower(p)}</span>
              {p.buffs.length > 0 && (
                <PartyBuffBadges buffs={p.buffs} />
              )}
            </div>
          );
        })}
      </div>
      {infoPu && (
        <Modal onClose={() => setInfoPlayer(null)}>
          <div style={{ textAlign: 'center', padding: 8 }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>{infoPu.icon}</div>
            <h3 style={{ margin: '0 0 6px' }}>{infoPu.name}</h3>
            <div className="muted" style={{ fontSize: 13, lineHeight: 1.4, marginBottom: 12, maxWidth: 280 }}>{infoPu.desc}</div>
            <div className="muted small" style={{ marginBottom: 12 }}>
              {infoReady ? `Fully charged — ready to activate! (Costs ${infoPu.cost} charge.)` : infoChargedButWaiting ? 'Fully charged — throw at least one dart this visit to activate.' : `${Math.round(infoCharge)}% charged — need ${infoPu.cost} to activate. Land doubles, triples and bulls to charge.`}
            </div>
            <div className="row" style={{ gap: 8, justifyContent: 'center' }}>
              <button className="btn ghost" onClick={() => setInfoPlayer(null)}>Close</button>
              <button className="btn primary" disabled={!infoReady} onClick={() => { if (onActivatePowerUp && infoPu) onActivatePowerUp(infoPu.id); setInfoPlayer(null); }}>Use Power-Up</button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
