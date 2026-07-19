import { useEffect, useState } from 'react';
import type { CampaignBattleState, CampaignProgress } from './types';
import { addDart, undoDart, resolvePlayerVisit, resolveEnemyTurn, setTarget, startBattle, getLevel, describeShield } from './engine';
import { Sound } from '../sound';
import type { Settings } from '../types';

interface Props {
  levelId: number;
  progress: CampaignProgress;
  settings: Settings;
  onWin: (newHighest: number, partyHp: number) => void;
  onLose: (partyHp: number) => void;
  onQuit: () => void;
}

export function CampaignBattle({ levelId, progress, settings, onWin, onLose, onQuit }: Props) {
  const level = getLevel(levelId)!;
  const [state, setState] = useState<CampaignBattleState>(() =>
    startBattle(level, progress.current_party_hp, progress.party_max_hp),
  );
  const [mult, setMult] = useState(1);
  const [showLog, setShowLog] = useState(false);

  // When phase becomes 'enemy', auto-run the enemy turn after a short delay.
  useEffect(() => {
    if (state.phase !== 'enemy') return;
    if (state.outcome !== 'ongoing') return;
    const t = setTimeout(() => {
      setState(prev => resolveEnemyTurn(prev));
      Sound.play('impact', {}, settings);
    }, 1100);
    return () => clearTimeout(t);
  }, [state.phase, state.outcome, settings]);

  // Victory / defeat handling.
  useEffect(() => {
    if (state.outcome === 'victory') {
      Sound.play('win', {}, settings);
      const newHighest = Math.max(progress.highest_level_beaten, levelId);
      onWin(newHighest, state.partyHp);
    } else if (state.outcome === 'defeat') {
      Sound.play('kill', {}, settings);
      onLose(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.outcome]);

  const aliveEnemies = state.enemies.filter(e => !e.defeated);
  const target = state.enemies[state.targetIdx];
  const validTarget = target && !target.defeated ? target : aliveEnemies[0];

  const onAdd = (base: number, m: number, labelOverride?: string, isBull?: boolean) => {
    setState(prev => addDart(prev, base, m, labelOverride, isBull));
    Sound.play('dart', { score: base * m }, settings);
  };

  const onUndo = () => setState(prev => undoDart(prev));

  const onEnter = () => {
    if (!state.darts.length) return;
    setState(prev => resolvePlayerVisit(prev));
    setShowLog(true);
  };

  const partyHpPct = Math.max(0, Math.min(100, (state.partyHp / state.partyMaxHp) * 100));

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

        {state.phase === 'player' && (
          <>
            <div className="pc-slots" style={{ marginTop: 6 }}>
              {[0, 1, 2].map(i => {
                const d = state.darts[i];
                return <div key={i} className={`pc-slot${d ? ' filled' : ''}`}>{d ? d.label : '–'}</div>;
              })}
            </div>
            <div className="muted small">
              This visit: <b style={{ color: 'var(--text)' }}>{state.darts.reduce((a, d) => a + d.value, 0)}</b>
              {validTarget && validTarget.shields.length > 0 && (
                <span style={{ marginLeft: 8, color: '#fbbf24' }}>
                  🛡 {validTarget.name} shields: {validTarget.shields.map(describeShield).join(' → ')}
                </span>
              )}
            </div>
          </>
        )}

        {state.phase === 'enemy' && (
          <div className="muted small" style={{ marginTop: 6, fontStyle: 'italic' }}>
            Enemies are attacking…
          </div>
        )}
      </div>

      <div className="play-others">
        {state.enemies.map((e, i) => {
          const hpPct = Math.max(0, Math.min(100, (e.hp / e.maxHp) * 100));
          const isTarget = i === state.targetIdx && !e.defeated;
          const canTarget = state.phase === 'player' && !e.defeated;
          return (
            <div
              key={e.id}
              className="play-other"
              onClick={() => canTarget && setState(prev => setTarget(prev, e.id))}
              style={{
                cursor: canTarget ? 'pointer' : 'default',
                opacity: e.defeated ? 0.4 : 1,
                borderColor: isTarget ? 'var(--accent)' : e.defeated ? 'var(--border)' : 'var(--border)',
                boxShadow: isTarget ? '0 0 0 2px var(--accent)' : 'none',
                background: e.defeated ? 'var(--bg-3)' : 'var(--bg-2)',
              }}
            >
              <div className="row between">
                <div className="row" style={{ gap: 6 }}>
                  <span className="po-name">{e.name}</span>
                  {e.defeated && <span className="pill" style={{ fontSize: 9, background: '#ef4444', color: '#fff' }}>DEFEATED</span>}
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

      {state.phase === 'player' && state.outcome === 'ongoing' && (
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

      <button className="btn danger sm" style={{ alignSelf: 'flex-end' }} onClick={() => { if (confirm('Quit this battle? Party HP will be saved.')) onQuit(); }}>Quit</button>

      {showLog && state.lastVisitLog.length > 0 && state.outcome === 'ongoing' && (
        <VisitLogOverlay log={state.lastVisitLog} onClose={() => setShowLog(false)} phase={state.phase} />
      )}
    </div>
  );
}

function VisitLogOverlay({ log, onClose, phase }: { log: CampaignBattleState['lastVisitLog']; onClose: () => void; phase: string }) {
  // Auto-dismiss once the enemy phase resolves back to player.
  useEffect(() => {
    if (phase === 'player') {
      const t = setTimeout(onClose, 1400);
      return () => clearTimeout(t);
    }
  }, [phase, onClose]);
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginBottom: 10 }}>Visit summary</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {log.map((entry, i) => (
            <div key={i} style={{ fontSize: 14, padding: 8, borderRadius: 8, background: 'var(--bg-3)' }}>
              {entry.kind === 'shield_break' && (
                <span>🛡 <b>{entry.dartLabel}</b> broke shield #{entry.shieldIndex + 1} ({entry.shieldTarget}) — 0 dmg</span>
              )}
              {entry.kind === 'damage' && (
                <span>💥 <b>{entry.dartLabel}</b> dealt <b style={{ color: 'var(--accent)' }}>{entry.damage}</b> dmg</span>
              )}
              {entry.kind === 'enemy_defeated' && (
                <span style={{ color: '#ef4444' }}>☠ <b>{entry.enemyName}</b> defeated!</span>
              )}
              {entry.kind === 'enemy_attack' && (
                <span>👹 <b>{entry.enemyName}</b> attacks: {entry.dartLabel} — <b style={{ color: '#ef4444' }}>−{entry.damage}</b> party HP</span>
              )}
              {entry.kind === 'party_hit' && (
                <span className="muted small">Party lost {entry.damage} HP this turn.</span>
              )}
            </div>
          ))}
        </div>
        <button className="btn primary block" style={{ marginTop: 12 }} onClick={onClose}>Continue</button>
      </div>
    </div>
  );
}
