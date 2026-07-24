import { useEffect, useState } from 'react';
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
import { ownsPlayer, type LobbyPlayer } from '../multiplayer/client';
import { DeckUpgradeScreen } from './DeckUpgradeScreen';
import { BOSS_INTRO_STORIES, MINIBOSS_INTRO_STORIES } from './bossStories';
import { ProgressScreen } from './ProgressScreen';
import { PartyBuffBadges } from '../cards/BuffBadges';
import { PlayerDetailModal } from './PlayerDetailModal';
import { BossVictoryScreen } from './BossVictoryScreen';
import { RewardRevealOverlay } from './RewardRevealOverlay';
import type { PlayerCard, CardDef, CardPlayState } from '../cards/types';
import {
  initCardPlayState, endTurn, MAX_PLAYS_PER_TURN, resolveCardDef,
  getPlayerCards, playCardFromHand,
} from '../cards/deck';
import { startTurnWithExtraDraws } from '../cards/turnLogic';
import { applyCardEffect } from '../cards/cardEffects';
import { CardHand } from '../cards/CardHand';

interface Props {
  run: DartliteRun;
  players: Player[];
  settings: Settings;
  music: MusicEngine;
  onBattleEnd: (won: boolean, finalBattle?: CampaignBattleState) => void;
  onChoice: (nextRun: DartliteRun) => void;
  onQuit: () => void;
  lobbyPlayers?: LobbyPlayer[];
}

