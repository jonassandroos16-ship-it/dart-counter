import { useEffect, useState } from 'react';
import type { Settings, Player } from '../types';
import type { CampaignBattleState } from '../campaign/types';
import {
  prepareEnemyTurn, applyNextEnemyAttack, setTarget, effectivePower,
} from '../campaign/engine';
import { getEnemyDef } from '../campaign/engine/enemies';
import { Sound } from '../sound';
import type { MusicEngine } from '../music';
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
import { PlayerDetailModal } from './PlayerDetailModal';
import { BossVictoryScreen } from './BossVictoryScreen';
import { RewardRevealOverlay } from './RewardRevealOverlay';
import type { CardDef } from '../cards/types';
import { resolveCardDef } from '../cards/deck';
import { CardHand } from '../cards/CardHand';
import { EnemyList } from '../campaign/shared/EnemyList';
import { PlayerChips } from '../campaign/shared/PlayerChips';
import { PartyHpBar } from '../campaign/shared/PartyHpBar';
import { DartKeypad } from '../campaign/shared/DartKeypad';
import { useCardBattle } from '../campaign/shared/useCardBattle';

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

  const cardBattle = useCardBattle({
    battle: state,
    cardMode,
    runPlayers: run.runPlayers,
    players,
    settings,
    onStateChange: setState,
  });

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
  const thrower = state.players[state.playerTurnIdx];

  const { maxDartsPerVisit, totalCardsPlayed, playCard, onUndo, onEnter } = cardBattle;

  const onAdd = (base: number, m: number, labelOverride?: string, isBull?: boolean) => {
    cardBattle.onAdd(base, m, labelOverride, isBull);
    setMult(1);
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

  const handleEnter = () => {
    if (pendingVictory) {
      onBattleEnd(true);
      return;
    }
    if (pendingDefeat) {
      onBattleEnd(false);
      return;
    }
    onEnter();
  };

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
            <PartyHpBar state={state} />

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

            <PlayerChips
              state={state}
              onPlayerClick={(pid) => setDetailPlayerId(pid)}
              playerClickTitle="Tap for run stats"
            />

            {state.phase === 'player' && thrower && !cardMode && (
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

          {state.phase === 'player' && (
            <EnemyList
              state={state}
              enemyIcon={enemyIcon}
              canTarget={canThrow && state.outcome === 'ongoing'}
              onSelectTarget={(enemyId) => setState(prev => prev ? setTarget(prev, enemyId) : prev)}
            />
          )}

          {state.phase === 'player' && cardMode && thrower && cardBattle.cardStates[thrower.id] && (
            <CardHand
              cardState={cardBattle.cardStates[thrower.id]!}
              playerName={thrower.name}
              isMyTurn={canThrow}
              isBattle={true}
              canEndVisit={totalCardsPlayed > 0}
              canUndo={state.darts.length > 0}
              canPlayMore={totalCardsPlayed < maxDartsPerVisit}
              onPlayCard={playCard}
              onUndo={onUndo}
              onEndVisit={handleEnter}
            />
          )}

          {state.phase === 'player' && !cardMode && thrower && (
            <DartKeypad
              mult={mult}
              onSetMult={setMult}
              onAdd={onAdd}
              onUndo={onUndo}
              onEnter={handleEnter}
              canThrow={canThrow}
              darts={state.darts}
              dartCount={state.darts.length}
            />
          )}

          {showingFrozen && <FrozenOverlay state={state} onContinue={onContinue} />}
          {showingOverlay && !showingFrozen && (
            <DartOverlay state={state} onContinue={onContinue} onEndVisit={handleEnter} settings={settings} enemyIcon={enemyIcon} playerVisitDone={playerVisitDone || playerVictoryPending} playedCards={cardMode && thrower ? (cardBattle.cardStates[thrower.id]?.used.map(pc => resolveCardDef(pc)).filter(Boolean) as CardDef[] ?? []) : undefined} />
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
