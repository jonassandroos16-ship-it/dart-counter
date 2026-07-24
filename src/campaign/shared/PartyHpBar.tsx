import type { CampaignBattleState } from '../types';

export function PartyHpBar({ state }: { state: CampaignBattleState }) {
  const partyHpPct = Math.max(0, Math.min(100, (state.partyHp / state.partyMaxHp) * 100));
  const aliveEnemies = state.enemies.filter(e => !e.defeated);
  return (
    <>
      <div className="row between" style={{ width: '100%', margin: '4px 0' }}>
        <span className="pill" style={{ background: 'color-mix(in srgb,#ef4444 18%,var(--bg-3))', color: '#fca5a5', borderColor: 'transparent' }}>
          ❤️ Party {state.partyHp}/{state.partyMaxHp}
        </span>
        <span className="muted small">{aliveEnemies.length} enemy{aliveEnemies.length === 1 ? '' : 's'} alive</span>
      </div>
      <div style={{ width: '100%', height: 8, borderRadius: 4, background: 'var(--bg-3)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${partyHpPct}%`, background: '#ef4444', transition: 'width .4s' }} />
      </div>
    </>
  );
}
