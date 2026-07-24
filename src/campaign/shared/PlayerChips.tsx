import type { CampaignBattleState, CoopPlayer } from '../types';
import { initials } from '../../store';
import { effectivePower } from '../engine/playerTurn';
import { PartyBuffBadges } from '../../cards/BuffBadges';

export interface PlayerChipExtra {
  icon?: string;
  iconTitle?: string;
  badge?: { label: string; title: string };
}

export interface PlayerChipsProps {
  state: CampaignBattleState;
  onPlayerClick?: (playerId: string) => void;
  playerClickTitle?: string;
  extras?: Record<string, PlayerChipExtra>;
}

export function PlayerChips({ state, onPlayerClick, playerClickTitle, extras }: PlayerChipsProps) {
  return (
    <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
      {state.players.map((p: CoopPlayer, i: number) => {
        const isThrower = state.phase === 'player' && i === state.playerTurnIdx;
        const extra = extras?.[p.id];
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
            <span className="avatar" style={{ width: 18, height: 18, fontSize: 9, background: isThrower ? 'rgba(0,0,0,.25)' : p.color }}>{initials(p.name)}</span>
            {p.name}
            {extra?.icon && (
              <span title={extra.iconTitle} style={{ fontSize: 11, marginLeft: 2 }}>
                {extra.icon}
              </span>
            )}
            {extra?.badge && (
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
  );
}
