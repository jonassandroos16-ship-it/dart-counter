import { useEffect, useState } from 'react';
import type { CampaignBattleState, CampaignProgress, CoopPowerUpDef, CoopPowerUpId, EnemyAttackStep } from './types';
import {
  addDart, undoDart, resolvePlayerVisit,
  prepareEnemyTurn, applyNextEnemyAttack, setTarget, startBattle, getLevel,
  describeShield, getCoopPowerUp, canActivateCoopPowerUp, activateCoopPowerUp,
  levelRewardPowerUp, getCoopClass,
} from './engine';
import { getChapter } from './campaignLevels';
import type { Player, Settings } from '../types';
import { Sound } from '../sound';
import { initials } from '../store';
import { bumpCoopStat } from './coopStats';
import { Modal } from '../Popups';

interface Props {
  levelId: number;
  chapterId: string;
  progress: CampaignProgress;
  settings: Settings;
  players: Player[];
  onWin: (newHighest: number, unlockedPowerUpId: string | null, stats: CampaignBattleState['stats']) => void;
  onLose: () => void;
  onQuit: () => void;
}

export function CampaignBattle({ levelId, chapterId, progress, settings, players, onWin, onLose, onQuit }: Props) {
  const chapter = getChapter(chapterId);
  const level = (chapter?.levels.find(l => l.level_id === levelId)) || getLevel(levelId)!;
  const [state, setState] = useState<CampaignBattleState>(() =>
    startBattle(level, players, settings, undefined, chapterId),
  );
  const [mult, setMult] = useState(1);

  // Victory / defeat handling.
  useEffect(() => {
    if (state.outcome === 'victory') {
      Sound.play('win', {}, settings);
      bumpCoopStat('levelsCleared');
      const newHighest = Math.max(progress.highest_level_beaten, levelId);
      // Determine if this level grants a power-up reward the player hasn't
      // already unlocked. The first time a level is beaten, the reward is
      // unlocked; replaying a level does not re-grant it.
      const rewardId = levelRewardPowerUp(levelId, chapterId);
      const alreadyUnlocked = !!rewardId && (progress.unlockedPowerUps || []).includes(rewardId);
      const grantId = rewardId && !alreadyUnlocked ? rewardId : null;
      onWin(newHighest, grantId, state.stats);
    } else if (state.outcome === 'defeat') {
      Sound.play('kill', {}, settings);
      onLose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.outcome]);

  // When entering the enemy phase, prepare the enemy attack steps. The UI
  // then animates through them one at a time, requiring the player to tap
  // "Continue" to advance — so the player can see what each dart did.
  // Frozen enemies produce no attack steps; the frozen popup is shown
  // instead (see `frozenEnemiesThisRound`).
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
  const target = state.enemies[state.targetIdx];
  const validTarget = target && !target.defeated ? target : aliveEnemies[0];
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
    // No pending attacks — either the enemy phase is done, or all enemies
    // were frozen this round. Advancing finishes the enemy turn and returns
    // to the player phase.
    if (state.phase === 'enemy' && state.frozenEnemiesThisRound.length) {
      setState(prev => applyNextEnemyAttack(prev));
    }
  };

  const onActivatePowerUp = (id: CoopPowerUpId) => {
    setState(prev => activateCoopPowerUp(prev, id));
    Sound.play('impact', {}, settings);
    if (id === 'coop_heal' || id === 'coop_ressurect') bumpCoopStat('healsUsed');
    else if (id === 'coop_freeze') bumpCoopStat('freezesUsed');
    else if (id === 'coop_buff_power' || id === 'coop_buff_acc') bumpCoopStat('buffsUsed');
    else if (id === 'coop_shield') bumpCoopStat('shieldsUsed');
    else if (id === 'coop_apocalypse') {
      bumpCoopStat('healsUsed');
      bumpCoopStat('freezesUsed');
    }
  };

  const partyHpPct = Math.max(0, Math.min(100, (state.partyHp / state.partyMaxHp) * 100));
  // Show the player summary overlay once the player has thrown all 3 darts
  // (or fewer, if every enemy is already defeated). The enemy overlay shows
  // whenever there are pending enemy attacks to animate. The frozen overlay
  // shows when the enemy phase has produced no attacks because every alive
  // enemy is frozen — the player taps Continue to advance to their turn.
  const playerVisitDone = state.phase === 'player'
    && state.darts.length >= 3
    && state.outcome === 'ongoing';
  const showingFrozen = state.phase === 'enemy'
    && state.pendingEnemyAttacks.length === 0
    && state.appliedEnemyAttacks.length === 0
    && state.frozenEnemiesThisRound.length > 0;
  const showingOverlay = playerVisitDone || state.pendingEnemyAttacks.length > 0 || showingFrozen;

  return (
    <div className="view-noscroll coop-battle" style={{ position: 'relative', background: chapter?.theme.background || undefined, borderRadius: 14, overflow: 'hidden' }}>
      {showingFrozen && <div className="battle-frost-tint" />}
      <div className="play-current" style={{ position: 'relative', zIndex: 2 }}>
        <div className="pc-header">
          <div className="row" style={{ gap: 8, alignItems: 'center' }}>
            <span className="pc-name">{level.is_boss ? '☠ BOSS · ' : ''}{level.name}</span>
            {chapter && <span className="muted small" style={{ color: chapter.theme.accent }}>{chapter.name}</span>}
          </div>
          <div className="row" style={{ gap: 8, alignItems: 'center' }}>
            <span className="muted small">VISIT {state.visitNumber} · {state.phase === 'player' ? 'YOUR TURN' : 'ENEMY TURN'}</span>
            {state.phase === 'player' && thrower && (() => {
              const srcPlayer = players.find(p => p.id === thrower.id);
              const equippedId = srcPlayer?.powerUps?.coopActive ?? null;
              const pu = equippedId ? getCoopPowerUp(equippedId as CoopPowerUpId) : null;
              if (!pu) return null;
              const can = canActivateCoopPowerUp(state, pu.id);
              return (
                <CoopPowerUpOrb
                  charge={thrower.powerUpCharge}
                  pu={pu}
                  canActivate={can && state.darts.length === 0}
                  onActivate={() => onActivatePowerUp(pu.id)}
                />
              );
            })()}
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

        {/* Party roster — shows all players, who's throwing now, and active buffs. */}
        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          {state.players.map((p, i) => {
            const isThrower = state.phase === 'player' && i === state.playerTurnIdx;
            const srcPlayer = players.find(sp => sp.id === p.id);
            const classDef = getCoopClass(srcPlayer?.coopProgress?.classId);
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
                {classDef && (
                  <span title={`${classDef.name}: ${classDef.desc}`} style={{ fontSize: 11, marginLeft: 2 }}>
                    {classDef.icon}
                  </span>
                )}
                {/* Per-player charge pip — shows each player's own orb progress. */}
                <span title={`${p.name}'s power-up charge`} style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  minWidth: 22, padding: '1px 5px', borderRadius: 8, fontSize: 9, fontWeight: 800,
                  background: isThrower ? 'rgba(0,0,0,.2)' : 'var(--bg-2)',
                  color: isThrower ? '#0b0e13' : 'var(--muted)',
                  border: '1px solid var(--border)',
                  marginLeft: 2,
                }}>
                  {Math.round(p.powerUpCharge)}%
                </span>
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

        {/* Passive bonus summary — shows the team-wide stat bonuses
            contributed by each player's equipped class passives. */}
        {state.passiveBonus && (state.passiveBonus.power > 0 || state.passiveBonus.health > 0 || state.passiveBonus.armor > 0) && (
          <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {state.passiveBonus.power > 0 && (
              <span className="pill" style={{ fontSize: 10, background: 'color-mix(in srgb,#fbbf24 18%,var(--bg-3))', color: '#fbbf24', borderColor: 'transparent' }}>
                ⚡ +{state.passiveBonus.power} party power
              </span>
            )}
            {state.passiveBonus.health > 0 && (
              <span className="pill" style={{ fontSize: 10, background: 'color-mix(in srgb,#22c55e 18%,var(--bg-3))', color: '#86efac', borderColor: 'transparent' }}>
                ❤️ +{state.passiveBonus.health} party HP
              </span>
            )}
            {state.passiveBonus.armor > 0 && (
              <span className="pill" style={{ fontSize: 10, background: 'color-mix(in srgb,#60a5fa 18%,var(--bg-3))', color: '#93c5fd', borderColor: 'transparent' }}>
                🛡️ +{state.passiveBonus.armor}% party armor
              </span>
            )}
          </div>
        )}

        {state.phase === 'player' && thrower && (
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
                  }}>
                    <div style={{ fontWeight: 800 }}>{d.label}</div>
                    {r && (
                      <div style={{ fontSize: 9, marginTop: 2, opacity: 0.85 }}>
                        → {r.enemyName}{r.damage > 0 ? ` · -${r.damage}` : r.kind === 'shield_break' ? ' · 🛡' : ''}
                        {isDefeated ? ' · ☠' : ''}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="muted small">
              <b style={{ color: 'var(--text)' }}>{thrower.name}</b> is throwing · this visit: <b style={{ color: 'var(--text)' }}>{state.resolvedDarts.reduce((a, d) => a + d.damage, 0)} dmg</b>
              {validTarget && validTarget.shields.length > 0 && (
                <span style={{ marginLeft: 8, color: '#fbbf24' }}>
                  🛡 {validTarget.name} shields: {validTarget.shields.map(describeShield).join(' → ')}
                </span>
              )}
            </div>
          </>
        )}

        {state.phase === 'enemy' && !state.pendingEnemyAttacks.length && !state.frozenEnemiesThisRound.length && (
          <div className="muted small" style={{ marginTop: 6, fontStyle: 'italic' }}>
            Enemies are preparing to attack…
          </div>
        )}
      </div>

      <div className="play-others">
        {state.enemies.map((e, i) => {
          const hpPct = Math.max(0, Math.min(100, (e.hp / e.maxHp) * 100));
          const isTarget = i === state.targetIdx && !e.defeated;
          const canTarget = state.phase === 'player' && !e.defeated && state.darts.length < 3 && state.outcome === 'ongoing';
          const frozen = e.frozenTurns > 0;
          const vulnerable = e.vulnerableTurns > 0;
          const distracted = e.distractedTurns > 0;
          const effAcc = Math.max(0, e.accuracy - (distracted ? e.distractAmount : 0));
          return (
            <div
              key={e.id}
              className="play-other"
              onClick={() => canTarget && setState(prev => setTarget(prev, e.id))}
              style={{
                cursor: canTarget ? 'pointer' : 'default',
                opacity: e.defeated ? 0.4 : 1,
                borderColor: isTarget ? 'var(--accent)' : e.defeated ? 'var(--border)' : frozen ? 'color-mix(in srgb,#60a5fa 60%,var(--border))' : distracted ? 'color-mix(in srgb,#a78bfa 60%,var(--border))' : vulnerable ? 'color-mix(in srgb,#fbbf24 60%,var(--border))' : 'var(--border)',
                boxShadow: isTarget ? '0 0 0 2px var(--accent)' : 'none',
                background: e.defeated ? 'var(--bg-3)' : frozen ? 'color-mix(in srgb,#60a5fa 12%,var(--bg-2))' : distracted ? 'color-mix(in srgb,#a78bfa 12%,var(--bg-2))' : vulnerable ? 'color-mix(in srgb,#fbbf24 12%,var(--bg-2))' : 'var(--bg-2)',
              }}
            >
              <div className="row between">
                <div className="row" style={{ gap: 6 }}>
                  <span className="po-name">{e.name}</span>
                  {e.defeated && <span className="pill" style={{ fontSize: 9, background: '#ef4444', color: '#fff' }}>DEFEATED</span>}
                  {frozen && <span className="pill" style={{ fontSize: 9, background: '#60a5fa', color: '#0b0e13' }}>❄ FROZEN {e.frozenTurns}</span>}
                  {distracted && !e.defeated && <span className="pill" style={{ fontSize: 9, background: '#a78bfa', color: '#0b0e13' }}>🎯 DISTRACTED {e.distractedTurns}</span>}
                  {vulnerable && !e.defeated && <span className="pill" style={{ fontSize: 9, background: '#fbbf24', color: '#0b0e13' }}>⏳ VULN {e.vulnerableTurns}</span>}
                </div>
                <span className="pill" style={{ fontSize: 10 }}>{e.hp} HP</span>
              </div>
              <div style={{ marginTop: 4, height: 6, borderRadius: 3, background: 'var(--bg-3)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${hpPct}%`, background: e.defeated ? 'var(--muted)' : '#ef4444', transition: 'width .4s' }} />
              </div>
              <div className="po-sub">🛡 {e.armor}% armor · 🎯 {Math.round(effAcc * 100)}% acc{distracted ? ' (debuffed)' : ''}{e.shields.length ? ` · 🛡 ${e.shields.length} shield${e.shields.length === 1 ? '' : 's'}` : ''}</div>
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

      {/* Coop power-up activation is handled via the orb in the player card header. */}

      {state.phantomDarts > 0 && state.phase === 'player' && (
        <div className="pill" style={{ marginTop: 6, background: 'color-mix(in srgb,#22d3ee 22%,var(--bg-3))', color: '#cffafe', borderColor: 'transparent' }}>
          👻 Phantom Darts active — next {state.phantomDarts} dart{state.phantomDarts === 1 ? '' : 's'} auto-bullseye
        </div>
      )}

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
              <button className="btn block ghost" onClick={onUndo} disabled={!state.darts.length}>↶ Undo dart</button>
              <button className="btn block primary" onClick={onEnter} disabled={!state.darts.length}>End visit</button>
            </div>
          </div>
        </div>
      )}

      <button className="btn danger sm" style={{ alignSelf: 'flex-end' }} onClick={() => { if (confirm('Quit this battle? Progress will be saved.')) onQuit(); }}>Quit</button>

      {showingFrozen && (
        <FrozenOverlay state={state} onContinue={onContinue} />
      )}

      {showingOverlay && !showingFrozen && (
        <DartOverlay
          state={state}
          onContinue={onContinue}
          onEndVisit={onEnter}
        />
      )}
    </div>
  );
}

// ── Coop power-up orb ─────────────────────────────────────────────────
//
// Mirrors the competitive PowerUpOrb: a circular button with a charge ring
// and percentage badge. Opens a modal with the power-up description and an
// activate button. Sits inside the player card header so it's always
// visible during the player's turn — same placement pattern as the
// competitive boards.
function CoopPowerUpOrb({ charge, pu, canActivate, onActivate }: {
  charge: number;
  pu: CoopPowerUpDef | null;
  canActivate: boolean;
  onActivate: () => void;
}) {
  const [open, setOpen] = useState(false);
  const cap = 100;
  const clamped = Math.max(0, Math.min(cap, charge));
  const pct = Math.round((clamped / cap) * 100);
  const ready = canActivate && !!pu;
  const chargedButWaiting = !!pu && clamped >= (pu.cost || cap) && !canActivate;
  const R = 22;
  const C = 2 * Math.PI * R;
  const dash = C * (pct / 100);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title={pu ? `${pu.name} (${pct}% charged)` : 'No coop power-up equipped'}
        className={chargedButWaiting ? 'pu-orb-charged-waiting' : undefined}
        style={{
          position: 'relative', width: 52, height: 52, borderRadius: '50%',
          background: ready || chargedButWaiting ? 'color-mix(in srgb,var(--accent) 18%,var(--bg-3))' : 'var(--bg-3)',
          border: `2px solid ${ready || chargedButWaiting ? 'var(--accent)' : 'var(--border)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', padding: 0, color: 'inherit', flex: '0 0 auto',
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
              {ready ? `Fully charged — ready to activate! (Costs ${pu.cost} charge.)` : `${pct}% charged — need ${pu.cost} to activate. Land doubles, triples and bulls to charge.`}
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

// ── Post-visit / enemy-turn overlay ───────────────────────────────────
//
// For the player phase: shows a summary of every dart the thrower just
// threw this visit — each dart's target, the damage dealt (or shield-break
// / miss), and the resulting HP of each enemy hit. Defeated enemies are
// called out. The player taps "Continue" to advance to the next player
// or the enemy phase.
//
// For the enemy phase: shows every enemy dart thrown so far cumulatively
// (dart 1, 2, 3…) with the running party HP, plus the current dart
// highlighted. The player taps "Continue" to advance to the next dart.

function DartOverlay({ state, onContinue, onEndVisit }: {
  state: CampaignBattleState;
  onContinue: () => void;
  onEndVisit: () => void;
}) {
  const isPlayer = state.phase === 'player' && state.darts.length >= 3;
  const [shakeKey, setShakeKey] = useState(0);
  const currentEnemyStep = state.pendingEnemyAttacks[0];
  useEffect(() => {
    if (!isPlayer) setShakeKey(k => k + 1);
  }, [currentEnemyStep, isPlayer]);

  if (isPlayer) {
    const thrower = state.players[state.playerTurnIdx];
    const steps = state.resolvedDarts;
    // Group consecutive darts by the enemy they hit for the HP display.
    const totalDamage = steps.reduce((a, s) => a + s.damage, 0);
    // Unique enemies hit this visit, preserving order.
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

          {/* Per-dart list — all darts thrown this visit with their target. */}
          <div className="bo-steps" style={{ marginTop: 4 }}>
            {steps.map((s, i) => (
              <div key={i} className={`bo-step current${s.damage <= 0 ? ' miss' : ''}`}>
                <span className="bo-step-dart">{s.dart.label}</span>
                <span className="bo-step-formula">
                  → {s.enemyName} ·{' '}
                  {s.kind === 'shield_break' ? `Broke ${s.shieldTarget} — 0 dmg`
                    : s.kind === 'miss' ? 'Absorbed by shield — 0 dmg'
                    : s.dart.value <= 0 ? 'Miss · 0 dmg'
                    : `${s.dart.value} dmg`}
                  {s.kind === 'defeated' ? ' · DEFEATED' : ''}
                </span>
                <span className="bo-step-dmg">{s.damage > 0 ? `-${s.damage}` : '0'}</span>
              </div>
            ))}
          </div>

          {/* Per-enemy HP summary — final HP after this visit's darts. */}
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {enemiesHit.map(e => {
              const hpPct = Math.max(0, Math.min(100, (e.finalHp / e.maxHp) * 100));
              return (
                <div key={e.id} style={{ padding: '6px 8px', borderRadius: 8, background: 'var(--bg-3)', border: '1px solid var(--border)' }}>
                  <div className="row between" style={{ marginBottom: 4 }}>
                    <span className="bo-name" style={{ fontSize: 13 }}>{e.name}</span>
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

  // Enemy phase overlay — show all darts thrown so far cumulatively.
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
            return (
              <div key={i} className={`bo-step ${isCurrent ? 'current' : 'past'}${s.damage <= 0 ? ' miss' : ''}`}>
                <span className="bo-step-dart">{s.dart.label}</span>
                <span className="bo-step-formula">
                  {s.enemyName} · {s.dart.value <= 0 ? 'Miss · 0 dmg' : `${s.dart.value} dmg`}
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

// ── Frozen overlay ───────────────────────────────────────────────────
//
// Shown when the enemy phase starts but every alive enemy is frozen. The
// popup lists each frozen enemy and their remaining frozen turns, then the
// player taps Continue to advance to their turn. The overlay uses an
// ice-blue palette to reinforce the freeze context.
function FrozenOverlay({ state, onContinue }: {
  state: CampaignBattleState;
  onContinue: () => void;
}) {
  const frozen = state.frozenEnemiesThisRound;
  return (
    <div className="battle-overlay-bg">
      <div className="battle-overlay frozen-overlay" onClick={(e) => e.stopPropagation()}>
        <div className="frozen-icon">❄️</div>
        <div className="frozen-title">Enemies Frozen</div>
        <div className="frozen-subtitle">
          The cold holds them still — their turn is skipped.
        </div>
        <div>
          {frozen.map(e => (
            <div key={e.id} className="frozen-enemy-row">
              <span>👹 {e.name}</span>
              <span className="frozen-badge">❄ {e.frozenTurns} turn{e.frozenTurns === 1 ? '' : 's'} left</span>
            </div>
          ))}
        </div>
        <button className="btn primary block" style={{ marginTop: 12 }} onClick={onContinue}>
          Continue
        </button>
      </div>
    </div>
  );
}
