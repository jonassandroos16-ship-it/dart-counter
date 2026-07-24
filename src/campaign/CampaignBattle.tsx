import { useEffect, useState } from 'react';
import type { CampaignBattleState, CampaignProgress, CoopPowerUpId } from './types';
import {
  prepareEnemyTurn, applyNextEnemyAttack, setTarget, startBattle, getLevel,
  activateCoopPowerUp,
  levelRewardPowerUp, getCoopClass,
} from './engine';
import { getChapter } from './campaignLevels';
import type { Player, Settings } from '../types';
import type { CardDef } from '../cards/types';
import { resolveCardDef } from '../cards/deck';
import { CardHand } from '../cards/CardHand';
import { initCardPlayState } from '../cards/deck';

import { Sound } from '../sound';
import type { MusicEngine } from '../music';
import { bumpCoopStat } from './coopStats';
import { DartOverlay } from './DartOverlay';
import { FrozenOverlay } from './FrozenOverlay';
import { Modal } from '../Popups';
import { getEnemyDef } from './engine/enemies';
import { EnemyList } from './shared/EnemyList';
import { PlayerChips } from './shared/PlayerChips';
import { PartyHpBar } from './shared/PartyHpBar';
import { DartKeypad } from './shared/DartKeypad';
import { PlayerTurnInfo } from './shared/PlayerTurnInfo';
import { useCardBattle } from './shared/useCardBattle';


interface Props {
  levelId: number;
  chapterId: string;
  progress: CampaignProgress;
  settings: Settings;
  players: Player[];
  music: MusicEngine;
  onWin: (newHighest: number, unlockedPowerUpId: string | null, stats: CampaignBattleState['stats']) => void;
  onLose: () => void;
  onQuit: () => void;
}

