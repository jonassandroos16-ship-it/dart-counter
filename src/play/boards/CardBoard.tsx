import { useEffect, useState, useRef } from 'react';
import type { Game, GameRecord, Player, Settings, PlayedCard } from '../../types';
import { TEAM_COLORS } from '../../constants';
import { checkoutHint, leadTrailBadge } from '../../logic';
import { Sound } from '../../sound';
import type { MusicEngine } from '../../music';
import type { PopupControls } from '../../Popups';
import { AttributeStrip, BadgeAvatar } from '../common';
import {
  initCardPlayState, startTurn, drawCards,
  endTurn, MAX_PLAYS_PER_TURN, resolveCardDef,
  getPlayerCards, defaultPlayerCards,
} from '../../cards/deck';
import type { PlayerCard, CardDef, CardPlayState } from '../../cards/types';
import { CardBoardOthers } from './CardBoardOthers';
import { CardBoardHand, CardPopup } from './CardBoardHand';
import { DeckPopup, GraveyardPopup, PlayedPopup, CardDetailPopup, CardPlayAnimOverlay } from './CardBoardPopups';
import type { CardPlayAnim } from './CardBoardPopups';
import { playCard } from './cardBoardPlay';
import { enterVisit } from './cardBoardVisit';
import { GameOver } from '../GameOver';

const HIGH_SCORE_VISITS = 7;

