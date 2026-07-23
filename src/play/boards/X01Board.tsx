import { useState } from 'react';
import type { Game, GamePlayer, GameRecord, Player, Settings } from '../../types';
import { MODES, TEAM_COLORS, getTitleInfo } from '../../constants';
import { recordFromGame, checkoutHint, leadTrailBadge, visitAvg, levelFromXP, getPlayerXPById } from '../../logic';
import { Sound } from '../../sound';
import type { MusicEngine } from '../../music';
import type { PopupControls } from '../../Popups';
import { ChargedPlayerIcon, AttributeStrip, BadgeAvatar } from '../common';
import { addDartToGame, undoDart, KeypadPad, clearVisitPowerUpFlags, tickShield } from '../dart';
import { activatePowerUp } from '../powerups';
import { runMilestones, awardXP, checkTitleUnlocks, awardBadges } from '../rewards';
import { GameOver } from '../GameOver';
import { RerollOverlay } from '../RerollOverlay';
import type { RerollPlan } from '../../powerups';

export function X01Board({ game, setGame, settings, players, games, setGames, setPlayers, toast, music, onQuit, onGameOver, popups, isMyTurn = true }: {
  game: Game; setGame: (g: Game | null) => void; settings: Settings; players: Player[]; games: GameRecord[];
  setGames: (updater: any) => void; setPlayers: (updater: any) => void; toast: (m: string) => void;
  music: MusicEngine; onQuit: () => void; onGameOver: () => void; popups: PopupControls; isMyTurn?: boolean;
}) {
  const [reroll, setReroll] = useState<RerollPlan | null>(null);
  const [rerollResolve, setRerollResolve] = useState<((v: boolean) => void) | null>(null);

  if (game.finished) return <GameOver game={game} onNewGame={() => { setGame(null); onGameOver(); music.startContext('setup', settings); }} onViewStats={() => { setGame(null); onGameOver(); }} />;

  const p = game.players[game.turn];
  const buffScored = game.darts.reduce((a, d) => a + d.value, 0);
  const projected = game.practice ? p.score + buffScored : p.score - buffScored;
  const others = [...game.players.slice(game.turn + 1), ...game.players.slice(0, game.turn)];
  const throwOrder = (idx: number) => (idx - game.roundStartTurn + game.players.length) % game.players.length;

  const curTeam = game.teamMode ? (p.team ?? 0) : -1;
  const curTeamColor = game.teamMode ? TEAM_COLORS[curTeam % TEAM_COLORS.length] : p.color;

  const addDart = (base: number, mult: number, labelOverride?: string, isBull?: boolean) => {
    const next = addDartToGame(game, base, mult, labelOverride, isBull, settings, toast);
    if (next) setGame(next);
  };

  const enterVisit = () => {
    if (!game.darts.length) { toast('Add at least one dart'); return; }
    const cur0 = game.players[game.turn] as any;
    const surgeActive = !!cur0._surgeNext && !cur0._surgeArmed;
    const crippleActive = !!cur0._crippledNext;
    const bullseyeFrenzyActive = !!cur0._bullseyeFrenzy;
    const hotStreakActive = !!cur0._hotStreak;
    const rawScored = game.darts.reduce((a, d) => {
      const isBull = d.value === 50 || d.value === 25;
      const v = bullseyeFrenzyActive && isBull ? d.value * 2 : d.value;
      return a + v;
    }, 0);
    const surgeScored = surgeActive ? rawScored * 2 : rawScored;
    const crippleScored = crippleActive ? Math.round(surgeScored * 0.5) : surgeScored;
    const hotStreakBonus = hotStreakActive
      ? game.darts.reduce((a, _d, i) => a + i * 5, 0)
      : 0;
    const scored = crippleScored + hotStreakBonus;
    const newPlayers = game.players.map((pl, i) => i === game.turn ? { ...pl } : pl);
    const cur = newPlayers[game.turn] as any;
    if (cur._surgeArmed) delete cur._surgeArmed;
    else if (cur._surgeNext) delete cur._surgeNext;
    if (cur._crippledNext) delete cur._crippledNext;
    if (cur._fourthDart) delete cur._fourthDart;
    if (cur._oneDartNext) delete cur._oneDartNext;
    if (cur._bullseyeFrenzy) delete cur._bullseyeFrenzy;
    if (cur._hotStreak) delete cur._hotStreak;

    if (game.practice) {
      cur.score += scored;
      cur.visits.push({ darts: [...game.darts], scored, remaining: cur.score, leg: 1, date: new Date().toISOString() });
      Sound.play('enter', {}, settings);
      const next = advanceTurn({ ...game, players: newPlayers, darts: [], mult: 1 });
      setGame(next);
      runMilestones(cur, cur.score, scored, settings, popups, setPlayers, { ...game, players: newPlayers }, players, games);
      return;
    }

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
          finishGame({ ...game, players: newPlayers, teamLegsWon: teamLegs, darts: [], mult: 1, winningTeam: cur.team }, null, null);
          return;
        }
        const nextLeg = game.leg + 1;
        newPlayers.forEach(pl => pl.score = MODES[game.mode].start);
        const tc = game.teamCount || 2;
        const nextTeam = ((game.teamTurn || 0) + 1) % tc;
        const cursors = [...(game.teamPlayerCursor || Array(tc).fill(0))];
        cursors[nextTeam] = 0;
        const ros: number[][] = Array.from({ length: tc }, () => []);
        newPlayers.forEach((pl, i) => { const t = pl.team ?? 0; if (t < tc) ros[t].push(i); });
        const nextTurn = ros[nextTeam][cursors[nextTeam] % ros[nextTeam].length];
        Sound.play('win', {}, settings);
        toast(`Team ${cur.team! + 1} wins leg ${game.leg}`);
        setGame({ ...game, players: newPlayers, leg: nextLeg, turn: nextTurn, teamTurn: nextTeam, teamLegsWon: teamLegs, teamPlayerCursor: cursors, roundStartTurn: nextTurn, checkedOutThisRound: [], thrownThisRound: [], darts: [], mult: 1 });
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
          const next = advanceTurn({ ...game, players: newPlayers, checkedOutThisRound: checkedOut, thrownThisRound: thrown, darts: [], mult: 1 });
          setGame(next);
          return;
        }
        if (checkedOut.length > 1) { finishGame({ ...game, players: newPlayers, checkedOutThisRound: checkedOut, thrownThisRound: thrown, darts: [], mult: 1 }, null, checkedOut); return; }
        finishGame({ ...game, players: newPlayers, checkedOutThisRound: checkedOut, thrownThisRound: thrown, darts: [], mult: 1 }, cur, null);
        return;
      }
      const nextLeg = game.leg + 1;
      const nextTurn = (nextLeg - 1) % game.players.length;
      newPlayers.forEach(pl => pl.score = MODES[game.mode].start);
      if (game.powerUpsEnabled) newPlayers[game.turn] = tickShield(newPlayers[game.turn]);
      Sound.play('win', {}, settings);
      toast(`${cur.name} wins leg ${game.leg}`);
      setGame({ ...game, players: newPlayers, leg: nextLeg, turn: nextTurn, roundStartTurn: nextTurn, checkedOutThisRound: [], thrownThisRound: [], darts: [], mult: 1 });
      return;
    }

    if (bust) {
      if (cur._luckyMiss) {
        delete cur._luckyMiss;
        cur.visits.push({ darts: [...game.darts], scored: 0, remaining: cur.score, leg: game.leg, bust: true, luckyMiss: true, date: new Date().toISOString() });
        Sound.play('enter', {}, settings);
        toast('Lucky Miss! Bust cancelled — score stays.');
        const thrown = [...game.thrownThisRound, cur.id];
        const next = advanceTurn({ ...game, players: newPlayers, thrownThisRound: thrown, darts: [], mult: 1 });
        setGame(next);
        return;
      }
      cur.visits.push({ darts: [...game.darts], scored: 0, remaining: cur.score, leg: game.leg, bust: true, date: new Date().toISOString() });
      Sound.play('bust', {}, settings);
      toast('Bust!');
      const thrown = [...game.thrownThisRound, cur.id];
      const next = advanceTurn({ ...game, players: newPlayers, thrownThisRound: thrown, darts: [], mult: 1 });
      setGame(next);
      return;
    }

    cur.score = remaining;
    if (game.teamMode) newPlayers.forEach(pl => { if (pl.team === cur.team && pl.id !== cur.id) pl.score = remaining; });
    cur.visits.push({ darts: [...game.darts], scored, remaining, leg: game.leg, date: new Date().toISOString() });
    Sound.play('enter', {}, settings);
    const thrown = [...game.thrownThisRound, cur.id];
    const next = advanceTurn({ ...game, players: newPlayers, thrownThisRound: thrown, darts: [], mult: 1 });
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
          const visits = [...frozenPl.visits, { darts: [], scored: 0, remaining: frozenPl.score, leg: g.leg, frozen: true, date: new Date().toISOString() }];
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

  const finishGame = (g: Game, winner: GamePlayer | null, tiedIds: string[] | null) => {
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

  return (
    <div className="view-noscroll">
      <button className="btn danger sm quit-float" onClick={() => { if (confirm('Quit this game? Progress will not be saved.')) onQuit(); }}>Quit</button>
      <div className="play-current" style={game.teamMode ? { borderColor: curTeamColor, boxShadow: `0 0 0 2px ${curTeamColor}33` } : {}}>
        <div className="pc-header">
          <div className="row" style={{ gap: 8 }}>
            <span className={`turn-order-badge${game.turn === game.roundStartTurn ? ' starter' : ''}`}>{throwOrder(game.turn) + 1}</span>
            {game.powerUpsEnabled ? (
              <ChargedPlayerIcon game={game} curIdx={game.turn} settings={settings} players={players} games={games} toast={toast} onActivate={() => {
                activatePowerUp(game, game.turn, settings, toast, {
                  popups,
                  onReroll: (plan) => new Promise<boolean>((resolve) => {
                    setReroll(plan);
                    setRerollResolve(() => resolve);
                  }),
                }).then((next) => { if (next) setGame(next); });
              }} />
            ) : (
              <BadgeAvatar playerId={p.id} players={players} games={games} size={32} fontSize={16} color={p.color} />
            )}
            <span className="pc-name">{p.name}</span>
            {game.teamMode && <span className="pill" style={{ background: curTeamColor, color: '#04150a' }}>Team {curTeam + 1}</span>}
            {!game.teamMode && !game.practice && (() => { const badge = leadTrailBadge(p, game); return badge ? <span className={`lead-badge ${badge.startsWith('+') ? 'lead' : 'trail'}`}>{badge}</span> : null; })()}
          </div>
          <div className="row" style={{ gap: 6 }}>
            {game.teamMode && game.legsBestOf > 1 ? <span className="pill" style={{ background: curTeamColor, color: '#04150a' }}>{(game.teamLegsWon || [])[curTeam] || 0} legs</span> : null}
            {!game.teamMode && game.legsBestOf > 1 ? <span className="pill">{p.legsWon} legs</span> : null}
            <span className="muted small">{game.practice ? 'PRACTICE' : `LEG ${game.leg} · ${game.doubleOut ? 'DOUBLE OUT' : 'STRAIGHT OUT'}`}</span>
          </div>
        </div>
        <div className="pc-remaining" style={{ color: projected < 0 ? 'var(--danger)' : 'var(--text)' }}>{projected}</div>
        <div className="checkout-hint center">{checkoutHint(game.practice ? null : projected, game.doubleOut, game.practice)}</div>
        {game.powerUpsEnabled && (p as any)._oneDartNext && (
          <div className="pu-banner" style={{ background: 'color-mix(in srgb,#f59e0b 18%,var(--bg-3))', border: '1px solid #f59e0b', color: '#f59e0b' }}>
            🛡️ Blocked! You only get ONE dart this visit.
          </div>
        )}
        {game.powerUpsEnabled && (p as any)._crippledNext && (
          <div className="pu-banner" style={{ background: 'color-mix(in srgb,#ef4444 18%,var(--bg-3))', border: '1px solid #ef4444', color: '#ef4444' }}>
            🦾 Crippled! You only score 50% this visit.
          </div>
        )}
        {game.powerUpsEnabled && (p as any)._surgeNext && !(p as any)._surgeArmed && (
          <div className="pu-banner" style={{ background: 'color-mix(in srgb,var(--accent) 18%,var(--bg-3))', border: '1px solid var(--accent)', color: 'var(--accent)' }}>
            ⚡ Surge active! This visit scores double.
          </div>
        )}
        {game.powerUpsEnabled && (p as any)._bullseyeFrenzy && (
          <div className="pu-banner" style={{ background: 'color-mix(in srgb,#a855f7 18%,var(--bg-3))', border: '1px solid #a855f7', color: '#c084fc' }}>
            🐂 Bullseye Frenzy! Bulls score double this visit.
          </div>
        )}
        {game.powerUpsEnabled && (p as any)._hotStreak && (
          <div className="pu-banner" style={{ background: 'color-mix(in srgb,#f97316 18%,var(--bg-3))', border: '1px solid #f97316', color: '#fb9234' }}>
            🔥 Hot Streak! Each dart this visit earns +5 bonus per dart before it.
          </div>
        )}
        {game.powerUpsEnabled && (p as any)._shieldTurns > 0 && (
          <div className="pu-banner" style={{ background: 'color-mix(in srgb,#38bdf8 18%,var(--bg-3))', border: '1px solid #38bdf8', color: '#7dd3fc' }}>
            🏰 Shield active! Protected from power-up attacks for {(p as any)._shieldTurns} more turn{(p as any)._shieldTurns === 1 ? '' : 's'}.
          </div>
        )}
        <div className="pc-slots">
          {Array.from({ length: (game.powerUpsEnabled && (p as any)._fourthDart) ? 4 : (game.powerUpsEnabled && (p as any)._oneDartNext ? 1 : 3) }).map((_, i) => { const d = game.darts[i]; return <div key={i} className={`pc-slot${d ? ' filled' : ''}`} style={i === 3 ? { borderColor: 'var(--accent)' } : {}}>{d ? d.label : (i === 3 ? '🎯' : '–')}</div>; })}
        </div>
        <div className="muted small">This visit: <b style={{ color: 'var(--text)' }}>{buffScored}</b> · Darts thrown: <b style={{ color: 'var(--text)' }}>{(p.visits.reduce((a, v) => a + v.darts.length, 0)) + game.darts.length}</b></div>
        <AttributeStrip playerId={p.id} players={players} mode={game.mode} settings={settings} />
      </div>

      {game.players.length > 1 && (
        <div className="play-others">
          {others.map(pl => {
            const xpInfo = getPlayerXPById(pl.id, players);
            const li = levelFromXP(xpInfo.xp, settings);
            const ti = getTitleInfo(xpInfo.selectedTitle ?? '', settings.customTitles);
            const badge = leadTrailBadge(pl, game);
            const plTeam = game.teamMode ? (pl.team ?? 0) : -1;
            const plTeamColor = game.teamMode ? TEAM_COLORS[plTeam % TEAM_COLORS.length] : pl.color;
            return (
              <div key={pl.id} className="play-other" style={game.teamMode ? { borderColor: plTeamColor } : {}}>
                <div className="row between">
                  <div className="row" style={{ gap: 6 }}>
                    <span className={`turn-order-badge${game.players.indexOf(pl) === game.roundStartTurn ? ' starter' : ''}`} style={{ width: 18, height: 18, fontSize: 10 }}>{throwOrder(game.players.indexOf(pl)) + 1}</span>
                    <BadgeAvatar playerId={pl.id} players={players} games={games} size={22} fontSize={12} color={pl.color} />
                    <span className="po-name">{pl.name}</span>
                    {game.teamMode && <span style={{ fontSize: 9, fontWeight: 800, color: plTeamColor }}>T{plTeam + 1}</span>}
                    {game.powerUpsEnabled && (pl as any)._shieldTurns > 0 && <span title="Shielded" style={{ fontSize: 11 }}>🏰</span>}
                  </div>
                  <div className="row" style={{ gap: 4 }}>
                    {game.teamMode && game.legsBestOf > 1 ? <span className="pill" style={{ fontSize: 10, background: plTeamColor, color: '#04150a' }}>{(game.teamLegsWon || [])[plTeam] || 0}</span> : null}
                    {!game.teamMode && game.legsBestOf > 1 ? <span className="pill" style={{ fontSize: 10 }}>{pl.legsWon}</span> : null}
                    {badge ? <span className={`lead-badge ${badge.startsWith('+') ? 'lead' : 'trail'}`}>{badge}</span> : null}
                  </div>
                </div>
                <div className="po-score">{pl.score}</div>
                <div className="po-sub">avg {visitAvg(pl).toFixed(1)} · {pl.visits.reduce((a, v) => a + v.darts.length, 0)} 🎯 · L{li.level}{ti ? ` · ${ti.icon || ''} ${ti.name}` : ''}</div>
                <AttributeStrip playerId={pl.id} players={players} mode={game.mode} settings={settings} />
              </div>
            );
          })}
        </div>
      )}

      <div className="play-input">
        <KeypadPad game={game} setGame={setGame as any} onAdd={addDart} onUndo={() => setGame(undoDart(game))} onEnter={enterVisit} disabled={!isMyTurn} />
      </div>
      {reroll ? (
        <RerollOverlay
          plan={reroll}
          settings={settings}
          onDone={() => {
            setReroll(null);
            if (rerollResolve) rerollResolve(true);
            setRerollResolve(null);
          }}
        />
      ) : null}
    </div>
  );
}