export function CampaignBattle({ levelId, chapterId, progress, settings, players, music, onWin, onLose, onQuit }: Props) {
  const chapter = getChapter(chapterId);
  const level = (chapter?.levels.find(l => l.level_id === levelId)) || getLevel(levelId)!;
  const [state, setState] = useState<CampaignBattleState>(() =>
    startBattle(level, players, settings, undefined, chapterId),
  );
  const [showInfo, setShowInfo] = useState(false);
  const [mult, setMult] = useState(1);

  const cardMode = settings.gameMode === 'cards';

  const cardBattle = useCardBattle({
    battle: state,
    cardMode,
    runPlayers: state.players,
    players,
    settings,
    onStateChange: setState as (updater: (prev: CampaignBattleState | null) => CampaignBattleState | null) => void,
  });

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

  useEffect(() => {
    music.startContext('coop', settings);
    return () => { music.stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (state.outcome === 'victory') {
      Sound.play('win', {}, settings);
      bumpCoopStat('levelsCleared');
      const newHighest = Math.max(progress.highest_level_beaten, levelId);
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

  const thrower = state.players[state.playerTurnIdx];

  const { maxDartsPerVisit, totalCardsPlayed, playCard, onUndo, onEnter } = cardBattle;

  const onAdd = (base: number, m: number, labelOverride?: string, isBull?: boolean) => {
    cardBattle.onAdd(base, m, labelOverride, isBull);
    setMult(1);
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

  const playerVisitDone = state.phase === 'player'
    && (cardMode ? totalCardsPlayed >= maxDartsPerVisit : state.darts.length >= 3)
    && state.outcome === 'ongoing';
  const showingFrozen = state.phase === 'enemy'
    && state.pendingEnemyAttacks.length === 0
    && state.appliedEnemyAttacks.length === 0
    && state.frozenEnemiesThisRound.length > 0;
  const showingOverlay = playerVisitDone || state.pendingEnemyAttacks.length > 0 || showingFrozen;

  // Player chip extras: class icon + power-up charge badge
  const playerChipExtras: Record<string, { icon?: string; iconTitle?: string; badge?: { label: string; title: string } }> = {};
  for (const p of state.players) {
    const srcPlayer = players.find(sp => sp.id === p.id);
    const classDef = getCoopClass(srcPlayer?.coopProgress?.classId);
    playerChipExtras[p.id] = {
      icon: classDef?.icon,
      iconTitle: classDef ? `${classDef.name}: ${classDef.desc}` : undefined,
      badge: { label: `${Math.round(p.powerUpCharge)}%`, title: `${p.name}'s power-up charge` },
    };
  }

  return (
    <div className="view-noscroll coop-battle" style={{ position: 'relative', background: chapter?.theme.background || undefined, borderRadius: 14, overflow: 'hidden' }}>
      <button className="btn danger sm quit-float" onClick={() => { if (confirm('Quit this battle? Progress will be saved.')) onQuit(); }}>Quit</button>
      {showingFrozen && <div className="battle-frost-tint" />}

      <div className="play-current" style={{ position: 'relative', zIndex: 2 }}>
        <div className="pc-header">
          <div className="row" style={{ gap: 8, alignItems: 'center' }}>
            <button
              onClick={() => setShowInfo(true)}
              title="Level & chapter info"
              style={{
                background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 8,
                width: 32, height: 32, fontSize: 16, cursor: 'pointer', padding: 0, color: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto',
              }}
            >ℹ</button>
            <span className="muted small">VISIT {state.visitNumber} · {state.phase === 'player' ? 'YOUR TURN' : 'ENEMY TURN'}</span>
          </div>
        </div>
        <PartyHpBar state={state} />

        <PlayerChips state={state} players={players} extras={playerChipExtras} onActivatePowerUp={onActivatePowerUp} />

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
          <PlayerTurnInfo state={state} enemyIcon={enemyIcon} />
        )}

        {state.phase === 'enemy' && !state.pendingEnemyAttacks.length && !state.frozenEnemiesThisRound.length && (
          <div className="muted small" style={{ marginTop: 6, fontStyle: 'italic' }}>
            Enemies are preparing to attack…
          </div>
        )}
      </div>

      <EnemyList
        state={state}
        enemyIcon={enemyIcon}
        canTarget={state.phase === 'player' && state.outcome === 'ongoing'}
        onSelectTarget={(enemyId) => setState(prev => setTarget(prev, enemyId))}
      />

      {state.phantomDarts > 0 && state.phase === 'player' && (
        <div className="pill" style={{ marginTop: 6, background: 'color-mix(in srgb,#22d3ee 22%,var(--bg-3))', color: '#cffafe', borderColor: 'transparent' }}>
          👻 Phantom Darts active — next {state.phantomDarts} dart{state.phantomDarts === 1 ? '' : 's'} auto-bullseye
        </div>
      )}

      {state.phase === 'player' && state.outcome === 'ongoing' && (cardMode ? totalCardsPlayed < maxDartsPerVisit : state.darts.length < 3) && (
        cardMode ? (
          <CardHand
            cardState={thrower ? cardBattle.cardStates[thrower.id] ?? initCardPlayState([]) : initCardPlayState([])}
            playerName={thrower?.name ?? 'Player'}
            isMyTurn={true}
            isBattle={true}
            canPlayMore={totalCardsPlayed < maxDartsPerVisit}
            canUndo={totalCardsPlayed > 0 || state.darts.length > 0}
            onPlayCard={(handIdx) => playCard(handIdx)}
            onUndo={onUndo}
            onEndVisit={onEnter}
            visitNumber={state.visitNumber}
          />
        ) : (
          <DartKeypad
            mult={mult}
            onSetMult={setMult}
            onAdd={onAdd}
            onUndo={onUndo}
            onEnter={onEnter}
            canThrow={true}
            darts={state.darts}
          />
        )
      )}

      {showingFrozen && (
        <FrozenOverlay state={state} onContinue={onContinue} />
      )}

      {showingOverlay && !showingFrozen && (
        <DartOverlay
          state={state}
          onContinue={onContinue}
          onEndVisit={onEnter}
          settings={settings}
          enemyIcon={enemyIcon}
          playerVisitDone={playerVisitDone}
          playedCards={cardMode && thrower ? (cardBattle.cardStates[thrower.id]?.used.map(pc => resolveCardDef(pc)).filter(Boolean) as CardDef[] ?? []) : undefined}
        />
      )}

      {showInfo && (
        <Modal onClose={() => setShowInfo(false)}>
          <div style={{ textAlign: 'center', padding: 8 }}>
            {chapter && (
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.14em', color: chapter.theme.accent, textTransform: 'uppercase', marginBottom: 4 }}>
                {chapter.name}
              </div>
            )}
            <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 4 }}>
              {level.is_boss ? '☠ ' : ''}{level.name}
            </div>
            {chapter && (
              <div className="muted small" style={{ fontStyle: 'italic', marginBottom: 10 }}>
                {chapter.subtitle}
              </div>
            )}
            {level.story_bit && (
              <div className="muted" style={{ fontSize: 13, lineHeight: 1.5, fontStyle: 'italic', textAlign: 'center', maxWidth: 300, margin: '0 auto 14px' }}>
                {level.story_bit}
              </div>
            )}
            <button className="btn primary block" onClick={() => setShowInfo(false)}>Close</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
