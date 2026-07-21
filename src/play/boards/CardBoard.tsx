import { useEffect, useState } from 'react';
import type { Game, GameRecord, Player, Settings, Dart } from '../../types';
import { TEAM_COLORS, getTitleInfo, MODES, SCORE_POPUPS } from '../../constants';
import { recordFromGame, checkoutHint, leadTrailBadge, visitAvg, levelFromXP, getPlayerXPById, computeBattleDartDamage } from '../../logic';
import { Sound } from '../../sound';
import type { MusicEngine } from '../../music';
import type { PopupControls } from '../../Popups';
import { AttributeStrip, BadgeAvatar } from '../common';
import { clearVisitPowerUpFlags, tickShield } from '../dart';
import { runMilestones, awardXP, checkTitleUnlocks, awardBadges } from '../rewards';
import { finishSimpleGame } from '../finish';
import { GameOver } from '../GameOver';
import type { PlayerCard, CardDef, CardPlayState } from '../../cards/types';
import { cardDamage, cardRarityColor, cardTypeColor } from '../../cards/definitions';
import {
  defaultPlayerCards, resolveCardDef, initCardPlayState, startTurn,
  playCardFromHand, endTurn, MAX_PLAYS_PER_TURN,
} from '../../cards/deck';

const HIGH_SCORE_VISITS = 7;

