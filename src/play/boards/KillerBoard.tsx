import { useState } from 'react';
import type { Game, GameRecord, Player, Settings } from '../../types';
import { Sound } from '../../sound';
import type { MusicEngine } from '../../music';
import type { PopupControls } from '../../Popups';
import { ChargedPlayerIcon, BadgeAvatar } from '../common';
import { addDartToGame, undoDart, clearVisitPowerUpFlags, tickShield } from '../dart';
import { activatePowerUp } from '../powerups';
import { finishSimpleGame } from '../finish';
import { GameOver } from '../GameOver';
import { RerollOverlay } from '../RerollOverlay';
import type { RerollPlan } from '../../powerups';

export function KillerBoard({ game, setGame, settings, players, games, toast, music, onQuit, setGames, setPlayers, popups, onGameOver, isMyTurn = true }: {
  game: Game; setGame: (g: Game | null) => void; settings: Settings; players: Player[]; games: GameRecord[]; toast: (m: string) => void; music: MusicEngine; onQuit: () => void; setGames: (updater: any) => void; setPlayers: (updater: any) => void; popups: PopupControls; onGameOver: () => void; isMyTurn?: boolean;
}) {
  const [reroll, setReroll] = useState<RerollPlan | null>(null);
  const [rerollResolve, setRerollResolve] = useState<((v: boolean) => void) | null>(null);
  const p = game.players[game.turn];
  const others = [...game.players.slice(game.turn + 1), ...game.players.slice(0, game.turn)];
  const alive = game.players.filter(pl => !pl.eliminated);

  const addDart = (base: number, mult: number, labelOverride?: string, isBull?: boolean) => {
    const next = addDartToGame(game, base, mult, labelOverride, isBull, settings, toast);
    if (next) setGame(next);
  };

  const enterVisit = () => {
    if (!game.darts.length) { toast('Add at least one dart'); return; }
    const newPlayers = game.players.map(pl => ({ ...pl }));
    const cur = newPlayers[game.turn] as any;
    if (cur._surgeArmed) delete cur._surgeArmed;
    else if (cur._surgeNext) delete cur._surgeNext;
    if (cur._crippledNext) delete cur._crippledNext;
    if (cur._fourthDart) delete cur._fourthDart;
    if (cur._oneDartNext) delete cur._oneDartNext;
    if (cur._bullseyeFrenzy) delete cur._bullseyeFrenzy;
    if (cur._hotStreak) delete cur._hotStreak;
    const isKiller = (cur.killerHits || 0) >= 5;
    let killedThisVisit: { killer: string; victim: string } | null = null;

    for (const dart of game.darts) {
      if (dart.base === 0) continue;
      if (!isKiller) {
        if (dart.base === cur.killerNumber) {
          cur.killerHits = Math.min(5, (cur.killerHits || 0) + 1);
          if (cur.killerHits === 5) toast(`${cur.name} is now a KILLER!`);
        }
      } else {
        const victim = newPlayers.find(pl => pl.id !== cur.id && !pl.eliminated && pl.killerNumber === dart.base);
        if (victim) {
          victim.lives = Math.max(0, (victim.lives || 0) - 1);
          cur.kills = [...(cur.kills || []), victim.id];
          if (victim.lives === 0 && !victim.eliminated) {
            victim.eliminated = true;
            killedThisVisit = { killer: cur.name, victim: victim.name };
          }
        }
      }
    }

    const scored = game.darts.reduce((a, d) => a + d.value, 0);
    cur.visits.push({ darts: [...game.darts], scored, remaining: cur.lives, leg: 1, mode: 'killer', date: new Date().toISOString(), hits: (cur.kills || []).length });
    cur.dartsThrown += game.darts.length;

    const remainingAlive = newPlayers.filter(pl => !pl.eliminated);
    const finishedState = { ...game, players: newPlayers, darts: [], mult: 1 };
    if (remainingAlive.length <= 1) {
      const winner = remainingAlive[0] || null;
      if (killedThisVisit) popups.setKill(killedThisVisit);
      setTimeout(() => finishSimpleGame(finishedState, winner, settings, setGame, setGames, setPlayers, popups, music, players, games), killedThisVisit ? 2200 : 0);
      return;
    }
    Sound.play('enter', {}, settings);
    if (killedThisVisit) popups.setKill(killedThisVisit);
    let nextTurn = (game.turn + 1) % game.players.length;
    while (newPlayers[nextTurn].eliminated) nextTurn = (nextTurn + 1) % newPlayers.length;
    // Shield: tick down the current player's shield at the end of their visit.
    if (game.powerUpsEnabled) newPlayers[game.turn] = tickShield(newPlayers[game.turn]);
    if (game.powerUpsEnabled) {
      let guards = 0;
      while (guards < newPlayers.length) {
        const np = newPlayers[nextTurn] as any;
        if (np._frozenNext) {
          const cleared = clearVisitPowerUpFlags(np);
          cleared.visits = [...np.visits, { darts: [], scored: 0, remaining: np.lives, leg: 1, mode: 'killer', date: new Date().toISOString(), frozen: true, hits: (np.kills || []).length }];
          newPlayers[nextTurn] = cleared;
          popups.setFrozen({ name: np.name });
          toast(`${np.name} is frozen — visit skipped.`);
          nextTurn = (nextTurn + 1) % newPlayers.length;
          while (newPlayers[nextTurn].eliminated) nextTurn = (nextTurn + 1) % newPlayers.length;
          guards++;
        } else break;
      }
    }
    setGame({ ...finishedState, turn: nextTurn });
  };

  if (game.finished) return <GameOver game={game} onNewGame={() => { setGame(null); onGameOver(); music.startContext('setup', settings); }} onViewStats={() => { setGame(null); onGameOver(); }} />;

  return (
    <div className="view-noscroll">
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
            {(p.killerHits || 0) >= 5 && <span className="pill" style={{ background: '#ef4444', color: '#fff', fontSize: 10 }}>KILLER</span>}
          </div>
          <span className="muted small">KILLER · {alive.length} ALIVE</span>
        </div>
        <div className="pc-remaining" style={{ fontSize: 28 }}>
          {(p.killerHits || 0) >= 5 ? '🎯 Aim at opponents' : `Hit ${p.killerNumber}`}
        </div>
        <div className="checkout-hint center">
          {(p.killerHits || 0) < 5 ? `Become a Killer: ${p.killerHits || 0}/5 hits on ${p.killerNumber}` : 'Hit opponent numbers to eliminate them'}
        </div>
        {game.powerUpsEnabled && (p as any)._oneDartNext && (
          <div className="pu-banner" style={{ background: 'color-mix(in srgb,#f59e0b 18%,var(--bg-3))', border: '1px solid #f59e0b', color: '#f59e0b' }}>
            🛡️ Blocked! You only get ONE dart this visit.
          </div>
        )}
        {game.powerUpsEnabled && (p as any)._crippledNext && (
          <div className="pu-banner" style={{ background: 'color-mix(in srgb,#ef4444 18%,var(--bg-3))', border: '1px solid #ef4444', color: '#ef4444' }}>
            🦾 Crippled! You only score 50% this visit.
          </div>
        )}
        {game.powerUpsEnabled && (p as any)._surgeNext && !(p as any)._surgeArmed && (
          <div className="pu-banner" style={{ background: 'color-mix(in srgb,var(--accent) 18%,var(--bg-3))', border: '1px solid var(--accent)', color: 'var(--accent)' }}>
            ⚡ Surge active! This visit scores double.
          </div>
        )}
        {game.powerUpsEnabled && (p as any)._bullseyeFrenzy && (
          <div className="pu-banner" style={{ background: 'color-mix(in srgb,#a855f7 18%,var(--bg-3))', border: '1px solid #a855f7', color: '#c084fc' }}>
            🐂 Bullseye Frenzy! Bulls score double this visit.
          </div>
        )}
        {game.powerUpsEnabled && (p as any)._hotStreak && (
          <div className="pu-banner" style={{ background: 'color-mix(in srgb,#f97316 18%,var(--bg-3))', border: '1px solid #f97316', color: '#fb9234' }}>
            🔥 Hot Streak! Each dart this visit earns +5 bonus per dart before it.
          </div>
        )}
        {game.powerUpsEnabled && (p as any)._shieldTurns > 0 && (
          <div className="pu-banner" style={{ background: 'color-mix(in srgb,#38bdf8 18%,var(--bg-3))', border: '1px solid #38bdf8', color: '#7dd3fc' }}>
            🏰 Shield active! Protected from power-up attacks for {(p as any)._shieldTurns} more turn{(p as any)._shieldTurns === 1 ? '' : 's'}.
          </div>
        )}
        <div className="pc-slots">
          {Array.from({ length: (game.powerUpsEnabled && (p as any)._fourthDart) ? 4 : (game.powerUpsEnabled && (p as any)._oneDartNext ? 1 : 3) }).map((_, i) => { const d = game.darts[i]; return <div key={i} className={`pc-slot${d ? ' filled' : ''}`} style={i === 3 ? { borderColor: 'var(--accent)' } : {}}>{d ? d.label : (i === 3 ? '🎯' : '–')}</div>; })}
        </div>
        <div className="muted small">Lives: <b style={{ color: 'var(--text)' }}>{'❤️'.repeat(p.lives || 0) || 'none'}</b></div>
      </div>

      <div className="play-others">
        {others.filter(pl => !pl.eliminated).map(pl => (
          <div key={pl.id} className="play-other">
            <div className="row between">
              <div className="row" style={{ gap: 6 }}>
                <BadgeAvatar playerId={pl.id} players={players} games={games} size={22} fontSize={10} color={pl.color} />
                <span className="po-name">{pl.name}</span>
                {(pl.killerHits || 0) >= 5 && <span className="pill" style={{ background: '#ef4444', color: '#fff', fontSize: 9 }}>KILLER</span>}
                {game.powerUpsEnabled && (pl as any)._shieldTurns > 0 && <span title="Shielded" style={{ fontSize: 11 }}>🏰</span>}
              </div>
              <span className="pill" style={{ fontSize: 10 }}>{'❤️'.repeat(pl.lives || 0) || '💀'}</span>
            </div>
            <div className="po-score">#{pl.killerNumber}</div>
            <div className="po-sub">{(pl.killerHits || 0) >= 5 ? 'Killer' : `${pl.killerHits || 0}/5 to kill`} · {pl.kills?.length || 0} kills</div>
          </div>
        ))}
      </div>

      <div className="play-input">
        <div className="pad-card">
          <div className="mult">
            <button className={game.mult === 1 ? 'on' : ''} onClick={() => setGame({ ...game, mult: 1 })} disabled={!isMyTurn}>Single</button>
            <button className={game.mult === 2 ? 'on' : ''} onClick={() => setGame({ ...game, mult: 2 })} disabled={!isMyTurn}>Double</button>
            <button className={game.mult === 3 ? 'on' : ''} onClick={() => setGame({ ...game, mult: 3 })} disabled={!isMyTurn}>Triple</button>
          </div>
          <div className="keypad">
            {[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20].map(n => (
              <button key={n} className={`key${n === p.killerNumber ? ' killer-target' : ''}`} onClick={() => addDart(n, game.mult)} disabled={!isMyTurn}>{n}</button>
            ))}
            <button className="key" style={{ background: 'color-mix(in srgb,var(--accent) 20%,var(--bg-3))' }} onClick={() => addDart(25, game.mult === 2 ? 2 : 1)} disabled={!isMyTurn}>25</button>
            <button className="key" style={{ gridColumn: 'span 2', background: 'color-mix(in srgb,var(--accent) 30%,var(--bg-3))' }} onClick={() => addDart(50, 1, 'Bull', true)} disabled={!isMyTurn}>Bull<br /><small>50</small></button>
            <button className="key" style={{ gridColumn: 'span 2', color: 'var(--muted)' }} onClick={() => addDart(0, 1, '0')} disabled={!isMyTurn}>Miss</button>
          </div>
          <div className="row" style={{ gap: 8, marginTop: 8 }}>
            <button className="btn block ghost" onClick={() => setGame(undoDart(game))} disabled={!isMyTurn}>↶ Undo dart</button>
            <button className="btn block primary" onClick={enterVisit} disabled={!isMyTurn}>Enter visit</button>
          </div>
        </div>
      </div>
      {reroll ? (
        <RerollOverlay
          plan={reroll}
          settings={settings}
          onDone={() => {
            setReroll(null);
            if (rerollResolve) rerollResolve(true);
            setRerollResolve(null);
          }}
        />
      ) : null}
    </div>
  );
}
