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
  getPlayerCards, redrawHand, recycleGraveyard,
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
  const [detailPlayerId, setDetailPlayerId] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [showTrinketUnlock, setShowTrinketUnlock] = useState(false);
  const [mult, setMult] = useState(1);
  const [chosenRun, setChosenRun] = useState<DartliteRun | null>(null);
  const [showRewardReveal, setShowRewardReveal] = useState(false);
  const [showDeckUpgrade, setShowDeckUpgrade] = useState(false);
  const [deckUpgradeOption, setDeckUpgradeOption] = useState<ChoiceOption | null>(null);

  // ── Card mode state ──────────────────────────────────────────────────
  // Per-player card play state (deck, hand, used, graveyard), keyed by
  // player ID. Only used when run.cardMode is true.
  const [cardStates, setCardStates] = useState<Record<string, CardPlayState>>({});
  const [selectedCardIdx, setSelectedCardIdx] = useState<number | null>(null);
  const [showDeck, setShowDeck] = useState(false);
  const [showGraveyard, setShowGraveyard] = useState(false);
  const [animatingOut, setAnimatingOut] = useState<number | null>(null);
  const prevHandLen = useRef<number>(0);
  const prevHandRef = useRef<number | null>(null);
  const cardMode = run.cardMode;

  // Initialize card play state for all players when a new battle starts.
  useEffect(() => {
    if (!cardMode || !battle) return;
    const cs: Record<string, CardPlayState> = {};
    for (const rp of run.runPlayers) {
      const playerData = players.find(p => p.id === rp.id);
      const collection: PlayerCard[] = playerData ? getPlayerCards(playerData) : [];
      cs[rp.id] = initCardPlayState(collection);
    }
    setCardStates(cs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battle, cardMode]);

  // Ensure the current thrower has a hand drawn for their turn.
  useEffect(() => {
    if (!cardMode || !state || state.phase !== 'player') return;
    const thrower = state.players[state.playerTurnIdx];
    if (!thrower) return;
    const cs = cardStates[thrower.id];
    if (!cs) return;
    if (cs.hand.length === 0 && cs.used.length === 0) {
      const next = startTurn(cs);
      setCardStates(prev => ({ ...prev, [thrower.id]: next }));
    }
  }, [state?.phase, state?.playerTurnIdx, cardMode, cardStates]);

  // Track hand length changes for enter/exit animations.
  useEffect(() => {
    if (!cardMode || !state || state.phase !== 'player') return;
    const thrower = state.players[state.playerTurnIdx];
    if (!thrower) return;
    const cs = cardStates[thrower.id];
    if (!cs) return;
    const curLen = cs.hand.length;
    if (curLen < prevHandLen.current && prevHandRef.current !== null) {
      setAnimatingOut(prevHandRef.current);
      const t = setTimeout(() => setAnimatingOut(null), 300);
      prevHandRef.current = null;
      return () => clearTimeout(t);
    }
    prevHandLen.current = curLen;
  }, [cardStates, state?.phase, state?.playerTurnIdx, cardMode]);

  useEffect(() => {
    if (run.lastUnlockedTrinket) setShowTrinketUnlock(true);
  }, [run.lastUnlockedTrinket]);

  useEffect(() => {
    music.startContext('coop', settings);
    return () => { music.stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!state) return;
    if (state.outcome === 'victory') {
      Sound.play('win', {}, settings);
      onBattleEnd(true);
    } else if (state.outcome === 'defeat') {
      Sound.play('kill', {}, settings);
      onBattleEnd(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.outcome]);

  useEffect(() => {
    if (!state) return;
    if (state.phase !== 'enemy') return;
    if (state.outcome !== 'ongoing') return;
    if (state.pendingEnemyAttacks.length) return;
    if (state.appliedEnemyAttacks.length) return;
    if (state.frozenEnemiesThisRound.length) return;
    const t = setTimeout(() => {
      setState(prev => prev ? prepareEnemyTurn(prev) : prev);
      Sound.play('impact', {}, settings);
    }, 600);
    return () => clearTimeout(t);
  }, [state?.phase, state?.outcome, state?.pendingEnemyAttacks.length, state?.appliedEnemyAttacks.length, state?.frozenEnemiesThisRound.length, settings]);

  if (!state) return null;
  const aliveEnemies = state.enemies.filter(e => !e.defeated);
  const thrower = state.players[state.playerTurnIdx];

  const onAdd = (base: number, m: number, labelOverride?: string, isBull?: boolean) => {
    setState(prev => prev ? addDart(prev, base, m, labelOverride, isBull, settings) : prev);
    Sound.play('dart', { score: base * m }, settings);
    if (base > 0) Sound.play('impact', {}, settings);
    setMult(1);
  };
  const onUndo = () => {
    if (cardMode && state && state.phase === 'player') {
      const thrower = state.players[state.playerTurnIdx];
      if (thrower) {
        const cs = cardStates[thrower.id];
        if (cs && state.darts.length > 0) {
          const lastDart = state.darts[state.darts.length - 1];
          const usedIdx = [...cs.used].reverse().findIndex(pc => {
            const def = resolveCardDef(pc);
            return def?.name === lastDart.label;
          });
          if (usedIdx !== -1) {
            const realIdx = cs.used.length - 1 - usedIdx;
            const card = cs.used[realIdx];
            const updated: CardPlayState = {
              deck: cs.deck,
              hand: [...cs.hand, card],
              used: cs.used.filter((_, i) => i !== realIdx),
              graveyard: cs.graveyard,
            };
            setCardStates(prev => ({ ...prev, [thrower.id]: updated }));
          }
        }
      }
    }
    setState(prev => prev ? undoDart(prev, settings) : prev);
  };
  const onEnter = () => {
    if (!state.darts.length) return;
    if (cardMode) {
      const thrower = state.players[state.playerTurnIdx];
      if (thrower) {
        const cs = cardStates[thrower.id];
        if (cs) {
          const endedState = endTurn(cs);
          setCardStates(prev => ({ ...prev, [thrower.id]: endedState }));
        }
      }
    }
    setState(prev => prev ? resolvePlayerVisit(prev) : prev);
  };

  // ── Card mode helpers ───────────────────────────────────────────────
  const playCard = (handIdx: number) => {
    if (!state || !cardMode) return;
    const thrower = state.players[state.playerTurnIdx];
    if (!thrower) return;
    const cs = cardStates[thrower.id];
    if (!cs) return;
    const handDefs = cs.hand.map(pc => resolveCardDef(pc)).filter(Boolean) as CardDef[];
    const card = handDefs[handIdx];
    if (!card) return;
    if (card.type !== 'damage') {
      let updated = playCardFromHand(cs, handIdx);
      if (!updated) return;
      if (card.effect === 'redraw') {
        updated = redrawHand(updated);
      } else if (card.effect === 'recycle') {
        updated = recycleGraveyard(updated);
      }
      Sound.play('powerup', {}, settings);
      setSelectedCardIdx(null);
      setCardStates(prev => ({ ...prev, [thrower.id]: updated }));
      return;
    }
    if (state.darts.length >= MAX_PLAYS_PER_TURN) return;
    const updated = playCardFromHand(cs, handIdx);
    if (!updated) return;
    const base = card.base ?? 0;
    const cardMult = card.mult ?? 1;
    const isBull = base === 50;
    const label = card.name;
    prevHandRef.current = handIdx;
    setSelectedCardIdx(null);
    setCardStates(prev => ({ ...prev, [thrower.id]: updated }));
    onAdd(base, isBull ? 2 : (base === 25 && cardMult === 2 ? 2 : cardMult), label, isBull);
  };
  const onContinue = () => {
    if (state.pendingEnemyAttacks.length) {
      setState(prev => prev ? applyNextEnemyAttack(prev) : prev);
      Sound.play('impact', {}, settings);
      return;
    }
    if (state.phase === 'enemy' && state.frozenEnemiesThisRound.length) {
      setState(prev => prev ? applyNextEnemyAttack(prev) : prev);
    }
  };

  const partyHpPct = Math.max(0, Math.min(100, (state.partyHp / state.partyMaxHp) * 100));
  const maxDartsPerVisit = cardMode ? MAX_PLAYS_PER_TURN : 3;
  const playerVisitDone = state.phase === 'player' && state.darts.length >= maxDartsPerVisit && state.outcome === 'ongoing';
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

      {!(showRewardReveal || showProgress) && (
        run.phase === 'boss_victory' && run.bossVictory ? (
        <BossVictoryScreen
          run={run}
          players={players}
          onPick={(trinketId) => {
            const next = applyBossTrinketChoice(run, trinketId);
            setChosenRun(next);
            setShowRewardReveal(true);
          }}
        />
      ) : run.phase === 'choice' && run.pendingChoice ? (
        <ChoiceScreen
          run={run}
          players={players}
          options={run.pendingChoice}
          onPick={(opt) => {
            if (opt.kind === 'deck_upgrade') {
              setDeckUpgradeOption(opt);
              setShowDeckUpgrade(true);
              return;
            }
            const next = applyPlayerChoice(run, opt);
            if (next.phase === 'reward') {
              setChosenRun(next);
              setShowRewardReveal(true);
            } else {
              onChoice(next);
            }
          }}
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
                  <div key={p.id} onClick={() => setDetailPlayerId(p.id)} title="Tap for run stats"
                    style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '4px 8px', borderRadius: 999,
                    background: isThrower ? p.color : 'var(--bg-3)',
                    color: isThrower ? '#0b0e13' : 'var(--text)',
                    border: isThrower ? '2px solid var(--accent)' : '1px solid var(--border)',
                    fontWeight: isThrower ? 800 : 600, fontSize: 12,
                    cursor: 'pointer',
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
              const canTarget = state.phase === 'player' && !e.defeated && state.darts.length < maxDartsPerVisit && state.outcome === 'ongoing';
              return (
                <div key={e.id} className="play-other" onClick={() => canTarget && setState(prev => prev ? setTarget(prev, e.id) : prev)}
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

          {state.phase === 'player' && state.outcome === 'ongoing' && state.darts.length < (cardMode ? MAX_PLAYS_PER_TURN : 3) && (
            cardMode && thrower ? (() => {
              const cs = cardStates[thrower.id];
              if (!cs) return null;
              const handDefs = cs.hand.map(pc => resolveCardDef(pc)).filter(Boolean) as CardDef[];
              const usedDefs = cs.used.map(pc => resolveCardDef(pc)).filter(Boolean) as CardDef[];
              const selectedCard = selectedCardIdx !== null ? handDefs[selectedCardIdx] : null;
              const canPlayMore = state.darts.length < MAX_PLAYS_PER_TURN;
              return (
                <>
                <div className="play-input">
                  <div className="pad-card card-board-pad">
                    <div className="card-pile-row">
                      <button className="card-pile-btn" onClick={() => setShowDeck(true)} title="View deck">
                        <span className="card-pile-icon">{'\u{1F0A0}'}</span>
                        <span className="card-pile-label">Deck</span>
                        <span className="card-pile-count">{cs.deck.length}</span>
                      </button>
                      <div className="card-hand-label">Your Hand — {thrower.name}</div>
                      <button className="card-pile-btn" onClick={() => setShowGraveyard(true)} title="View graveyard">
                        <span className="card-pile-icon">{'\u26B0\uFE0F'}</span>
                        <span className="card-pile-label">Graveyard</span>
                        <span className="card-pile-count">{cs.graveyard.length}</span>
                      </button>
                    </div>
                    <div className="card-hand-fan">
                      {handDefs.length === 0 && (
                        <div className="muted small" style={{ padding: '20px 0', textAlign: 'center' }}>No cards in hand. End turn to draw new cards.</div>
                      )}
                      {handDefs.map((card, idx) => {
                        const tColor = cardTypeColor(card.type);
                        const rColor = cardRarityColor(card.rarity);
                        const isAnimatingOut = animatingOut === idx;
                        return (
                          <div
                            key={`${idx}-${card.id}`}
                            className={`card-tile ${isAnimatingOut ? 'card-anim-out' : 'card-anim-in'}`}
                            style={{
                              '--card-color': tColor,
                              '--card-rarity': rColor,
                              '--card-rot': `${(idx - (handDefs.length - 1) / 2) * 4}deg`,
                              '--card-offset': `${Math.abs(idx - (handDefs.length - 1) / 2) * 6}px`,
                            } as React.CSSProperties}
                            onClick={() => setSelectedCardIdx(idx)}
                          >
                            <div className="card-tile-inner">
                              <div className="card-tile-top">
                                <span className="card-tile-icon">{card.icon}</span>
                              </div>
                              <div className="card-tile-name">{card.name}</div>
                              <div className="card-tile-type">{card.type === 'damage' ? `${cardDamage(card)} dmg` : card.type}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {usedDefs.length > 0 && (
                      <div className="card-used-row">
                        <span className="muted small" style={{ fontWeight: 600 }}>Used:</span>
                        {usedDefs.map((card, idx) => (
                          <div key={idx} className="card-used-tile" style={{ borderColor: cardRarityColor(card.rarity) }}>
                            <span style={{ fontSize: 16 }}>{card.icon}</span>
                            <span style={{ fontSize: 10, fontWeight: 800 }}>{card.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="row" style={{ gap: 8, marginTop: 8 }}>
                      <button className="btn block ghost" onClick={onUndo} disabled={!state.darts.length}>{'\u21B6'} Undo card</button>
                      <button className="btn block primary" onClick={onEnter} disabled={!state.darts.length}>End visit</button>
                    </div>
                  </div>
                </div>

                {selectedCard && (
                  <div className="card-popup-overlay" onClick={() => setSelectedCardIdx(null)}>
                    <div className="card-popup" onClick={e => e.stopPropagation()} style={{ '--card-color': cardTypeColor(selectedCard.type), '--card-rarity': cardRarityColor(selectedCard.rarity) } as React.CSSProperties}>
                      <div className="card-popup-header">
                        <span className="card-popup-icon">{selectedCard.icon}</span>
                        <span className="card-popup-name">{selectedCard.name}</span>
                        <span className="card-popup-rarity" style={{ color: cardRarityColor(selectedCard.rarity) }}>{selectedCard.rarity}</span>
                      </div>
                      <div className="card-popup-body">
                        <div className="card-popup-type" style={{ color: cardTypeColor(selectedCard.type) }}>
                          {selectedCard.type === 'damage' ? `Damage — ${cardDamage(selectedCard)} points` : selectedCard.type === 'spell' ? 'Spell' : 'Utility'}
                        </div>
                        <div className="card-popup-desc">{selectedCard.desc}</div>
                        {selectedCard.class !== 'any' && <div className="card-popup-class">Class: {selectedCard.class}</div>}
                      </div>
                      <div className="card-popup-actions">
                        <button className="btn block ghost" onClick={() => setSelectedCardIdx(null)}>Cancel</button>
                        <button
                          className="btn block primary"
                          disabled={selectedCard.type === 'damage' && !canPlayMore}
                          onClick={() => playCard(selectedCardIdx!)}
                        >
                          {selectedCard.type === 'damage' ? 'Play' : 'Use'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {showDeck && cs && (
                  <div className="card-popup-overlay" onClick={() => setShowDeck(false)}>
                    <div className="card-pile-popup" onClick={e => e.stopPropagation()}>
                      <div className="card-pile-popup-header">
                        <h3>{'\u{1F0A0}'} Deck ({cs.deck.length})</h3>
                        <button className="btn sm ghost" onClick={() => setShowDeck(false)}>Close</button>
                      </div>
                      <div className="card-pile-popup-grid">
                        {cs.deck.length === 0 && <div className="muted small" style={{ padding: 20 }}>Deck is empty. Graveyard will be shuffled in on next draw.</div>}
                        {cs.deck.map((pc, idx) => {
                          const def = resolveCardDef(pc);
                          if (!def) return null;
                          return (
                            <div key={idx} className="card-mini-tile" style={{ borderColor: cardRarityColor(def.rarity), background: `color-mix(in srgb, ${cardTypeColor(def.type)} 10%, var(--bg-3))` }}>
                              <span style={{ fontSize: 20 }}>{def.icon}</span>
                              <span style={{ fontSize: 10, fontWeight: 800 }}>{def.name}</span>
                              <span className="muted" style={{ fontSize: 9 }}>{def.type === 'damage' ? `${cardDamage(def)} dmg` : def.type}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {showGraveyard && cs && (
                  <div className="card-popup-overlay" onClick={() => setShowGraveyard(false)}>
                    <div className="card-pile-popup" onClick={e => e.stopPropagation()}>
                      <div className="card-pile-popup-header">
                        <h3>{'\u26B0\uFE0F'} Graveyard ({cs.graveyard.length})</h3>
                        <button className="btn sm ghost" onClick={() => setShowGraveyard(false)}>Close</button>
                      </div>
                      <div className="card-pile-popup-grid">
                        {cs.graveyard.length === 0 && <div className="muted small" style={{ padding: 20 }}>Graveyard is empty.</div>}
                        {cs.graveyard.map((pc, idx) => {
                          const def = resolveCardDef(pc);
                          if (!def) return null;
                          return (
                            <div key={idx} className="card-mini-tile" style={{ borderColor: cardRarityColor(def.rarity), background: `color-mix(in srgb, ${cardTypeColor(def.type)} 10%, var(--bg-3))` }}>
                              <span style={{ fontSize: 20 }}>{def.icon}</span>
                              <span style={{ fontSize: 10, fontWeight: 800 }}>{def.name}</span>
                              <span className="muted" style={{ fontSize: 9 }}>{def.type === 'damage' ? `${cardDamage(def)} dmg` : def.type}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
                </>
              );
            })() : (
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
            )
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

          {detailPlayerId && (
            <PlayerDetailModal
              playerId={detailPlayerId}
              run={run}
              players={players}
              onClose={() => setDetailPlayerId(null)}
            />
          )}
        </>
      )
      )}

      {showDeckUpgrade && deckUpgradeOption && (
        <DeckUpgradeScreen
          run={run}
          players={players}
          onCancel={() => { setShowDeckUpgrade(false); setDeckUpgradeOption(null); }}
          onComplete={(updatedCards, actionLabel) => {
            const idx = run.choicePlayerIdx;
            const updatedRun: DartliteRun = {
              ...run,
              runPlayers: run.runPlayers.map((p, i) =>
                i === idx ? { ...p, cards: updatedCards } : p
              ),
            };
            const resolvedOption: ChoiceOption = {
              ...deckUpgradeOption,
              label: 'Deck Upgrade',
              desc: actionLabel,
            };
            const next = applyPlayerChoice(updatedRun, resolvedOption);
            setShowDeckUpgrade(false);
            setDeckUpgradeOption(null);
            if (next.phase === 'reward') {
              setChosenRun(next);
              setShowRewardReveal(true);
            } else {
              onChoice(next);
            }
          }}
        />
      )}

      {showProgress && chosenRun && (
        <ProgressScreen
          run={chosenRun}
          players={players}
          onContinue={() => { setShowProgress(false); onChoice(chosenRun); }}
        />
      )}

      {showRewardReveal && chosenRun && (() => {
        const choosers = chosenRun.playerIds.map((pid, i) => {
          const p = players.find(pl => pl.id === pid);
          const choice = chosenRun.playerChoices[i];
          const trinket = choice?.trinketId ? getTrinket(choice.trinketId) : null;
          return { name: p?.name || `Player ${i + 1}`, color: p?.color || '#7c3aed', choice, trinket };
        }).filter(c => c.choice);
        // Boss victory path: playerChoices are null, but a boss trinket was
        // claimed. Show the boss trinket as the reward instead.
        if (!choosers.length && chosenRun.bossVictory && chosenRun.bossVictory.claimedTrinket) {
          const t = getTrinket(chosenRun.bossVictory.claimedTrinket);
          if (t) {
            return (
              <div onClick={() => { setShowRewardReveal(false); setShowProgress(true); }}
                style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.82)', cursor: 'pointer' }}>
                <div style={{ textAlign: 'center', maxWidth: 440, padding: 24 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.14em', color: '#fbbf24', textTransform: 'uppercase' }}>Boss Trinket Claimed</div>
                  <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 12, background: 'color-mix(in srgb,#f59e0b 18%, var(--bg-3))', border: '1px solid #f59e0b' }}>
                    <span style={{ fontSize: 28 }}>{t.icon}</span>
                    <div style={{ textAlign: 'left', flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{t.name}</div>
                      <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{t.desc}</div>
                    </div>
                  </div>
                  <div className="muted small" style={{ marginTop: 28, fontStyle: 'italic' }}>Tap anywhere to continue</div>
                </div>
              </div>
            );
          }
        }
        if (!choosers.length) return null;
        return (
          <div onClick={() => { setShowRewardReveal(false); setShowProgress(true); }}
            style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.82)', cursor: 'pointer' }}>
            <div style={{ textAlign: 'center', maxWidth: 440, padding: 24 }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.14em', color: '#c4b5fd', textTransform: 'uppercase' }}>Rewards Chosen</div>
              <div style={{ marginTop: 16, display: 'grid', gap: 12 }}>
                {choosers.map((c, i) => {
                  const icon = c.trinket ? c.trinket.icon : c.choice!.icon;
                  const label = c.trinket ? c.trinket.name : c.choice!.label;
                  const desc = c.trinket ? c.trinket.desc : c.choice!.desc;
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 12, background: `color-mix(in srgb, ${c.color} 18%, var(--bg-3))`, border: `1px solid ${c.color}` }}>
                      <span className="avatar" style={{ background: c.color, width: 24, height: 24, fontSize: 11 }}>{initials(c.name)}</span>
                      <span style={{ fontWeight: 800, fontSize: 14, minWidth: 64, textAlign: 'left' }}>{c.name}</span>
                      <span style={{ fontSize: 28 }}>{icon}</span>
                      <div style={{ textAlign: 'left', flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{label}</div>
                        <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{desc}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="muted small" style={{ marginTop: 28, fontStyle: 'italic' }}>Tap anywhere to continue</div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
