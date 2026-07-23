import { useEffect, useState } from 'react';
import type { CampaignBattleState, CampaignProgress, CoopPowerUpId } from './types';
import type { CardPlayState, PlayerCard } from '../cards/types';
import { initCardPlayState, startTurn, endTurn, getPlayerCards, MAX_PLAYS_PER_TURN, resolveCardDef, playCardFromHand, redrawHand, recycleGraveyard, drawCards, HAND_SIZE } from '../cards/deck';
import { CardHand } from '../cards/CardHand';
import {
  addDart, undoDart, resolvePlayerVisit,
  prepareEnemyTurn, applyNextEnemyAttack, setTarget, startBattle, getLevel,
  describeShield, getCoopPowerUp, canActivateCoopPowerUp, activateCoopPowerUp,
  levelRewardPowerUp, getCoopClass, effectivePower,
} from './engine';
import { getChapter } from './campaignLevels';
import type { Player, Settings } from '../types';
import type { CardDef } from '../cards/types';

function applyUtilityCard(state: CampaignBattleState, card: CardDef, _settings: Settings): CampaignBattleState {
  if (state.phase !== 'player') return state;
  const thrower = state.players[state.playerTurnIdx];
  if (!thrower) return state;
  const mag = card.magnitude ?? 0;
  const effect = card.effect ?? '';

  // Healing effects
  if (effect === 'heal' || effect === 'blessing') {
    const heal = effect === 'blessing' ? Math.min(mag, 40) : mag;
    const partyHp = Math.min(state.partyMaxHp, state.partyHp + heal);
    return { ...state, partyHp };
  }

  // Heal-over-time: add a regen buff to all players
  if (effect === 'heal_over_time') {
    const buffId = `regen_${Date.now()}`;
    const players = state.players.map(p => ({
      ...p,
      buffs: [...p.buffs, { id: buffId, kind: 'regen' as const, amount: mag, turnsLeft: 3, source: thrower.id }],
    }));
    return { ...state, players };
  }

  // Party shields
  if (effect === 'party_shield_flat' || effect === 'party_shield') {
    const heal = effect === 'party_shield_flat' ? Math.min(mag, state.partyMaxHp - state.partyHp) : 0;
    const buffId = `shield_${Date.now()}`;
    const players = state.players.map(p => ({
      ...p,
      buffs: [...p.buffs, { id: buffId, kind: 'shield' as const, amount: mag, turnsLeft: 2, source: thrower.id }],
    }));
    return { ...state, players, partyHp: Math.min(state.partyMaxHp, state.partyHp + heal) };
  }

  // Enemy debuffs: curse, weaken, miss, bleed, freeze
  if (effect === 'enemy_curse' || effect === 'enemy_debuff') {
    const enemies = state.enemies.map(e => e.defeated ? e : {
      ...e,
      distractedTurns: Math.max(e.distractedTurns, 3),
      distractAmount: Math.max(e.distractAmount, mag / 100),
    });
    return { ...state, enemies };
  }
  if (effect === 'enemy_miss') {
    const enemies = state.enemies.map(e => e.defeated ? e : {
      ...e,
      distractedTurns: Math.max(e.distractedTurns, 2),
      distractAmount: Math.max(e.distractAmount, mag / 100),
    });
    return { ...state, enemies };
  }
  if (effect === 'bleed') {
    const buffId = `bleed_${Date.now()}`;
    const enemies = state.enemies.map(e => e.defeated ? e : {
      ...e,
      buffs: [...(e as any).buffs, { id: buffId, kind: 'bleed', amount: mag, turnsLeft: 3 }],
    });
    return { ...state, enemies };
  }
  if (effect === 'freeze') {
    const enemies = state.enemies.map(e => e.defeated ? e : { ...e, frozenTurns: Math.max(e.frozenTurns, 1) });
    return { ...state, enemies };
  }

  // Power/accuracy/armor buffs
  if (effect === 'power_buff') {
    const buffId = `power_${Date.now()}`;
    const players = state.players.map(p => ({
      ...p,
      buffs: [...p.buffs, { id: buffId, kind: 'power' as const, amount: mag, turnsLeft: 3, source: thrower.id }],
    }));
    return { ...state, players };
  }
  if (effect === 'accuracy_buff') {
    const enemies = state.enemies.map(e => e.defeated ? e : {
      ...e,
      distractedTurns: Math.max(e.distractedTurns, 3),
      distractAmount: Math.max(e.distractAmount, mag / 100),
    });
    return { ...state, enemies };
  }
  if (effect === 'armor_buff') {
    const buffId = `armor_${Date.now()}`;
    const players = state.players.map(p => ({
      ...p,
      buffs: [...p.buffs, { id: buffId, kind: 'armor' as const, amount: mag, turnsLeft: 3, source: thrower.id }],
    }));
    return { ...state, players };
  }

  // Surge / hot streak / reflect / bust protect / double_up / extra_dart / revive
  if (effect === 'surge' || effect === 'hot_streak' || effect === 'bust_protect' || effect === 'double_up' || effect === 'extra_dart' || effect === 'reflect') {
    const buffId = `${effect}_${Date.now()}`;
    const players = state.players.map(p => ({
      ...p,
      buffs: [...p.buffs, { id: buffId, kind: effect as any, amount: mag, turnsLeft: 2, source: thrower.id }],
    }));
    return { ...state, players };
  }
  if (effect === 'revive') {
    return { ...state, partyHp: Math.max(state.partyHp, Math.round(state.partyMaxHp * 0.25)) };
  }

  // Draw / shadowstep / redraw / recycle — handled in playCampaignCard (deck operations)
  if (effect === 'draw' || effect === 'shadowstep' || effect === 'redraw' || effect === 'recycle' || effect === 'extra_slot' || effect === 'blessing') {
    return state;
  }

  return state;
}
import { Sound } from '../sound';
import type { MusicEngine } from '../music';
import { initials } from '../store';
import { bumpCoopStat } from './coopStats';
import { CoopPowerUpOrb } from './CoopPowerUpOrb';
import { DartOverlay } from './DartOverlay';
import { FrozenOverlay } from './FrozenOverlay';
import { Modal } from '../Popups';
import { getEnemyDef } from './engine/enemies';


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

  // ── Card mode state ──────────────────────────────────────────────────
  const [cardStates, setCardStates] = useState<Record<string, CardPlayState>>({});
  const [bonusSlots, setBonusSlots] = useState(0);
  const [nextTurnDraws, setNextTurnDraws] = useState<Record<string, number>>({});
  const [nextTurnSlots, setNextTurnSlots] = useState<Record<string, number>>({});
  const cardMode = settings.gameMode === 'cards';

  useEffect(() => {
    if (!cardMode) return;
    const cs: Record<string, CardPlayState> = {};
    for (const cp of state.players) {
      const playerData = players.find(p => p.id === cp.id);
      const collection: PlayerCard[] = playerData ? getPlayerCards(playerData) : [];
      cs[cp.id] = initCardPlayState(collection);
    }
    setCardStates(cs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardMode]);

  useEffect(() => {
    if (!cardMode || state.phase !== 'player') return;
    const thrower = state.players[state.playerTurnIdx];
    if (!thrower) return;
    const cs = cardStates[thrower.id];
    if (!cs) return;
    if (cs.hand.length === 0 && cs.used.length === 0) {
      const extraDraw = nextTurnDraws[thrower.id] ?? 0;
      const extraSlot = nextTurnSlots[thrower.id] ?? 0;
      let next = startTurn(cs);
      if (extraDraw > 0) next = drawCards(next, HAND_SIZE + extraDraw);
      setCardStates(prev => ({ ...prev, [thrower.id]: next }));
      if (extraSlot > 0) setBonusSlots(b => b + extraSlot);
      setNextTurnDraws(prev => { const c = { ...prev }; delete c[thrower.id]; return c; });
      setNextTurnSlots(prev => { const c = { ...prev }; delete c[thrower.id]; return c; });
    }
  }, [state.phase, state.playerTurnIdx, cardMode, cardStates, nextTurnDraws, nextTurnSlots]);

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
  const [mult, setMult] = useState(1);

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

  const aliveEnemies = state.enemies.filter(e => !e.defeated);
  const target = state.enemies[state.targetIdx];
  const validTarget = target && !target.defeated ? target : aliveEnemies[0];
  const thrower = state.players[state.playerTurnIdx];

  const onAdd = (base: number, m: number, labelOverride?: string, isBull?: boolean) => {
    setState(prev => addDart(prev, base, m, labelOverride, isBull, settings, maxDartsPerVisit));
    Sound.play('dart', { score: base * m }, settings);
    if (base > 0) Sound.play('impact', {}, settings);
    setMult(1);
  };

  const playCampaignCard = (handIdx: number) => {
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
      let updated = playCardFromHand(cs, handIdx);
      if (!updated) return;
      if (card.effect === 'redraw') {
        updated = redrawHand(updated);
      } else if (card.effect === 'recycle') {
        updated = recycleGraveyard(updated);
      } else if (card.effect === 'extra_dart') {
        setBonusSlots(b => b + 1);
      } else if (card.effect === 'extra_slot') {
        setNextTurnSlots(prev => ({ ...prev, [thrower.id]: (prev[thrower.id] ?? 0) + (card.magnitude ?? 1) }));
      } else if (card.effect === 'draw') {
        setNextTurnDraws(prev => ({ ...prev, [thrower.id]: (prev[thrower.id] ?? 0) + (card.magnitude ?? 1) }));
      } else if (card.effect === 'blessing') {
        setNextTurnDraws(prev => ({ ...prev, [thrower.id]: (prev[thrower.id] ?? 0) + 1 }));
      } else if (card.effect === 'shadowstep') {
        setNextTurnDraws(prev => ({ ...prev, [thrower.id]: (prev[thrower.id] ?? 0) + (card.magnitude ?? 1) }));
        if (updated.used.length > 0) {
          const swapBack = updated.used[updated.used.length - 1];
          updated = {
            ...updated,
            hand: [...updated.hand, swapBack],
            used: updated.used.slice(0, -1),
          };
        }
      }
      setState(prev => applyUtilityCard(prev, card, settings));
      Sound.play('powerup', {}, settings);
      setCardStates(prev => ({ ...prev, [thrower.id]: updated }));
      return;
    }

    const updated = playCardFromHand(cs, handIdx);
    if (!updated) return;
    setCardStates(prev => ({ ...prev, [thrower.id]: updated }));
    const base = card.base ?? 0;
    const cardMult = card.mult ?? 1;
    const isBull = base === 50;
    onAdd(base, isBull ? 2 : (base === 25 && cardMult === 2 ? 2 : cardMult), card.name, isBull);
  };

  const onUndo = () => {
    if (cardMode) {
      const thrower = state.players[state.playerTurnIdx];
      if (thrower) {
        const cs = cardStates[thrower.id];
        if (cs && cs.used.length > 0) {
          const lastUsed = cs.used[cs.used.length - 1];
          const lastDef = resolveCardDef(lastUsed);
          if (lastDef && lastDef.type !== 'damage') {
            const updated: CardPlayState = {
              deck: cs.deck,
              hand: [...cs.hand, lastUsed],
              used: cs.used.slice(0, -1),
              graveyard: cs.graveyard,
            };
            setCardStates(prev => ({ ...prev, [thrower.id]: updated }));
            return;
          }
          if (state.darts.length > 0) {
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
    }
    setState(prev => undoDart(prev, settings));
  };

  const onEnter = () => {
    if (cardMode) {
      const thrower = state.players[state.playerTurnIdx];
      if (!thrower) return;
      const cs = cardStates[thrower.id];
      if (!cs || cs.used.length === 0) return;
      const endedState = endTurn(cs);
      setCardStates(prev => ({ ...prev, [thrower.id]: endedState }));
      setBonusSlots(0);
      setState(prev => resolvePlayerVisit(prev, true));
      return;
    }
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
  const maxDartsPerVisit = cardMode ? MAX_PLAYS_PER_TURN + bonusSlots : 3;
  const totalCardsPlayed = cardMode && thrower ? (cardStates[thrower.id]?.used.length ?? 0) : 0;
  const playerVisitDone = state.phase === 'player'
    && (cardMode ? totalCardsPlayed >= maxDartsPerVisit : state.darts.length >= 3)
    && state.outcome === 'ongoing';
  const showingFrozen = state.phase === 'enemy'
    && state.pendingEnemyAttacks.length === 0
    && state.appliedEnemyAttacks.length === 0
    && state.frozenEnemiesThisRound.length > 0;
  const showingOverlay = playerVisitDone || state.pendingEnemyAttacks.length > 0 || showingFrozen;

  return (
    <div className="view-noscroll coop-battle" style={{ position: 'relative', background: chapter?.theme.background || undefined, borderRadius: 14, overflow: 'hidden' }}>
      <button className="btn danger sm quit-float" onClick={() => { if (confirm('Quit this battle? Progress will be saved.')) onQuit(); }}>Quit</button>
      {showingFrozen && <div className="battle-frost-tint" />}
      {state.phase === 'player' && thrower && (() => {
        const srcPlayer = players.find(p => p.id === thrower.id);
        const equippedId = srcPlayer?.powerUps?.coopActive ?? null;
        const pu = equippedId ? getCoopPowerUp(equippedId as CoopPowerUpId) : null;
        if (!pu) return null;
        const can = canActivateCoopPowerUp(state, pu.id);
        return (
          <div className="coop-orb-float">
            <CoopPowerUpOrb
              charge={thrower.powerUpCharge}
              pu={pu}
              canActivate={can && state.darts.length === 0}
              onActivate={() => onActivatePowerUp(pu.id)}
            />
          </div>
        );
      })()}

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
        <div className="row between" style={{ width: '100%', margin: '4px 0' }}>
          <span className="pill" style={{ background: 'color-mix(in srgb,#ef4444 18%,var(--bg-3))', color: '#fca5a5', borderColor: 'transparent' }}>
            ❤️ Party {state.partyHp}/{state.partyMaxHp}
          </span>
          <span className="muted small">{aliveEnemies.length} enemy{aliveEnemies.length === 1 ? '' : 's'} alive</span>
        </div>
        <div style={{ width: '100%', height: 8, borderRadius: 4, background: 'var(--bg-3)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${partyHpPct}%`, background: '#ef4444', transition: 'width .4s' }} />
        </div>

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
                    flexDirection: 'row', gap: 6, justifyContent: 'space-between', padding: '4px 8px',
                  }}>
                    <span style={{ fontWeight: 800, fontSize: 15 }}>{d.label}</span>
                    {r && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, opacity: 0.9 }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          minWidth: 18, height: 18, borderRadius: 6, padding: '0 4px',
                          background: 'color-mix(in srgb,var(--accent) 22%,var(--bg))',
                          color: 'var(--accent)', fontSize: 10, fontWeight: 900, flex: '0 0 auto',
                        }} title={r.enemyName}>{enemyIcon(state.enemies.find(e => e.id === r.enemyId)?.defId ?? r.enemyId)}</span>
                        {r.damage > 0 ? `-${r.damage}` : r.kind === 'shield_break' ? '🛡' : ''}
                        {isDefeated ? ' ☠' : ''}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="muted small">
              <b style={{ color: 'var(--text)' }}>{thrower.name}</b> is throwing · this visit: <b style={{ color: 'var(--text)' }}>{state.resolvedDarts.reduce((a, d) => a + d.damage, 0)} dmg</b>
              <span style={{ marginLeft: 8, color: '#fbbf24' }}>
                ⚡ Effective power: <b>{effectivePower(thrower)}</b>
                {state.passiveBonus && state.passiveBonus.power > 0 && (
                  <span style={{ opacity: 0.8 }}> (base {thrower.power - (state.passiveBonus?.power || 0)} + {state.passiveBonus.power} passive)</span>
                )}
              </span>
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
          const canTarget = state.phase === 'player' && !e.defeated && (cardMode ? totalCardsPlayed < maxDartsPerVisit : state.darts.length < 3) && state.outcome === 'ongoing';
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

      {state.phantomDarts > 0 && state.phase === 'player' && (
        <div className="pill" style={{ marginTop: 6, background: 'color-mix(in srgb,#22d3ee 22%,var(--bg-3))', color: '#cffafe', borderColor: 'transparent' }}>
          👻 Phantom Darts active — next {state.phantomDarts} dart{state.phantomDarts === 1 ? '' : 's'} auto-bullseye
        </div>
      )}

      {state.phase === 'player' && state.outcome === 'ongoing' && (cardMode ? totalCardsPlayed < maxDartsPerVisit : state.darts.length < 3) && (
        cardMode ? (
          <CardHand
            cardState={thrower ? cardStates[thrower.id] ?? initCardPlayState([]) : initCardPlayState([])}
            playerName={thrower?.name ?? 'Player'}
            isMyTurn={true}
            isBattle={true}
            canPlayMore={totalCardsPlayed < maxDartsPerVisit}
            canEndVisit={totalCardsPlayed > 0}
            canUndo={totalCardsPlayed > 0 || state.darts.length > 0}
            onPlayCard={(handIdx) => playCampaignCard(handIdx)}
            onUndo={onUndo}
            onEndVisit={onEnter}
          />
        ) : (
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
          playedCards={cardMode && thrower ? (cardStates[thrower.id]?.used.map(pc => resolveCardDef(pc)).filter(Boolean) as CardDef[] ?? []) : undefined}
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
