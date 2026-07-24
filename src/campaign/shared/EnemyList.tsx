import type { CampaignBattleState } from '../types';
import { getEnemyDef } from '../engine/enemies';
import { describeShield } from '../engine/shields';
import { EnemyDebuffBadges } from '../../cards/DebuffBadges';

export interface EnemyListProps {
  state: CampaignBattleState;
  enemyIcon: (defId: string) => string;
  canTarget: boolean;
  onSelectTarget: (enemyId: string) => void;
}

export function EnemyList({ state, enemyIcon, canTarget, onSelectTarget }: EnemyListProps) {
  return (
    <div className="play-others">
      {state.enemies.map((e, i) => {
        const def = getEnemyDef(e.defId);
        const hpPct = Math.max(0, Math.min(100, (e.hp / e.maxHp) * 100));
        const isTarget = i === state.targetIdx && !e.defeated;
        const frozen = e.frozenTurns > 0;
        const vulnerable = e.vulnerableTurns > 0;
        const distracted = e.distractedTurns > 0;
        const effAcc = Math.max(0, e.accuracy - (distracted ? e.distractAmount : 0));
        const isBoss = def?.difficulty === 'Boss';
        return (
          <div
            key={e.id}
            className="play-other"
            onClick={() => canTarget && !e.defeated && onSelectTarget(e.id)}
            style={{
              cursor: canTarget && !e.defeated ? 'pointer' : 'default',
              opacity: e.defeated ? 0.4 : 1,
              borderColor: isTarget ? 'var(--accent)' : e.defeated ? 'var(--border)' : frozen ? 'color-mix(in srgb,#60a5fa 60%,var(--border))' : distracted ? 'color-mix(in srgb,#a78bfa 60%,var(--border))' : vulnerable ? 'color-mix(in srgb,#fbbf24 60%,var(--border))' : 'var(--border)',
              boxShadow: isTarget ? '0 0 0 2px var(--accent)' : 'none',
              background: e.defeated ? 'var(--bg-3)' : frozen ? 'color-mix(in srgb,#60a5fa 12%,var(--bg-2))' : distracted ? 'color-mix(in srgb,#a78bfa 12%,var(--bg-2))' : vulnerable ? 'color-mix(in srgb,#fbbf24 12%,var(--bg-2))' : 'var(--bg-2)',
            }}
          >
            <div className="row between">
              <div className="row" style={{ gap: 6, alignItems: 'center' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    minWidth: 24, height: 24, borderRadius: 6, padding: '0 5px',
                    background: 'color-mix(in srgb,var(--accent) 22%,var(--bg))',
                    color: 'var(--accent)', fontSize: 12, fontWeight: 900, flex: '0 0 auto',
                  }}>{enemyIcon(e.defId)}</span>
                  <span className="po-name">{e.name}</span>
                  {isBoss && <span style={{ fontSize: 10, fontWeight: 800, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '.08em' }}>Boss</span>}
                </span>
                {e.defeated && <span style={{ fontSize: 14, color: '#ef4444', fontWeight: 900 }}>☠</span>}
                {!e.defeated && <EnemyDebuffBadges enemy={e} />}
              </div>
              <span className="pill" style={{ fontSize: 10 }}>{e.defeated ? '☠' : `${e.hp} HP`}</span>
            </div>
            <div style={{ marginTop: 4, height: 6, borderRadius: 3, background: 'var(--bg-3)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${hpPct}%`, background: e.defeated ? 'var(--muted)' : '#ef4444', transition: 'width .4s' }} />
            </div>
            <div className="po-sub">🛡 {e.armor}% armor · 🎯 {Math.round(effAcc * 100)}% acc{distracted ? ' (debuffed)' : ''}{e.shields.length ? ` · 🛡 ${e.shields.length} shield${e.shields.length === 1 ? '' : 's'}` : ''}</div>
            {e.shields.length > 0 && !e.defeated && (
              <div style={{ marginTop: 3, display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {e.shields.map((s, si) => (
                  <span key={si} className="pill" style={{ fontSize: 9, padding: '1px 6px', background: 'color-mix(in srgb,#fbbf24 18%,var(--bg-3))', color: '#fbbf24', borderColor: 'transparent' }}>
                    🛡 {s.flatHp != null ? `${s.flatHp}HP` : describeShield(s)}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
