import { useEffect, useState } from 'react';
import type { CampaignBattleState, CampaignProgress, CoopPowerUpId, ResolvedDart, EnemyAttackStep } from './types';
import {
  addDart, undoDart, resolvePlayerVisit, applyNextPlayerDart,
  prepareEnemyTurn, applyNextEnemyAttack, setTarget, startBattle, getLevel,
  describeShield, COOP_POWER_UPS, canActivateCoopPowerUp, activateCoopPowerUp,
} from './engine';
import type { Player, Settings } from '../types';
import { Sound } from '../sound';
import { initials } from '../store';
import { bumpCoopStat } from './coopStats';

interface Props {
  levelId: number;
  progress: CampaignProgress;
  settings: Settings;
  players: Player[];
  onWin: (newHighest: number) => void;
  onLose: () => void;
  onQuit: () => void;
}

export function CampaignBattle({ levelId, progress, settings, players, onWin, onLose, onQuit }: Props) {
  const level = getLevel(levelId)!;
  const [state, setState] = useState<CampaignBattleState>(() =>
    startBattle(level, players, settings),
  );
  const [mult, setMult] = useState(1);

  // Victory / defeat handling.
  useEffect(() => {
    if (state.outcome === 'victory') {
      Sound.play('win', {}, settings);
      bumpCoopStat('levelsCleared');
      const newHighest = Math.max(progress.highest_level_beaten, levelId);
      onWin(newHighest);
    } else if (state.outcome === 'defeat') {
      Sound.play('kill', {}, settings);
      onLose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.outcome]);

  // When entering the enemy phase, prepare the enemy attack steps. The UI
  // then animates through them one at a time, requiring the player to tap
  // "Continue" to advance — so the player can see what each dart did.
  useEffect(() => {
    if (state.phase !== 'enemy') return;
    if (state.outcome !== 'ongoing') return;
    if (state.pendingEnemyAttacks.length) return;
    const t = setTimeout(() => {
      setState(prev => prepareEnemyTurn(prev));
      Sound.play('impact', {}, settings);
    }, 600);
    return () => clearTimeout(t);
  }, [state.phase, state.outcome, state.pendingEnemyAttacks.length, settings]);

  const aliveEnemies = state.enemies.filter(e => !e.defeated);
  const target = state.enemies[state.targetIdx];
  const validTarget = target && !target.defeated ? target : aliveEnemies[0];
  const thrower = state.players[state.playerTurnIdx];

  const onAdd = (base: number, m: number, labelOverride?: string, isBull?: boolean) => {
    setState(prev => addDart(prev, base, m, labelOverride, isBull));
    Sound.play('dart', { score: base * m }, settings);
  };

  const onUndo = () => setState(prev => undoDart(prev));

  const onEnter = () => {
    if (!state.darts.length) return;
    setState(prev => resolvePlayerVisit(prev));
  };

  const onContinue = () => {
    if (state.pendingPlayerDarts.length) {
      setState(prev => applyNextPlayerDart(prev));
      Sound.play('impact', {}, settings);
    } else if (state.pendingEnemyAttacks.length) {
      setState(prev => applyNextEnemyAttack(prev));
      Sound.play('impact', {}, settings);
    }
  };

  const onActivatePowerUp = (id: CoopPowerUpId) => {
    setState(prev => activateCoopPowerUp(prev, id));
    Sound.play('impact', {}, settings);
    if (id === 'coop_heal') bumpCoopStat('healsUsed');
    else if (id === 'coop_freeze') bumpCoopStat('freezesUsed');
    else if (id === 'coop_buff_power' || id === 'coop_buff_acc') bumpCoopStat('buffsUsed');
    else if (id === 'coop_shield') bumpCoopStat('shieldsUsed');
  };

  const partyHpPct = Math.max(0, Math.min(100, (state.partyHp / state.partyMaxHp) * 100));
  const showingOverlay = state.pendingPlayerDarts.length > 0 || state.pendingEnemyAttacks.length > 0;

  return (
    <div className="view-noscroll">
      <div className="play-current">
        <div className="pc-header">
          <div className="row" style={{ gap: 8 }}>
            <span className="pc-name">{level.is_boss ? '☠ BOSS · ' : ''}{level.name}</span>
          </div>
          <span className="muted small">VISIT {state.visitNumber} · {state.phase === 'player' ? 'YOUR TURN' : 'ENEMY TURN'}</span>
        </div>
        <div className="row between" style={{ width: '100%', margin: '4px 0' }}>
          <span className="pill" style={{ background: 'color-mix(in srgb,#ef4444 18%,var(--bg-3))', color: '#fca5a5', borderColor: 'transparent' }}>
            ❤️ Party {state.partyHp}/{state.partyMaxHp}
          </span>
          <span className="muted small">{aliveEnemies.length} enemy{aliveEnemies.length === 1 ? '' : 's'} alive</span>
        </div>
        <div style={{ width: '100%', height: 8, borderRadius: 4, background: 'var(--bg-3)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${partyHpPct}%`, background: '#ef4444', transition: 'width .4s' }} />
        </div>

        {/* Party roster — shows all players, who's throwing now, and active buffs. */}
        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          {state.players.map((p, i) => {
            const isThrower = state.phase === 'player' && i === state.playerTurnIdx;
            return (
              <div key={p.id} style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '4px 8px', borderRadius: 999,
                background: isThrower ? p.color : 'var(--bg-3)',
                color: isThrower ? '#0b0e13' : 'var(--text)',
                border: isThrower ? '2px solid var(--accent)' : '1px solid var(--border)',
                fontWeight: isThrower ? 800 : 600,
                fontSize: 12,
              }}>
                <span className="avatar" style={{ width: 18, height: 18, fontSize: 9, background: isThrower ? 'rgba(0,0,0,.25)' : p.color }}>{initials(p.name)}</span>
                {p.name}
                {p.buffs.length > 0 && (
                  <span style={{ display: 'inline-flex', gap: 3, marginLeft: 4 }}>
                    {p.buffs.map(b => (
                      <span key={b.id} title={`${b.kind} +${b.amount} (${b.turnsLeft} turns)`}
                        style={{ fontSize: 10, padding: '1px 4px', borderRadius: 4, background: b.kind === 'power' ? 'color-mix(in srgb,#fbbf24 30%,transparent)' : 'color-mix(in srgb,#60a5fa 30%,transparent)', color: '#0b0e13' }}>
                        {b.kind === 'power' ? '⚡' : '🎯'}{b.turnsLeft}
                      </span>
                    ))}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {state.phase === 'player' && thrower && (
          <>
            <div className="pc-slots" style={{ marginTop: 6 }}>
              {[0, 1, 2].map(i => {
                const d = state.darts[i];
                return <div key={i} className={`pc-slot${d ? ' filled' : ''}`}>{d ? d.label : '–'}</div>;
              })}
            </div>
            <div className="muted small">
              <b style={{ color: 'var(--text)' }}>{thrower.name}</b> is throwing · this visit: <b style={{ color: 'var(--text)' }}>{state.darts.reduce((a, d) => a + d.value, 0)}</b>
              {validTarget && validTarget.shields.length > 0 && (
                <span style={{ marginLeft: 8, color: '#fbbf24' }}>
                  🛡 {validTarget.name} shields: {validTarget.shields.map(describeShield).join(' → ')}
                </span>
              )}
            </div>
          </>
        )}

        {state.phase === 'enemy' && !state.pendingEnemyAttacks.length && (
          <div className="muted small" style={{ marginTop: 6, fontStyle: 'italic' }}>
            Enemies are preparing to attack…
          </div>
        )}
      </div>

      <div className="play-others">
        {state.enemies.map((e, i) => {
          const hpPct = Math.max(0, Math.min(100, (e.hp / e.maxHp) * 100));
          const isTarget = i === state.targetIdx && !e.defeated;
          const canTarget = state.phase === 'player' && !e.defeated && !state.pendingPlayerDarts.length;
          const frozen = e.frozenTurns > 0;
          return (
            <div
              key={e.id}
              className="play-other"
              onClick={() => canTarget && setState(prev => setTarget(prev, e.id))}
              style={{
                cursor: canTarget ? 'pointer' : 'default',
                opacity: e.defeated ? 0.4 : 1,
                borderColor: isTarget ? 'var(--accent)' : e.defeated ? 'var(--border)' : frozen ? 'color-mix(in srgb,#60a5fa 60%,var(--border))' : 'var(--border)',
                boxShadow: isTarget ? '0 0 0 2px var(--accent)' : 'none',
                background: e.defeated ? 'var(--bg-3)' : frozen ? 'color-mix(in srgb,#60a5fa 12%,var(--bg-2))' : 'var(--bg-2)',
              }}
            >
              <div className="row between">
                <div className="row" style={{ gap: 6 }}>
                  <span className="po-name">{e.name}</span>
                  {e.defeated && <span className="pill" style={{ fontSize: 9, background: '#ef4444', color: '#fff' }}>DEFEATED</span>}
                  {frozen && <span className="pill" style={{ fontSize: 9, background: '#60a5fa', color: '#0b0e13' }}>❄ FROZEN {e.frozenTurns}</span>}
                </div>
                <span className="pill" style={{ fontSize: 10 }}>{e.hp} HP</span>
              </div>
              <div style={{ marginTop: 4, height: 6, borderRadius: 3, background: 'var(--bg-3)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${hpPct}%`, background: e.defeated ? 'var(--muted)' : '#ef4444', transition: 'width .4s' }} />
              </div>
              <div className="po-sub">🛡 {e.armor} armor · 🎯 {Math.round(e.accuracy * 100)}% acc{e.shields.length ? ` · 🛡 ${e.shields.length} shield${e.shields.length === 1 ? '' : 's'}` : ''}</div>
              {e.shields.length > 0 && !e.defeated && (
                <div style={{ marginTop: 3, display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                  {e.shields.map((s, si) => (
                    <span key={si} className="pill" style={{ fontSize: 9, padding: '1px 6px', background: 'color-mix(in srgb,#fbbf24 18%,var(--bg-3))', color: '#fbbf24', borderColor: 'transparent' }}>
                      🛡 {describeShield(s)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Coop power-up bar — available before the player throws. */}
      {state.phase === 'player' && !state.pendingPlayerDarts.length && state.darts.length === 0 && (
        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          <div className="muted small" style={{ alignSelf: 'center', marginRight: 4 }}>⚡ {state.powerUpCharge}</div>
          {COOP_POWER_UPS.map(pu => {
            const can = canActivateCoopPowerUp(state, pu.id);
            return (
              <button key={pu.id} className="pill" disabled={!can}
                title={pu.desc}
                onClick={() => can && onActivatePowerUp(pu.id)}
                style={{
                  background: can ? 'color-mix(in srgb,var(--accent) 25%,var(--bg-3))' : 'var(--bg-3)',
                  color: can ? 'var(--text)' : 'var(--muted)',
                  opacity: can ? 1 : 0.5,
                  cursor: can ? 'pointer' : 'not-allowed',
                  borderColor: 'transparent',
                }}>
                {pu.icon} {pu.name} <span className="muted small">({pu.cost})</span>
              </button>
            );
          })}
        </div>
      )}

      {state.phase === 'player' && state.outcome === 'ongoing' && !state.pendingPlayerDarts.length && (
        <div className="play-input">
          <div className="pad-card">
            <div className="mult">
              <button className={mult === 1 ? 'on' : ''} onClick={() => setMult(1)}>Single</button>
              <button className={mult === 2 ? 'on' : ''} onClick={() => setMult(2)}>Double</button>
              <button className={mult === 3 ? 'on' : ''} onClick={() => setMult(3)}>Triple</button>
            </div>
            <div className="keypad">
              {[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20].map(n => (
                <button key={n} className="key" onClick={() => onAdd(n, mult)}>{n}</button>
              ))}
              <button className="key" style={{ background: 'color-mix(in srgb,var(--accent) 20%,var(--bg-3))' }} onClick={() => onAdd(25, mult === 2 ? 2 : 1)}>25</button>
              <button className="key" style={{ gridColumn: 'span 2', background: 'color-mix(in srgb,var(--accent) 30%,var(--bg-3))' }} onClick={() => onAdd(50, 1, 'Bull', true)}>Bull<br /><small>50</small></button>
              <button className="key" style={{ gridColumn: 'span 2', color: 'var(--muted)' }} onClick={() => onAdd(0, 1, '0')}>Miss</button>
            </div>
            <div className="row" style={{ gap: 8, marginTop: 8 }}>
              <button className="btn block ghost" onClick={onUndo}>↶ Undo dart</button>
              <button className="btn block primary" onClick={onEnter} disabled={!state.darts.length}>Throw darts</button>
            </div>
          </div>
        </div>
      )}

      <button className="btn danger sm" style={{ alignSelf: 'flex-end' }} onClick={() => { if (confirm('Quit this battle? Progress will be saved.')) onQuit(); }}>Quit</button>

      {showingOverlay && (
        <DartOverlay
          state={state}
          onContinue={onContinue}
        />
      )}
    </div>
  );
}

// ── Dart-by-dart overlay ──────────────────────────────────────────────
//
// Shows the current dart being resolved (either a player's attack dart or
// an enemy's attack dart) with the damage formula and HP bar animation.
// The overlay waits for the player to tap "Continue" before advancing —
// this gives the player time to see what happened.

function DartOverlay({ state, onContinue }: { state: CampaignBattleState; onContinue: () => void }) {
  const isPlayer = state.pendingPlayerDarts.length > 0;
  const step = isPlayer ? state.pendingPlayerDarts[0] : state.pendingEnemyAttacks[0];

  // Re-render shake on each step.
  const [shakeKey, setShakeKey] = useState(0);
  useEffect(() => { setShakeKey(k => k + 1); }, [step]);

  if (!step) return null;

  if (isPlayer) {
    const s = step as ResolvedDart;
    const enemy = state.enemies.find(e => e.id === s.enemyId);
    const maxHp = enemy?.maxHp || 1;
    const hpPct = Math.max(0, Math.min(100, (s.hpAfter / maxHp) * 100));
    const intensity = s.damage <= 0 ? 0 : s.damage < 20 ? 1 : s.damage < 50 ? 2 : 3;
    const shakeClass = intensity === 0 ? '' : intensity === 1 ? 'battle-shake-light' : intensity === 2 ? 'battle-shake-medium' : 'battle-shake-heavy';
    const thrower = state.players[state.playerTurnIdx];
    return (
      <div className="battle-overlay-bg">
        <div className="battle-overlay" onClick={(e) => e.stopPropagation()}>
          <div className="bo-header">
            <span className="bo-attacker">
              <span className="avatar" style={{ width: 28, height: 28, fontSize: 12, background: thrower?.color }}>{thrower ? initials(thrower.name) : '?'}</span>
              <span className="bo-name">{thrower?.name || 'Player'}</span>
            </span>
            <span className="bo-vs">→</span>
            <span className="bo-target">
              <span className="bo-name">{s.enemyName}</span>
            </span>
          </div>
          <div className={`bo-target-card ${shakeClass}`} key={shakeKey}>
            <div className="bo-hp-row">
              <span className="bo-hp-label">Enemy HP</span>
              <span className="bo-hp-value">{s.hpAfter}</span>
            </div>
            <div className="bo-hp-track">
              <div className="bo-hp-fill" style={{ width: `${hpPct}%`, background: '#ef4444', color: '#ef4444' }} />
            </div>
            {s.kind === 'defeated' && <div className="bo-defeated">DEFEATED</div>}
          </div>
          <div className="bo-steps">
            <div className="bo-step current">
              <span className="bo-step-dart">{s.dart.label}</span>
              <span className="bo-step-formula">
                {s.kind === 'shield_break' ? `Broke shield: ${s.shieldTarget} — 0 dmg`
                  : s.kind === 'miss' ? 'Absorbed by shield — 0 dmg'
                  : s.dart.value <= 0 ? 'Miss · 0 dmg'
                  : `${s.dart.value} dmg`}
              </span>
              <span className="bo-step-dmg">{s.damage > 0 ? `-${s.damage}` : '0'}</span>
            </div>
          </div>
          <button className="btn primary block" style={{ marginTop: 12 }} onClick={onContinue}>
            Continue
          </button>
        </div>
      </div>
    );
  }

  const a = step as EnemyAttackStep;
  const maxHp = state.partyMaxHp || 1;
  const hpPct = Math.max(0, Math.min(100, (a.partyHpAfter / maxHp) * 100));
  const intensity = a.damage <= 0 ? 0 : a.damage < 20 ? 1 : a.damage < 50 ? 2 : 3;
  const shakeClass = intensity === 0 ? '' : intensity === 1 ? 'battle-shake-light' : intensity === 2 ? 'battle-shake-medium' : 'battle-shake-heavy';
  return (
    <div className="battle-overlay-bg">
      <div className="battle-overlay" onClick={(e) => e.stopPropagation()}>
        <div className="bo-header">
          <span className="bo-attacker">
            <span className="avatar" style={{ width: 28, height: 28, fontSize: 12, background: '#ef4444' }}>👹</span>
            <span className="bo-name">{a.enemyName}</span>
          </span>
          <span className="bo-vs">→</span>
          <span className="bo-target">
            <span className="bo-name">Party</span>
          </span>
        </div>
        <div className={`bo-target-card ${shakeClass}`} key={shakeKey}>
          <div className="bo-hp-row">
            <span className="bo-hp-label">Party HP</span>
            <span className="bo-hp-value">{a.partyHpAfter}</span>
          </div>
          <div className="bo-hp-track">
            <div className="bo-hp-fill" style={{ width: `${hpPct}%`, background: '#ef4444', color: '#ef4444' }} />
          </div>
          {a.partyHpAfter <= 0 && <div className="bo-defeated">DEFEATED</div>}
        </div>
        <div className="bo-steps">
          <div className="bo-step current">
            <span className="bo-step-dart">{a.dart.label}</span>
            <span className="bo-step-formula">{a.dart.value <= 0 ? 'Miss · 0 dmg' : `${a.dart.value} dmg`}</span>
            <span className="bo-step-dmg">{a.damage > 0 ? `-${a.damage}` : '0'}</span>
          </div>
        </div>
        <button className="btn primary block" style={{ marginTop: 12 }} onClick={onContinue}>
          Continue
        </button>
      </div>
    </div>
  );
}
