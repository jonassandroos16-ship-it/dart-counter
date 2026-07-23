import type { Game, GameRecord, Player, Settings, Dart } from '../../types';
import { MODES, SCORE_POPUPS } from '../../constants';
import { recordFromGame, checkoutHint, leadTrailBadge, computeBattleDartDamage } from '../../logic';
import { Sound } from '../../sound';
import type { MusicEngine } from '../../music';
import type { PopupControls } from '../../Popups';
import { clearVisitPowerUpFlags, tickShield } from '../dart';
import { runMilestones, awardXP, checkTitleUnlocks, awardBadges } from '../rewards';
import { finishSimpleGame } from '../finish';

const HIGH_SCORE_VISITS = 7;

export interface VisitContext {
  game: Game;
  setGame: (g: Game | null) => void;
  settings: Settings;
  players: Player[];
  games: GameRecord[];
  setGames: (updater: any) => void;
  setPlayers: (updater: any) => void;
  toast: (m: string) => void;
  music: MusicEngine;
  popups: PopupControls;
  targetId: string | null;
  setTargetId: (id: string | null) => void;
}

export function advanceTurn(g: Game, ctx: { isBattle: boolean; isKiller: boolean; isHighScore: boolean; popups: PopupControls; toast: (m: string) => void }): Game {
  const { isBattle, isKiller, isHighScore, popups, toast } = ctx;
  if (g.powerUpsEnabled && !g.teamMode) {
    const c = g.players[g.turn] as any;
    if (c && c._shieldTurns > 0) {
      g = { ...g, players: g.players.map((pl, i) => i === g.turn ? tickShield(pl) : pl) };
    }
  }
  if (g.teamMode) {
    const tc = g.teamCount || 2;
    const ros: number[][] = Array.from({ length: tc }, () => []);
    g.players.forEach((pl, i) => { const t = pl.team ?? 0; if (t < tc) ros[t].push(i); });
    const cursors = [...(g.teamPlayerCursor || Array(tc).fill(0))];
    const curT = g.teamTurn || 0;
    if (ros[curT].length) cursors[curT] = (cursors[curT] + 1) % ros[curT].length;
    const nextTeam = (curT + 1) % tc;
    const nextTurn = ros[nextTeam][cursors[nextTeam] % ros[nextTeam].length];
    return { ...g, turn: nextTurn, teamTurn: nextTeam, teamPlayerCursor: cursors };
  }
  let turn = (g.turn + 1) % g.players.length;
  if (g.powerUpsEnabled) {
    let guards = 0;
    while (guards < g.players.length) {
      const np = g.players[turn] as any;
      if (np._frozenNext) {
        g = { ...g, players: g.players.map((pl, i) => i === turn ? clearVisitPowerUpFlags(pl) : pl) };
        const frozenPl = g.players[turn];
        const modeLabel = isBattle ? 'battle' : isKiller ? 'killer' : isHighScore ? 'highscore' : undefined;
        const visits = [...frozenPl.visits, { darts: [], scored: 0, remaining: isBattle ? frozenPl.hp : isKiller ? frozenPl.lives : frozenPl.score, leg: g.leg, frozen: true, mode: modeLabel, date: new Date().toISOString() }];
        g = { ...g, players: g.players.map((pl, i) => i === turn ? { ...pl, visits } : pl), thrownThisRound: [...(g.thrownThisRound || []), frozenPl.id] };
        popups.setFrozen({ name: frozenPl.name });
        toast(`${frozenPl.name} is frozen — visit skipped.`);
        turn = (turn + 1) % g.players.length;
        guards++;
      } else {
        break;
      }
    }
  }
  if (isBattle) {
    while (g.players[turn].defeated) turn = (turn + 1) % g.players.length;
  } else if (isKiller) {
    while (g.players[turn].eliminated) turn = (turn + 1) % g.players.length;
  } else if (isHighScore) {
    while (g.players[turn].visits.length >= HIGH_SCORE_VISITS) turn = (turn + 1) % g.players.length;
  }
  const checkedOutCount = g.checkedOutThisRound.length;
  const thrown = g.thrownThisRound || [];
  if (checkedOutCount > 0) {
    const legsToWin = Math.ceil(g.legsBestOf / 2);
    const anyReached = g.players.some(pl => g.checkedOutThisRound.includes(pl.id) && pl.legsWon >= (g.legsBestOf === 1 ? 1 : legsToWin));
    if (anyReached) {
      const MAX_CHECKOUT = 170;
      const playersLeftToThrow = g.players.filter(pl =>
        !g.checkedOutThisRound.includes(pl.id) && !thrown.includes(pl.id) && pl.score > 0);
      if (playersLeftToThrow.length === 0) {
        if (checkedOutCount > 1) { finishGame({ ...g, turn }, null, g.checkedOutThisRound, ctx); return { ...g, turn, finished: true }; }
        const winner = g.players.find(pl => g.checkedOutThisRound.includes(pl.id));
        if (winner) { finishGame({ ...g, turn }, winner, null, ctx); return { ...g, turn, finished: true }; }
      }
      const canTie = playersLeftToThrow.filter(pl => pl.score <= MAX_CHECKOUT);
      if (canTie.length === 0) {
        if (checkedOutCount > 1) { finishGame({ ...g, turn }, null, g.checkedOutThisRound, ctx); return { ...g, turn, finished: true }; }
        const winner = g.players.find(pl => g.checkedOutThisRound.includes(pl.id));
        if (winner) { finishGame({ ...g, turn }, winner, null, ctx); return { ...g, turn, finished: true }; }
      }
    }
  }
  return { ...g, turn };
}

export function finishGame(g: Game, winner: any, tiedIds: string[] | null, ctx: VisitContext): void {
  const { setGame, setGames, setPlayers, settings, popups, music, players, games } = ctx;
  if (g.finished) return;
  const isTie = !winner && tiedIds && tiedIds.length > 1;
  const winningTeam = g.winningTeam ?? null;
  const finished: Game = { ...g, finished: true, winner: winner ? winner.id : null, tied: !!isTie, tiedPlayers: isTie ? tiedIds : null, winningTeam };
  Sound.play('win', {}, settings);
  music.startContext('setup', settings);
  setGames((prev: GameRecord[]) => [...prev, recordFromGame(finished)]);
  if (!finished.practice) {
    if (finished.teamMode && winningTeam != null) {
      finished.players.filter(pl => pl.team === winningTeam).forEach(pl => awardXP(pl.id, settings.xpConfig.win, `Team ${winningTeam + 1} won`, settings, setPlayers, popups));
    } else if (winner) {
      awardXP(winner.id, settings.xpConfig.win, 'Winning the game', settings, setPlayers, popups);
    }
    if (isTie && tiedIds) tiedIds.forEach(pid => awardXP(pid, Math.round(settings.xpConfig.win / 2), 'Tied the game', settings, setPlayers, popups));
  }
  finished.players.forEach(pl => checkTitleUnlocks(pl, settings, popups, setPlayers, finished, players, games));
  awardBadges(finished, setPlayers);
  setGame(finished);
}
