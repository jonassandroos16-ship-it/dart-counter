import { useEffect, useState } from 'react';
import type { CampaignBattleState, EnemyAttackStep } from './types';
import { initials } from '../store';
import { Sound } from '../sound';
import type { Settings } from '../types';

export function DartOverlay({ state, onContinue, onEndVisit, settings, enemyIcon }: {
  state: CampaignBattleState;
  onContinue: () => void;
  onEndVisit: () => void;
  settings?: Settings;
  enemyIcon?: (defId: string) => string;
}) {
  const isPlayer = state.phase === 'player' && state.darts.length >= 3;
  const [shakeKey, setShakeKey] = useState(0);
  const [hitIdx, setHitIdx] = useState(0);
  const currentEnemyStep = state.pendingEnemyAttacks[0];
  const playerSteps = isPlayer ? state.resolvedDarts : [];

  // Play a hit sound for each resolved dart in the player visit summary,
  // staggered so each damage line gets its own audible cue.
  useEffect(() => {
    if (!isPlayer) return;
    if (hitIdx >= playerSteps.length) return;
    const t = setTimeout(() => {
      Sound.playHit(playerSteps[hitIdx].damage, settings || ({} as Settings));
      setHitIdx((i) => i + 1);
    }, 300 + hitIdx * 250);
    return () => clearTimeout(t);
  }, [hitIdx, isPlayer, playerSteps, settings]);

  useEffect(() => {
    if (!isPlayer) setShakeKey(k => k + 1);
  }, [currentEnemyStep, isPlayer]);

  if (isPlayer) {
    const thrower = state.players[state.playerTurnIdx];
    const steps = state.resolvedDarts;
    const totalDamage = steps.reduce((a, s) => a + s.damage, 0);
    const enemiesHit = steps.reduce((acc: { id: string; name: string; maxHp: number; finalHp: number; defeated: boolean }[], s) => {
      const existing = acc.find(e => e.id === s.enemyId);
      if (existing) {
        existing.finalHp = s.hpAfter;
        if (s.kind === 'defeated') existing.defeated = true;
      } else {
        const enemy = state.enemies.find(e => e.id === s.enemyId);
        acc.push({
          id: s.enemyId,
          name: s.enemyName,
          maxHp: enemy?.maxHp || 1,
          finalHp: s.hpAfter,
          defeated: s.kind === 'defeated',
        });
      }
      return acc;
    }, []);
    return (
      <div className="battle-overlay-bg">
        <div className="battle-overlay" onClick={(e) => e.stopPropagation()}>
          <div className="bo-header">
            <span className="bo-attacker">
              <span className="avatar" style={{ width: 28, height: 28, fontSize: 12, background: thrower?.color }}>{thrower ? initials(thrower.name) : '?'}</span>
              <span className="bo-name">{thrower?.name || 'Player'}</span>
            </span>
            <span className="bo-vs">·</span>
            <span className="bo-target">
              <span className="bo-name">Visit summary</span>
            </span>
          </div>

          <div className="bo-steps" style={{ marginTop: 4 }}>
            {steps.map((s, i) => {
              const eDef = state.enemies.find(e => e.id === s.enemyId);
              const icon = enemyIcon && eDef ? enemyIcon(eDef.defId) : '';
              return (
                <div key={i} className={`bo-step current${s.damage <= 0 ? ' miss' : ''}`}>
                  <span className="bo-step-dart">{s.dart.label}</span>
                  <span className="bo-step-formula">
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      minWidth: 20, height: 20, borderRadius: 6, padding: '0 4px',
                      background: 'color-mix(in srgb,var(--accent) 22%,var(--bg))',
                      color: 'var(--accent)', fontSize: 11, fontWeight: 900, marginRight: 4, flex: '0 0 auto',
                    }} title={s.enemyName}>{icon}</span>
                    {s.kind === 'shield_break' ? `Broke ${s.shieldTarget} — 0 dmg`
                      : s.kind === 'miss' ? 'Absorbed by shield — 0 dmg'
                      : s.dart.value <= 0 ? 'Miss · 0 dmg'
                      : `${s.dart.value} dmg`}
                    {s.kind === 'defeated' ? ' · DEFEATED' : ''}
                  </span>
                  <span className="bo-step-dmg">{s.damage > 0 ? `-${s.damage}` : '0'}</span>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {enemiesHit.map(e => {
              const eDef = state.enemies.find(en => en.id === e.id);
              const icon = enemyIcon && eDef ? enemyIcon(eDef.defId) : '';
              const hpPct = Math.max(0, Math.min(100, (e.finalHp / e.maxHp) * 100));
              return (
                <div key={e.id} style={{ padding: '6px 8px', borderRadius: 8, background: 'var(--bg-3)', border: '1px solid var(--border)' }}>
                  <div className="row between" style={{ marginBottom: 4, alignItems: 'center' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        minWidth: 22, height: 22, borderRadius: 6, padding: '0 5px',
                        background: 'color-mix(in srgb,var(--accent) 22%,var(--bg))',
                        color: 'var(--accent)', fontSize: 12, fontWeight: 900, flex: '0 0 auto',
                      }} title={e.name}>{icon}</span>
                      <span className="bo-name" style={{ fontSize: 13 }}>{e.name}</span>
                    </span>
                    <span className="muted small">
                      {e.defeated ? <span style={{ color: '#ef4444', fontWeight: 800 }}>DEFEATED</span> : `${e.finalHp} / ${e.maxHp} HP`}
                    </span>
                  </div>
                  <div className="bo-hp-tracks">
                    <div className="bo-hp-fill" style={{ width: `${hpPct}%`, background: e.defeated ? 'var(--muted)' : '#ef4444' }} />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="bo-footer" style={{ marginTop: 10 }}>
            <span className="muted small">Total this visit</span>
            <span className="bo-total">-{totalDamage} HP</span>
          </div>

          <button className="btn primary block" style={{ marginTop: 12 }} onClick={onEndVisit}>
            Continue
          </button>
        </div>
      </div>
    );
  }

  const allSteps = [...state.appliedEnemyAttacks, ...(currentEnemyStep ? [currentEnemyStep] : [])];
  const a = currentEnemyStep as EnemyAttackStep | undefined;
  const maxHp = state.partyMaxHp || 1;
  const hpPct = a ? Math.max(0, Math.min(100, (a.partyHpAfter / maxHp) * 100)) : 0;
  const intensity = !a || a.damage <= 0 ? 0 : a.damage < 20 ? 1 : a.damage < 50 ? 2 : 3;
  const shakeClass = intensity === 0 ? '' : intensity === 1 ? 'battle-shake-light' : intensity === 2 ? 'battle-shake-medium' : 'battle-shake-heavy';
  return (
    <div className="battle-overlay-bg">
      <div className="battle-overlay" onClick={(e) => e.stopPropagation()}>
        <div className="bo-header">
          <span className="bo-attacker">
            <span className="avatar" style={{ width: 28, height: 28, fontSize: 12, background: '#ef4444' }}>👹</span>
            <span className="bo-name">{a?.enemyName || 'Enemy'}</span>
          </span>
          <span className="bo-vs">→</span>
          <span className="bo-target">
            <span className="bo-name">Party</span>
          </span>
        </div>
        <div className={`bo-target-card ${shakeClass}`} key={shakeKey}>
          <div className="bo-hp-row">
            <span className="bo-hp-label">Party HP</span>
            <span className="bo-hp-value">{a?.partyHpAfter ?? state.partyHp}</span>
          </div>
          <div className="bo-hp-track">
            <div className="bo-hp-fill" style={{ width: `${hpPct}%`, background: '#ef4444', color: '#ef4444' }} />
          </div>
          {a && a.partyHpAfter <= 0 && <div className="bo-defeated">DEFEATED</div>}
        </div>
        <div className="bo-steps">
          {allSteps.map((s, i) => {
            const isCurrent = i === allSteps.length - 1 && !!currentEnemyStep;
            const eDef = state.enemies.find(e => e.id === s.enemyId);
            const icon = enemyIcon && eDef ? enemyIcon(eDef.defId) : '';
            return (
              <div key={i} className={`bo-step ${isCurrent ? 'current' : 'past'}${s.damage <= 0 ? ' miss' : ''}`}>
                <span className="bo-step-dart">{s.dart.label}</span>
                <span className="bo-step-formula">
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    minWidth: 20, height: 20, borderRadius: 6, padding: '0 4px',
                    background: 'color-mix(in srgb,var(--accent) 22%,var(--bg))',
                    color: 'var(--accent)', fontSize: 11, fontWeight: 900, marginRight: 4, flex: '0 0 auto',
                  }} title={s.enemyName}>{icon}</span>
                  {s.dart.value <= 0 ? 'Miss · 0 dmg' : `${s.dart.value} dmg`}
                </span>
                <span className="bo-step-dmg">{s.damage > 0 ? `-${s.damage}` : '0'}</span>
              </div>
            );
          })}
        </div>
        <button className="btn primary block" style={{ marginTop: 12 }} onClick={onContinue} disabled={!currentEnemyStep}>
          {currentEnemyStep ? 'Continue' : 'Done'}
        </button>
      </div>
    </div>
  );
}
