import { useEffect, useState } from 'react';
import type { Game, GamePlayer, GameRecord, Player, Settings } from './types';
import { MODES, ATC_TARGETS, atcLabel, BUILTIN_TITLES, buildTitleCheck, getTitleInfo, SCORE_POPUPS, MILESTONES } from './constants';
import { createGame, recordFromGame, checkoutHint, leadTrailBadge, visitAvg, levelFromXP, getPlayerXPById, allVisitsFor } from './logic';
import { initials } from './store';
import { Sound } from './sound';
import type { MusicEngine } from './music';
import type { PopupControls } from './Popups';

interface Props {
  players: Player[];
  games: GameRecord[];
  settings: Settings;
  activeGame: Game | null;
  setActiveGame: (updater: any) => void;
  setGames: (updater: any) => void;
  setPlayers: (updater: any) => void;
  toast: (m: string) => void;
  music: MusicEngine;
  onQuit: () => void;
  onGameOver: () => void;
  popups: PopupControls;
}

export function PlayView({ players, games, settings, activeGame, setActiveGame, setGames, setPlayers, toast, music, onQuit, onGameOver, popups }: Props) {
  const game = activeGame;
  const setGame = setActiveGame;

  // Auto-resume: if there's a saved in-progress match, switch music to match context.
  useEffect(() => {
    if (game && !game.finished) music.startContext('match', settings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (game) {
    return <GameBoard game={game} setGame={setGame} settings={settings} players={players} games={games} setGames={setGames} setPlayers={setPlayers} toast={toast} music={music}
      onQuit={() => { setGame(null); onQuit(); }} onGameOver={onGameOver} popups={popups} />;
  }
  return <SetupView players={players} onStart={(mode, ids, dbl, legs) => {
    const g = createGame(mode, ids, players, dbl, legs);
    setGame(g);
    music.startContext('match', settings);
  }} />;
}

function SetupView({ players, onStart }: { players: Player[]; onStart: (mode: string, ids: string[], dbl: boolean, legs: number) => void }) {
  const [mode, setMode] = useState('301');
  const [doubleOut, setDoubleOut] = useState(true);
  const [legs, setLegs] = useState(1);
  const [picked, setPicked] = useState<string[]>(players.length ? [players[0].id] : []);

  if (!players.length) return <div className="view-scroll"><div className="card empty">Add a player before starting a game.</div></div>;
  const m = MODES[mode];
  const noX01 = !!(m.practice || m.atc);

  return (
    <div className="view-scroll">
      <div className="card">
        <h2 style={{ marginBottom: 14 }}>New Game</h2>
        <label className="field"><span>Game Mode</span>
          <select value={mode} onChange={e => setMode(e.target.value)}>
            <option value="501">501</option><option value="301">301</option>
            <option value="701">701</option><option value="101">101</option>
            <option value="atc">Around the Clock</option><option value="practice">Practice (free scoring)</option>
          </select>
        </label>
        {!noX01 && <label className="field"><span>Finish</span>
          <select value={doubleOut ? '1' : '0'} onChange={e => setDoubleOut(e.target.value === '1')}>
            <option value="1">Double Out</option><option value="0">Straight Out</option>
          </select>
        </label>}
        {!noX01 && <label className="field"><span>Best of (legs)</span>
          <select value={legs} onChange={e => setLegs(+e.target.value)}>
            <option>1</option><option>3</option><option>5</option><option>7</option>
          </select>
        </label>}
        <span style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>Players (tap to add)</span>
        <div className="row wrap" style={{ gap: 8, marginBottom: 8 }}>
          {players.map(p => {
            const on = picked.includes(p.id);
            return (
              <button key={p.id} className="pill" style={{ background: on ? p.color : 'var(--bg-3)', color: on ? '#0b0e13' : 'var(--text)' }}
                onClick={() => setPicked(on ? picked.filter(x => x !== p.id) : [...picked, p.id])}>
                <span className="avatar" style={{ width: 20, height: 20, fontSize: 10, background: on ? 'rgba(0,0,0,.2)' : p.color }}>{initials(p.name)}</span>{p.name}
              </button>
            );
          })}
        </div>
        <div className="muted small" style={{ marginBottom: 16 }}>
          {picked.length ? 'Order: ' + picked.map(id => players.find(p => p.id === id)!.name).join(' → ') : 'Select at least one player'}
        </div>
        <button className="btn primary block" onClick={() => { if (!picked.length) return; onStart(mode, picked, doubleOut, legs); }}>Start Game</button>
      </div>
    </div>
  );
}

function GameBoard({ game, setGame, settings, players, games, setGames, setPlayers, toast, music, onQuit, onGameOver, popups }: {
  game: Game; setGame: (g: Game | null) => void; settings: Settings; players: Player[]; games: GameRecord[];
  setGames: (updater: any) => void; setPlayers: (updater: any) => void; toast: (m: string) => void;
  music: MusicEngine; onQuit: () => void; onGameOver: () => void; popups: PopupControls;
}) {
  if (game.atc) return <AtcBoard game={game} setGame={setGame} settings={settings} toast={toast} music={music} onQuit={onQuit} setGames={setGames} />;
  if (game.finished) return <GameOver game={game} onNewGame={() => { setGame(null); onGameOver(); music.startContext('setup', settings); }} onViewStats={() => { setGame(null); onGameOver(); }} />;

  const p = game.players[game.turn];
  const buffScored = game.darts.reduce((a, d) => a + d.value, 0);
  const projected = game.practice ? p.score + buffScored : p.score - buffScored;
  const others = [...game.players.slice(game.turn + 1), ...game.players.slice(0, game.turn)];
  const throwOrder = (idx: number) => (idx - game.roundStartTurn + game.players.length) % game.players.length;

  const addDart = (base: number, mult: number, labelOverride?: string, isBull?: boolean) => {
    if (game.darts.length >= 3) { toast('3 darts already'); return; }
    let value: number, label: string;
    if (isBull) { value = 50; label = 'Bull'; }
    else if (base === 25) { value = mult === 2 ? 50 : 25; label = mult === 2 ? 'Bull' : '25'; }
    else if (base === 0) { value = 0; label = 'Miss'; }
    else { value = base * mult; label = (mult === 2 ? 'D' : mult === 3 ? 'T' : '') + base; }
    const dart = { value, label: labelOverride || label, base, mult: isBull ? 2 : (base === 25 && value === 50 ? 2 : mult), isDouble: !!(isBull || (base === 25 && value === 50) || mult === 2), isOuter: false };
    Sound.play('dart', { score: value }, settings);
    setGame({ ...game, darts: [...game.darts, dart], mult: 1 });
  };

  const undoDart = () => { if (game.darts.length) setGame({ ...game, darts: game.darts.slice(0, -1) }); };

  const enterVisit = () => {
    if (!game.darts.length) { toast('Add at least one dart'); return; }
    const scored = game.darts.reduce((a, d) => a + d.value, 0);
    const newPlayers = game.players.map((pl, i) => i === game.turn ? { ...pl } : pl);
    const cur = newPlayers[game.turn];

    if (game.practice) {
      cur.score += scored;
      cur.visits.push({ darts: [...game.darts], scored, remaining: cur.score, leg: 1, date: new Date().toISOString() });
      Sound.play('enter', {}, settings);
      advanceTurn({ ...game, players: newPlayers, darts: [], mult: 1 });
      return;
    }

    const remaining = cur.score - scored;
    const lastDart = game.darts[game.darts.length - 1];
    const bust = remaining < 0 || remaining === 1 || (remaining === 0 && game.doubleOut && !lastDart.isDouble);

    if (remaining === 0 && (!game.doubleOut || lastDart.isDouble)) {
      cur.visits.push({ darts: [...game.darts], scored, remaining: 0, leg: game.leg, checkout: scored, date: new Date().toISOString() });
      cur.score = 0; cur.legsWon++;
      const checkedOut = [...game.checkedOutThisRound, cur.id];
      const legsToWin = Math.ceil(game.legsBestOf / 2);
      const reachedThreshold = cur.legsWon >= (game.legsBestOf === 1 ? 1 : legsToWin);
      if (reachedThreshold) {
        const playersLeft = newPlayers.filter(pl => !checkedOut.includes(pl.id) && pl.score > 0);
        if (playersLeft.length > 0) {
          toast(`${cur.name} checked out! ${playersLeft.length} player${playersLeft.length > 1 ? 's' : ''} left to tie.`);
          Sound.play('win', {}, settings);
          advanceTurn({ ...game, players: newPlayers, checkedOutThisRound: checkedOut, darts: [], mult: 1 });
          return;
        }
        if (checkedOut.length > 1) { finishGame({ ...game, players: newPlayers, checkedOutThisRound: checkedOut, darts: [], mult: 1 }, null, checkedOut); return; }
        finishGame({ ...game, players: newPlayers, checkedOutThisRound: checkedOut, darts: [], mult: 1 }, cur, null);
        return;
      }
      const nextLeg = game.leg + 1;
      const nextTurn = (nextLeg - 1) % game.players.length;
      newPlayers.forEach(pl => pl.score = MODES[game.mode].start);
      Sound.play('win', {}, settings);
      toast(`${cur.name} wins leg ${game.leg}`);
      setGame({ ...game, players: newPlayers, leg: nextLeg, turn: nextTurn, roundStartTurn: nextTurn, checkedOutThisRound: [], darts: [], mult: 1 });
      return;
    }

    if (bust) {
      cur.visits.push({ darts: [...game.darts], scored: 0, remaining: cur.score, leg: game.leg, bust: true, date: new Date().toISOString() });
      Sound.play('bust', {}, settings);
      toast('Bust!');
      advanceTurn({ ...game, players: newPlayers, darts: [], mult: 1 });
      return;
    }

    cur.score = remaining;
    cur.visits.push({ darts: [...game.darts], scored, remaining, leg: game.leg, date: new Date().toISOString() });
    Sound.play('enter', {}, settings);
    checkMilestones(cur, remaining, scored, settings, popups, setPlayers, game, players);
    advanceTurn({ ...game, players: newPlayers, darts: [], mult: 1 });
  };

  const advanceTurn = (g: Game) => {
    const turn = (g.turn + 1) % g.players.length;
    const checkedOutCount = g.checkedOutThisRound.length;
    if (checkedOutCount > 0) {
      const legsToWin = Math.ceil(g.legsBestOf / 2);
      const anyReached = g.players.some(pl => g.checkedOutThisRound.includes(pl.id) && pl.legsWon >= (g.legsBestOf === 1 ? 1 : legsToWin));
      if (anyReached) {
        const playersLeftToThrow = g.players.filter(pl => !g.checkedOutThisRound.includes(pl.id) && pl.score > 0);
        if (playersLeftToThrow.length === 0) {
          if (checkedOutCount > 1) { finishGame({ ...g, turn }, null, g.checkedOutThisRound); return; }
          const winner = g.players.find(pl => g.checkedOutThisRound.includes(pl.id));
          if (winner) { finishGame({ ...g, turn }, winner, null); return; }
        }
      }
    }
    setGame({ ...g, turn });
  };

  const finishGame = (g: Game, winner: GamePlayer | null, tiedIds: string[] | null) => {
    const isTie = !winner && tiedIds && tiedIds.length > 1;
    const finished: Game = { ...g, finished: true, winner: winner ? winner.id : null, tied: !!isTie, tiedPlayers: isTie ? tiedIds : null };
    Sound.play('win', {}, settings);
    music.startContext('setup', settings);
    setGames((prev: GameRecord[]) => [...prev, recordFromGame(finished)]);
    if (!finished.practice) {
      if (winner) awardXP(winner.id, settings.xpConfig.win, 'Winning the game', settings, setPlayers, popups);
      if (isTie && tiedIds) tiedIds.forEach(pid => awardXP(pid, Math.round(settings.xpConfig.win / 2), 'Tied the game', settings, setPlayers, popups));
    }
    finished.players.forEach(pl => checkTitleUnlocks(pl, settings, popups, setPlayers, finished, players, games));
    setGame(finished);
  };

  return (
    <div className="view-noscroll">
      <div className="play-current">
        <div className="pc-header">
          <div className="row" style={{ gap: 8 }}>
            <span className={`turn-order-badge${game.turn === game.roundStartTurn ? ' starter' : ''}`}>{throwOrder(game.turn) + 1}</span>
            <span className="avatar" style={{ width: 32, height: 32, fontSize: 13, background: p.color }}>{initials(p.name)}</span>
            <span className="pc-name">{p.name}</span>
          </div>
          <div className="row" style={{ gap: 6 }}>
            {game.legsBestOf > 1 ? <span className="pill">{p.legsWon} legs</span> : null}
            <span className="muted small">{game.practice ? 'PRACTICE' : `LEG ${game.leg} · ${game.doubleOut ? 'DOUBLE OUT' : 'STRAIGHT OUT'}`}</span>
          </div>
        </div>
        <div className="pc-remaining" style={{ color: projected < 0 ? 'var(--danger)' : 'var(--text)' }}>{projected}</div>
        <div className="checkout-hint center">{checkoutHint(game.practice ? null : projected, game.doubleOut, game.practice)}</div>
        <div className="pc-slots">
          {[0, 1, 2].map(i => { const d = game.darts[i]; return <div key={i} className={`pc-slot${d ? ' filled' : ''}`}>{d ? d.label : '–'}</div>; })}
        </div>
        <div className="muted small">This visit: <b style={{ color: 'var(--text)' }}>{buffScored}</b> · Darts thrown: <b style={{ color: 'var(--text)' }}>{(p.visits.reduce((a, v) => a + v.darts.length, 0)) + game.darts.length}</b></div>
      </div>

      {game.players.length > 1 && (
        <div className="play-others">
          {others.map(pl => {
            const xpInfo = getPlayerXPById(pl.id, players);
            const li = levelFromXP(xpInfo.xp, settings);
            const ti = getTitleInfo(xpInfo.selectedTitle, settings.customTitles);
            const badge = leadTrailBadge(pl, game);
            return (
              <div key={pl.id} className="play-other">
                <div className="row between">
                  <div className="row" style={{ gap: 6 }}>
                    <span className={`turn-order-badge${game.players.indexOf(pl) === game.roundStartTurn ? ' starter' : ''}`} style={{ width: 18, height: 18, fontSize: 10 }}>{throwOrder(game.players.indexOf(pl)) + 1}</span>
                    <span className="avatar" style={{ width: 22, height: 22, fontSize: 10, background: pl.color }}>{initials(pl.name)}</span>
                    <span className="po-name">{pl.name}</span>
                  </div>
                  <div className="row" style={{ gap: 4 }}>
                    {game.legsBestOf > 1 ? <span className="pill" style={{ fontSize: 10 }}>{pl.legsWon}</span> : null}
                    {badge ? <span className={`lead-badge ${badge.startsWith('+') ? 'lead' : 'trail'}`}>{badge}</span> : null}
                  </div>
                </div>
                <div className="po-score">{pl.score}</div>
                <div className="po-sub">avg {visitAvg(pl).toFixed(1)} · {pl.visits.reduce((a, v) => a + v.darts.length, 0)} 🎯 · L{li.level}{ti ? ` · ${ti.icon || ''} ${ti.name}` : ''}</div>
              </div>
            );
          })}
        </div>
      )}

      <div className="play-input">
        <div className="pad-card">
          <div className="mult">
            <button className={game.mult === 1 ? 'on' : ''} onClick={() => setGame({ ...game, mult: 1 })}>Single</button>
            <button className={game.mult === 2 ? 'on' : ''} onClick={() => setGame({ ...game, mult: 2 })}>Double</button>
            <button className={game.mult === 3 ? 'on' : ''} onClick={() => setGame({ ...game, mult: 3 })}>Triple</button>
          </div>
          <div className="keypad">
            {[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20].map(n => (
              <button key={n} className="key" onClick={() => addDart(n, game.mult)}>{n}</button>
            ))}
            <button className="key" style={{ background: 'color-mix(in srgb,var(--accent) 20%,var(--bg-3))' }} onClick={() => addDart(25, game.mult === 2 ? 2 : 1)}>25</button>
            <button className="key" style={{ gridColumn: 'span 2', background: 'color-mix(in srgb,var(--accent) 30%,var(--bg-3))' }} onClick={() => addDart(50, 1, 'Bull', true)}>Bull<br /><small>50</small></button>
            <button className="key" style={{ gridColumn: 'span 2', color: 'var(--muted)' }} onClick={() => addDart(0, 1, '0')}>Miss</button>
          </div>
          <div className="row" style={{ gap: 8, marginTop: 8 }}>
            <button className="btn block ghost" onClick={undoDart}>↶ Undo dart</button>
            <button className="btn block primary" onClick={enterVisit}>Enter visit</button>
          </div>
        </div>
      </div>
      <button className="btn danger sm" style={{ alignSelf: 'flex-end' }} onClick={() => { if (confirm('Quit this game? Progress will not be saved.')) onQuit(); }}>Quit</button>
    </div>
  );
}

function AtcBoard({ game, setGame, settings, toast, music, onQuit, setGames }: {
  game: Game; setGame: (g: Game | null) => void; settings: Settings; toast: (m: string) => void; music: MusicEngine; onQuit: () => void; setGames: (updater: any) => void;
}) {
  const p = game.players[game.turn];
  const total = ATC_TARGETS.length;
  const target = atcLabel(p.idx);
  const others = [...game.players.slice(game.turn + 1), ...game.players.slice(0, game.turn)];

  const addDartATC = (hit: boolean) => {
    const atcDarts = game.atcDarts || [];
    if (atcDarts.length >= 3) { toast('3 darts already'); return; }
    if (p.idx >= total) return;
    const t = atcLabel(p.idx);
    const newDarts = [...atcDarts, { hit, target: t }];
    const newPlayers = game.players.map((pl, i) => i === game.turn ? { ...pl, idx: hit ? pl.idx + 1 : pl.idx } : pl);
    if (hit) Sound.play('hit', {}, settings); else Sound.play('miss', {}, settings);
    const newGame = { ...game, players: newPlayers, atcDarts: newDarts };
    if (newPlayers[game.turn].idx >= total) { enterVisitATC(newGame); return; }
    setGame(newGame);
  };

  const undoDartATC = () => {
    const atcDarts = game.atcDarts || [];
    if (!atcDarts.length) return;
    const d = atcDarts[atcDarts.length - 1];
    const newPlayers = game.players.map((pl, i) => i === game.turn && d.hit && pl.idx > 0 ? { ...pl, idx: pl.idx - 1 } : pl);
    setGame({ ...game, players: newPlayers, atcDarts: atcDarts.slice(0, -1) });
  };

  const enterVisitATC = (g: Game) => {
    const atcDarts = g.atcDarts || [];
    if (!atcDarts.length) { toast('Throw at least one dart'); return; }
    const hits = atcDarts.filter(d => d.hit).length;
    const newPlayers = g.players.map((pl, i) => i === g.turn ? { ...pl, dartsThrown: pl.dartsThrown + atcDarts.length, visits: [...pl.visits, { darts: atcDarts as any, atc: true, scored: 0, hits, endIdx: pl.idx, leg: 1, date: new Date().toISOString() }] } : pl);
    const newGame = { ...g, players: newPlayers, atcDarts: [] as any[] };
    if (newPlayers[g.turn].idx >= total) {
      const finished = { ...newGame, finished: true, winner: newPlayers[g.turn].id };
      Sound.play('win', {}, settings);
      music.startContext('setup', settings);
      setGames((prev: GameRecord[]) => [...prev, recordFromGame(finished)]);
      setGame(finished);
      return;
    }
    setGame({ ...newGame, turn: (newGame.turn + 1) % newGame.players.length });
  };

  return (
    <div className="view-noscroll">
      <div className="play-current">
        <div className="pc-header">
          <div className="row" style={{ gap: 8 }}>
            <span className="avatar" style={{ width: 32, height: 32, fontSize: 13, background: p.color }}>{initials(p.name)}</span>
            <span className="pc-name">{p.name}</span>
          </div>
          <span className="muted small">AROUND THE CLOCK</span>
        </div>
        <div className="pc-remaining">{target}</div>
        <div className="checkout-hint center">{p.idx + 1} of {total}{target === 'Bull' ? ' · last one!' : ''}</div>
        <div className="pc-slots">
          {[0, 1, 2].map(i => { const d = (game.atcDarts || [])[i]; return <div key={i} className={`pc-slot${d ? ' filled' : ''}`} style={d && d.hit ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : {}}>{d ? (d.hit ? '✓ ' + d.target : '✗') : '–'}</div>; })}
        </div>
        <div className="muted small">Hits this visit: <b style={{ color: 'var(--text)' }}>{(game.atcDarts || []).filter(d => d.hit).length}</b></div>
      </div>

      {game.players.length > 1 && (
        <div className="play-others">
          {others.map(pl => {
            const pct = Math.round(pl.idx / total * 100);
            return (
              <div key={pl.id} className="play-other">
                <div className="row between">
                  <div className="row" style={{ gap: 6 }}>
                    <span className="avatar" style={{ width: 22, height: 22, fontSize: 10, background: pl.color }}>{initials(pl.name)}</span>
                    <span className="po-name">{pl.name}</span>
                  </div>
                  <span className="pill" style={{ fontSize: 10 }}>{pl.dartsThrown} 🎯</span>
                </div>
                <div style={{ marginTop: 6, height: 7, borderRadius: 4, background: 'var(--bg-3)', overflow: 'hidden' }}><div style={{ height: '100%', width: `${pct}%`, background: pl.color, transition: 'width .25s' }} /></div>
                <div className="po-sub">{pl.done ? 'Finished!' : `On ${atcLabel(pl.idx)} · ${pl.idx}/${total}`}</div>
              </div>
            );
          })}
        </div>
      )}

      <div className="play-input">
        <div className="pad-card">
          <div className="row" style={{ gap: 10 }}>
            <button className="btn block primary" style={{ height: 64, fontSize: 20 }} onClick={() => addDartATC(true)}>✓ Hit {target}</button>
            <button className="btn block" style={{ height: 64, fontSize: 20 }} onClick={() => addDartATC(false)}>✗ Miss</button>
          </div>
          <div className="row" style={{ gap: 8, marginTop: 8 }}>
            <button className="btn block ghost" onClick={undoDartATC}>↶ Undo dart</button>
            <button className="btn block primary" onClick={() => enterVisitATC(game)}>Next player</button>
          </div>
        </div>
      </div>
      <button className="btn danger sm" style={{ alignSelf: 'flex-end' }} onClick={() => { if (confirm('Quit this game?')) onQuit(); }}>Quit</button>
    </div>
  );
}

function GameOver({ game, onNewGame, onViewStats }: { game: Game; onNewGame: () => void; onViewStats: () => void }) {
  const w = game.players.find(pl => pl.id === game.winner);
  const isTie = !!game.tied && !!game.tiedPlayers && game.tiedPlayers.length > 1;
  const tiedNames = isTie ? (game.tiedPlayers || []).map(id => game.players.find(pl => pl.id === id)?.name || '').filter(Boolean) : [];
  const titleText = game.practice ? 'Practice complete' : isTie ? "It's a tie!" : (w ? `${w.name} wins!` : 'Game over');
  return (
    <div className="view-scroll">
      <div className="card center">
        <div style={{ fontSize: 44 }}>{isTie ? '🤝' : '🏆'}</div>
        <h2 style={{ margin: '8px 0' }}>{titleText}</h2>
        {isTie ? <div className="muted small" style={{ marginBottom: 8 }}>{tiedNames.join(' & ')}</div> : null}
        <div className="grid grid-2" style={{ margin: '14px 0' }}>
          {game.players.map(pl => {
            const best = Math.max(0, ...pl.visits.filter((v: any) => !v.bust).map((v: any) => v.scored));
            return [
              <div key={pl.id + 'a'} className="stat"><div className="v">{visitAvg(pl).toFixed(1)}</div><div className="l">{pl.name} avg</div></div>,
              <div key={pl.id + 'b'} className="stat"><div className="v">{best}</div><div className="l">{pl.name} best</div></div>,
            ];
          })}
        </div>
        <button className="btn primary block" onClick={onNewGame}>New Game</button>
        <button className="btn ghost block" style={{ marginTop: 8 }} onClick={onViewStats}>View Stats</button>
      </div>
    </div>
  );
}

function checkMilestones(p: GamePlayer, remaining: number, visitScore: number, settings: Settings, popups: PopupControls, setPlayers: (updater: any) => void, game: Game, players: Player[]) {
  if (settings.popups.scores) {
    for (const sp of SCORE_POPUPS) { if (visitScore >= sp.min) { popups.setMilestone({ emoji: sp.emoji, title: sp.title, sub: sp.sub }); Sound.play('milestone', {}, settings); break; } }
  }
  if (settings.popups.milestones) {
    for (const ms of MILESTONES) { if (remaining < ms.threshold && p.score + visitScore >= ms.threshold) { setTimeout(() => popups.setMilestone({ emoji: ms.emoji, title: ms.title, sub: ms.sub }), 1800); break; } }
  }
  const pid = p.id;
  const prevVisits = allVisitsFor(pid, []).filter(v => !v.bust && !v.atc);
  void prevVisits;
  awardVisitXP(p, visitScore, settings, setPlayers, popups);
  checkTitleUnlocks(p, settings, popups, setPlayers, game, players, games);
}

function awardVisitXP(p: GamePlayer, visitScore: number, settings: Settings, setPlayers: (updater: any) => void, popups: PopupControls) {
  const cfg = settings.xpConfig;
  let xp = cfg.perDart * 3;
  if (visitScore >= 180) xp += cfg.visit180;
  else if (visitScore >= 140) xp += cfg.visit140;
  else if (visitScore >= 120) xp += cfg.visit120;
  else if (visitScore >= 100) xp += cfg.visit100;
  else if (visitScore >= 80) xp += cfg.visit80;
  else if (visitScore >= 60) xp += cfg.visit60;
  awardXP(p.id, xp, `${visitScore}-point visit`, settings, setPlayers, popups);
}

function awardXP(playerId: string, amount: number, reason: string, settings: Settings, setPlayers: (updater: any) => void, popups: PopupControls) {
  if (amount <= 0) return;
  setPlayers((prev: Player[]) => prev.map(p => {
    if (p.id !== playerId) return p;
    const oldLevel = p.level || 1;
    const newXp = (p.xp || 0) + amount;
    const li = levelFromXP(newXp, settings);
    if (li.level > oldLevel && settings.popups.xp) { popups.setLevelUp({ level: li.level, name: p.name, xpGained: amount, reason }); Sound.play('levelup', {}, settings); }
    return { ...p, xp: newXp, level: li.level };
  }));
}

function checkTitleUnlocks(pl: GamePlayer, settings: Settings, popups: PopupControls, setPlayers: (updater: any) => void, game: Game, _players: Player[], games: GameRecord[] = []) {
  if (!settings.popups.titles) return;
  const titles = [...BUILTIN_TITLES, ...settings.customTitles.map(t => ({ ...t, custom: true, check: buildTitleCheck(t) as any }))];
  setPlayers((prev: Player[]) => {
    const player = prev.find(p => p.id === pl.id);
    if (!player) return prev;
    const unlocked = [...(player.unlockedTitles || [])];

    // Historical stats from prior completed games (excluding the current in-progress game).
    const historyGames = games.filter(g => g.id !== game.id && g.players.some(p => p.id === pl.id));
    const historyVisits = allVisitsFor(pl.id, historyGames);
    const lifetimeVisits = [...historyVisits, ...(pl.visits || [])];
    const gamesPlayed = historyGames.length + (game.finished ? 1 : 0);
    const gamesWon = historyGames.filter(g => g.winner === pl.id).length + (game.finished && game.winner === pl.id ? 1 : 0);
    const ctx = { playerId: pl.id, games: historyGames, gamesPlayed, gamesWon, lifetimeVisits };

    titles.forEach(t => {
      if (unlocked.includes(t.id)) return;
      let met = false;
      try { met = t.check(lifetimeVisits, pl.visits || [], game, ctx); } catch { met = false; }
      if (met) {
        unlocked.push(t.id);
        popups.setTitleUnlock({ icon: t.icon || '🏅', name: t.name, player: pl.name, desc: t.desc || '' });
        Sound.play('title', {}, settings);
      }
    });
    return prev.map(p => p.id === pl.id ? { ...p, unlockedTitles: unlocked } : p);
  });
}
