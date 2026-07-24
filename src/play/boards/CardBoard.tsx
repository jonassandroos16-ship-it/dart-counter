import { useEffect, useState, useRef } from 'react';
import type { Game, GameRecord, Player, Settings, PlayedCard } from '../../types';
import type { MusicEngine } from '../../music';
import type { PopupControls } from '../../Popups';
import { BadgeAvatar, ChargedPlayerIcon } from '../common';
import {
  initCardPlayState, endTurn, MAX_PLAYS_PER_TURN, resolveCardDef,
  getPlayerCards, defaultPlayerCards,
} from '../../cards/deck';
import { startTurnWithExtraDraws } from '../../cards/turnLogic';
import type { CardDef } from '../../cards/types';
import { CardHand } from '../../cards/CardHand';
import { playCard } from './cardBoardPlay';
import { enterVisit } from './cardBoardVisit';
import { PlayedPopup, CardDetailPopup } from './CardBoardPopups';
import { GameOver } from '../GameOver';
import { activatePowerUp } from '../powerups';
import { RerollOverlay } from '../RerollOverlay';
import type { RerollPlan } from '../../powerups';

export function CardBoard({ game, setGame, settings, players, games, setGames, setPlayers, toast, music, onQuit, onGameOver, popups, isMyTurn = true }: {
  game: Game; setGame: (g: Game | null) => void; settings: Settings; players: Player[]; games: GameRecord[];
  setGames: (updater: any) => void; setPlayers: (updater: any) => void; toast: (m: string) => void;
  music: MusicEngine; onQuit: () => void; onGameOver: () => void; popups: PopupControls; isMyTurn?: boolean;
}) {
  const [, force] = useState(0);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [showPlayed, setShowPlayed] = useState(false);
  const [selectedPlayedCard, setSelectedPlayedCard] = useState<PlayedCard | null>(null);
  const [reroll, setReroll] = useState<RerollPlan | null>(null);
  const [rerollResolve, setRerollResolve] = useState<((v: boolean) => void) | null>(null);
  const prevHandRef = useRef<number | null>(null);

  const p = game.players[game.turn];
  const alive = game.players.filter(pl => !pl.defeated);
  const aliveOthers = alive.filter(pl => pl.id !== p?.id);
  const others = game.players.filter(pl => pl.id !== p?.id);

  useEffect(() => {
    if (aliveOthers.length === 1) setTargetId(aliveOthers[0].id);
    else if (targetId && !aliveOthers.find(pl => pl.id === targetId)) setTargetId(null);
  }, [game.turn, aliveOthers.length]);

  useEffect(() => {
    if (!p) return;
    let cs = game.cardState?.[p.id];
    if (!cs) {
      const playerData = players.find(pl => pl.id === p.id);
      const cards = playerData ? getPlayerCards(playerData) : defaultPlayerCards();
      cs = initCardPlayState(cards);
      setGame({
        ...game,
        cardState: { ...(game.cardState || {}), [p.id]: cs },
      });
      return;
    }
    if (cs.hand.length === 0 && cs.used.length === 0) {
      const extraDraw = game.nextTurnDraws?.[p.id] ?? 0;
      const extraSlot = game.nextTurnSlots?.[p.id] ?? 0;
      const next = startTurnWithExtraDraws(cs, extraDraw, extraSlot, () => {});

      const newNextTurnDraws = { ...(game.nextTurnDraws || {}) };
      delete newNextTurnDraws[p.id];
      const newNextTurnSlots = { ...(game.nextTurnSlots || {}) };
      delete newNextTurnSlots[p.id];

      setGame({
        ...game,
        cardState: { ...(game.cardState || {}), [p.id]: next },
        nextTurnDraws: newNextTurnDraws,
        nextTurnSlots: newNextTurnSlots,
        bonusSlots: (game.bonusSlots || 0) + extraSlot,
      });
    }
  }, [game.turn, p?.id, game.cardState]);

  const cs = p ? game.cardState?.[p.id] : undefined;
  const totalCardsPlayed = cs?.used.length ?? 0;
  const maxPlays = MAX_PLAYS_PER_TURN + (game.bonusSlots || 0);

  const handlePlayCard = (handIdx: number) => {
    if (!p || !cs) return;
    const handDefs = cs.hand.map(pc => resolveCardDef(pc)).filter(Boolean) as CardDef[];
    playCard({
      handIdx,
      handDefs,
      state: cs,
      game,
      p: { id: p.id, name: p.name, color: p.color },
      settings,
      toast,
      setGame: setGame as (g: Game) => void,
      totalCardsPlayed,
      maxPlays,
      bonusSlots: game.bonusSlots || 0,
      prevHandRef,
      setSelectedCardIdx: () => {},
      force,
    });
  };

  const onUndo = () => {
    if (!p || !cs) return;
    if (cs.used.length === 0) return;
    const lastUsed = cs.used[cs.used.length - 1];
    const lastDef = resolveCardDef(lastUsed);
    if (lastDef?.type === 'damage' && game.darts.length > 0) {
      setGame({
        ...game,
        darts: game.darts.slice(0, -1),
        cardState: {
          ...(game.cardState || {}),
          [p.id]: {
            ...cs,
            hand: [...cs.hand, lastUsed],
            used: cs.used.slice(0, -1),
          },
        },
      });
    } else {
      setGame({
        ...game,
        cardState: {
          ...(game.cardState || {}),
          [p.id]: {
            ...cs,
            hand: [...cs.hand, lastUsed],
            used: cs.used.slice(0, -1),
          },
        },
      });
    }
  };

  const onEnter = () => {
    if (!p || !cs || cs.used.length === 0) return;
    const endedState = endTurn(cs);
    enterVisit({
      game,
      setGame,
      settings,
      players,
      games,
      setGames,
      setPlayers,
      toast,
      music,
      popups,
      targetId,
      setTargetId,
      state: cs,
      endedState,
      isMyTurn,
    });
  };

  if (game.finished) return <GameOver game={game} onNewGame={() => { setGame(null); onGameOver(); music.startContext('setup', settings); }} onViewStats={() => { setGame(null); onGameOver(); }} />;
  if (!p || !cs) return null;

  const hpPct = (pl: any) => Math.max(0, Math.min(100, ((pl.hp || 0) / (pl.maxHp || 1)) * 100));
  const playedCount = game.playedCards?.length ?? 0;

  const slotEntries: { label: string; isDamage: boolean }[] = cs.used.map(pc => {
    const def = resolveCardDef(pc);
    if (!def) return { label: '?', isDamage: false };
    return { label: def.name, isDamage: def.type === 'damage' };
  });

  return (
    <div className="view-noscroll coop-battle">
      <button className="btn danger sm quit-float" onClick={() => { if (confirm('Quit this game?')) onQuit(); }}>Quit</button>
      <div className="play-current">
        <div className="pc-header">
          <div className="row" style={{ gap: 8 }}>
            {game.powerUpsEnabled ? (
              <ChargedPlayerIcon game={game} curIdx={game.turn} settings={settings} players={players} games={games} toast={toast} onActivate={() => {
                activatePowerUp(game, game.turn, settings, toast, {
                  popups,
                  onReroll: (plan) => new Promise<boolean>((resolve) => {
                    setReroll(plan);
                    setRerollResolve(() => resolve);
                  }),
                }).then((next) => { if (next) setGame(next); });
              }} />
            ) : (
              <BadgeAvatar playerId={p.id} players={players} games={games} size={32} fontSize={13} color={p.color} />
            )}
            <span className="pc-name">{p.name}</span>
          </div>
          <span className="muted small">BATTLE · {alive.length} ALIVE</span>
        </div>
        <div className="pc-remaining" style={{ fontSize: 28 }}>{p.hp} HP</div>
        <div className="checkout-hint center">❤️ {p.hp}/{p.maxHp} · 🛡️ {p.armorPct}% armor · ⚡ {p.powerPct} power</div>
        <div style={{ width: '100%', height: 8, borderRadius: 4, background: 'var(--bg-3)', overflow: 'hidden', margin: '4px 0' }}>
          <div style={{ height: '100%', width: `${hpPct(p)}%`, background: p.color, transition: 'width .3s' }} />
        </div>
        {game.powerUpsEnabled && (p as any)._oneDartNext && (
          <div className="pu-banner" style={{ background: 'color-mix(in srgb,#f59e0b 18%,var(--bg-3))', border: '1px solid #f59e0b', color: '#f59e0b' }}>
            🛡️ Blocked! You only get ONE card this visit.
          </div>
        )}
        {game.powerUpsEnabled && (p as any)._crippledNext && (
          <div className="pu-banner" style={{ background: 'color-mix(in srgb,#ef4444 18%,var(--bg-3))', border: '1px solid #ef4444', color: '#ef4444' }}>
            🦾 Crippled! You deal 50% damage this visit.
          </div>
        )}
        {game.powerUpsEnabled && (p as any)._surgeNext && !(p as any)._surgeArmed && (
          <div className="pu-banner" style={{ background: 'color-mix(in srgb,var(--accent) 18%,var(--bg-3))', border: '1px solid var(--accent)', color: 'var(--accent)' }}>
            ⚡ Surge active! This visit scores double.
          </div>
        )}
        {game.powerUpsEnabled && (p as any)._bullseyeFrenzy && (
          <div className="pu-banner" style={{ background: 'color-mix(in srgb,#a855f7 18%,var(--bg-3))', border: '1px solid #a855f7', color: '#c084fc' }}>
            🐂 Bullseye Frenzy! Bulls deal double damage this visit.
          </div>
        )}
        {game.powerUpsEnabled && (p as any)._hotStreak && (
          <div className="pu-banner" style={{ background: 'color-mix(in srgb,#f97316 18%,var(--bg-3))', border: '1px solid #f97316', color: '#fb9234' }}>
            🔥 Hot Streak! Each card this visit earns +5 bonus per card before it.
          </div>
        )}
        {game.powerUpsEnabled && (p as any)._shieldTurns > 0 && (
          <div className="pu-banner" style={{ background: 'color-mix(in srgb,#38bdf8 18%,var(--bg-3))', border: '1px solid #38bdf8', color: '#7dd3fc' }}>
            🏰 Shield active! Protected from power-up attacks for {(p as any)._shieldTurns} more turn{(p as any)._shieldTurns === 1 ? '' : 's'}.
          </div>
        )}
        <div className="pc-slots">
          {Array.from({ length: maxPlays }).map((_, i) => {
            const entry = slotEntries[i];
            return <div key={i} className={`pc-slot${entry ? ' filled' : ''}`}>{entry ? entry.label : '–'}</div>;
          })}
        </div>
        <div className="muted small">This visit: <b style={{ color: 'var(--text)' }}>{game.darts.reduce((a, d) => a + d.value, 0)}</b></div>
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
                  {!defeated && game.powerUpsEnabled && (pl as any)._shieldTurns > 0 && <span title="Shielded" style={{ fontSize: 11 }}>🏰</span>}
                  {!defeated && game.powerUpsEnabled && (pl as any)._frozenNext && <span title="Frozen" style={{ fontSize: 11 }}>❄️</span>}
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

      <CardHand
        cardState={cs}
        playerName={p.name}
        isMyTurn={isMyTurn}
        isBattle={true}
        canEndVisit={cs.used.length > 0}
        canUndo={cs.used.length > 0}
        canPlayMore={totalCardsPlayed < maxPlays}
        onPlayCard={handlePlayCard}
        onUndo={onUndo}
        onEndVisit={onEnter}
        showPlayedButton={playedCount > 0}
        playedCount={playedCount}
        onShowPlayed={() => setShowPlayed(true)}
        visitNumber={game.turn + game.leg * 100}
      />

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
          closing={false}
          onClose={() => setSelectedPlayedCard(null)}
        />
      )}
      {reroll && (
        <RerollOverlay
          plan={reroll}
          settings={settings}
          onDone={() => {
            setReroll(null);
            if (rerollResolve) rerollResolve(true);
            setRerollResolve(null);
          }}
        />
      )}
    </div>
  );
}
