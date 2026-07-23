import { useEffect, useMemo, useState } from 'react';
import { addDartToGame, undoDart, KeypadPad, clearVisitPowerUpFlags, tickShield } from '../dart';
import { ChargedPlayerIcon, AttributeStrip, BadgeAvatar } from '../common';
import { TEAM_COLORS, getTitleInfo, MODES } from '../../constants';
import { Game, Player, Settings, GameRecord } from '../dart';
import { useX01Board } from './X01BoardLogic';
import { useToast } from '../toast';

export function X01Board({ game, setGame, players, games, settings }: {
  game: Game; setGame: (g: Game) => void; players: Player[]; games: GameRecord[]; settings: Settings;
}) {
  const toast = useToast();
  const { enterVisit, addDart } = useX01Board(game, setGame, settings, toast);
  const titleInfo = useMemo(() => getTitleInfo(players[game.turn]?.xp || 0), [players, game.turn]);
  const themeColor = TEAM_COLORS[game.turn % TEAM_COLORS.length];

  useEffect(() => {
    clearVisitPowerUpFlags(game);
    tickShield(game);
  }, [game.turn]);

  return (
    <div className="board x01-board">
      <div className="board-header" style={{ background: themeColor }}>
        <span className="board-title">{MODES.x01.name}</span>
        <span className="board-subtitle">{players[game.turn]?.name}</span>
      </div>

      <div className="players-row">
        {game.players.map((p, i) => (
          <div key={i} className={`player-card ${i === game.turn ? 'active' : ''}`}>
            <BadgeAvatar player={players[i]} games={games} />
            <div className="player-name">{p.name}</div>
            <div className="player-score">{p.score}</div>
          </div>
        ))}
      </div>

      <div className="action-row">
        <ChargedPlayerIcon game={game} curIdx={game.turn} settings={settings} players={players} games={games} onActivate={() => {}} />
        <KeypadPad game={game} setGame={setGame as any} onAdd={addDart} onUndo={() => setGame(undoDart(game))} onEnter={enterVisit} />
      </div>
    </div>
  );
}
