import { useEffect, useState } from 'react';
import type { Settings, Player } from '../types';
import type { CampaignBattleState, CoopPlayer } from '../campaign/types';
import {
  addDart, undoDart, resolvePlayerVisit,
  prepareEnemyTurn, applyNextEnemyAttack, setTarget, effectivePower,
} from '../campaign/engine';
import { getEnemyDef } from '../campaign/engine/enemies';
import { Sound } from '../sound';
import type { MusicEngine } from '../music';
import { initials } from '../store';
import { DartOverlay } from '../campaign/DartOverlay';
import { FrozenOverlay } from '../campaign/FrozenOverlay';
import { Modal } from '../Popups';
import type { DartliteRun, ChoiceOption, DartlitePlayerRunStats } from './engine';
import { isMiniBossRound, isBossRound, applyPlayerChoice } from './engine';
import { getTrinket, TRINKETS } from './trinkets';

interface Props {
  run: DartliteRun;
  players: Player[];
  settings: Settings;
  music: MusicEngine;
  onBattleEnd: (won: boolean) => void;
  onChoice: (run: DartliteRun) => void;
  onQuit: () => void;
}

export function DartliteBattle({ run, players, settings, music, onBattleEnd, onChoice, onQuit }: Props) {
  const battle = run.battle!;
  // Sync local battle state whenever a new round/battle starts. Without
  // this, `useState(battle)` keeps the stale first-round state after
  // `onChoice` swaps in a fresh `run.battle`, freezing the game.
  const [state, setState] = useState<CampaignBattleState>(battle);
  useEffect(() => { setState(battle); }, [battle]);
  const [showProgress, setShowProgress] = useState(false);
  const [detailPlayerId, setDetailPlayerId] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [showTrinketUnlock, setShowTrinketUnlock] = useState(false);
  const [mult, setMult] = useState(1);

  useEffect(() => {
    if (run.lastUnlockedTrinket) setShowTrinketUnlock(true);
  }, [run.lastUnlockedTrinket]);

  useEffect(() => {
    music.startContext('coop', settings);
    return () => { music.stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (state.outcome === 'victory') {
      Sound.play('win', {}, settings);
      onBattleEnd(true);
    } else if (state.outcome === 'defeat') {
      Sound.play('kill', {}, settings);
      onBattleEnd(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.outcome]);

  useEffect(() => {
    if (state.phase !== 'enemy') return;
    if (state.outcome !== 'ongoing') return;
    if (state.pendingEnemyAttacks.length) return;
    if (state.appliedEnemyAttacks.length) return;
    if (state.frozenEnemiesThisRound.length) return;
    const t = setTimeout(() => {
      setState(prev => prepareEnemyTurn(prev));
      Sound.play('impact', {}, settings);
    }, 600);
    return () => clearTimeout(t);
  }, [state.phase, state.outcome, state.pendingEnemyAttacks.length, state.appliedEnemyAttacks.length, state.frozenEnemiesThisRound.length, settings]);

  const aliveEnemies = state.enemies.filter(e => !e.defeated);
  const thrower = state.players[state.playerTurnIdx];

  const onAdd = (base: number, m: number, labelOverride?: string, isBull?: boolean) => {
    setState(prev => addDart(prev, base, m, labelOverride, isBull, settings));
    Sound.play('dart', { score: base * m }, settings);
    if (base > 0) Sound.play('impact', {}, settings);
    setMult(1);
  };
  const onUndo = () => setState(prev => undoDart(prev, settings));
  const onEnter = () => {
    if (!state.darts.length) return;
    setState(prev => resolvePlayerVisit(prev));
  };
  const onContinue = () => {
    if (state.pendingEnemyAttacks.length) {
      setState(prev => applyNextEnemyAttack(prev));
      Sound.play('impact', {}, settings);
      return;
    }
    if (state.phase === 'enemy' && state.frozenEnemiesThisRound.length) {
      setState(prev => applyNextEnemyAttack(prev));
    }
  };

  const partyHpPct = Math.max(0, Math.min(100, (state.partyHp / state.partyMaxHp) * 100));
  const playerVisitDone = state.phase === 'player' && state.darts.length >= 3 && state.outcome === 'ongoing';
  const showingFrozen = state.phase === 'enemy'
    && state.pendingEnemyAttacks.length === 0
    && state.appliedEnemyAttacks.length === 0
    && state.frozenEnemiesThisRound.length > 0;
  const showingOverlay = playerVisitDone || state.pendingEnemyAttacks.length > 0 || showingFrozen;

  const enemyNumberMap: Record<string, number> = {};
  let enemyCounter = 0;
  for (const e of state.enemies) {
    if (enemyNumberMap[e.defId] == null) {
      const def = getEnemyDef(e.defId);
      if (def?.difficulty !== 'Boss') enemyCounter++;
      enemyNumberMap[e.defId] = enemyCounter;
    }
  }
  const enemyIcon = (defId: string): string => {
    const def = getEnemyDef(defId);
    if (def?.difficulty === 'Boss') return '☠';
    return `${enemyNumberMap[defId]}`;
  };

  const roundLabel = isBossRound(run.round) ? `☠ BOSS — Round ${run.round}`
    : isMiniBossRound(run.round) ? `⚔ Mini-Boss — Round ${run.round}`
    : `Round ${run.round}`;

  const allTrinkets = run.runPlayers.flatMap(p => p.trinkets);

  return (
    <div className="view-noscroll coop-battle" style={{ position: 'relative', background: 'radial-gradient(ellipse at top, color-mix(in srgb,#7c3aed 15%,var(--bg)) 0%, var(--bg) 70%)', borderRadius: 14, overflow: 'hidden' }}>
      <button className="btn danger sm quit-float" onClick={() => { if (confirm('Quit this run? Progress will be saved.')) onQuit(); }}>Quit</button>

      {run.phase === 'choice' && run.pendingChoice ? (
        <ChoiceScreen
          run={run}
          players={players}
          options={run.pendingChoice}
          onPick={(opt) => {
            const next = applyPlayerChoice(run, opt);
            if (next.phase === 'reward') {
              // All players have chosen — show the progress popup. The
              // next round starts when the player dismisses it.
              setShowProgress(true);
            } else {
              onChoice(next);
            }
          }}
        />
      ) : run.phase === 'reward' ? (
        <ProgressScreen
          run={run}
          players={players}
          onContinue={() => { onChoice(run); }}
        />
      ) : (
        <>
          <div className="play-current" style={{ position: 'relative', zIndex: 2 }}>
            <div className="pc-header">
              <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                <button onClick={() => setShowInfo(true)} title="Run info"
                  style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 8, width: 32, height: 32, fontSize: 16, cursor: 'pointer', padding: 0, color: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>ℹ</button>
                <span className="muted small" style={{ fontWeight: 700 }}>{roundLabel} · VISIT {state.visitNumber} · {state.phase === 'player' ? 'YOUR TURN' : 'ENEMY TURN'}</span>
              </div>
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

            {allTrinkets.length > 0 && (
              <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {allTrinkets.map((tid, i) => {
                  const t = getTrinket(tid);
                  return t ? (
                    <span key={i} title={`${t.name}: ${t.desc}`} className="pill" style={{ fontSize: 10, padding: '2px 6px', background: 'color-mix(in srgb,#7c3aed 18%,var(--bg-3))', color: '#c4b5fd', borderColor: 'transparent' }}>
                      {t.icon} {t.name}
                    </span>
                  ) : null;
                })}
              </div>
            )}

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
                    fontWeight: isThrower ? 800 : 600, fontSize: 12,
                  }}>
                    <span className="avatar" style={{ width: 18, height: 18, fontSize: 9, background: isThrower ? 'rgba(0,0,0,.25)' : p.color }}>{initials(p.name)}</span>
                    {p.name}
                    <span style={{ fontSize: 10, opacity: 0.8 }}>⚡{effectivePower(p)}</span>
                  </div>
                );
              })}
            </div>

            {state.phase === 'player' && thrower && (
              <>
                <div className="pc-slots" style={{ marginTop: 6 }}>
                  {[0, 1, 2].map(i => {
                    const d = state.darts[i];
                    if (!d) return <div key={i} className="pc-slot">–</div>;
                    const r = state.resolvedDarts[i];
                    const isDefeated = r?.kind === 'defeated';
                    return (
                      <div key={i} className="pc-slot filled" style={{
                        borderColor: isDefeated ? '#ef4444' : undefined,
                        background: isDefeated ? 'color-mix(in srgb,#ef4444 18%,var(--bg-3))' : undefined,
                        flexDirection: 'row', gap: 6, justifyContent: 'space-between', padding: '4px 8px',
                      }}>
                        <span style={{ fontWeight: 800, fontSize: 15 }}>{d.label}</span>
                        {r && (
                          <span style={{ fontSize: 10, fontWeight: 700, opacity: 0.9 }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 18, height: 18, borderRadius: 6, padding: '0 4px', background: 'color-mix(in srgb,var(--accent) 22%,var(--bg))', color: 'var(--accent)', fontSize: 10, fontWeight: 900 }}>{enemyIcon(state.enemies.find(e => e.id === r.enemyId)?.defId ?? r.enemyId)}</span>
                            {r.damage > 0 ? `-${r.damage}` : r.kind === 'shield_break' ? '🛡' : ''}
                            {isDefeated ? ' ☠' : ''}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="muted small">
                  <b style={{ color: 'var(--text)' }}>{thrower.name}</b> · <b style={{ color: 'var(--text)' }}>{state.resolvedDarts.reduce((a, d) => a + d.damage, 0)} dmg</b>
                  <span style={{ marginLeft: 8, color: '#fbbf24' }}>⚡ Power: <b>{effectivePower(thrower)}</b></span>
                </div>
              </>
            )}

            {state.phase === 'enemy' && !state.pendingEnemyAttacks.length && !state.frozenEnemiesThisRound.length && (
              <div className="muted small" style={{ marginTop: 6, fontStyle: 'italic' }}>Enemies are preparing to attack…</div>
            )}
          </div>

          <div className="play-others">
            {state.enemies.map((e, i) => {
              const hpPct = Math.max(0, Math.min(100, (e.hp / e.maxHp) * 100));
              const isTarget = i === state.targetIdx && !e.defeated;
              const canTarget = state.phase === 'player' && !e.defeated && state.darts.length < 3 && state.outcome === 'ongoing';
              return (
                <div key={e.id} className="play-other" onClick={() => canTarget && setState(prev => setTarget(prev, e.id))}
                  style={{ cursor: canTarget ? 'pointer' : 'default', opacity: e.defeated ? 0.4 : 1, borderColor: isTarget ? 'var(--accent)' : 'var(--border)', boxShadow: isTarget ? '0 0 0 2px var(--accent)' : 'none', background: e.defeated ? 'var(--bg-3)' : 'var(--bg-2)' }}>
                  <div className="row between">
                    <div className="row" style={{ gap: 6 }}>
                      <span className="po-name">{e.name}</span>
                      {e.defeated && <span className="pill" style={{ fontSize: 9, background: '#ef4444', color: '#fff' }}>DEFEATED</span>}
                      {e.frozenTurns > 0 && <span className="pill" style={{ fontSize: 9, background: '#60a5fa', color: '#0b0e13' }}>❄ FROZEN {e.frozenTurns}</span>}
                    </div>
                    <span className="pill" style={{ fontSize: 10 }}>{e.hp} HP</span>
                  </div>
                  <div style={{ marginTop: 4, height: 6, borderRadius: 3, background: 'var(--bg-3)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${hpPct}%`, background: e.defeated ? 'var(--muted)' : '#ef4444', transition: 'width .4s' }} />
                  </div>
                  <div className="po-sub">🛡 {e.armor}% · 🎯 {Math.round(e.accuracy * 100)}% acc{e.shields.length ? ` · 🛡 ${e.shields.length} shield${e.shields.length === 1 ? '' : 's'}` : ''}</div>
                </div>
              );
            })}
          </div>

          {state.phase === 'player' && state.outcome === 'ongoing' && state.darts.length < 3 && (
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
                  <button className="btn block ghost" onClick={onUndo} disabled={!state.darts.length}>↶ Undo</button>
                  <button className="btn block primary" onClick={onEnter} disabled={!state.darts.length}>End visit</button>
                </div>
              </div>
            </div>
          )}

          {showingFrozen && <FrozenOverlay state={state} onContinue={onContinue} />}
          {showingOverlay && !showingFrozen && (
            <DartOverlay state={state} onContinue={onContinue} onEndVisit={onEnter} settings={settings} enemyIcon={enemyIcon} />
          )}

          {showTrinketUnlock && run.lastUnlockedTrinket && (() => {
            const t = getTrinket(run.lastUnlockedTrinket);
            return t ? (
              <Modal onClose={() => setShowTrinketUnlock(false)}>
                <div style={{ textAlign: 'center', padding: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.14em', color: '#c4b5fd', textTransform: 'uppercase' }}>New Trinket Unlocked!</div>
                  <div style={{ fontSize: 40, margin: '12px 0' }}>{t.icon}</div>
                  <div style={{ fontSize: 20, fontWeight: 900 }}>{t.name}</div>
                  <div className='muted' style={{ fontSize: 13, marginTop: 6, maxWidth: 280, margin: '6px auto 12px' }}>{t.desc}</div>
                  <div className='muted small' style={{ marginBottom: 12 }}>This trinket is now available in the pool for future runs.</div>
                  <button className='btn primary block' onClick={() => setShowTrinketUnlock(false)}>Awesome!</button>
                </div>
              </Modal>
            ) : null;
          })()}

          {showInfo && (
            <Modal onClose={() => setShowInfo(false)}>
              <div style={{ textAlign: 'center', padding: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.14em', color: '#c4b5fd', textTransform: 'uppercase' }}>Dartlite Run</div>
                <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 4 }}>{roundLabel}</div>
                <div className="muted small" style={{ marginBottom: 10 }}>Round {run.round} of an endless run. Mini-boss every 5, boss every 10.</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                  <div><div style={{ fontWeight: 800 }}>{run.stats.roundsCleared}</div><div className="muted small">Rounds cleared</div></div>
                  <div><div style={{ fontWeight: 800 }}>{run.stats.enemiesDefeated}</div><div className="muted small">Enemies defeated</div></div>
                  <div><div style={{ fontWeight: 800 }}>{run.stats.miniBossesDefeated}</div><div className="muted small">Mini-bosses</div></div>
                  <div><div style={{ fontWeight: 800 }}>{run.stats.bossesDefeated}</div><div className="muted small">Bosses</div></div>
                </div>
                <button className="btn primary block" onClick={() => setShowInfo(false)}>Close</button>
              </div>
            </Modal>
          )}

          {showProgress && (
            <ProgressScreen
              run={run}
              players={players}
              onContinue={() => { setShowProgress(false); onChoice(run); }}
            />
          )}

          {detailPlayerId && (
            <PlayerDetailModal
              playerId={detailPlayerId}
              run={run}
              players={players}
              onClose={() => setDetailPlayerId(null)}
            />
          )}
        </>
      )}
    </div>
  );
}

// ── Choice screen ─────────────────────────────────────────────────────

function ChoiceScreen({ run, players, options, onPick }: { run: DartliteRun; players: Player[]; options: ChoiceOption[]; onPick: (opt: ChoiceOption) => void }) {
  const chooserIdx = run.choicePlayerIdx;
  const chooserId = run.playerIds[chooserIdx];
  const chooser = players.find(p => p.id === chooserId);
  const chooserName = chooser?.name || `Player ${chooserIdx + 1}`;
  const chooserColor = chooser?.color || '#7c3aed';
  const alreadyChosen = run.playerIds.length > 1
    ? run.playerIds.slice(0, chooserIdx).map(id => players.find(p => p.id === id)?.name || 'Player').join(', ')
    : '';

  return (
    <div className="view-scroll" style={{ background: 'radial-gradient(ellipse at top, color-mix(in srgb,#7c3aed 15%,var(--bg)) 0%, var(--bg) 70%)', minHeight: '100%' }}>
      <div className="card" style={{ maxWidth: 480, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.14em', color: '#c4b5fd', textTransform: 'uppercase' }}>Round {run.round} Cleared</div>
          <div style={{ fontSize: 22, fontWeight: 900, marginTop: 4 }}>Choose a Boon</div>
          <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 999, background: `color-mix(in srgb, ${chooserColor} 22%, var(--bg-3))`, border: `1px solid ${chooserColor}` }}>
            <span className="avatar" style={{ background: chooserColor, width: 22, height: 22, fontSize: 10 }}>{initials(chooserName)}</span>
            <span style={{ fontWeight: 800, fontSize: 14 }}>{chooserName} is choosing</span>
          </div>
          <div className="muted small" style={{ marginTop: 6 }}>
            {alreadyChosen ? `Already chosen: ${alreadyChosen}` : 'Each player picks their own personal reward.'}
          </div>
        </div>
        <div style={{ display: 'grid', gap: 10 }}>
          {options.map((opt, i) => (
            <button key={i} className="btn block" style={{ padding: 14, textAlign: 'left', background: `linear-gradient(135deg, color-mix(in srgb, ${chooserColor} 18%, var(--bg-3)) 0%, var(--bg-3) 80%)`, borderColor: `color-mix(in srgb, ${chooserColor} 40%, var(--border))` }}
              onClick={() => onPick(opt)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 26 }}>{opt.icon}</span>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>{opt.label}</div>
                  <div className="muted small" style={{ marginTop: 2 }}>{opt.desc}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Progress popup (between rounds) ─────────────────────────────────
//
// Shown after every player has chosen their personal reward. Lists all
// players in the run with a quick summary. Clicking a player opens a
// detail modal with their run stats, chosen rewards, kills, and trinkets.
// Clicking a trinket shows the trinket's full description.
function ProgressScreen({ run, players, onContinue }: { run: DartliteRun; players: Player[]; onContinue: () => void }) {
  const [detailId, setDetailId] = useState<string | null>(null);

  return (
    <div className="view-scroll" style={{ background: 'radial-gradient(ellipse at top, color-mix(in srgb,#7c3aed 12%,var(--bg)) 0%, var(--bg) 70%)', minHeight: '100%' }}>
      <div className="card" style={{ maxWidth: 520, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.14em', color: '#c4b5fd', textTransform: 'uppercase' }}>Run Progress</div>
          <div style={{ fontSize: 22, fontWeight: 900, marginTop: 4 }}>Round {run.round} Complete</div>
          <div className="muted small" style={{ marginTop: 4 }}>
            {run.stats.roundsCleared} rounds cleared · {run.stats.enemiesDefeated} kills · Round {run.round + 1} next
          </div>
        </div>

        <div className="muted small" style={{ fontWeight: 700, marginBottom: 8 }}>Tap a player for details</div>
        <div style={{ display: 'grid', gap: 8 }}>
          {run.playerIds.map((pid) => {
            const p = players.find(x => x.id === pid);
            if (!p) return null;
            const ps = run.playerStats.find(s => s.playerId === pid);
            const rp = run.runPlayers.find(r => r.playerId === pid);
            return (
              <button key={pid} className="btn block" style={{ padding: 12, textAlign: 'left', background: 'var(--bg-3)', borderColor: 'var(--border)' }}
                onClick={() => setDetailId(pid)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="avatar" style={{ background: p.color, width: 30, height: 30, fontSize: 12 }}>{initials(p.name)}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800 }}>{p.name}</div>
                    <div className="muted small">
                      {ps?.kills ?? 0} kills · {ps?.damageDealt ?? 0} dmg · {ps?.trinkets.length ?? 0} trinkets
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: '#c4b5fd', fontWeight: 700 }}>{ps?.rewards.length ?? 0} rewards</div>
                    <div className="muted small">HP {rp?.hp ?? 0}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <button className="btn primary block" style={{ marginTop: 18 }} onClick={onContinue}>
          Continue to Round {run.round + 1}
        </button>
      </div>

      {detailId && (
        <PlayerDetailModal playerId={detailId} run={run} players={players} onClose={() => setDetailId(null)} />
      )}
    </div>
  );
}

// ── Player detail modal ──────────────────────────────────────────────
//
// Shows a single player's run breakdown: stats, chosen rewards, kills,
// and acquired trinkets. Clicking a trinket shows its full description.
function PlayerDetailModal({ playerId, run, players, onClose }: { playerId: string; run: DartliteRun; players: Player[]; onClose: () => void }) {
  const [trinketInfo, setTrinketInfo] = useState<keyof typeof TRINKETS | null>(null);
  const p = players.find(x => x.id === playerId);
  if (!p) return null;
  const ps = run.playerStats.find(s => s.playerId === playerId);
  const rp = run.runPlayers.find(r => r.playerId === playerId);

  return (
    <Modal onClose={onClose}>
      <div style={{ padding: 8, maxWidth: 420 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <span className="avatar" style={{ background: p.color, width: 36, height: 36, fontSize: 14 }}>{initials(p.name)}</span>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900 }}>{p.name}</div>
            <div className="muted small">Round {run.round} · Dartlite Run</div>
          </div>
        </div>

        <div className="card" style={{ padding: 12, background: 'var(--bg-3)', marginBottom: 12 }}>
          <div className="muted small" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 8 }}>Stats</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <DetailStat label="Kills" value={ps?.kills ?? 0} />
            <DetailStat label="Damage" value={ps?.damageDealt ?? 0} />
            <DetailStat label="HP" value={rp?.hp ?? 0} />
            <DetailStat label="Max HP" value={rp?.maxHp ?? 0} />
            <DetailStat label="Armor" value={`${rp?.armor ?? 0}%`} />
            <DetailStat label="Power" value={rp?.power ?? 0} />
          </div>
        </div>

        <div className="card" style={{ padding: 12, background: 'var(--bg-3)', marginBottom: 12 }}>
          <div className="muted small" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 8 }}>Chosen Rewards ({ps?.rewards.length ?? 0})</div>
          {ps && ps.rewards.length > 0 ? (
            <div style={{ display: 'grid', gap: 6 }}>
              {ps.rewards.map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 18 }}>{r.icon}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{r.label}</div>
                    <div className="muted small">{r.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="muted small">No rewards chosen yet.</div>
          )}
        </div>

        <div className="card" style={{ padding: 12, background: 'var(--bg-3)' }}>
          <div className="muted small" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 8 }}>Trinkets ({ps?.trinkets.length ?? 0})</div>
          {ps && ps.trinkets.length > 0 ? (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {ps.trinkets.map((tid, i) => {
                const t = getTrinket(tid);
                return t ? (
                  <button key={i} className="pill" style={{ fontSize: 11, background: 'color-mix(in srgb,#7c3aed 18%,var(--bg-3))', color: '#c4b5fd', borderColor: 'transparent', cursor: 'pointer', padding: '4px 10px' }}
                    onClick={() => setTrinketInfo(tid)}>
                    {t.icon} {t.name}
                  </button>
                ) : null;
              })}
            </div>
          ) : (
            <div className="muted small">No trinkets acquired yet.</div>
          )}
        </div>

        <button className="btn primary block" style={{ marginTop: 16 }} onClick={onClose}>Close</button>
      </div>

      {trinketInfo && (
        <Modal onClose={() => setTrinketInfo(null)}>
          <div style={{ padding: 16, textAlign: 'center', maxWidth: 360 }}>
            <div style={{ fontSize: 40 }}>{TRINKETS[trinketInfo].icon}</div>
            <div style={{ fontSize: 18, fontWeight: 900, marginTop: 6 }}>{TRINKETS[trinketInfo].name}</div>
            <div className="pill" style={{ marginTop: 6, display: 'inline-flex', background: 'color-mix(in srgb,#7c3aed 18%,var(--bg-3))', color: '#c4b5fd', borderColor: 'transparent' }}>
              Tier {TRINKETS[trinketInfo].tier}
            </div>
            <div className="muted" style={{ marginTop: 10, fontSize: 13, lineHeight: 1.5 }}>{TRINKETS[trinketInfo].desc}</div>
            <button className="btn primary block" style={{ marginTop: 14 }} onClick={() => setTrinketInfo(null)}>Close</button>
          </div>
        </Modal>
      )}
    </Modal>
  );
}

function DetailStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontWeight: 900, fontSize: 16 }}>{value}</div>
      <div className="muted small" style={{ marginTop: 2 }}>{label}</div>
    </div>
  );
}
