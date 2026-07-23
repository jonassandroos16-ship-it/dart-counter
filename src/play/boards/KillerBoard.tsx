import type { Game, GameRecord, Player, Settings } from '../../types';
import { Sound } from '../../sound';
import type { MusicEngine } from '../../music';
import type { PopupControls } from '../../Popups';
import { ChargedPlayerIcon, BadgeAvatar } from '../common';
import { addDartToGame, undoDart, KeypadPad, clearVisitPowerUpFlags, tickShield } from '../dart';
import { activatePowerUp } from '../powerups';
import { finishSimpleGame } from '../finish';
import { QuitButton, GameOverGuard, PowerUpBanners, DartSlots, clearCurFlags, useRerollOverlay, advanceSimpleTurn } from '../boardUtils';

export function KillerBoard({ game, setGame, settings, players, games, toast, music, onQuit, setGames, setPlayers, popups, onGameOver }: {
  game: Game; setGame: (g: Game | null) => void; settings: Settings; players: Player[]; games: GameRecord[]; toast: (m: string) => void; music: MusicEngine; onQuit: () => void; setGames: (updater: any) => void; setPlayers: (updater: any) => void; popups: PopupControls; onGameOver: () => void;
}) {
  const { rerollOverlay, onReroll } = useRerollOverlay(settings);
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
    clearCurFlags(cur);
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
    const result = advanceSimpleTurn(
      game, newPlayers,
      (pl: any) => pl.eliminated,
      (pl: any) => pl.lives,
      'killer',
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
        <PowerUpBanners game={game} p={p} />
        <DartSlots game={game} p={p} />
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
        <KeypadPad game={game} setGame={setGame as any} onAdd={addDart} onUndo={() => setGame(undoDart(game))} onEnter={enterVisit} />
      </div>
      {rerollOverlay}
    </div>
  );
}