export function CardBoard({ game, setGame, settings, players, games, setGames, setPlayers, toast, music, onQuit, onGameOver, popups }: {
  game: Game; setGame: (g: Game | null) => void; settings: Settings; players: Player[]; games: GameRecord[];
  setGames: (updater: any) => void; setPlayers: (updater: any) => void; toast: (m: string) => void;
  music: MusicEngine; onQuit: () => void; onGameOver: () => void; popups: PopupControls;
}) {
  const [, force] = useState(0);
  const [targetId, setTargetId] = useState<string | null>(null);

  // Initialize per-player deck-builder state the first time CardBoard mounts.
  // Each player's collection becomes their draw deck, shuffled.
  useEffect(() => {
    if (game.cardState && Object.keys(game.cardState).length === game.players.length) return;
    const cardState: Record<string, CardPlayState> = {};
    for (const gp of game.players) {
      const playerData = players.find(pl => pl.id === gp.id);
      const collection: PlayerCard[] = (playerData?.cards && playerData.cards.length > 0 ? playerData.cards : defaultPlayerCards());
      cardState[gp.id] = initCardPlayState(collection);
    }
    setGame({ ...game, cardState });
  }, [game.players.length]);

  // Ensure the current player has a hand drawn for their turn.
  useEffect(() => {
    if (!game.cardState) return;
    const p = game.players[game.turn];
    const state = game.cardState[p.id];
    if (!state) return;
    if (state.hand.length === 0 && state.used.length === 0) {
      const next = startTurn(state);
      setGame({ ...game, cardState: { ...game.cardState, [p.id]: next } });
    }
  }, [game.turn, game.cardState]);

  if (game.finished) return <GameOver game={game} onNewGame={() => { setGame(null); onGameOver(); music.startContext('setup', settings); }} onViewStats={() => { setGame(null); onGameOver(); }} />;

  const p = game.players[game.turn];
  const playerData = players.find(pl => pl.id === p.id);
  const collection: PlayerCard[] = (playerData?.cards && playerData.cards.length > 0 ? playerData.cards : defaultPlayerCards());
  const state: CardPlayState = game.cardState?.[p.id] ?? initCardPlayState(collection);
  const handDefs = state.hand.map(pc => resolveCardDef(pc)).filter(Boolean) as CardDef[];
  const usedDefs = state.used.map(pc => resolveCardDef(pc)).filter(Boolean) as CardDef[];

  const isBattle = game.mode === 'battle';
  const isKiller = game.mode === 'killer';
  const isHighScore = game.mode === 'highscore';
  const buffScored = game.darts.reduce((a, d) => a + d.value, 0);
  const projected = game.practice ? p.score + buffScored : p.score - buffScored;
  const others = [...game.players.slice(game.turn + 1), ...game.players.slice(0, game.turn)];
  const throwOrder = (idx: number) => (idx - game.roundStartTurn + game.players.length) % game.players.length;
  const curTeam = game.teamMode ? (p.team ?? 0) : -1;
  const curTeamColor = game.teamMode ? TEAM_COLORS[curTeam % TEAM_COLORS.length] : p.color;

  // Battle mode: auto-select target when only one alive opponent.
  const aliveOthers = isBattle ? others.filter(pl => !pl.defeated) : [];
  useEffect(() => {
    if (isBattle) {
      if (aliveOthers.length === 1) setTargetId(aliveOthers[0].id);
      else setTargetId(null);
    }
  }, [game.turn, aliveOthers.length, isBattle]);

  const playCard = (handIdx: number) => {
    const card = handDefs[handIdx];
    if (!card) return;
    if (card.type !== 'damage') {
      toast(`${card.name}: ${card.desc}`);
      return;
    }
    if (game.darts.length >= MAX_PLAYS_PER_TURN) { toast(`Only ${MAX_PLAYS_PER_TURN} cards per visit`); return; }
    const updated = playCardFromHand(state, handIdx);
    if (!updated) return;
    const base = card.base ?? 0;
    const mult = card.mult ?? 1;
    const isBull = base === 50;
    const value = cardDamage(card);
    const label = card.name;
    const dart = { value, label, base, mult: isBull ? 2 : (base === 25 && value === 50 ? 2 : mult), isDouble: !!(isBull || (base === 25 && value === 50) || mult === 2), isOuter: false };
    Sound.play('dart', { score: value }, settings);
    setGame({
      ...game,
      darts: [...game.darts, dart],
      mult: 1,
      cardState: { ...game.cardState, [p.id]: updated },
    });
    force(n => n + 1);
  };

  const undoCard = () => {
    if (!game.darts.length) return;
    const lastDart = game.darts[game.darts.length - 1];
    // Find the matching used card (last played) and return it to the hand.
    const usedIdx = [...state.used].reverse().findIndex(pc => {
      const def = resolveCardDef(pc);
      return def?.name === lastDart.label;
    });
    if (usedIdx === -1) {
      setGame({ ...game, darts: game.darts.slice(0, -1) });
      return;
    }
    const realIdx = state.used.length - 1 - usedIdx;
    const card = state.used[realIdx];
    const updated: CardPlayState = {
      deck: state.deck,
      hand: [...state.hand, card],
      used: state.used.filter((_, i) => i !== realIdx),
      graveyard: state.graveyard,
    };
    setGame({ ...game, darts: game.darts.slice(0, -1), cardState: { ...game.cardState, [p.id]: updated } });
    force(n => n + 1);
  };

  const enterVisit = () => {
    if (!game.darts.length) { toast('Play at least one damage card'); return; }
    const scored = game.darts.reduce((a, d) => a + d.value, 0);
    const newPlayers = game.players.map((pl, i) => i === game.turn ? { ...pl } : pl);
    const cur = newPlayers[game.turn] as any;

    // Move the current player's used pile into the graveyard (end of turn).
    const endedState = endTurn(state);

    if (game.practice) {
      cur.score += scored;
      cur.visits.push({ darts: [...game.darts], scored, remaining: cur.score, leg: 1, date: new Date().toISOString() });
      Sound.play('enter', {}, settings);
      const next = advanceTurn({ ...game, players: newPlayers, darts: [], mult: 1, cardState: { ...game.cardState, [p.id]: endedState } });
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
      const finishedState: Game = { ...game, players: newPlayers, darts: [], mult: 1 };
      const remainingAlive = newPlayers.filter((pl: any) => !pl.defeated);
      if (remainingAlive.length <= 1) {
        const winner = remainingAlive[0] || null;
        setTimeout(() => finishSimpleGame(finishedState, winner, settings, setGame, setGames, setPlayers, popups, music, [], []), 200);
        return;
      }
      const next = advanceTurn({ ...finishedState, cardState: { ...game.cardState, [p.id]: endedState } });
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
      const finishedState = { ...game, players: newPlayers, darts: [], mult: 1 };
      if (remainingAlive.length <= 1) {
        const winner = remainingAlive[0] || null;
        if (killedThisVisit) popups.setKill(killedThisVisit);
        setTimeout(() => finishSimpleGame(finishedState, winner, settings, setGame, setGames, setPlayers, popups, music, [], []), killedThisVisit ? 2200 : 0);
        return;
      }
      Sound.play('enter', {}, settings);
      if (killedThisVisit) popups.setKill(killedThisVisit);
      const next = advanceTurn({ ...finishedState, cardState: { ...game.cardState, [p.id]: endedState } });
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
      const finishedState = { ...game, players: newPlayers, darts: [], mult: 1 };
      if (allDone) {
        const maxScore = Math.max(...newPlayers.map(pl => pl.score));
        const winners = newPlayers.filter(pl => pl.score === maxScore);
        const winner = winners.length === 1 ? winners[0] : null;
        finishSimpleGame(finishedState, winner, settings, setGame, setGames, setPlayers, popups, music, [], []);
        return;
      }
      const next = advanceTurn({ ...finishedState, cardState: { ...game.cardState, [p.id]: endedState } });
      setGame(next);
      return;
    }

    // x01 modes (501, 301, 701, 101, speed101)
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
          finishGame({ ...game, players: newPlayers, teamLegsWon: teamLegs, darts: [], mult: 1, winningTeam: cur.team, cardState: { ...game.cardState, [p.id]: endedState } }, null, null);
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
        setGame({ ...game, players: newPlayers, leg: nextLeg, turn: nextTurn, teamTurn: nextTeam, teamLegsWon: teamLegs, roundStartTurn: nextTurn, checkedOutThisRound: [], thrownThisRound: [], darts: [], mult: 1, cardState: { ...game.cardState, [p.id]: endedState } });
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
          const next = advanceTurn({ ...game, players: newPlayers, checkedOutThisRound: checkedOut, thrownThisRound: thrown, darts: [], mult: 1, cardState: { ...game.cardState, [p.id]: endedState } });
          setGame(next);
          return;
        }
        if (checkedOut.length > 1) { finishGame({ ...game, players: newPlayers, checkedOutThisRound: checkedOut, thrownThisRound: thrown, darts: [], mult: 1, cardState: { ...game.cardState, [p.id]: endedState } }, null, checkedOut); return; }
        finishGame({ ...game, players: newPlayers, checkedOutThisRound: checkedOut, thrownThisRound: thrown, darts: [], mult: 1, cardState: { ...game.cardState, [p.id]: endedState } }, cur, null);
        return;
      }
      const nextLeg = game.leg + 1;
      const nextTurn = (nextLeg - 1) % game.players.length;
      newPlayers.forEach(pl => pl.score = MODES[game.mode].start);
      if (game.powerUpsEnabled) newPlayers[game.turn] = tickShield(newPlayers[game.turn]);
      Sound.play('win', {}, settings);
      toast(`${cur.name} wins leg ${game.leg}`);
      setGame({ ...game, players: newPlayers, leg: nextLeg, turn: nextTurn, roundStartTurn: nextTurn, checkedOutThisRound: [], thrownThisRound: [], darts: [], mult: 1, cardState: { ...game.cardState, [p.id]: endedState } });
      return;
    }

    if (bust) {
      cur.visits.push({ darts: [...game.darts], scored: 0, remaining: cur.score, leg: game.leg, bust: true, date: new Date().toISOString() });
      Sound.play('bust', {}, settings);
      toast('Bust!');
      const thrown = [...game.thrownThisRound, cur.id];
      const next = advanceTurn({ ...game, players: newPlayers, thrownThisRound: thrown, darts: [], mult: 1, cardState: { ...game.cardState, [p.id]: endedState } });
      setGame(next);
      return;
    }

    cur.score = remaining;
    if (game.teamMode) newPlayers.forEach(pl => { if (pl.team === cur.team && pl.id !== cur.id) pl.score = remaining; });
    cur.visits.push({ darts: [...game.darts], scored, remaining, leg: game.leg, date: new Date().toISOString() });
    Sound.play('enter', {}, settings);
    const thrown = [...game.thrownThisRound, cur.id];
    const next = advanceTurn({ ...game, players: newPlayers, thrownThisRound: thrown, darts: [], mult: 1, cardState: { ...game.cardState, [p.id]: endedState } });
    setGame(next);
    runMilestones(cur, remaining, scored, settings, popups, setPlayers, { ...game, players: newPlayers }, players, games);
  };

  const advanceTurn = (g: Game): Game => {
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
    // Skip defeated (battle), eliminated (killer), or finished (highscore) players.
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
          if (checkedOutCount > 1) { finishGame({ ...g, turn }, null, g.checkedOutThisRound); return { ...g, turn, finished: true }; }
          const winner = g.players.find(pl => g.checkedOutThisRound.includes(pl.id));
          if (winner) { finishGame({ ...g, turn }, winner, null); return { ...g, turn, finished: true }; }
        }
        const canTie = playersLeftToThrow.filter(pl => pl.score <= MAX_CHECKOUT);
        if (canTie.length === 0) {
          if (checkedOutCount > 1) { finishGame({ ...g, turn }, null, g.checkedOutThisRound); return { ...g, turn, finished: true }; }
          const winner = g.players.find(pl => g.checkedOutThisRound.includes(pl.id));
          if (winner) { finishGame({ ...g, turn }, winner, null); return { ...g, turn, finished: true }; }
        }
      }
    }
    return { ...g, turn };
  };

  const finishGame = (g: Game, winner: any, tiedIds: string[] | null) => {
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
  };

  const damageCards = handDefs.filter(c => c.type === 'damage');
  const spellCards = handDefs.filter(c => c.type === 'spell');
  const utilityCards = handDefs.filter(c => c.type === 'utility');

  const hpPct = (pl: any) => Math.max(0, Math.min(100, ((pl.hp || 0) / (pl.maxHp || 1)) * 100));
  const aliveCount = isBattle ? game.players.filter(pl => !pl.defeated).length : isKiller ? game.players.filter(pl => !pl.eliminated).length : 0;

  return (
    <div className="view-noscroll">
      <button className="btn danger sm quit-float" onClick={() => { if (confirm('Quit this game? Progress will not be saved.')) onQuit(); }}>Quit</button>
      <div className="play-current" style={game.teamMode ? { borderColor: curTeamColor, boxShadow: `0 0 0 2px ${curTeamColor}33` } : {}}>
        <div className="pc-header">
          <div className="row" style={{ gap: 8 }}>
            <span className={`turn-order-badge${game.turn === game.roundStartTurn ? ' starter' : ''}`}>{throwOrder(game.turn) + 1}</span>
            <BadgeAvatar playerId={p.id} players={players} games={games} size={32} fontSize={16} color={p.color} />
            <span className="pc-name">{p.name}</span>
            {game.teamMode && <span className="pill" style={{ background: curTeamColor, color: '#04150a' }}>Team {curTeam + 1}</span>}
            {isKiller && (p.killerHits || 0) >= 5 && <span className="pill" style={{ background: '#ef4444', color: '#fff', fontSize: 10 }}>KILLER</span>}
          </div>
          <div className="row" style={{ gap: 6 }}>
            {!game.teamMode && game.legsBestOf > 1 && !isBattle && !isKiller && !isHighScore ? <span className="pill">{p.legsWon} legs</span> : null}
            <span className="muted small">
              {isBattle ? `BATTLE · ${aliveCount} ALIVE` :
               isKiller ? `KILLER · ${aliveCount} ALIVE` :
               isHighScore ? `HIGH SCORE · VISIT ${(p.visits.length || 0) + 1}/${HIGH_SCORE_VISITS}` :
               game.practice ? 'PRACTICE' : `LEG ${game.leg} · ${game.doubleOut ? 'DOUBLE OUT' : 'STRAIGHT OUT'}`}
            </span>
          </div>
        </div>
        {isBattle ? (
          <>
            <div className="pc-remaining" style={{ fontSize: 28 }}>{p.hp} HP</div>
            <div className="checkout-hint center">{'\u2764\uFE0F'} {p.hp}/{p.maxHp} · {'\u{1F6E1}\uFE0F'} {p.armorPct}% armor · {'\u26A1'} {p.powerPct} power</div>
            <div style={{ width: '100%', height: 8, borderRadius: 4, background: 'var(--bg-3)', overflow: 'hidden', margin: '4px 0' }}>
              <div style={{ height: '100%', width: `${hpPct(p)}%`, background: p.color, transition: 'width .3s' }} />
            </div>
          </>
        ) : isKiller ? (
          <>
            <div className="pc-remaining" style={{ fontSize: 28 }}>
              {(p.killerHits || 0) >= 5 ? '\u{1F3AF} Aim at opponents' : `Hit ${p.killerNumber}`}
            </div>
            <div className="checkout-hint center">
              {(p.killerHits || 0) < 5 ? `Become a Killer: ${p.killerHits || 0}/5 hits on ${p.killerNumber}` : 'Hit opponent numbers to eliminate them'}
            </div>
            <div className="muted small">Lives: <b style={{ color: 'var(--text)' }}>{'\u2764\uFE0F'.repeat(p.lives || 0) || 'none'}</b></div>
          </>
        ) : isHighScore ? (
          <>
            <div className="pc-remaining">{p.score + buffScored}</div>
            <div className="checkout-hint center">{(p.visits.length || 0) + 1 >= HIGH_SCORE_VISITS ? 'Final visit — go big!' : 'Score as high as you can!'}</div>
          </>
        ) : (
          <>
            <div className="pc-remaining" style={{ color: projected < 0 ? 'var(--danger)' : 'var(--text)' }}>{projected}</div>
            <div className="checkout-hint center">{checkoutHint(game.practice ? null : projected, game.doubleOut, game.practice)}</div>
          </>
        )}
        <div className="pc-slots">
          {Array.from({ length: MAX_PLAYS_PER_TURN }).map((_, i) => { const d = game.darts[i]; return <div key={i} className={`pc-slot${d ? ' filled' : ''}`}>{d ? d.label : '\u2013'}</div>; })}
        </div>
        <div className="muted small">
          This visit: <b style={{ color: 'var(--text)' }}>{buffScored}</b> · Cards played: <b style={{ color: 'var(--text)' }}>{game.darts.length}</b>/{MAX_PLAYS_PER_TURN}
          {isBattle && <span style={{ marginLeft: 8 }}> · {buffScored} dmg</span>}
        </div>
        {isBattle && aliveOthers.length > 1 && (
          <div style={{ width: '100%', marginTop: 6 }}>
            <div className="muted small" style={{ marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>Attack target</div>
            <div className="row wrap" style={{ gap: 6 }}>
              {aliveOthers.map(pl => (
                <button key={pl.id} className="pill" style={{ background: targetId === pl.id ? pl.color : 'var(--bg-3)', color: targetId === pl.id ? '#0b0e13' : 'var(--text)', cursor: 'pointer' }}
                  onClick={() => setTargetId(pl.id)}>
                  <BadgeAvatar playerId={pl.id} players={players} games={games} size={18} fontSize={9} color={targetId === pl.id ? 'rgba(0,0,0,.2)' : pl.color} />{pl.name}
                </button>
              ))}
            </div>
          </div>
        )}
        <AttributeStrip playerId={p.id} players={players} mode={game.mode} />
      </div>

      {game.players.length > 1 && (
        <div className="play-others">
          {others.map(pl => {
            const xpInfo = getPlayerXPById(pl.id, players);
            const li = levelFromXP(xpInfo.xp, settings);
            const ti = getTitleInfo(xpInfo.selectedTitle, settings.customTitles);
            const badge = leadTrailBadge(pl, game);
            const plTeam = game.teamMode ? (pl.team ?? 0) : -1;
            const plTeamColor = game.teamMode ? TEAM_COLORS[plTeam % TEAM_COLORS.length] : pl.color;
            const defeated = isBattle && pl.defeated;
            const eliminated = isKiller && pl.eliminated;
            const hidden = defeated || eliminated;
            return (
              <div key={pl.id} className="play-other" style={{ ...(hidden ? { opacity: 0.4, filter: 'grayscale(.6)' } : {}), ...(game.teamMode ? { borderColor: plTeamColor } : {}) }}>
                <div className="row between">
                  <div className="row" style={{ gap: 6 }}>
                    <span className={`turn-order-badge${game.players.indexOf(pl) === game.roundStartTurn ? ' starter' : ''}`} style={{ width: 18, height: 18, fontSize: 10 }}>{throwOrder(game.players.indexOf(pl)) + 1}</span>
                    <BadgeAvatar playerId={pl.id} players={players} games={games} size={22} fontSize={12} color={pl.color} />
                    <span className="po-name">{pl.name}</span>
                    {game.teamMode && <span style={{ fontSize: 9, fontWeight: 800, color: plTeamColor }}>T{plTeam + 1}</span>}
                    {isKiller && (pl.killerHits || 0) >= 5 && !eliminated && <span className="pill" style={{ background: '#ef4444', color: '#fff', fontSize: 9 }}>KILLER</span>}
                    {defeated && <span className="pill" style={{ fontSize: 9, background: '#ef4444', color: '#fff' }}>DEFEATED</span>}
                    {eliminated && <span className="pill" style={{ fontSize: 9, background: '#ef4444', color: '#fff' }}>ELIMINATED</span>}
                  </div>
                  <div className="row" style={{ gap: 4 }}>
                    {!game.teamMode && game.legsBestOf > 1 && !isBattle && !isKiller && !isHighScore ? <span className="pill" style={{ fontSize: 10 }}>{pl.legsWon}</span> : null}
                    {isBattle ? <span className="pill" style={{ fontSize: 10 }}>{pl.hp} HP</span> :
                     isKiller ? <span className="pill" style={{ fontSize: 10 }}>{'\u2764\uFE0F'.repeat(pl.lives || 0) || '\u{1F480}'}</span> :
                     isHighScore ? <span className="pill" style={{ fontSize: 10 }}>{pl.visits.length}/{HIGH_SCORE_VISITS}</span> :
                     badge ? <span className={`lead-badge ${badge.startsWith('+') ? 'lead' : 'trail'}`}>{badge}</span> : null}
                  </div>
                </div>
                {isBattle ? (
                  <>
                    <div style={{ marginTop: 4, height: 6, borderRadius: 3, background: 'var(--bg-3)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${hpPct(pl)}%`, background: pl.color, transition: 'width .3s' }} />
                    </div>
                    <div className="po-sub">{'\u{1F6E1}\uFE0F'} {pl.armorPct}% · {'\u26A1'} {pl.powerPct}{pl.damageDealt ? ` · {'\u{1F4A5}'} ${pl.damageDealt}` : ''}</div>
                  </>
                ) : isKiller ? (
                  <>
                    <div className="po-score">#{pl.killerNumber}</div>
                    <div className="po-sub">{(pl.killerHits || 0) >= 5 ? 'Killer' : `${pl.killerHits || 0}/5 to kill`} · {pl.kills?.length || 0} kills</div>
                  </>
                ) : isHighScore ? (
                  <>
                    <div className="po-score">{pl.score}</div>
                    <div className="po-sub">avg {visitAvg(pl).toFixed(1)}</div>
                  </>
                ) : (
                  <>
                    <div className="po-score">{pl.score}</div>
                    <div className="po-sub">avg {visitAvg(pl).toFixed(1)} · {pl.visits.reduce((a, v) => a + v.darts.length, 0)} {'\u{1F3AF}'} · L{li.level}{ti ? ` · ${ti.icon || ''} ${ti.name}` : ''}</div>
                    <AttributeStrip playerId={pl.id} players={players} mode={game.mode} />
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="play-input">
        <div className="pad-card">
          <div className="muted small" style={{ marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>Your Hand — {p.name}</div>
          <PileBar deckCount={state.deck.length} handCount={state.hand.length} usedCount={state.used.length} graveyardCount={state.graveyard.length} />
          <CardSection title="Damage" cards={damageCards} onPlay={playCard} disabled={game.darts.length >= MAX_PLAYS_PER_TURN} typeColor="#ef4444" />
          {spellCards.length > 0 && <CardSection title="Spells" cards={spellCards} onPlay={playCard} disabled={false} typeColor="#3b82f6" />}
          {utilityCards.length > 0 && <CardSection title="Utility" cards={utilityCards} onPlay={playCard} disabled={false} typeColor="#3b82f6" />}
          {usedDefs.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div className="muted small" style={{ marginBottom: 4, fontWeight: 600 }}>Used this turn (cannot replay)</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', opacity: 0.55 }}>
                {usedDefs.map((card, idx) => (
                  <div key={idx} style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                    padding: '6px 8px', borderRadius: 8, minWidth: 52,
                    background: 'var(--bg-3)', border: `1px solid ${cardRarityColor(card.rarity)}`,
                  }}>
                    <span style={{ fontSize: 18 }}>{card.icon}</span>
                    <span style={{ fontSize: 10, fontWeight: 800 }}>{card.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="row" style={{ gap: 8, marginTop: 8 }}>
            <button className="btn block ghost" onClick={undoCard}>{'\u21B6'} Undo card</button>
            <button className="btn block primary" onClick={enterVisit}>{isBattle ? 'Attack!' : 'Enter visit'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PileBar({ deckCount, handCount, usedCount, graveyardCount }: { deckCount: number; handCount: number; usedCount: number; graveyardCount: number }) {
  const piles: { label: string; value: number; icon: string }[] = [
    { label: 'Deck', value: deckCount, icon: '\u{1F0A0}' },
    { label: 'Hand', value: handCount, icon: '\u270B' },
    { label: 'Used', value: usedCount, icon: '\u{1F5D1}\uFE0F' },
    { label: 'Graveyard', value: graveyardCount, icon: '\u26B0\uFE0F' },
  ];
  return (
    <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
      {piles.map(pl => (
        <div key={pl.label} style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '4px 8px', borderRadius: 6,
          background: 'var(--bg-3)', border: '1px solid var(--border)',
          fontSize: 11,
        }}>
          <span>{pl.icon}</span>
          <span className="muted">{pl.label}</span>
          <b style={{ color: 'var(--text)' }}>{pl.value}</b>
        </div>
      ))}
    </div>
  );
}

function CardSection({ title, cards, onPlay, disabled, typeColor }: {
  title: string; cards: CardDef[]; onPlay: (idx: number) => void; disabled: boolean; typeColor: string;
}) {
  if (cards.length === 0) return null;
  return (
    <div style={{ marginBottom: 8 }}>
      <div className="muted small" style={{ marginBottom: 4, fontWeight: 600 }}>{title}</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {cards.map((card, idx) => (
          <button key={idx} onClick={() => onPlay(idx)} disabled={disabled && card.type === 'damage'}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              padding: '8px 10px', borderRadius: 8, minWidth: 64,
              background: `color-mix(in srgb, ${typeColor} 14%, var(--bg-3))`,
              border: `1px solid ${cardRarityColor(card.rarity)}`,
              cursor: 'pointer', color: 'inherit', textAlign: 'center',
              opacity: disabled && card.type === 'damage' ? 0.5 : 1,
              transition: 'transform 0.1s ease, box-shadow 0.1s ease',
            }}
            onMouseEnter={e => { if (!(disabled && card.type === 'damage')) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 4px 12px ${cardTypeColor(card.type)}33`; } }}
            onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
          >
            <span style={{ fontSize: 22 }}>{card.icon}</span>
            <span style={{ fontSize: 11, fontWeight: 800 }}>{card.name}</span>
            <span className="muted" style={{ fontSize: 9, lineHeight: 1.2 }}>{card.type === 'damage' ? `${cardDamage(card)} dmg` : card.desc.slice(0, 30)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
