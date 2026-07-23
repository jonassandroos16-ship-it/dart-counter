import type { Game, GameRecord, Player, Settings } from '../../types';
import { visitAvg, leadTrailBadge } from '../../logic';
import { Sound } from '../../sound';
import type { MusicEngine } from '../../music';
import type { PopupControls } from '../../Popups';
import { ChargedPlayerIcon, BadgeAvatar } from '../common';
import { addDartToGame, undoDart, KeypadPad } from '../dart';
import { activatePowerUp } from '../powerups';
import { finishSimpleGame } from '../finish';
import { QuitButton, GameOverGuard, PowerUpBanners, DartSlots, calcScored, clearCurFlags, useRerollOverlay, advanceSimpleTurn, checkScoreMilestones } from '../boardUtils';

const HIGH_SCORE_VISITS = 7;

export function HighScoreBoard({ game, setGame, settings, players, games, toast, music, onQuit, setGames, setPlayers, popups, onGameOver }: {
  game: Game; setGame: (g: Game | null) => void; settings: Settings; players: Player[]; games: GameRecord[]; toast: (m: string) => void; music: MusicEngine; onQuit: () => void; setGames: (updater: any) => void; setPlayers: (updater: any) => void; popups: PopupControls; onGameOver: () => void;
}) {
  const { rerollOverlay, onReroll } = useRerollOverlay(settings);
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
    const scored = calcScored(game.darts, cur0);
    const newPlayers = game.players.map((pl, i) => i === game.turn ? { ...pl } : pl);
    const cur = newPlayers[game.turn] as any;
    clearCurFlags(cur);
    cur.score += scored;
    cur.visits.push({ darts: [...game.darts], scored, remaining: cur.score, leg: 1, mode: 'highscore', date: new Date().toISOString() });
    cur.dartsThrown += game.darts.length;
    Sound.play('enter', {}, settings);

    checkScoreMilestones(scored, settings, popups);

    const allDone = newPlayers.every(pl => pl.visits.length >= HIGH_SCORE_VISITS);
    const finishedState = { ...game, players: newPlayers, darts: [], mult: 1 };
    if (allDone) {
      const maxScore = Math.max(...newPlayers.map(pl => pl.score));
      const winners = newPlayers.filter(pl => pl.score === maxScore);
      const winner = winners.length === 1 ? winners[0] : null;
      finishSimpleGame(finishedState, winner, settings, setGame, setGames, setPlayers, popups, music, players, games, winners.length > 1 ? winners : null);
      return;
    }
    const result = advanceSimpleTurn(
      game, newPlayers,
      (pl: any) => pl.visits.length >= HIGH_SCORE_VISITS,
      (pl: any) => pl.score,
      'highscore',
      popups, toast,
    );
    setGame({ ...finishedState, turn: result.turn });
  };

  if (game.finished) return <GameOverGuard game={game} setGame={setGame} onGameOver={onGameOver} music={music} settings={settings} />;

  return (
    <div className="view-noscroll">
      <QuitButton onQuit={onQuit} />
      <div className="play-current">
        <div className="pc-header">
          <div className="row" style={{ gap: 8 }}>
            {game.powerUpsEnabled ? (
              <ChargedPlayerIcon game={game} curIdx={game.turn} settings={settings} players={players} games={games} toast={toast} onActivate={() => {
                activatePowerUp(game, game.turn, settings, toast, { popups, onReroll }).then((next) => { if (next) setGame(next); });
              }} />
            ) : (
              <BadgeAvatar playerId={p.id} players={players} games={games} size={32} fontSize={13} color={p.color} />
            )}
            <span className="pc-name">{p.name}</span>
            {(() => { const badge = leadTrailBadge(p, game); return badge ? <span className={`lead-badge ${badge.startsWith('+') ? 'lead' : 'trail'}`}>{badge}</span> : null; })()}
          </div>
          <span className="muted small">HIGH SCORE · VISIT {visitNum}/{HIGH_SCORE_VISITS}</span>
        </div>
        <div className="pc-remaining">{p.score}</div>
        <div className="checkout-hint center">{visitNum >= HIGH_SCORE_VISITS ? 'Final visit — go big!' : 'Score as high as you can!'}</div>
        <PowerUpBanners game={game} p={p} />
        <DartSlots game={game} p={p} />
        <div className="muted small">This visit: <b style={{ color: 'var(--text)' }}>{game.darts.reduce((a, d) => a + d.value, 0)}</b></div>
      </div>

      {game.players.length > 1 && (
        <div className="play-others">
          {others.map(pl => (
            <div key={pl.id} className="play-other">
              <div className="row between">
                <div className="row" style={{ gap: 6 }}>
                  <BadgeAvatar playerId={pl.id} players={players} games={games} size={22} fontSize={10} color={pl.color} />
                  <span className="po-name">{pl.name}</span>
                  {game.powerUpsEnabled && (pl as any)._shieldTurns > 0 && <span title="Shielded" style={{ fontSize: 11 }}>🏰</span>}
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
      {rerollOverlay}
    </div>
  );
}
