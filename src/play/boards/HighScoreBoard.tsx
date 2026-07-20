import { useState } from 'react';
import type { Game, GameRecord, Player, Settings } from '../../types';
import { SCORE_POPUPS } from '../../constants';
import { visitAvg } from '../../logic';
import { Sound } from '../../sound';
import type { MusicEngine } from '../../music';
import type { PopupControls } from '../../Popups';
import { PowerUpOrb, BadgeAvatar } from '../common';
import { addDartToGame, undoDart, KeypadPad, clearVisitPowerUpFlags } from '../dart';
import { activatePowerUp } from '../powerups';
import { finishSimpleGame } from '../finish';
import { GameOver } from '../GameOver';
import { RerollOverlay } from '../RerollOverlay';
import type { RerollPlan } from '../../powerups';

const HIGH_SCORE_VISITS = 7;

export function HighScoreBoard({ game, setGame, settings, players, games, toast, music, onQuit, setGames, setPlayers, popups, onGameOver }: {
  game: Game; setGame: (g: Game | null) => void; settings: Settings; players: Player[]; games: GameRecord[]; toast: (m: string) => void; music: MusicEngine; onQuit: () => void; setGames: (updater: any) => void; setPlayers: (updater: any) => void; popups: PopupControls; onGameOver: () => void;
}) {
  const [reroll, setReroll] = useState<RerollPlan | null>(null);
  const [rerollResolve, setRerollResolve] = useState<((v: boolean) => void) | null>(null);
  const p = game.players[game.turn];
  const others = [...game.players.slice(game.turn + 1), ...game.players.slice(0, game.turn)];
  const visitNum = p.visits.length + 1;

  const addDart = (base: number, mult: number, labelOverride?: string, isBull?: boolean) => {
    const next = addDartToGame(game, base, mult, labelOverride, isBull, settings, toast);
    if (next) setGame(next);
  };

  const enterVisit = () => {
    if (!game.darts.length) { toast('Add at least one dart'); return; }
    const cur0 = game.players[game.turn] as any;
    const surgeActive = !!cur0._surgeNext && !cur0._surgeArmed;
    const crippleActive = !!cur0._crippledNext;
    const rawScored = game.darts.reduce((a, d) => a + d.value, 0);
    const surgeScored = surgeActive ? rawScored * 2 : rawScored;
    const scored = crippleActive ? Math.round(surgeScored * 0.5) : surgeScored;
    const newPlayers = game.players.map((pl, i) => i === game.turn ? { ...pl } : pl);
    const cur = newPlayers[game.turn] as any;
    if (cur._surgeArmed) delete cur._surgeArmed;
    else if (cur._surgeNext) delete cur._surgeNext;
    if (cur._crippledNext) delete cur._crippledNext;
    if (cur._fourthDart) delete cur._fourthDart;
    if (cur._oneDartNext) delete cur._oneDartNext;
    cur.score += scored;
    cur.visits.push({ darts: [...game.darts], scored, remaining: cur.score, leg: 1, mode: 'highscore', date: new Date().toISOString() });
    cur.dartsThrown += game.darts.length;
    Sound.play('enter', {}, settings);

    if (settings.popups.scores) {
      for (const sp of SCORE_POPUPS) { if (scored >= sp.min) { popups.setMilestone({ emoji: sp.emoji, title: sp.title, sub: sp.sub }); Sound.play('milestone', {}, settings); break; } }
    }

    const allDone = newPlayers.every(pl => pl.visits.length >= HIGH_SCORE_VISITS);
    const finishedState = { ...game, players: newPlayers, darts: [], mult: 1 };
    if (allDone) {
      const maxScore = Math.max(...newPlayers.map(pl => pl.score));
      const winners = newPlayers.filter(pl => pl.score === maxScore);
      const winner = winners.length === 1 ? winners[0] : null;
      finishSimpleGame(finishedState, winner, settings, setGame, setGames, setPlayers, popups, music, [], []);
      return;
    }
    let nextTurn = (game.turn + 1) % game.players.length;
    while (newPlayers[nextTurn].visits.length >= HIGH_SCORE_VISITS) nextTurn = (nextTurn + 1) % newPlayers.length;
    if (game.powerUpsEnabled) {
      let guards = 0;
      while (guards < newPlayers.length) {
        const np = newPlayers[nextTurn] as any;
        if (np._frozenNext) {
          const cleared = clearVisitPowerUpFlags(np);
          cleared.visits = [...np.visits, { darts: [], scored: 0, remaining: np.score, leg: 1, mode: 'highscore', date: new Date().toISOString(), frozen: true }];
          newPlayers[nextTurn] = cleared;
          popups.setFrozen({ name: np.name });
          toast(`${np.name} is frozen — visit skipped.`);
          nextTurn = (nextTurn + 1) % newPlayers.length;
          while (newPlayers[nextTurn].visits.length >= HIGH_SCORE_VISITS) nextTurn = (nextTurn + 1) % newPlayers.length;
          guards++;
        } else break;
      }
    }
    setGame({ ...finishedState, turn: nextTurn });
  };

  if (game.finished) return <GameOver game={game} onNewGame={() => { setGame(null); onGameOver(); music.startContext('setup', settings); }} onViewStats={() => { setGame(null); onGameOver(); }} />;

  return (
    <div className="view-noscroll">
      <div className="play-current">
        <div className="pc-header">
          <div className="row" style={{ gap: 8 }}>
            <BadgeAvatar playerId={p.id} players={players} games={games} size={32} fontSize={13} color={p.color} />
            <span className="pc-name">{p.name}</span>
          </div>
          <span className="muted small">HIGH SCORE · VISIT {visitNum}/{HIGH_SCORE_VISITS}</span>
        </div>
        <div className="pc-remaining">{p.score}</div>
        <div className="checkout-hint center">{visitNum >= HIGH_SCORE_VISITS ? 'Final visit — go big!' : 'Score as high as you can!'}</div>
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
        <div className="pc-slots">
          {Array.from({ length: (game.powerUpsEnabled && (p as any)._fourthDart) ? 4 : (game.powerUpsEnabled && (p as any)._oneDartNext ? 1 : 3) }).map((_, i) => { const d = game.darts[i]; return <div key={i} className={`pc-slot${d ? ' filled' : ''}`} style={i === 3 ? { borderColor: 'var(--accent)' } : {}}>{d ? d.label : (i === 3 ? '🎯' : '–')}</div>; })}
        </div>
        <div className="muted small">This visit: <b style={{ color: 'var(--text)' }}>{game.darts.reduce((a, d) => a + d.value, 0)}</b></div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
          <PowerUpOrb game={game} curIdx={game.turn} settings={settings} toast={toast} onActivate={() => {
            activatePowerUp(game, game.turn, settings, toast, {
              onReroll: (plan) => new Promise<boolean>((resolve) => {
                setReroll(plan);
                setRerollResolve(() => resolve);
              }),
            }).then((next) => { if (next) setGame(next); });
          }} />
        </div>
      </div>

      {game.players.length > 1 && (
        <div className="play-others">
          {others.map(pl => (
            <div key={pl.id} className="play-other">
              <div className="row between">
                <div className="row" style={{ gap: 6 }}>
                  <BadgeAvatar playerId={pl.id} players={players} games={games} size={22} fontSize={10} color={pl.color} />
                  <span className="po-name">{pl.name}</span>
                </div>
                <span className="pill" style={{ fontSize: 10 }}>{pl.visits.length}/{HIGH_SCORE_VISITS}</span>
              </div>
              <div className="po-score">{pl.score}</div>
              <div className="po-sub">avg {visitAvg(pl).toFixed(1)}</div>
            </div>
          ))}
        </div>
      )}

      <div className="play-input">
        <KeypadPad game={game} setGame={setGame as any} onAdd={addDart} onUndo={() => setGame(undoDart(game))} onEnter={enterVisit} />
      </div>
      <button className="btn danger sm" style={{ alignSelf: 'flex-end' }} onClick={() => { if (confirm('Quit this game?')) onQuit(); }}>Quit</button>
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
