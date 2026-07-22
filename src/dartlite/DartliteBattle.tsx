import { useEffect, useState, useRef } from 'react';
import type { Settings, Player } from '../types';
import type { CampaignBattleState } from '../campaign/types';
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
import type { DartliteRun, ChoiceOption } from './engine';
import { isMiniBossRound, isBossRound, applyPlayerChoice, applyBossTrinketChoice } from './engine';
import { getTrinket } from './trinkets';
import { ChoiceScreen } from './ChoiceScreen';
import { DeckUpgradeScreen } from './DeckUpgradeScreen';
import { ProgressScreen } from './ProgressScreen';
import { PlayerDetailModal } from './PlayerDetailModal';
import { BossVictoryScreen } from './BossVictoryScreen';
import type { PlayerCard, CardDef, CardPlayState } from '../cards/types';
import { cardDamage, cardRarityColor, cardTypeColor } from '../cards/definitions';
import {
  initCardPlayState, startTurn,
  playCardFromHand, endTurn, MAX_PLAYS_PER_TURN, resolveCardDef,
  getPlayerCards,
} from '../cards/deck';

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
  const [state, setState] = useState<CampaignBattleState | null>(battle);
  useEffect(() => { if (battle) setState(battle); }, [battle]);
  const [showProgress, setShowProgress] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [showTrinketUnlock, setShowTrinketUnlock] = useState(false);
  const [mult, setMult] = useState(1);
  const [chosenRun, setChosenRun] = useState<DartliteRun | null>(null);
  const [showRewardReveal, setShowRewardReveal] = useState(false);
  const [showDeckUpgrade, setShowDeckUpgrade] = useState(false);
  const [deckUpgradeOption, setDeckUpgradeOption] = useState<ChoiceOption | null>(null);

  // ── Card mode state ──────────────────────────────────────────────────
  // Per-player card play state (deck, hand, used, graveyard), keyed by
  // player id. Initialized once when the battle starts.
  const [cardStates, setCardStates] = useState<Record<string, CardPlayState>>(() => {
    const initial: Record<string, CardPlayState> = {};
    for (const pid of run.playerIds) {
      const rp = run.runPlayers.find(r => r.id === pid);
      if (rp) initial[pid] = initCardPlayState(rp.cards);
    }
    return initial;
  });
  const [activeCardPid, setActiveCardPid] = useState<string | null>(null);
  const [cardPilePopup, setCardPilePopup] = useState<null | 'deck' | 'hand' | 'used' | 'graveyard'>(null);
  const [cardDetail, setCardDetail] = useState<{ pc: PlayerCard; action: 'upgrade' | 'remove' | 'add' } | null>(null);

  // ── Battle flow ──────────────────────────────────────────────────────
  //
  // DartliteBattle is a controlled component: the parent owns the run state
  // and passes it down. We keep a local copy of the battle state for the
  // dart-throwing interaction, then report results back via onBattleEnd.

  useEffect(() => {
    if (!state) return;
    if (state.phase === 'won' || state.phase === 'lost') {
      const damageDealt: { [playerId: string]: number } = {};
      const kills: { [playerId: string]: number } = {};
      for (const p of state.players) {
        damageDealt[p.id] = 0;
        kills[p.id] = 0;
      }
      for (const e of state.enemies) {
        if (e.hp <= 0 && e.lastHitBy) {
          kills[e.lastHitBy] = (kills[e.lastHitBy] ?? 0) + 1;
        }
      }
      // Approximate damage attribution from enemy HP loss
      for (const e of state.enemies) {
        const def = getEnemyDef(e.id);
        const maxHp = def?.hp ?? 0;
        const lost = maxHp - e.hp;
        if (lost > 0 && e.lastHitBy) {
          damageDealt[e.lastHitBy] = (damageDealt[e.lastHitBy] ?? 0) + Math.round(lost / (state.players.length || 1));
        }
      }
      onBattleEnd(state.phase === 'won');
    }
  }, [state?.phase]);

  // ── Dart throwing ────────────────────────────────────────────────────

  const player = state?.players[state.currentPlayerIdx];
  const enemy = state?.enemies[state.currentEnemyIdx];
  const canThrow = state?.phase === 'player_turn' && player && !state?.playerDone;

  const handleAddDart = (score: number, mult: number) => {
    if (!canThrow || !state) return;
    Sound.play('dart');
    const next = addDart(state, score, mult);
    setState(next);
  };

  const handleUndo = () => {
    if (!state) return;
    Sound.play('click');
    setState(undoDart(state));
  };

  const handleVisit = () => {
    if (!state || !player) return;
    Sound.play('click');
    const next = resolvePlayerVisit(state);
    setState(next);
  };

  const handleEndVisit = () => {
    if (!state) return;
    Sound.play('click');
    const next = prepareEnemyTurn(state);
    setState(next);
    // Process enemy attacks after a short delay
    setTimeout(() => {
      setState(s => {
        if (!s) return s;
        let next = applyNextEnemyAttack(s);
        return next;
      });
    }, 800);
  };

  const handleTargetEnemy = (enemyIdx: number) => {
    if (!state) return;
    Sound.play('click');
    setState(setTarget(state, enemyIdx));
  };

  // ── Card mode: play cards ────────────────────────────────────────────

  const handlePlayCard = (pid: string, cardId: string) => {
    if (!state) return;
    const rp = run.runPlayers.find(r => r.id === pid);
    if (!rp) return;
    const cs = cardStates[pid];
    if (!cs) return;
    const next = playCardFromHand(cs, cardId, state, pid);
    setCardStates({ ...cardStates, [pid]: next.cs });
    setState(next.battle);
    Sound.play('card');
  };

  const handleStartTurn = (pid: string) => {
    if (!state) return;
    const cs = cardStates[pid];
    if (!cs) return;
    const next = startTurn(cs);
    setCardStates({ ...cardStates, [pid]: next });
  };

  const handleEndTurn = (pid: string) => {
    if (!state) return;
    const cs = cardStates[pid];
    if (!cs) return;
    const next = endTurn(cs);
    setCardStates({ ...cardStates, [pid]: next });
  };

  // ── Reward choice handling ──────────────────────────────────────────

  const handlePickReward = (opt: ChoiceOption) => {
    if (opt.kind === 'deck_upgrade') {
      setDeckUpgradeOption(opt);
      setShowDeckUpgrade(true);
      return;
    }
    const updated = applyPlayerChoice(run, opt);
    onChoice(updated);
  };

  const handleDeckUpgradeComplete = (updatedCards: PlayerCard[], actionLabel: string) => {
    if (!deckUpgradeOption) return;
    const updated = applyDeckUpgradeResult(run, updatedCards, { ...deckUpgradeOption, desc: actionLabel });
    setShowDeckUpgrade(false);
    setDeckUpgradeOption(null);
    onChoice(updated);
  };

  const handleDeckUpgradeCancel = () => {
    setShowDeckUpgrade(false);
    setDeckUpgradeOption(null);
  };

  // ── Render ──────────────────────────────────────────────────────────

  // Card mode: render card UI panels
  const renderCardPanel = (pid: string) => {
    const rp = run.runPlayers.find(r => r.id === pid);
    if (!rp) return null;
    const cs = cardStates[pid];
    if (!cs) return null;
    const p = players.find(pl => pl.id === pid);
    const isMyTurn = state?.currentPlayerIdx === state?.players.findIndex(pp => pp.id === pid);
    return (
      <div className="card-panel" style={{ padding: 8, borderRadius: 10, background: 'var(--bg-3)', border: '1px solid var(--border)', marginTop: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 800 }}>{p?.name ?? 'Player'}'s Cards</span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button className="btn sm ghost" onClick={() => { setActiveCardPid(pid); setCardPilePopup('hand'); }}>Hand ({cs.hand.length})</button>
            <button className="btn sm ghost" onClick={() => { setActiveCardPid(pid); setCardPilePopup('deck'); }}>Deck ({cs.deck.length})</button>
            <button className="btn sm ghost" onClick={() => { setActiveCardPid(pid); setCardPilePopup('used'); }}>Used ({cs.used.length})</button>
            <button className="btn sm ghost" onClick={() => { setActiveCardPid(pid); setCardPilePopup('graveyard'); }}>Grave ({cs.graveyard.length})</button>
          </div>
        </div>
        {isMyTurn && state?.phase === 'player_turn' && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {cs.hand.map((pc, i) => {
              const def = resolveCardDef(pc);
              if (!def) return null;
              return (
                <button key={i} className="card-mini-tile" style={{ cursor: 'pointer', borderColor: cardRarityColor(def.rarity), background: `color-mix(in srgb, ${cardTypeColor(def.type)} 10%, var(--bg-3))` }}
                  onClick={() => handlePlayCard(pid, pc.cardId)}>
                  <span style={{ fontSize: 20 }}>{def.icon}</span>
                  <span style={{ fontSize: 10, fontWeight: 800 }}>{def.name}</span>
                  <span className="muted" style={{ fontSize: 9 }}>{def.type === 'damage' ? `${cardDamage(def)} dmg` : def.type}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderCardPilePopup = () => {
    if (!cardPilePopup || !activeCardPid) return null;
    const cs = cardStates[activeCardPid];
    if (!cs) return null;
    const pile = cardPilePopup === 'deck' ? cs.deck : cardPilePopup === 'hand' ? cs.hand : cardPilePopup === 'used' ? cs.used : cs.graveyard;
    return (
      <div className="card-pile-popup-overlay" onClick={() => setCardPilePopup(null)}>
        <div className="card-pile-popup" onClick={e => e.stopPropagation()}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900 }}>{cardPilePopup.toUpperCase()} ({pile.length})</h3>
            <button className="btn sm ghost" onClick={() => setCardPilePopup(null)}>Close</button>
          </div>
          <div className="card-pile-popup-grid">
            {pile.map((pc, i) => {
              const def = resolveCardDef(pc);
              if (!def) return null;
              return (
                <div key={i} className="card-mini-tile" style={{ borderColor: cardRarityColor(def.rarity), background: `color-mix(in srgb, ${cardTypeColor(def.type)} 10%, var(--bg-3))` }}>
                  <span style={{ fontSize: 20 }}>{def.icon}</span>
                  <span style={{ fontSize: 10, fontWeight: 800 }}>{def.name}</span>
                  <span className="muted" style={{ fontSize: 9 }}>{def.type === 'damage' ? `${cardDamage(def)} dmg` : def.type}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  if (!state) return null;

  return (
    <div className="view-noscroll coop-battle" style={{ position: 'relative', background: 'radial-gradient(ellipse at top, color-mix(in srgb,#7c3aed 15%,var(--bg)) 0%, var(--bg) 70%)', borderRadius: 14, overflow: 'hidden' }}>
      <button className="btn danger sm quit-float" onClick={() => { if (confirm('Quit this run? Progress will be saved.')) onQuit(); }}>Quit</button>

      {!(showRewardReveal || showProgress || showDeckUpgrade) && (
        run.phase === 'boss_victory' && run.bossVictory ? (
        <BossVictoryScreen
          run={run}
          players={players}
          onPick={(trinketId) => {
            const updated = applyBossTrinketChoice(run, trinketId);
            onChoice(updated);
          }}
          onContinue={() => {
            setShowRewardReveal(true);
          }}
        />
      ) : run.phase === 'choice' && run.pendingChoice ? (
        <ChoiceScreen
          run={run}
          players={players}
          options={run.pendingChoice}
          onPick={(opt) => {
            handlePickReward(opt);
          }}
        />
      ) : run.phase === 'reward' ? (
        <ProgressScreen
          run={run}
          players={players}
          onContinue={() => {
            const updated = endRewardPhase(run);
            onChoice(updated);
          }}
        />
      ) : run.phase === 'gameover' ? (
        <DartliteGameOver run={run} players={players} onQuit={onQuit} />
      ) : (
        <BattleUI
          state={state}
          run={run}
          players={players}
          settings={settings}
          music={music}
          canThrow={canThrow}
          player={player}
          enemy={enemy}
          mult={mult}
          setMult={setMult}
          handleAddDart={handleAddDart}
          handleUndo={handleUndo}
          handleVisit={handleVisit}
          handleEndVisit={handleEndVisit}
          handleTargetEnemy={handleTargetEnemy}
          cardMode={run.cardMode}
          cardStates={cardStates}
          renderCardPanel={renderCardPanel}
          handleStartTurn={handleStartTurn}
          handleEndTurn={handleEndTurn}
          onBattleEnd={onBattleEnd}
        />
      )
      )}

      {showRewardReveal && (
        <RewardReveal
          run={run}
          players={players}
          onContinue={() => {
            setShowRewardReveal(false);
            setShowProgress(true);
          }}
        />
      )}

      {showProgress && (
        <ProgressScreen
          run={run}
          players={players}
          onContinue={() => {
            const updated = endRewardPhase(run);
            onChoice(updated);
          }}
        />
      )}

      {showDeckUpgrade && deckUpgradeOption && (
        <DeckUpgradeScreen
          run={run}
          players={players}
          onCancel={handleDeckUpgradeCancel}
          onComplete={handleDeckUpgradeComplete}
        />
      )}

      {cardPilePopup && renderCardPilePopup()}
    </div>
  );
}

// ── Battle UI (inline) ─────────────────────────────────────────────────

function BattleUI({ state, run, players, settings, music, canThrow, player, enemy, mult, setMult, handleAddDart, handleUndo, handleVisit, handleEndVisit, handleTargetEnemy, cardMode, cardStates, renderCardPanel, handleStartTurn, handleEndTurn, onBattleEnd }: {
  state: CampaignBattleState;
  run: DartliteRun;
  players: Player[];
  settings: Settings;
  music: MusicEngine;
  canThrow: boolean | undefined;
  player: any;
  enemy: any;
  mult: number;
  setMult: (n: number) => void;
  handleAddDart: (score: number, mult: number) => void;
  handleUndo: () => void;
  handleVisit: () => void;
  handleEndVisit: () => void;
  handleTargetEnemy: (idx: number) => void;
  cardMode: boolean;
  cardStates: Record<string, CardPlayState>;
  renderCardPanel: (pid: string) => React.ReactNode | null;
  handleStartTurn: (pid: string) => void;
  handleEndTurn: (pid: string) => void;
  onBattleEnd: (won: boolean) => void;
}) {
  // This is a thin wrapper that renders the actual battle UI using the
  // existing Coop Campaign battle layout. We keep it inline to avoid
  // importing the full CoopBattle component which has its own state
  // management that conflicts with Dartlite's controlled flow.
  return (
    <>
      {/* Player/enemy layout */}
      <div className="coop-battle-layout">
        {/* Players row */}
        <div className="coop-players-row">
          {state.players.map((p, i) => {
            const rp = run.runPlayers.find(r => r.id === p.id);
            const isCurrent = state.currentPlayerIdx === i;
            return (
              <div key={p.id} className={`coop-player-card ${isCurrent ? 'active' : ''}`} style={{ borderColor: isCurrent ? p.color : 'var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="avatar" style={{ background: p.color, width: 28, height: 28, fontSize: 12 }}>{initials(p.name)}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: 13 }}>{p.name}</div>
                    <div className="muted small">HP {p.hp}/{p.maxHp}{rp?.armor ? ` · ${rp.armor}% armor` : ''}</div>
                  </div>
                </div>
                {cardMode && renderCardPanel(p.id)}
              </div>
            );
          })}
        </div>

        {/* Enemies row */}
        <div className="coop-enemies-row">
          {state.enemies.map((e, i) => {
            const def = getEnemyDef(e.id);
            const isCurrent = state.currentEnemyIdx === i;
            const isTarget = state.targetEnemyIdx === i;
            return (
              <div key={i} className={`coop-enemy-card ${isCurrent ? 'active' : ''} ${isTarget ? 'target' : ''}`} onClick={() => handleTargetEnemy(i)} style={{ cursor: 'pointer' }}>
                <div style={{ fontSize: 24 }}>{def?.icon ?? '👹'}</div>
                <div style={{ fontWeight: 800, fontSize: 12 }}>{def?.name ?? e.id}</div>
                <div className="muted small">HP {e.hp}/{def?.hp ?? 0}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Dart input */}
      <DartInput
        canThrow={!!canThrow}
        player={player}
        enemy={enemy}
        mult={mult}
        setMult={setMult}
        handleAddDart={handleAddDart}
        handleUndo={handleUndo}
        handleVisit={handleVisit}
        handleEndVisit={handleEndVisit}
        onBattleEnd={onBattleEnd}
      />
    </>
  );
}

// ── DartInput (inline) ─────────────────────────────────────────────────

function DartInput({ canThrow, player, enemy, mult, setMult, handleAddDart, handleUndo, handleVisit, handleEndVisit, onBattleEnd }: {
  canThrow: boolean;
  player: any;
  enemy: any;
  mult: number;
  setMult: (n: number) => void;
  handleAddDart: (score: number, mult: number) => void;
  handleUndo: () => void;
  handleVisit: () => void;
  handleEndVisit: () => void;
  onBattleEnd: (won: boolean) => void;
}) {
  const [score, setScore] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (canThrow) {
      setScore('');
      inputRef.current?.focus();
    }
  }, [canThrow]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const s = parseInt(score, 10);
    if (isNaN(s)) return;
    handleAddDart(s, mult);
    setScore('');
  };

  return (
    <div className="dart-input-panel" style={{ padding: 12, borderTop: '1px solid var(--border)', background: 'var(--bg-2)' }}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input ref={inputRef} type="number" value={score} onChange={e => setScore(e.target.value)} placeholder="Score" disabled={!canThrow}
          style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }} />
        <div style={{ display: 'flex', gap: 4 }}>
          {[1, 2, 3].map(m => (
            <button key={m} type="button" className={`btn sm ${mult === m ? 'primary' : 'ghost'}`} onClick={() => setMult(m)} disabled={!canThrow}>×{m}</button>
          ))}
        </div>
        <button type="submit" className="btn primary" disabled={!canThrow}>Throw</button>
        {canThrow && <button type="button" className="btn ghost" onClick={handleUndo}>Undo</button>}
      </form>
      {canThrow && player && (
        <div className="muted small" style={{ marginTop: 6 }}>
          {player.name}'s turn — target: {enemy ? getEnemyDef(enemy.id)?.name ?? enemy.id : 'none'}
        </div>
      )}
    </div>
  );
}

// ── RewardReveal (inline) ──────────────────────────────────────────────

function RewardReveal({ run, players, onContinue }: { run: DartliteRun; players: Player[]; onContinue: () => void }) {
  return (
    <div className="view-scroll" style={{ background: 'radial-gradient(ellipse at top, color-mix(in srgb,#7c3aed 12%,var(--bg)) 0%, var(--bg) 70%)', minHeight: '100%' }}>
      <div className="card" style={{ maxWidth: 520, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.14em', color: '#c4b5fd', textTransform: 'uppercase' }}>Rewards</div>
          <div style={{ fontSize: 22, fontWeight: 900, marginTop: 4 }}>Round {run.round} — Choices</div>
        </div>
        <div style={{ display: 'grid', gap: 10 }}>
          {run.playerIds.map((pid, i) => {
            const p = players.find(x => x.id === pid);
            const choice = run.playerChoices[i];
            if (!p || !choice) return null;
            return (
              <div key={pid} className="card" style={{ padding: 12, background: 'var(--bg-3)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="avatar" style={{ background: p.color, width: 30, height: 30, fontSize: 12 }}>{initials(p.name)}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800 }}>{p.name}</div>
                    <div className="muted small">{choice.icon} {choice.label} — {choice.desc}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <button className="btn primary block" style={{ marginTop: 18 }} onClick={onContinue}>Continue</button>
      </div>
    </div>
  );
}

// ── DartliteGameOver (inline) ─────────────────────────────────────────

function DartliteGameOver({ run, players, onQuit }: { run: DartliteRun; players: Player[]; onQuit: () => void }) {
  const stats = getRunStats(run);
  return (
    <div className="view-scroll" style={{ background: 'radial-gradient(ellipse at top, visibility 12%,var(--bg)) 0%, var(--bg) 70%)', minHeight: '100%' }}>
      <div className="card" style={{ maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>💀</div>
        <div style={{ fontSize: 22, fontWeight: 900 }}>Run Over</div>
        <div className="muted small" style={{ marginTop: 4 }}>You reached Round {run.round}</div>
        <div style={{ display: 'grid', gap: 8, marginTop: 16, textAlign: 'left' }}>
          <div className="card" style={{ padding: 10, background: 'var(--bg-3)' }}>
            <div style={{ fontWeight: 800, fontSize: 13 }}>Rounds Cleared: {stats.roundsCleared}</div>
          </div>
          <div className="card" style={{ padding: 10, background: 'var(--bg-3)' }}>
            <    div style={{ fontWeight: 800, fontSize: 13 }}>Total Kills: {stats.totalKills}</div>
          </div>
          <div className="card" style={{ padding: 10, background: 'var(--bg-3)' }}>
            <    div style={{ fontWeight: 800, fontSize: 13 }}>Total Damage: {stats.totalDamage}</div>
          </div>
        </div>
        <button className="btn primary block" style={{ marginTop: 18 }} onClick={onQuit}>Back to Setup</button>
      </div>
    </div>
  );
}
