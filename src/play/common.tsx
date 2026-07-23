import { useEffect, useState } from 'react';
import { Game, Player, Settings, GameRecord } from './dart';
import { TEAM_COLORS } from '../constants';
import { Sound } from '../sound';

// ChargedPlayerIcon replaces the old standalone PowerUpOrb button. The
// visual is a glowing orb that fills as the player's charge meter fills,
// and becomes clickable when fully charged.
export function ChargedPlayerIcon({ game, curIdx, settings, players, games, onActivate }: {
  game: Game;
  curIdx: number;
  settings: Settings;
  players: Player[];
  games: GameRecord[];
  onActivate: () => void;
}) {
  const charge = game.players[curIdx]?.charge || 0;
  const isCharged = charge >= 100;
  const themeColor = TEAM_COLORS[curIdx % TEAM_COLORS.length];

  return (
    <div
      className={`charged-icon ${isCharged ? 'charged' : ''}`}
      style={{ borderColor: themeColor }}
      onClick={isCharged ? onActivate : undefined}
    >
      <div className="charge-fill" style={{ height: `${charge}%`, background: themeColor }} />
      <span className="charge-label">{isCharged ? 'READY' : `${Math.floor(charge)}%`}</span>
    </div>
  );
}

// Backward-compat wrapper — renders ChargedPlayerIcon with the same props
// the old PowerUpOrb accepted. Boards that haven't been migrated yet still
// import PowerUpOrb.
export function PowerUpOrb(props: { game: Game; curIdx: number; settings: Settings; onActivate: () => void; players?: Player[]; games?: GameRecord[] }) {
  return <ChargedPlayerIcon
    game={props.game}
    curIdx={props.curIdx}
    settings={props.settings}
    players={props.players || []}
    games={props.games || []}
    onActivate={props.onActivate}
  />;
}

export function BadgeAvatar({ player, games }: { player: Player; games: GameRecord[] }) {
  const wins = games.filter(g => g.winner === player.name).length;
  return (
    <div className="badge-avatar">
      <span className="badge-name">{player.name}</span>
      {wins > 0 && <span className="badge-wins">{wins}W</span>}
    </div>
  );
}

export function AttributeStrip({ game }: { game: Game }) {
  const player = game.players[game.turn];
  return (
    <div className="attribute-strip">
      <span>HP: {player.hp ?? 100}</span>
      <span>Score: {player.score}</span>
      <span>Charge: {player.charge || 0}%</span>
    </div>
  );
}
