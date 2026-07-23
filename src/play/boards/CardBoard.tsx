import { useEffect, useState, useRef } from 'react';
import type { Game, GameRecord, Player, Settings, PlayedCard } from '../../types';
import { TEAM_COLORS, SCORE_POPUPS } from '../../constants';
import { checkoutHint, leadTrailBadge } from '../../logic';
import { Sound } from '../../sound';
import type { MusicEngine } from '../../music';
import type { PopupControls } from '../../Popups';
import { AttributeStrip, BadgeAvatar } from '../common';
import {
  initCardPlayState, startTurn,
  playCardFromHand, endTurn, MAX_PLAYS_PER_TURN, resolveCardDef,
  getPlayerCards, defaultPlayerCards,
} from '../../cards/deck';
import type { PlayerCard, CardDef, CardPlayState } from '../../cards/types';
import { cardDamage } from '../../cards/definitions';
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
  const [animatingOut, setAnimatingOut] = useState<number | null>(null);
  const [popupClosing, setPopupClosing] = useState(false);
  const [cardPlayAnim, setCardPlayAnim] = useState<CardPlayAnim | null>(null);
  const prevHandLen = useRef<number>(0);
  const prevLastCardPlay = useRef<{ playerId: string; cardId: string; timestamp: number } | null>(null);

  const closeCardPopup = () => {
    if (popupClosing) return;
    setPopupClosing(true);
    setTimeout(() => {
      setSelectedCardIdx(null);
      setPopupClosing(false);
    }, 200);
  };

  const closePlayedPopup = () => {
    if (playedPopupClosing) return;
    setPlayedPopupClosing(true);
    setTimeout(() => {
      setSelectedPlayedCard(null);
      setPlayedPopupClosing(false);
    }, 200);
  };

  useEffect(() => {
    const lcp = game.lastCardPlay;
    if (!lcp) return;
    if (prevLastCardPlay.current &&
        prevLastCardPlay.current.playerId === lcp.playerId &&
        prevLastCardPlay.current.timestamp === lcp.timestamp) return;
    prevLastCardPlay.current = { playerId: lcp.playerId, cardId: lcp.cardId, timestamp: lcp.timestamp };
    if (!isMyTurn) {
      const player = game.players.find(pl => pl.id === lcp.playerId);
      setCardPlayAnim({
        cardId: lcp.cardId,
        upgradeLevel: lcp.upgradeLevel,
        playerName: player?.name || 'Player',
        playerColor: player?.color || '#888',
      });
      const def = resolveCardDef({ cardId: lcp.cardId, upgradeLevel: lcp.upgradeLevel, upgraded: lcp.upgradeLevel > 0 });
      if (def) {
        const soundType = def.type === 'damage' ? 'card_damage' : def.type === 'spell' ? 'card_spell' : 'card_utility';
        Sound.play(soundType, {}, settings);
      }
      const t = setTimeout(() => setCardPlayAnim(null), 1800);
      return () => clearTimeout(t);
    }
  }, [game.lastCardPlay]);

  useEffect(() => {
    if (game.cardState && Object.keys(game.cardState).length === game.players.length) return;
    const cardState: Record<string, CardPlayState> = {};
    for (const gp of game.players) {
      const playerData = players.find(pl => pl.id === gp.id);
      const collection: PlayerCard[] = playerData ? getPlayerCards(playerData) : defaultPlayerCards(undefined);
      cardState[gp.id] = initCardPlayState(collection);
    }
    setGame({ ...game, cardState });
  }, [game.players.length]);

  useEffect(() => {
    if (!game.cardState) return;
    const p = game.players[game.turn];
    const state = game.cardState[p.id];
    if (!state) return;
    if (state.hand.length === 0 && state.used.length === 0) {
      const next = startTurn(state);
      setGame({ ...game, cardState: { ...game.cardState, [p.id]: next } });
    }
  }, [game.turn, game.cardState]);

  if (game.finished) return <GameOver game={game} onNewGame={() => { setGame(null); onGameOver(); music.startContext('setup', settings); }} onViewStats={() => { setGame(null); onGameOver(); }} />;

  const p = game.players[game.turn];
  const playerData = players.find(pl => pl.id === p.id);
  const collection: PlayerCard[] = playerData ? getPlayerCards(playerData) : defaultPlayerCards(undefined);
  const state: CardPlayState = game.cardState?.[p.id] ?? initCardPlayState(collection);
  const handDefs = state.hand.map(pc => resolveCardDef(pc)).filter(Boolean) as CardDef[];
  const usedDefs = state.used.map(pc => resolveCardDef(pc)).filter(Boolean) as CardDef[];

  const isBattle = game.mode === 'battle';
  const isKiller = game.mode === 'killer';
  const isHighScore = game.mode === 'highscore';
  const bonusSlots = game.bonusSlots || 0;
  const maxPlays = MAX_PLAYS_PER_TURN + bonusSlots;
  const totalCardsPlayed = state.used.length;
  const canPlayMore = totalCardsPlayed < maxPlays;
  const buffScored = game.darts.reduce((a, d) => a + d.value, 0);
  const projected = game.practice ? p.score + buffScored : p.score - buffScored;
  const others = [...game.players.slice(game.turn + 1), ...game.players.slice(0, game.turn)];
  const throwOrder = (idx: number) => (idx - game.roundStartTurn + game.players.length) % game.players.length;
  const curTeam = game.teamMode ? (p.team ?? 0) : -1;
  const curTeamColor = game.teamMode ? TEAM_COLORS[curTeam % TEAM_COLORS.length] : p.color;

  const aliveOthers = isBattle ? others.filter(pl => !pl.defeated) : [];
  useEffect(() => {
    if (isBattle) {
      if (aliveOthers.length === 1) setTargetId(aliveOthers[0].id);
      else setTargetId(null);
    }
  }, [game.turn, aliveOthers.length, isBattle]);

  const prevHandRef = useRef<number | null>(null);

  useEffect(() => {
    const curLen = state.hand.length;
    if (curLen < prevHandLen.current && prevHandRef.current !== null) {
      setAnimatingOut(prevHandRef.current);
      const t = setTimeout(() => setAnimatingOut(null), 300);
      prevHandRef.current = null;
      return () => clearTimeout(t);
    }
    prevHandLen.current = curLen;
  }, [state.hand.length]);

  const handlePlayCard = (handIdx: number) => {
    if (!isMyTurn) return;
    playCard({
      handIdx, handDefs, state, game, p: { id: p.id, name: p.name, color: p.color },
      settings, toast, setGame: setGame as (g: Game) => void,
      totalCardsPlayed, maxPlays, bonusSlots, prevHandRef, setSelectedCardIdx, force,
    });
  };

  const undoCard = () => {
    if (!isMyTurn) return;
    if (!game.darts.length) return;
    const lastDart = game.darts[game.darts.length - 1];
    const usedIdx = [...state.used].reverse().findIndex(pc => {
      const def = resolveCardDef(pc);
      return def?.name === lastDart.label;
    });
    if (usedIdx === -1) {
      setGame({ ...game, darts: game.darts.slice(0, -1) });
      return;
    }
    const realIdx = state.used.length - 1 - usedIdx;
    const card = state.used[realIdx];
    const updated: CardPlayState = {
      deck: state.deck,
      hand: [...state.hand, card],
      used: state.used.filter((_, i) => i !== realIdx),
      graveyard: state.graveyard,
    };
    setGame({ ...game, darts: game.darts.slice(0, -1), cardState: { ...game.cardState, [p.id]: updated } });
    force(n => n + 1);
  };

  const handleEnterVisit = () => {
    if (!isMyTurn) return;
    const endedState = endTurn(state);
    enterVisit({
      game, setGame, settings, players, games, setGames, setPlayers,
      toast, music, popups, targetId, setTargetId, state, endedState, isMyTurn,
    });
  };

  const hpPct = (pl: any) => Math.max(0, Math.min(100, ((pl.hp || 0) / (pl.maxHp || 1)) * 100));
  const aliveCount = isBattle ? game.players.filter(pl => !pl.defeated).length : isKiller ? game.players.filter(pl => !pl.eliminated).length : 0;

  const selectedCard = selectedCardIdx !== null ? handDefs[selectedCardIdx] : null;

  return (
    <div className="view-noscroll">
      <button className="btn danger sm quit-float" onClick={() => { if (confirm('Quit this game? Progress will not be saved.')) onQuit(); }}>Quit</button>
      <div className="play-current" style={game.teamMode ? { borderColor: curTeamColor, boxShadow: `0 0 0 2px ${curTeamColor}33` } : {}}>
        <div className="pc-header">
          <div className="row" style={{ gap: 8 }}>
            <span className={`turn-order-badge${game.turn === game.roundStartTurn ? ' starter' : ''}`}>{throwOrder(game.turn) + 1}</span>
            <BadgeAvatar playerId={p.id} players={players} games={games} size={32} fontSize={16} color={p.color} />
            <span className="pc-name">{p.name}</span>
            {game.teamMode && <span className="pill" style={{ background: curTeamColor, color: '#04150a' }}>Team {curTeam + 1}</span>}
            {isKiller && (p.killerHits || 0) >= 5 && <span className="pill" style={{ background: '#ef4444', color: '#fff', fontSize: 10 }}>KILLER</span>}
            {!game.teamMode && !game.practice && !isBattle && !isKiller && !isHighScore && (() => { const badge = leadTrailBadge(p, game); return badge ? <span className={`lead-badge ${badge.startsWith('+') ? 'lead' : 'trail'}`}>{badge}</span> : null; })()}
          </div>
          <div className="row" style={{ gap: 6 }}>
            {!game.teamMode && game.legsBestOf > 1 && !isBattle && !isKiller && !isHighScore ? <span className="pill">{p.legsWon} legs</span> : null}
            <span className="muted small">
              {isBattle ? `BATTLE · ${aliveCount} ALIVE` :
               isKiller ? `KILLER · ${aliveCount} ALIVE` :
               isHighScore ? `HIGH SCORE · VISIT ${(p.visits.length || 0) + 1}/${HIGH_SCORE_VISITS}` :
               game.practice ? 'PRACTICE' : `LEG ${game.leg} · ${game.doubleOut ? 'DOUBLE OUT' : 'STRAIGHT OUT'}`}
            </span>
          </div>
        </div>
        {isBattle ? (
          <>
            <div className="pc-remaining" style={{ fontSize: 28 }}>{p.hp} HP</div>
            <div className="checkout-hint center">❤️ {p.hp}/{p.maxHp} · 🛡️ {p.armorPct}% armor · ⚡ {p.powerPct} power</div>
            <div style={{ width: '100%', height: 8, borderRadius: 4, background: 'var(--bg-3)', overflow: 'hidden', margin: '4px 0' }}>
              <div style={{ height: '100%', width: `${hpPct(p)}%`, background: p.color, transition: 'width .3s' }} />
            </div>
          </>
        ) : isKiller ? (
          <>
            <div className="pc-remaining" style={{ fontSize: 28 }}>
              {(p.killerHits || 0) >= 5 ? '🎯 Aim at opponents' : `Hit ${p.killerNumber}`}
            </div>
            <div className="checkout-hint center">
              {(p.killerHits || 0) < 5 ? `Become a Killer: ${p.killerHits || 0}/5 hits on ${p.killerNumber}` : 'Hit opponent numbers to eliminate them'}
            </div>
            <div className="muted small">Lives: <b style={{ color: 'var(--text)' }}>{'❤️'.repeat(p.lives || 0) || 'none'}</b></div>
          </>
        ) : isHighScore ? (
          <>
            <div className="pc-remaining">{p.score + buffScored}</div>
            <div className="checkout-hint center">{(p.visits.length || 0) + 1 >= HIGH_SCORE_VISITS ? 'Final visit — go big!' : 'Score as high as you can!'}</div>
          </>
        ) : (
          <>
            <div className="pc-remaining" style={{ color: projected < 0 ? 'var(--danger)' : 'var(--text)' }}>{projected}</div>
            <div className="checkout-hint center">{checkoutHint(game.practice ? null : projected, game.doubleOut, game.practice)}</div>
          </>
        )}
        <div className="pc-slots">
          {Array.from({ length: maxPlays }).map((_, i) => { const d = game.darts[i]; return <div key={i} className={`pc-slot${d ? ' filled' : ''}`}>{d ? d.label : '–'}</div>; })}
          {bonusSlots > 0 && Array.from({ length: bonusSlots }).map((_, i) => <div key={`bonus-${i}`} className="pc-slot" style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}>+</div>)}
        </div>
        <div className="muted small">
          This visit: <b style={{ color: 'var(--text)' }}>{buffScored}</b> · Cards played: <b style={{ color: 'var(--text)' }}>{totalCardsPlayed}</b>/{maxPlays}{bonusSlots > 0 ? ` (incl. ${bonusSlots} bonus)` : ''}
          {isBattle && <span style={{ marginLeft: 8 }}> · {buffScored} dmg</span>}
        </div>
        {isBattle && aliveOthers.length > 1 && (
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
        <AttributeStrip playerId={p.id} players={players} mode={game.mode} settings={settings} />
      </div>

      {game.players.length > 1 && (
        <CardBoardOthers
          game={game}
          players={players}
          games={games}
          settings={settings}
          isBattle={isBattle}
          isKiller={isKiller}
          isHighScore={isHighScore}
          throwOrder={throwOrder}
          hpPct={hpPct}
        />
      )}

      <CardBoardHand
        handDefs={handDefs}
        usedDefs={usedDefs}
        isMyTurn={isMyTurn}
        animatingOut={animatingOut}
        isBattle={isBattle}
        playerName={p.name}
        deckCount={state.deck.length}
        graveyardCount={state.graveyard.length}
        playedCount={game.playedCards?.length || 0}
        onCardClick={setSelectedCardIdx}
        onShowDeck={() => setShowDeck(true)}
        onShowGraveyard={() => setShowGraveyard(true)}
        onShowPlayed={() => setShowPlayed(true)}
        onUndo={undoCard}
        onEnterVisit={handleEnterVisit}
      />

      {selectedCard && (
        <CardPopup
          card={selectedCard}
          popupClosing={popupClosing}
          canPlayMore={canPlayMore}
          onClose={closeCardPopup}
          onPlay={() => handlePlayCard(selectedCardIdx!)}
        />
      )}

      {showDeck && (
        <DeckPopup deck={state.deck} onClose={() => setShowDeck(false)} />
      )}

      {showGraveyard && (
        <GraveyardPopup graveyard={state.graveyard} onClose={() => setShowGraveyard(false)} />
      )}

      {showPlayed && (
        <PlayedPopup
          playedCards={game.playedCards || []}
          onClose={() => setShowPlayed(false)}
          onSelect={(pc) => { setSelectedPlayedCard(pc); setShowPlayed(false); }}
        />
      )}

      {selectedPlayedCard && (
        <CardDetailPopup
          playedCard={selectedPlayedCard}
          closing={playedPopupClosing}
          onClose={closePlayedPopup}
        />
      )}

      {cardPlayAnim && <CardPlayAnimOverlay anim={cardPlayAnim} />}
    </div>
  );
}
