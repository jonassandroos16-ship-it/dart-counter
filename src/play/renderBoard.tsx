import type { Game, GameRecord, Player, Settings } from '../types';
import type { MusicEngine } from '../music';
import type { PopupControls } from '../Popups';
import { X01Board } from './boards/X01Board';
import { AtcBoard } from './boards/AtcBoard';
import { KillerBoard } from './boards/KillerBoard';
import { HighScoreBoard } from './boards/HighScoreBoard';
import { BattleBoard } from './boards/BattleBoard';
import { CardBoard } from './boards/CardBoard';

export interface RenderBoardArgs {
  game: Game;
  setGame: (g: Game | null) => void;
  settings: Settings;
  players: Player[];
  games: GameRecord[];
  setGames: (updater: any) => void;
  setPlayers: (updater: any) => void;
  toast: (m: string) => void;
  music: MusicEngine;
  onQuit: () => void;
  onGameOver: () => void;
  popups: PopupControls;
  isMyTurn?: boolean;
  gameMode?: 'dartboard' | 'cards';
}

// Shared board-selection logic used by both local and multiplayer play.
// Picks the right board component for the current game mode and renders it
// with a consistent prop set. This avoids duplicating the routing switch
// in every place a game board is mounted.
export function renderBoard(args: RenderBoardArgs): React.ReactNode {
  const { game, setGame, settings, players, games, setGames, setPlayers, toast, music, onQuit, onGameOver, popups, isMyTurn = true, gameMode } = args;
  if (gameMode === 'cards') return <CardBoard game={game} setGame={setGame} settings={settings} players={players} games={games} setGames={setGames} setPlayers={setPlayers} toast={toast} music={music} onQuit={onQuit} onGameOver={onGameOver} popups={popups} isMyTurn={isMyTurn} />;
  if (game.atc) return <AtcBoard game={game} setGame={setGame} settings={settings} players={players} games={games} toast={toast} music={music} onQuit={onQuit} setGames={setGames} setPlayers={setPlayers} popups={popups} onGameOver={onGameOver} isMyTurn={isMyTurn} />;
  if (game.mode === 'killer') return <KillerBoard game={game} setGame={setGame} settings={settings} players={players} games={games} toast={toast} music={music} onQuit={onQuit} setGames={setGames} setPlayers={setPlayers} popups={popups} onGameOver={onGameOver} isMyTurn={isMyTurn} />;
  if (game.mode === 'highscore') return <HighScoreBoard game={game} setGame={setGame} settings={settings} players={players} games={games} toast={toast} music={music} onQuit={onQuit} setGames={setGames} setPlayers={setPlayers} popups={popups} onGameOver={onGameOver} isMyTurn={isMyTurn} />;
  if (game.mode === 'battle') return <BattleBoard game={game} setGame={setGame} settings={settings} players={players} games={games} toast={toast} music={music} onQuit={onQuit} setGames={setGames} setPlayers={setPlayers} popups={popups} onGameOver={onGameOver} isMyTurn={isMyTurn} />;
  return <X01Board game={game} setGame={setGame} settings={settings} players={players} games={games} setGames={setGames} setPlayers={setPlayers} toast={toast} music={music} onQuit={onQuit} onGameOver={onGameOver} popups={popups} isMyTurn={isMyTurn} />;
}
