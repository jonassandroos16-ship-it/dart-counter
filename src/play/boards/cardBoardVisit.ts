import type { Game, GameRecord, Player, Settings, Dart } from '../../types';
import { MODES, SCORE_POPUPS } from '../../constants';
import { computeBattleDartDamage } from '../../logic';
import { Sound } from '../../sound';
import type { MusicEngine } from '../../music';
import type { PopupControls } from '../../Popups';
import { tickShield } from '../dart';
import { runMilestones } from '../rewards';
import { finishSimpleGame } from '../finish';
import type { CardPlayState } from '../../cards/types';
import { advanceTurn, finishGame, type VisitContext } from './cardBoardLogic';

const HIGH_SCORE_VISITS = 7;

export interface EnterVisitParams {
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
  state: CardPlayState;
  endedState: CardPlayState;
  isMyTurn: boolean;
}

export function enterVisit(params: EnterVisitParams): void {
  const { game, setGame, settings, players, games, setGames, setPlayers, toast, music, popups, targetId, setTargetId, endedState } = params;
  if (!game.darts.length) { toast('Play at least one damage card'); return; }
  const scored = game.darts.reduce((a, d) => a + d.value, 0);
  const newPlayers = game.players.map((pl, i) => i === game.turn ? { ...pl } : pl);
  const cur = newPlayers[game.turn] as any;
  const resetBonus = { ...game, bonusSlots: 0 };
  const isBattle = game.mode === 'battle';
  const isKiller = game.mode === 'killer';
  const isHighScore = game.mode === 'highscore';

  const ctx: VisitContext & { isBattle: boolean; isKiller: boolean; isHighScore: boolean } = {
    game, setGame, settings, players, games, setGames, setPlayers, toast, music, popups, targetId, setTargetId,
    isBattle, isKiller, isHighScore,
  };

  if (game.practice) {
    cur.score += scored;
    cur.visits.push({ darts: [...game.darts], scored, remaining: cur.score, leg: 1, date: new Date().toISOString() });
    Sound.play('enter', {}, settings);
    const next = advanceTurn({ ...resetBonus, players: newPlayers, darts: [], mult: 1, cardState: { ...game.cardState, [cur.id]: endedState } }, ctx);
    setGame(next);
    runMilestones(cur, cur.score, scored, settings, popups, setPlayers, { ...game, players: newPlayers }, players, games);
    return;
  }

  if (isBattle) {
    const power = cur.powerPct || 0;
    let target = targetId;
    const aliveTargets = newPlayers.filter((pl: any) => pl.id !== cur.id && !pl.defeated);
    if (aliveTargets.length === 1) target = aliveTargets[0].id;
    if (!target) { toast('Pick a target to attack'); return; }
    const victim = newPlayers.find((pl: any) => pl.id === target);
    if (!victim || victim.defeated) { toast('That opponent is already defeated'); return; }
    const armor = victim.armorPct || 0;
    let totalDamage = 0;
    let hp = victim.hp || 0;
    for (const d of game.darts as Dart[]) {
      const dmg = computeBattleDartDamage(d.value, power, armor, settings);
      totalDamage += dmg;
      hp = Math.max(0, hp - dmg);
    }
    victim.hp = hp;
    cur.damageDealt = (cur.damageDealt || 0) + totalDamage;
    victim.damageTaken = (victim.damageTaken || 0) + totalDamage;
    cur.attacks = [...(cur.attacks || []), { target: victim.id, damage: totalDamage, visit: cur.visits.length + 1, date: new Date().toISOString() }];
    cur.score += scored;
    cur.visits.push({ darts: [...game.darts], scored, remaining: cur.hp, leg: 1, mode: 'battle', date: new Date().toISOString() });
    cur.dartsThrown += game.darts.length;
    Sound.play('impact', {}, settings);
    if (victim.hp <= 0 && !victim.defeated) {
      victim.defeated = true;
      popups.setKill({ killer: cur.name, victim: victim.name });
      Sound.play('kill', {}, settings);
    }
    if (settings.popups.scores) {
      for (const sp of SCORE_POPUPS) { if (scored >= sp.min) { popups.setMilestone({ emoji: sp.emoji, title: sp.title, sub: sp.sub }); Sound.play('milestone', {}, settings); break; } }
    }
    const finishedState: Game = { ...resetBonus, players: newPlayers, darts: [], mult: 1 };
    const remainingAlive = newPlayers.filter((pl: any) => !pl.defeated);
    if (remainingAlive.length <= 1) {
      const winner = remainingAlive[0] || null;
      setTimeout(() => finishSimpleGame(finishedState, winner, settings, setGame, setGames, setPlayers, popups, music, [], []), 200);
      return;
    }
    const next = advanceTurn({ ...finishedState, cardState: { ...game.cardState, [cur.id]: endedState } }, ctx);
    setGame(next);
    return;
  }

  if (isKiller) {
    const isKillerAlready = (cur.killerHits || 0) >= 5;
    let killedThisVisit: { killer: string; victim: string } | null = null;
    for (const dart of game.darts) {
      if (dart.base === 0) continue;
      if (!isKillerAlready) {
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
    cur.visits.push({ darts: [...game.darts], scored, remaining: cur.lives, leg: 1, mode: 'killer', date: new Date().toISOString(), hits: (cur.kills || []).length });
    cur.dartsThrown += game.darts.length;
    const remainingAlive = newPlayers.filter(pl => !pl.eliminated);
    const finishedState = { ...resetBonus, players: newPlayers, darts: [], mult: 1 };
    if (remainingAlive.length <= 1) {
      const winner = remainingAlive[0] || null;
      if (killedThisVisit) popups.setKill(killedThisVisit);
      setTimeout(() => finishSimpleGame(finishedState, winner, settings, setGame, setGames, setPlayers, popups, music, [], []), killedThisVisit ? 2200 : 0);
      return;
    }
    Sound.play('enter', {}, settings);
    if (killedThisVisit) popups.setKill(killedThisVisit);
    const next = advanceTurn({ ...finishedState, cardState: { ...game.cardState, [cur.id]: endedState } }, ctx);
    setGame(next);
    return;
  }

  if (isHighScore) {
    cur.score += scored;
    cur.visits.push({ darts: [...game.darts], scored, remaining: cur.score, leg: 1, mode: 'highscore', date: new Date().toISOString() });
    cur.dartsThrown += game.darts.length;
    Sound.play('enter', {}, settings);
    if (settings.popups.scores) {
      for (const sp of SCORE_POPUPS) { if (scored >= sp.min) { popups.setMilestone({ emoji: sp.emoji, title: sp.title, sub: sp.sub }); Sound.play('milestone', {}, settings); break; } }
    }
    const allDone = newPlayers.every(pl => pl.visits.length >= HIGH_SCORE_VISITS);
    const finishedState = { ...resetBonus, players: newPlayers, darts: [], mult: 1 };
    if (allDone) {
      const maxScore = Math.max(...newPlayers.map(pl => pl.score));
      const winners = newPlayers.filter(pl => pl.score === maxScore);
      const winner = winners.length === 1 ? winners[0] : null;
      finishSimpleGame(finishedState, winner, settings, setGame, setGames, setPlayers, popups, music, [], []);
      return;
    }
    const next = advanceTurn({ ...finishedState, cardState: { ...game.cardState, [cur.id]: endedState } }, ctx);
    setGame(next);
    return;
  }

  // X01 mode
  const remaining = cur.score - scored;
  const lastDart = game.darts[game.darts.length - 1];
  const bust = remaining < 0 || (remaining === 1 && game.doubleOut) || (remaining === 0 && game.doubleOut && !lastDart.isDouble);

  if (remaining === 0 && (!game.doubleOut || lastDart.isDouble)) {
    cur.visits.push({ darts: [...game.darts], scored, remaining: 0, leg: game.leg, checkout: scored, date: new Date().toISOString() });
    cur.score = 0; cur.legsWon++;
    if (game.teamMode) {
      newPlayers.forEach(pl => { if (pl.team === cur.team) pl.score = 0; });
      const teamLegs = [...(game.teamLegsWon || [])];
      teamLegs[cur.team!] = (teamLegs[cur.team!] || 0) + 1;
      const legsToWin = Math.ceil(game.legsBestOf / 2);
      const teamWonMatch = teamLegs[cur.team!] >= (game.legsBestOf === 1 ? 1 : legsToWin);
      if (teamWonMatch) {
        const visitCtx: VisitContext = { game: { ...resetBonus, players: newPlayers, teamLegsWon: teamLegs, darts: [], mult: 1, winningTeam: cur.team, cardState: { ...game.cardState, [cur.id]: endedState } }, setGame, settings, players, games, setGames, setPlayers, toast, music, popups, targetId, setTargetId };
        finishGame(visitCtx.game, null, null, visitCtx);
        return;
      }
      const nextLeg = game.leg + 1;
      newPlayers.forEach(pl => pl.score = MODES[game.mode].start);
      const tc = game.teamCount || 2;
      const nextTeam = ((game.teamTurn || 0) + 1) % tc;
      const cursors = [...(game.teamPlayerCursor || Array(tc).fill(0))];
      const ros: number[][] = Array.from({ length: tc }, () => []);
      newPlayers.forEach((pl, i) => { const t = pl.team ?? 0; if (t < tc) ros[t].push(i); });
      const nextTurn = ros[nextTeam][cursors[nextTeam] % ros[nextTeam].length];
      Sound.play('win', {}, settings);
      toast(`Team ${cur.team! + 1} wins leg ${game.leg}`);
      setGame({ ...resetBonus, players: newPlayers, leg: nextLeg, turn: nextTurn, teamTurn: nextTeam, teamLegsWon: teamLegs, roundStartTurn: nextTurn, checkedOutThisRound: [], thrownThisRound: [], darts: [], mult: 1, cardState: { ...game.cardState, [cur.id]: endedState } });
      return;
    }
    const checkedOut = [...game.checkedOutThisRound, cur.id];
    const thrown = [...game.thrownThisRound, cur.id];
    const legsToWin = Math.ceil(game.legsBestOf / 2);
    const reachedThreshold = cur.legsWon >= (game.legsBestOf === 1 ? 1 : legsToWin);
    if (reachedThreshold) {
      const MAX_CHECKOUT = 170;
      const playersLeft = newPlayers.filter(pl => !checkedOut.includes(pl.id) && pl.score > 0);
      const canTie = playersLeft.filter(pl => pl.score <= MAX_CHECKOUT);
      if (playersLeft.length > 0 && canTie.length === playersLeft.length) {
        toast(`${cur.name} checked out! ${playersLeft.length} player${playersLeft.length > 1 ? 's' : ''} left to tie.`);
        Sound.play('win', {}, settings);
        const next = advanceTurn({ ...resetBonus, players: newPlayers, checkedOutThisRound: checkedOut, thrownThisRound: thrown, darts: [], mult: 1, cardState: { ...game.cardState, [cur.id]: endedState } }, ctx);
        setGame(next);
        return;
      }
      const visitCtx: VisitContext = { game: { ...resetBonus, players: newPlayers, checkedOutThisRound: checkedOut, thrownThisRound: thrown, darts: [], mult: 1, cardState: { ...game.cardState, [cur.id]: endedState } }, setGame, settings, players, games, setGames, setPlayers, toast, music, popups, targetId, setTargetId };
      if (checkedOut.length > 1) { finishGame(visitCtx.game, null, checkedOut, visitCtx); return; }
      finishGame(visitCtx.game, cur, null, visitCtx);
      return;
    }
    const nextLeg = game.leg + 1;
    const nextTurn = (nextLeg - 1) % game.players.length;
    newPlayers.forEach(pl => pl.score = MODES[game.mode].start);
    if (game.powerUpsEnabled) newPlayers[game.turn] = tickShield(newPlayers[game.turn]);
    Sound.play('win', {}, settings);
    toast(`${cur.name} wins leg ${game.leg}`);
    setGame({ ...resetBonus, players: newPlayers, leg: nextLeg, turn: nextTurn, roundStartTurn: nextTurn, checkedOutThisRound: [], thrownThisRound: [], darts: [], mult: 1, cardState: { ...game.cardState, [cur.id]: endedState } });
    return;
  }

  if (bust) {
    cur.visits.push({ darts: [...game.darts], scored: 0, remaining: cur.score, leg: game.leg, bust: true, date: new Date().toISOString() });
    Sound.play('bust', {}, settings);
    toast('Bust!');
    const thrown = [...game.thrownThisRound, cur.id];
    const next = advanceTurn({ ...resetBonus, players: newPlayers, thrownThisRound: thrown, darts: [], mult: 1, cardState: { ...game.cardState, [cur.id]: endedState } }, ctx);
    setGame(next);
    return;
  }

  cur.score = remaining;
  if (game.teamMode) newPlayers.forEach(pl => { if (pl.team === cur.team && pl.id !== cur.id) pl.score = remaining; });
  cur.visits.push({ darts: [...game.darts], scored, remaining, leg: game.leg, date: new Date().toISOString() });
  Sound.play('enter', {}, settings);
  const thrown = [...game.thrownThisRound, cur.id];
  const next = advanceTurn({ ...resetBonus, players: newPlayers, thrownThisRound: thrown, darts: [], mult: 1, cardState: { ...game.cardState, [cur.id]: endedState } }, ctx);
  setGame(next);
  runMilestones(cur, remaining, scored, settings, popups, setPlayers, { ...game, players: newPlayers }, players, games);
}
