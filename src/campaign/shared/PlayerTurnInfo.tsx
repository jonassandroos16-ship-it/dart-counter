import type { CampaignBattleState } from '../types';
import type { CardPlayState } from '../../cards/types';
import { resolveCardDef } from '../../cards/deck';
import { effectivePower } from '../engine/playerTurn';
import { describeShield } from '../engine/shields';

export interface PlayerTurnInfoProps {
  state: CampaignBattleState;
  enemyIcon: (defId: string) => string;
  cardMode?: boolean;
  cardPlayState?: CardPlayState | null;
  maxPlays?: number;
  cardsPlayed?: number;
}

export function PlayerTurnInfo({ state, enemyIcon, cardMode, cardPlayState, maxPlays, cardsPlayed }: PlayerTurnInfoProps) {
  const thrower = state.players[state.playerTurnIdx];
  if (!thrower) return null;

  const aliveEnemies = state.enemies.filter(e => !e.defeated);
  const target = state.enemies[state.targetIdx];
  const validTarget = target && !target.defeated ? target : aliveEnemies[0];

  // In card mode, show a slot for every played card (damage + utility/spell).
  // Damage cards map 1-to-1 with state.darts in order.
  // Non-damage cards show the card name/icon without dart resolution data.
  if (cardMode && cardPlayState) {
    const usedCards = cardPlayState.used;
    let dartIdx = 0;
    const slots = usedCards.map((pc, i) => {
      const def = resolveCardDef(pc);
      const isDamage = def?.type === 'damage';
      if (isDamage) {
        const d = state.darts[dartIdx];
        const r = state.resolvedDarts[dartIdx];
        dartIdx++;
        const isDefeated = r?.kind === 'defeated';
        return (
          <div key={i} className="pc-slot filled" style={{
            borderColor: isDefeated ? '#ef4444' : undefined,
            background: isDefeated ? 'color-mix(in srgb,#ef4444 18%,var(--bg-3))' : undefined,
            flexDirection: 'row', gap: 6, justifyContent: 'space-between', padding: '4px 8px',
          }}>
            <span style={{ fontWeight: 800, fontSize: 15 }}>{d?.label ?? def?.name ?? '?'}</span>
            {r && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, opacity: 0.9 }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  minWidth: 18, height: 18, borderRadius: 6, padding: '0 4px',
                  background: 'color-mix(in srgb,var(--accent) 22%,var(--bg))',
                  color: 'var(--accent)', fontSize: 10, fontWeight: 900, flex: '0 0 auto',
                }} title={r.enemyName}>{enemyIcon(state.enemies.find(e => e.id === r.enemyId)?.defId ?? r.enemyId)}</span>
                {r.damage > 0 ? `-${r.damage}` : r.kind === 'shield_break' ? '🛡' : ''}
                {isDefeated ? ' ☠' : ''}
              </span>
            )}
          </div>
        );
      }
      // Utility or spell card
      const typeColor = def?.type === 'spell' ? '#a78bfa' : '#60a5fa';
      return (
        <div key={i} className="pc-slot filled" style={{
          flexDirection: 'row', gap: 6, justifyContent: 'space-between', padding: '4px 8px',
          borderColor: typeColor,
          background: `color-mix(in srgb,${typeColor} 12%,var(--bg-3))`,
        }}>
          <span style={{ fontWeight: 800, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            {def?.icon && <span>{def.icon}</span>}
            {def?.name ?? pc.cardId}
          </span>
          <span style={{ fontSize: 10, fontWeight: 700, opacity: 0.7, color: typeColor, textTransform: 'uppercase' }}>
            {def?.type ?? 'card'}
          </span>
        </div>
      );
    });

    return (
      <>
        <div className="pc-slots" style={{ marginTop: 6 }}>
          {slots.length > 0 ? slots : <div className="pc-slot">–</div>}
        </div>
        <div className="muted small">
          <b style={{ color: 'var(--text)' }}>{thrower.name}</b> is playing · this visit: <b style={{ color: 'var(--text)' }}>{state.resolvedDarts.reduce((a, d) => a + d.damage, 0)} dmg</b>
          {typeof maxPlays === 'number' && typeof cardsPlayed === 'number' && (
            <span style={{ marginLeft: 8, color: '#c4b5fd', fontWeight: 700 }}>
              🃏 {cardsPlayed}/{maxPlays} cards · {Math.max(0, maxPlays - cardsPlayed)} left
            </span>
          )}
          <span style={{ marginLeft: 8, color: '#fbbf24' }}>
            ⚡ Effective power: <b>{effectivePower(thrower)}</b>
            {state.passiveBonus && state.passiveBonus.power > 0 && (
              <span style={{ opacity: 0.8 }}> (base {thrower.power - (state.passiveBonus?.power || 0)} + {state.passiveBonus.power} passive)</span>
            )}
          </span>
          {validTarget && validTarget.shields.length > 0 && (
            <span style={{ marginLeft: 8, color: '#fbbf24' }}>
              🛡 {validTarget.name} shields: {validTarget.shields.map(describeShield).join(' → ')}
            </span>
          )}
        </div>
      </>
    );
  }

  // Default (non-card mode): show the 3 dart throw slots
  return (
    <>
      <div className="pc-slots" style={{ marginTop: 6 }}>
        {[0, 1, 2].map(i => {
          const d = state.darts[i];
          const r = state.resolvedDarts[i];
          if (!d) return <div key={i} className="pc-slot">–</div>;
          const isDefeated = r?.kind === 'defeated';
          return (
            <div key={i} className="pc-slot filled" style={{
              borderColor: isDefeated ? '#ef4444' : undefined,
              background: isDefeated ? 'color-mix(in srgb,#ef4444 18%,var(--bg-3))' : undefined,
              flexDirection: 'row', gap: 6, justifyContent: 'space-between', padding: '4px 8px',
            }}>
              <span style={{ fontWeight: 800, fontSize: 15 }}>{d.label}</span>
              {r && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, opacity: 0.9 }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    minWidth: 18, height: 18, borderRadius: 6, padding: '0 4px',
                    background: 'color-mix(in srgb,var(--accent) 22%,var(--bg))',
                    color: 'var(--accent)', fontSize: 10, fontWeight: 900, flex: '0 0 auto',
                  }} title={r.enemyName}>{enemyIcon(state.enemies.find(e => e.id === r.enemyId)?.defId ?? r.enemyId)}</span>
                  {r.damage > 0 ? `-${r.damage}` : r.kind === 'shield_break' ? '🛡' : ''}
                  {isDefeated ? ' ☠' : ''}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className="muted small">
        <b style={{ color: 'var(--text)' }}>{thrower.name}</b> is throwing · this visit: <b style={{ color: 'var(--text)' }}>{state.resolvedDarts.reduce((a, d) => a + d.damage, 0)} dmg</b>
        <span style={{ marginLeft: 8, color: '#c4b5fd', fontWeight: 700 }}>
          🎯 {state.darts.length}/3 darts · {Math.max(0, 3 - state.darts.length)} left
        </span>
        <span style={{ marginLeft: 8, color: '#fbbf24' }}>
          ⚡ Effective power: <b>{effectivePower(thrower)}</b>
          {state.passiveBonus && state.passiveBonus.power > 0 && (
            <span style={{ opacity: 0.8 }}> (base {thrower.power - (state.passiveBonus?.power || 0)} + {state.passiveBonus.power} passive)</span>
          )}
        </span>
        {validTarget && validTarget.shields.length > 0 && (
          <span style={{ marginLeft: 8, color: '#fbbf24' }}>
            🛡 {validTarget.name} shields: {validTarget.shields.map(describeShield).join(' → ')}
          </span>
        )}
      </div>
    </>
  );
}