export function CardBoard({ game, setGame, settings, players, games, setGames, setPlayers, toast, music, onQuit, onGameOver, popups, isMyTurn = true }: {
  game: Game; setGame: (g: Game | null) => void; settings: Settings; players: Player[]; games: GameRecord[];
  setGames: (updater: any) => void; setPlayers: (updater: any) => void; toast: (m: string) => void;
  music: MusicEngine; onQuit: () => void; onGameOver: () => void; popups: PopupControls; isMyTurn?: boolean;
}) {
  const [, force] = useState(0);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [selectedCardIdx, setSelectedCardIdx] = useState<number | null>(null);
  const [showDeck, setShowDeck] = useState(false);
  const [showGraveyard, setShowGraveyard] = useState(false);
  const [showPlayed, setShowPlayed] = useState(false);
  const [selectedPlayedCard, setSelectedPlayedCard] = useState<PlayedCard | null>(null);
  const [playedPopupClosing, setPlayedPopupClosing] = useState(false);
  const [cardPlayAnim, setCardPlayAnim] = useState<CardPlayAnim | null>(null);
  const [cardStates, setCardStates] = useState<Record<string, CardPlayState>>({});
  const [bonusSlots, setBonusSlots] = useState(0);
  const [nextTurnSlots, setNextTurnSlots] = useState<Record<string, number>>({});
  const [nextTurnDraws, setNextTurnDraws] = useState<Record<string, number>>({});
  const [showHandDetail, setShowHandDetail] = useState(false);
  const rerollResolve = useRef<((v: boolean) => void) | null>(null);
  const [reroll, setReroll] = useState<any>(null);
  const rerollRef = useRef(reroll);
  rerollRef.current = reroll;
  const [pendingTurnStart, setPendingTurnStart] = useState(true);
  const prevTurnRef = useRef(-1);
  const prevHandLen = useRef(0);
  const [animatingOut, setAnimatingOut] = useState<number | null>(null);

  const p = game.players[game.turn];
  const alive = game.players.filter(pl => !pl.defeated);
  const aliveOthers = alive.filter(pl => pl.id !== p?.id);
  const others = game.players.filter(pl => pl.id !== p?.id);
  const targetEnemy = others.find(pl => pl.id === targetId) || aliveOthers[0];
  if (targetId === null && targetEnemy) setTargetId(targetEnemy.id);
  const lastHit = game.lastHit;
  const isCardMode = (p as any).cardMode || game.darts.length === 0 && (p as any).cards;

  useEffect(() => {
    if (isCardMode && p && !cardStates[p.id]) {
      const cards = getPlayerCards(p);
      setCardStates(prev => ({ ...prev, [p.id]: initCardPlayState(cards) }));
    }
  }, [isCardMode, p, cardStates]);

  useEffect(() => {
    if (!isCardMode || !p) return;
    if (game.turn !== prevTurnRef.current) {
      prevTurnRef.current = game.turn;
      setPendingTurnStart(true);
    }
  }, [game.turn, isCardMode, p]);

  useEffect(() => {
    if (!isCardMode || !p || !pendingTurnStart) return;
    const cs = cardStates[p.id];
    if (!cs) return;
    const extraDraw = nextTurnDraws[p.id] ?? 0;
    const extraSlot = nextTurnSlots[p.id] ?? 0;
    if (extraDraw > 0 || extraSlot > 0) {
      setNextTurnDraws(prev => { const n = { ...prev }; delete n[p.id]; return n; });
      setNextTurnSlots(prev => { const n = { ...prev }; delete n[p.id]; return n; });
    }
    const next = startTurnWithExtraDraws(cs, extraDraw, extraSlot, (n) => setBonusSlots(n));
    setCardStates(prev => ({ ...prev, [p.id]: next }));
    setPendingTurnStart(false);
  }, [isCardMode, p, pendingTurnStart, cardStates, nextTurnDraws, nextTurnSlots]);

  useEffect(() => {
    if (handDefsLen < prevHandLen.current) {
      setAnimatingOut(prevHandLen.current - 1);
      const t = setTimeout(() => setAnimatingOut(null), 300);
      prevHandLen.current = handDefsLen;
      return () => clearTimeout(t);
    }
    prevHandLen.current = handDefsLen;
  }, [handDefsLen]);

  const cs = p ? cardStates[p.id] : undefined;
  const handDefs = cs ? cs.hand.map(pc => resolveCardDef(pc)).filter(Boolean) as CardDef[] : [];
  const usedDefs = cs ? cs.used.map(pc => resolveCardDef(pc)).filter(Boolean) as CardDef[] : [];
  const handDefsLen = handDefs.length;

  const onAdd = (base: number, mult: number, label: string, isBull: boolean) => {
    if (!p) return;
    const newDart = { value: base * mult, label, mult, isDouble: mult === 2, isTriple: mult === 3, isBull, player: p.id, target: targetId || undefined } as any;
    setGame({ ...game, darts: [...game.darts, newDart], lastHit: { ...newDart, damage: base * mult } });
  };

  const onUndo = () => {
    if (!game.darts.length) return;
    setGame({ ...game, darts: game.darts.slice(0, -1), lastHit: null });
    if (cs && cs.used.length > 0) {
      setCardStates(prev => {
        const s = prev[p!.id];
        if (!s) return prev;
        const lastUsed = s.used[s.used.length - 1];
        return { ...prev, [p!.id]: { ...s, used: s.used.slice(0, -1), hand: [...s.hand, lastUsed] } };
      });
    }
  };

  const onEnter = () => {
    if (!p || game.darts.length === 0) return;
    enterVisit(game, setGame, settings, toast, popups, {
      onReroll: (plan) => new Promise<boolean>((resolve) => {
        setReroll(plan);
        setRerollResolve(() => resolve);
      }),
    });
  };

  const handlePlayCard = (handIdx: number) => {
    if (!p || !cs) return;
    playCard({
      handIdx, game, setGame, cs, setCardStates, p, targetId,
      bonusSlots, setBonusSlots, setNextTurnSlots, setNextTurnDraws,
      settings, toast, setCardPlayAnim, onAdd,
    });
  };

  if (game.finished) return <GameOver game={game} onNewGame={() => { setGame(null); onGameOver(); music.startContext('setup', settings); }} onViewStats={() => { setGame(null); onGameOver(); }} />;

  const hpPct = (pl: any) => Math.max(0, Math.min(100, ((pl.hp || 0) / (pl.maxHp || 1)) * 100));

  return (
    <div className="view-noscroll coop-battle">
      <button className="btn danger sm quit-float" onClick={() => { if (confirm('Quit this game?')) onQuit(); }}>Quit</button>
      <div className="play-current">
        <div className="pc-header">
          <div className="row" style={{ gap: 8 }}>
            <BadgeAvatar playerId={p.id} players={players} games={games} size={32} fontSize={13} color={p.color} />
            <span className="pc-name">{p.name}</span>
          </div>
          <span className="muted small">BATTLE · {alive.length} ALIVE</span>
        </div>
        <div className="pc-remaining" style={{ fontSize: 28 }}>{p.hp} HP</div>
        <div className="checkout-hint center">❤️ {p.hp}/{p.maxHp} · 🛡️ {p.armorPct}% armor · ⚡ {p.powerPct} power</div>
        <div style={{ width: '100%', height: 8, borderRadius: 4, background: 'var(--bg-3)', overflow: 'hidden', margin: '4px 0' }}>
          <div style={{ height: '100%', width: `${hpPct(p)}%`, background: p.color, transition: 'width .3s' }} />
        </div>
        <div className="pc-slots">
          {Array.from({ length: 3 }).map((_, i) => { const d = game.darts[i]; return <div key={i} className={`pc-slot${d ? ' filled' : ''}`}>{d ? d.label : '–'}</div>; })}
        </div>
        <div className="muted small">This visit: <b style={{ color: 'var(--text)' }}>{game.darts.reduce((a, d) => a + d.value, 0)}</b>{lastHit && lastHit.target ? <span style={{ marginLeft: 8, color: 'var(--danger)' }}> · {lastHit.damage} dmg → {game.players.find(pl => pl.id === lastHit.target)?.name || 'target'}</span> : null}</div>
        {aliveOthers.length > 1 && (
          <div style={{ width: '100%', marginTop: 6 }}>
            <div className="muted small" style={{ marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>Attack target</div>
            <div className="row wrap" style={{ gap: 6 }}>
              {aliveOthers.map(pl => (
                <button key={pl.id} className="pill" style={{ background: targetId === pl.id ? pl.color : 'var(--bg-3)', color: targetId === pl.id ? '#0b0e13' : 'var(--text)', cursor: 'pointer' }}
                  onClick={() => setTargetId(pl.id)}>
                  <BadgeAvatar playerId={pl.id} players={players} games={games} size={18} fontSize={9} color={targetId === pl.id ? 'rgba(0,0,0,.2)' : pl.color} />{pl.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="play-others">
        {others.map(pl => {
          const defeated = pl.defeated;
          return (
            <div key={pl.id} className="play-other" style={{ ...(defeated ? { opacity: 0.4, filter: 'grayscale(.6)' } : {}) }}>
              <div className="row between">
                <div className="row" style={{ gap: 6 }}>
                  <BadgeAvatar playerId={pl.id} players={players} games={games} size={22} fontSize={10} color={pl.color} />
                  <span className="po-name">{pl.name}</span>
                  {defeated && <span style={{ fontSize: 14, color: '#ef4444', fontWeight: 900 }}>☠</span>}
                </div>
                <span className="pill" style={{ fontSize: 10 }}>{pl.hp} HP</span>
              </div>
              <div style={{ marginTop: 4, height: 6, borderRadius: 3, background: 'var(--bg-3)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${hpPct(pl)}%`, background: pl.color, transition: 'width .3s' }} />
              </div>
            </div>
          );
        })}
      </div>

      {isCardMode && cs && (
        <CardBoardHand
          cardState={cs}
          playerName={p.name}
          isMyTurn={isMyTurn}
          isBattle={true}
          canEndVisit={game.darts.length > 0}
          canUndo={game.darts.length > 0}
          canPlayMore={game.darts.length < 3}
          onPlayCard={handlePlayCard}
          onUndo={onUndo}
          onEndVisit={onEnter}
          animatingOut={animatingOut}
          showPlayedButton={usedDefs.length > 0}
          playedCount={usedDefs.length}
          onShowPlayed={() => setShowPlayed(true)}
          onShowHandDetail={() => setShowHandDetail(true)}
        />
      )}

      {showDeck && <DeckPopup cardState={cs} onClose={() => setShowDeck(false)} />}
      {showGraveyard && <GraveyardPopup cardState={cs} onClose={() => setShowGraveyard(false)} />}
      {showPlayed && (
        <PlayedPopup cards={usedDefs} onClose={() => { setPlayedPopupClosing(true); setTimeout(() => { setShowPlayed(false); setPlayedPopupClosing(false); }, 200); }} closing={playedPopupClosing} />
      )}
      {selectedPlayedCard && (
        <CardDetailPopup card={selectedPlayedCard} onClose={() => setSelectedPlayedCard(null)} />
      )}
      {cardPlayAnim && (
        <CardPlayAnimOverlay anim={cardPlayAnim} onDone={() => setCardPlayAnim(null)} />
      )}
      {showHandDetail && cs && (
        <CardPopup
          card={handDefs[0]}
          canPlayMore={game.darts.length < 3}
          onPlay={() => { handlePlayCard(0); setShowHandDetail(false); }}
          onClose={() => setShowHandDetail(false)}
        />
      )}
    </div>
  );
}
