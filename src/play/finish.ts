import type { Game, GamePlayer, GameRecord, Player, Settings } from '../types';
import { recordFromGame } from './logic';
import { Sound } from './sound';
import type { MusicEngine } from './music';
import type { PopupControls } from './Popups';
import { awardXP, checkTitleUnlocks, awardBadges } from './rewards';

// Shared end-game helper used by the Killer, High Score and Battle boards
// (the simpler modes that don't need x01's tie/leg logic).
export function finishSimpleGame(g: Game, winner: GamePlayer | null, settings: Settings, setGame: (g: Game | null) => void, setGames: (updater: any) => void, setPlayers: (updater: any) => void, popups: PopupControls, music: MusicEngine, players: Player[], games: GameRecord[], tiedPlayers?: GamePlayer[] | null) {
  if (g.finished) return;
  const tied = !winner && !!tiedPlayers && tiedPlayers.length > 1;
  const finished: Game = { ...g, finished: true, winner: winner ? winner.id : null, tied, tiedPlayers: tied ? tiedPlayers.map(p => p.id) : null };
  Sound.play('win', {}, settings);
  music.startContext('setup', settings);
  setGames((prev: GameRecord[]) => [...prev, recordFromGame(finished)]);
  if (winner) awardXP(winner.id, settings.xpConfig.win, 'Winning the game', settings, setPlayers, popups);
  finished.players.forEach(pl => checkTitleUnlocks(pl, settings, popups, setPlayers, finished, players, games));
  awardBadges(finished, setPlayers);
  setGame(finished);
}
