import { useEffect, useMemo, useState } from 'react';
import { addDartToGame, undoDart, KeypadPad } from '../dart';
import { ChargedPlayerIcon, BadgeAvatar } from '../common';
import { TEAM_COLORS, getTitleInfo, MODES } from '../../constants';
import { Game, Player, Settings, GameRecord } from '../dart';
import { useKillerBoard } from './KillerBoardLogic';
import { useToast } from '../toast';

export function KillerBoard({ game, setGame, players, games, settings }: {
  game: Game; setGame: (g: Game) => void; players: Player[]; games: GameRecord[]; settings: Settings;
}) {
  const toast = useToast();
  const { enterVisit, addDart } = useKillerBoard(game, setGame, settings, toast);
  const titleInfo = useMemo(() => getTitleInfo(players[game.turn]?.xp || 0), [players, game.turn]);
  const themeColor = TEAM_COLORS[game.turn % TEAM_COLORS.length];

  return (
    <div className="board killer-board">
      <div className="board-header" style={{ background: themeColor }}>
        <span className="board-title">{MODES.killer.name}</span>
        <span className="board-subtitle">{players[game.turn]?.name}</span>
      </div>

      <div className="players-row">
        {game.players.map((p, i) => (
          <div key={i} className={`player-card ${i === game.turn ? 'active' : ''}`}>
            <BadgeAvatar player={players[i]} games={games} />
            <div className="player-name">{p.name}</div>
            <div className="pc-remaining" style={{ fontSize: 28 }}>
              {(p.killerHits || 0) >= 5 ? `{'\u{1F3AF}'} Aim at opponents` : `Hit ${p.killerNumber}`}
            </div>
            <div className="checkout-hint center">
              {p.killerHits || 0}/5 hits
            </div>
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