export function DartliteBattle({ run, players, settings, music, onBattleEnd, onChoice, onQuit, lobbyPlayers }: Props) {
  const battle = run.battle!;
  const [state, setState] = useState<CampaignBattleState | null>(battle);
  const [pendingVictory, setPendingVictory] = useState(false);
  const [pendingDefeat, setPendingDefeat] = useState(false);
  useEffect(() => {
    if (battle) {
      setState(battle);
      setPendingVictory(false);
      setPendingDefeat(false);
    }
  }, [battle]);
  const [showProgress, setShowProgress] = useState(false);
  const [detailPlayerId, setDetailPlayerId] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [showTrinketUnlock, setShowTrinketUnlock] = useState(false);
  const [mult, setMult] = useState(1);
  const [chosenRun, setChosenRun] = useState<DartliteRun | null>(null);
  const [showRewardReveal, setShowRewardReveal] = useState(false);
  const [showDeckUpgrade, setShowDeckUpgrade] = useState(false);
  const [deckUpgradeOption, setDeckUpgradeOption] = useState<ChoiceOption | null>(null);

  const isMultiplayer = !!lobbyPlayers?.length;
  const chooserIdx = run.phase === 'choice' ? run.choicePlayerIdx : (run.phase === 'boss_victory' ? 0 : -1);
  const chooserPlayerId = chooserIdx >= 0 ? run.playerIds[chooserIdx] : null;
  const canChoose = !isMultiplayer || (chooserPlayerId != null && ownsPlayer(lobbyPlayers!, chooserPlayerId));

  const throwerId = state?.players?.[state.playerTurnIdx]?.id;
  const canThrow = !isMultiplayer || (throwerId != null && ownsPlayer(lobbyPlayers!, throwerId));

  const cardMode = run.cardMode;
  const [cardStates, setCardStates] = useState<Record<string, CardPlayState>>(() => {
    if (!cardMode || !battle) return {};
    const cs: Record<string, CardPlayState> = {};
    for (const rp of run.runPlayers) {
      const playerData = players.find(p => p.id === rp.id);
      const collection: PlayerCard[] = rp.cards?.length ? rp.cards : (playerData ? getPlayerCards(playerData) : []);
      cs[rp.id] = initCardPlayState(collection);
    }
    return cs;
  });
  const [bonusSlots, setBonusSlots] = useState(0);

  const [nextTurnDraws, setNextTurnDraws] = useState<Record<string, number>>({});
  const [nextTurnSlots, setNextTurnSlots] = useState<Record<string, number>>({});

  const [showBossIntro, setShowBossIntro] = useState(false);
  const [bossIntroText, setBossIntroText] = useState('');

  useEffect(() => {
    if (!state) return;
    if (state.phase !== 'player') return;
    if (!isBossRound(run.round) && !isMiniBossRound(run.round)) return;
    if (state.visitNumber > 1) return;
    const enemy = state.enemies[0];
    if (!enemy) return;
    const isBoss = isBossRound(run.round);
    const stories = isBoss ? BOSS_INTRO_STORIES : MINIBOSS_INTRO_STORIES;
    const story = stories[Math.floor(Math.random() * stories.length)];
    setBossIntroText(story.replace('{name}', enemy.name));
    setShowBossIntro(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.phase, run.round, state?.visitNumber]);

  useEffect(() => {
    if (!cardMode || !battle) return;
    const cs: Record<string, CardPlayState> = {};
    for (const rp of run.runPlayers) {
      const playerData = players.find(p => p.id === rp.id);
      const collection: PlayerCard[] = rp.cards?.length ? rp.cards : (playerData ? getPlayerCards(playerData) : []);
      cs[rp.id] = initCardPlayState(collection);
    }
    setCardStates(cs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battle, cardMode]);

  useEffect(() => {
    if (!cardMode || !state || state.phase !== 'player') return;
    const thrower = state.players[state.playerTurnIdx];
    if (!thrower) return;
    const cs = cardStates[thrower.id];
    if (!cs) return;
    if (cs.hand.length === 0 && cs.used.length === 0) {
      const extraDraw = nextTurnDraws[thrower.id] ?? 0;
      const extraSlot = nextTurnSlots[thrower.id] ?? 0;
      const next = startTurnWithExtraDraws(cs, extraDraw, extraSlot, (n) => setBonusSlots(b => b + n));
      setCardStates(prev => ({ ...prev, [thrower.id]: next }));
      setNextTurnDraws(prev => { const c = { ...prev }; delete c[thrower.id]; return c; });
      setNextTurnSlots(prev => { const c = { ...prev }; delete c[thrower.id]; return c; });
    }
  }, [state?.phase, state?.playerTurnIdx, cardMode, cardStates]);

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
      setPendingVictory(true);
    } else if (state.outcome === 'defeat') {
      Sound.play('kill', {}, settings);
      setPendingDefeat(true);
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

  const maxDartsPerVisit = cardMode ? MAX_PLAYS_PER_TURN + bonusSlots : 3;
  const totalCardsPlayed = cardMode && thrower ? (cardStates[thrower.id]?.used.length ?? 0) : 0;

  const onAdd = (base: number, m: number, labelOverride?: string, isBull?: boolean) => {
    setState(prev => prev ? addDart(prev, base, m, labelOverride, isBull, settings, maxDartsPerVisit) : prev);
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
    if (pendingVictory) {
      onBattleEnd(true);
      return;
    }
    if (pendingDefeat) {
      onBattleEnd(false);
      return;
    }
    if (cardMode ? totalCardsPlayed === 0 : !state.darts.length) return;
    if (cardMode) {
      const thrower = state.players[state.playerTurnIdx];
      if (thrower) {
        const cs = cardStates[thrower.id];
        if (cs) {
          const endedState = endTurn(cs);
          setCardStates(prev => ({ ...prev, [thrower.id]: endedState }));
        }
      }
      setBonusSlots(0);
    }
    setState(prev => prev ? resolvePlayerVisit(prev, cardMode && totalCardsPlayed > 0) : prev);
  };

  const playCard = (handIdx: number) => {
    if (!state || !cardMode) return;
    const thrower = state.players[state.playerTurnIdx];
    if (!thrower) return;
    const cs = cardStates[thrower.id];
    if (!cs) return;
    const handDefs = cs.hand.map(pc => resolveCardDef(pc)).filter(Boolean) as CardDef[];
    const card = handDefs[handIdx];
    if (!card) return;
    const maxPlays = MAX_PLAYS_PER_TURN + bonusSlots;
    if (cs.used.length >= maxPlays) return;
    if (card.type !== 'damage') {
      const updated = applyCardEffect({
        card, handIdx, state: cs, battleState: state, throwerId: thrower.id,
        bonusSlots, setBonusSlots, setNextTurnSlots, setNextTurnDraws, setBattleState: setState as any,
      });
      Sound.play('powerup', {}, settings);
      setCardStates(prev => ({ ...prev, [thrower.id]: updated }));
      return;
    }
    if (totalCardsPlayed >= maxDartsPerVisit) return;
    const updated = playCardFromHand(cs, handIdx);
    if (!updated) return;
    const base = card.base ?? 0;
    const cardMult = card.mult ?? 1;
    const isBull = base === 50;
    const label = card.name;
    setCardStates(prev => ({ ...prev, [thrower.id]: updated }));
    onAdd(base, isBull ? 2 : (base === 25 && cardMult === 2 ? 2 : cardMult), label, isBull);
  };

  const onContinue = () => {
    if (pendingDefeat) {
      onBattleEnd(false);
      return;
    }
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
  const playerVisitDone = state.phase === 'player' && (cardMode ? totalCardsPlayed >= maxDartsPerVisit : state.darts.length >= 3) && (state.outcome === 'ongoing' || state.outcome === 'victory');
  const playerVictoryPending = state.phase === 'player' && state.outcome === 'victory' && !playerVisitDone;
  const showingFrozen = state.phase === 'enemy'
    && state.pendingEnemyAttacks.length === 0
    && state.appliedEnemyAttacks.length === 0
    && state.frozenEnemiesThisRound.length > 0;
  const showingOverlay = playerVisitDone || playerVictoryPending || state.pendingEnemyAttacks.length > 0 || showingFrozen || pendingDefeat;

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

  if (showBossIntro) {
    const isBoss = isBossRound(run.round);
    return (
      <div className="view-scroll" style={{ minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isBoss ? 'radial-gradient(ellipse at center, color-mix(in srgb,#dc2626 20%,var(--bg)) 0%, var(--bg) 70%)' : 'radial-gradient(ellipse at center, color-mix(in srgb,#f59e0b 15%,var(--bg)) 0%, var(--bg) 70%)' }}>
        <div className="card" style={{ maxWidth: 520, margin: '0 auto', textAlign: 'center', padding: 32, border: '2px solid ' + (isBoss ? '#dc2626' : '#f59e0b') }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>{isBoss ? '☠' : '⚔'}</div>
          <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: '.14em', color: isBoss ? '#fca5a5' : '#fcd34d', textTransform: 'uppercase' }}>
            {isBoss ? 'Boss Battle' : 'Mini-Boss Battle'}
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, marginTop: 8, color: isBoss ? '#ef4444' : '#f59e0b' }}>
            {state?.enemies[0]?.name ?? 'Unknown'}
          </div>
          <div style={{ marginTop: 16, fontSize: 15, lineHeight: 1.6, color: 'var(--text)', fontStyle: 'italic' }}>
            {bossIntroText}
          </div>
          <button className="btn block primary" style={{ marginTop: 24 }} onClick={() => setShowBossIntro(false)}>
            {isBoss ? 'Face the Boss' : 'Begin the Fight'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="view-noscroll coop-battle" style={{ position: 'relative', background: 'radial-gradient(ellipse at top, color-mix(in srgb,#7c3aed 15%,var(--bg)) 0%, var(--bg) 70%)', borderRadius: 14, overflow: 'hidden' }}>
      <button className="btn danger sm quit-float" onClick={() => { if (confirm('Quit this run? Progress will be saved.')) onQuit(); }}>Quit</button>

      {!(showRewardReveal || showProgress || showDeckUpgrade) && (
        run.phase === 'boss_victory' && run.bossVictory ? (
        <BossVictoryScreen
          run={run}
          players={players}
          canChoose={canChoose}
          onPick={(trinketId) => {
            if (!canChoose) return;
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
          canChoose={canChoose}
          chooserPlayerId={chooserPlayerId}
          onPick={(opt) => {
            if (!canChoose) return;
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
                    {p.buffs.length > 0 && (
                      <PartyBuffBadges buffs={p.buffs} />
                    )}
                  </div>
                );
              })}
            </div>

            {state.phase === 'player' && thrower && (
              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="muted small">Multiplier</span>
                {[1, 2, 3].map(m => (
                  <button key={m} onClick={() => setMult(m)}
                    style={{
                      width: 36, height: 36, borderRadius: 8, cursor: 'pointer',
                      border: `2px solid ${mult === m ? 'var(--accent)' : 'var(--border)'}`,
                      background: mult === m ? 'color-mix(in srgb,var(--accent) 22%,var(--bg-3))' : 'var(--bg-3)',
                      color: 'var(--text)', fontWeight: 800, fontSize: 14, padding: 0,
                    }}>{m}×</button>
                ))}
              </div>
            )}
          </div>

          {state.phase === 'player' && thrower && (
            <div className="play-targets" style={{ marginTop: 8 }}>
              {state.enemies.map((e, ei) => {
                const def = getEnemyDef(e.defId);
                const icon = enemyIcon(e.defId);
                const hpPct = Math.max(0, Math.min(100, (e.hp / e.maxHp) * 100));
                const isTarget = state.targetIdx === ei;
                const isBoss = def?.difficulty === 'Boss';
                return (
                  <div key={e.id} onClick={() => canThrow && setState(prev => prev ? setTarget(prev, e.id) : prev)}
                    style={{
                      cursor: canThrow ? 'pointer' : 'default',
                      border: `2px solid ${isTarget ? 'var(--accent)' : 'var(--border)'}`,
                      borderRadius: 12, padding: '10px 12px', background: isTarget ? 'color-mix(in srgb,var(--accent) 12%,var(--bg-3))' : 'var(--bg-3)',
                      opacity: e.defeated ? 0.4 : 1, transition: 'all .2s',
                    }}>
                    <div className="row between" style={{ alignItems: 'center' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          minWidth: 24, height: 24, borderRadius: 6, padding: '0 5px',
                          background: 'color-mix(in srgb,var(--accent) 22%,var(--bg))',
                          color: 'var(--accent)', fontSize: 12, fontWeight: 900, flex: '0 0 auto',
                        }}>{icon}</span>
                        <span style={{ fontWeight: 800, fontSize: 14 }}>{e.name}</span>
                        {isBoss && <span style={{ fontSize: 10, fontWeight: 800, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '.08em' }}>Boss</span>}
                      </span>
                      <span className="muted small">{e.defeated ? '☠' : `${e.hp}/${e.maxHp} HP`}</span>
                    </div>
                    {!e.defeated && (
                      <div style={{ marginTop: 6, height: 6, borderRadius: 3, background: 'var(--bg)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${hpPct}%`, background: '#ef4444', transition: 'width .4s' }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {state.phase === 'player' && cardMode && thrower && cardStates[thrower.id] && (
            <CardHand
              cardState={cardStates[thrower.id]!}
              playerName={thrower.name}
              isMyTurn={canThrow}
              isBattle={true}
              canEndVisit={totalCardsPlayed > 0}
              canUndo={state.darts.length > 0}
              canPlayMore={totalCardsPlayed < maxDartsPerVisit}
              onPlayCard={playCard}
              onUndo={onUndo}
              onEndVisit={onEnter}
            />
          )}

          {state.phase === 'player' && !cardMode && thrower && (
            <div className="play-input" style={{ marginTop: 8 }}>
              <div className="row" style={{ gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map(n => (
                  <button key={n} disabled={!canThrow} onClick={() => onAdd(n, mult)}
                    style={{
                      width: 44, height: 44, borderRadius: 8, cursor: canThrow ? 'pointer' : 'default',
                      border: '1px solid var(--border)', background: 'var(--bg-3)', color: 'var(--text)',
                      fontWeight: 800, fontSize: 16, padding: 0,
                    }}>{n}</button>
                ))}
              </div>
              <div className="row" style={{ gap: 6, marginTop: 8, justifyContent: 'center' }}>
                <button disabled={!canThrow} onClick={() => onAdd(25, 2, 'Bull', false)}
                  style={{
                    width: 64, height: 44, borderRadius: 8, cursor: canThrow ? 'pointer' : 'default',
                    border: '1px solid var(--border)', background: 'color-mix(in srgb,#ef4444 18%,var(--bg-3))',
                    color: '#fca5a5', fontWeight: 800, fontSize: 14, padding: 0,
                  }}>25</button>
                <button disabled={!canThrow} onClick={() => onAdd(50, 2, 'Bullseye', true)}
                  style={{
                    width: 64, height: 44, borderRadius: 8, cursor: canThrow ? 'pointer' : 'default',
                    border: '1px solid var(--border)', background: 'color-mix(in srgb,#ef4444 28%,var(--bg-3))',
                    color: '#fca5a5', fontWeight: 800, fontSize: 14, padding: 0,
                  }}>50</button>
                <button disabled={!canThrow} onClick={() => onAdd(0, 1, 'Miss', false)}
                  style={{
                    width: 64, height: 44, borderRadius: 8, cursor: canThrow ? 'pointer' : 'default',
                    border: '1px solid var(--border)', background: 'var(--bg-3)',
                    color: 'var(--muted)', fontWeight: 800, fontSize: 14, padding: 0,
                  }}>Miss</button>
              </div>
              <div className="row" style={{ gap: 8, marginTop: 10, justifyContent: 'center', alignItems: 'center' }}>
                {state.darts.map((d, i) => (
                  <span key={i} className="pill" style={{ fontSize: 12, padding: '4px 10px', background: 'var(--bg-3)', borderColor: 'var(--border)' }}>
                    {d.label} {d.value > 0 ? `(${d.value})` : ''}
                  </span>
                ))}
                <button className="btn sm" disabled={!canThrow || !state.darts.length} onClick={onUndo} style={{ marginLeft: 4 }}>Undo</button>
                <button className="btn primary" disabled={!canThrow} onClick={onEnter} style={{ marginLeft: 4 }}>Enter</button>
              </div>
            </div>
          )}

          {showingFrozen && <FrozenOverlay state={state} onContinue={onContinue} />}
          {showingOverlay && !showingFrozen && (
            <DartOverlay state={state} onContinue={onContinue} onEndVisit={onEnter} settings={settings} enemyIcon={enemyIcon} playerVisitDone={playerVisitDone || playerVictoryPending} playedCards={cardMode && thrower ? (cardStates[thrower.id]?.used.map(pc => resolveCardDef(pc)).filter(Boolean) as CardDef[] ?? []) : undefined} />
          )}

          {showTrinketUnlock && run.lastUnlockedTrinket && (() => {
            const t = getTrinket(run.lastUnlockedTrinket);
            if (!t) return null;
            return (
              <Modal onClose={() => setShowTrinketUnlock(false)}>
                <div style={{ textAlign: 'center', padding: 24 }}>
                  <div style={{ fontSize: 48, marginBottom: 8 }}>{t.icon}</div>
                  <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: '.14em', color: '#c4b5fd', textTransform: 'uppercase' }}>Trinket Unlocked</div>
                  <div style={{ fontSize: 24, fontWeight: 900, marginTop: 4 }}>{t.name}</div>
                  <div className="muted" style={{ marginTop: 8, fontSize: 14 }}>{t.desc}</div>
                  <button className="btn block primary" style={{ marginTop: 20 }} onClick={() => setShowTrinketUnlock(false)}>Continue</button>
                </div>
              </Modal>
            );
          })()}

          {showInfo && (
            <Modal onClose={() => setShowInfo(false)}>
              <div style={{ padding: 20 }}>
                <h3 style={{ margin: '0 0 12px 0' }}>Run Info</h3>
                <div className="muted small" style={{ marginBottom: 8 }}>Round {run.round} · {run.phase}</div>
                <div className="row between" style={{ marginBottom: 4 }}><span className="muted small">Rounds cleared</span><span className="small" style={{ fontWeight: 700 }}>{run.stats.roundsCleared}</span></div>
                <div className="row between" style={{ marginBottom: 4 }}><span className="muted small">Enemies defeated</span><span className="small" style={{ fontWeight: 700 }}>{run.stats.enemiesDefeated}</span></div>
                <div className="row between" style={{ marginBottom: 4 }}><span className="muted small">Damage dealt</span><span className="small" style={{ fontWeight: 700 }}>{run.stats.damageDealt}</span></div>
                <div className="row between" style={{ marginBottom: 4 }}><span className="muted small">XP gained</span><span className="small" style={{ fontWeight: 700 }}>{run.stats.xpGained}</span></div>
                <div className="row between" style={{ marginBottom: 12 }}><span className="muted small">Trinkets</span><span className="small" style={{ fontWeight: 700 }}>{run.trinkets.length}</span></div>
                <button className="btn block ghost" onClick={() => setShowInfo(false)}>Close</button>
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
            setDeckUpgradeOption(null);
            setShowDeckUpgrade(false);
            if (next.phase === 'reward') {
              setChosenRun(next);
              setShowRewardReveal(true);
            } else {
              onChoice(next);
            }
          }}
          onCancel={() => { setShowDeckUpgrade(false); setDeckUpgradeOption(null); }}
        />
      )}

      {showRewardReveal && chosenRun && (
        <RewardRevealOverlay
          run={chosenRun}
          players={players}
          onContinue={() => {
            setShowRewardReveal(false);
            setShowProgress(true);
          }}
        />
      )}

      {showProgress && chosenRun && (
        <ProgressScreen
          run={chosenRun}
          players={players}
          onContinue={() => {
            setShowProgress(false);
            onChoice(chosenRun);
          }}
        />
      )}
    </div>
  );
}
