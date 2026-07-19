import { useEffect, useMemo, useState } from 'react';
import type { Game, GamePlayer, GameRecord, Player, Settings } from './types';
import { MODES, ATC_TARGETS, atcLabel, BUILTIN_TITLES, buildTitleCheck, getTitleInfo, SCORE_POPUPS, MILESTONES, TEAM_COLORS, TEAM_NAMES, showdownBgFor } from './constants';
import { createGame, recordFromGame, checkoutHint, leadTrailBadge, visitAvg, levelFromXP, getPlayerXPById, allVisitsFor, computeBattleDamage, playerStats } from './logic';
import { initials } from './store';
import { Sound } from './sound';
import type { MusicEngine } from './music';
import type { PopupControls } from './Popups';
import { computeGameBadges, getBadgeInfo, getBadgeContext } from './badges';
import { BadgeInfoPopup, Modal } from './Popups';
import { getPowerUpInfo } from './powerups';

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

function chargeFromDart(dart: { value: number; isDouble: boolean; mult: number; base: number }, settings: Settings): number {
  const cfg = settings.powerUpScaling;
  let c = 0;
  const isBull = dart.value === 50 || dart.value === 25;
  if (isBull) c += cfg.chargePerBull;
  else if (dart.mult === 3) c += cfg.chargePerTriple;
  else if (dart.mult === 2 || dart.isDouble) c += cfg.chargePerDouble;
  c += dart.value * cfg.chargePerScorePoint;
  return c;
}

function applyCharge(game: Game, playerIdx: number, charge: number, settings: Settings): Game {
  if (!game.powerUpsEnabled) return game;
  const cap = settings.powerUpScaling.chargeMax;
  const players = game.players.map((pl, i) => {
    if (i !== playerIdx) return pl;
    if (pl.powerUpUsed) return pl;
    const next = Math.min(cap, (pl.powerUpCharge || 0) + charge);
    return { ...pl, powerUpCharge: next };
  });
  return { ...game, players };
}

function activatePowerUp(game: Game, playerIdx: number, settings: Settings, toast: (m: string) => void): Game | null {
  if (!game.powerUpsEnabled) return null;
  const pl = game.players[playerIdx];
  if (!pl || pl.powerUpUsed) { toast('Power-up already used'); return null; }
  const cap = settings.powerUpScaling.chargeMax;
  if ((pl.powerUpCharge || 0) < cap) { toast('Power-up not fully charged'); return null; }
  // Power-up cannot be activated at the start of a visit — at least one dart
  // must be thrown first. This prevents "instant" activation the moment a
  // round begins even when the orb is already at 100%.
  if (!game.darts.length) { toast('Throw at least one dart before activating'); return null; }
  const puId = pl.powerUpId;
  const pu = getPowerUpInfo(puId);
  if (!pu) { toast('No power-up equipped'); return null; }
  const { game: nextGame, message, ok } = pu.apply(game, playerIdx);
  // If the apply call signalled a failure (ok === false), do NOT consume the
  // charge — the player keeps their full orb and can try again later.
  if (ok === false) { toast(message); return null; }
  const players = nextGame.players.map((p: any, i: number) => {
    if (i !== playerIdx) return p;
    const updated: any = { ...p, powerUpUsed: true, powerUpCharge: 0 };
    if (puId === 'pu_fourth_dart') updated._fourthDart = true;
    return updated;
  });
  toast(message);
  Sound.playSfx('impact', settings);
  return { ...nextGame, players };
}

function PowerUpOrb({ game, curIdx, settings, onActivate }: { game: Game; curIdx: number; settings: Settings; onActivate: () => void; toast: (m: string) => void }) {
  if (!game.powerUpsEnabled) return null;
  const pl = game.players[curIdx];
  if (!pl) return null;
  const pu = getPowerUpInfo(pl.powerUpId);
  const cap = settings.powerUpScaling.chargeMax;
  const charge = Math.min(cap, pl.powerUpCharge || 0);
  const pct = Math.round((charge / cap) * 100);
  const ready = !pl.powerUpUsed && charge >= cap && !!pu && game.darts.length > 0;
  const chargedButWaiting = !pl.powerUpUsed && charge >= cap && !!pu && game.darts.length === 0;
  const [open, setOpen] = useState(false);
  const R = 22;
  const C = 2 * Math.PI * R;
  const dash = C * (pct / 100);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title={pu ? `${pu.name} (${pct}% charged${chargedButWaiting ? ' — throw a dart to activate' : ''})` : 'No power-up equipped'}
        className={chargedButWaiting ? 'pu-orb-charged-waiting' : undefined}
        style={{
          position: 'relative', width: 52, height: 52, borderRadius: '50%',
          background: ready || chargedButWaiting ? 'color-mix(in srgb,var(--accent) 18%,var(--bg-3))' : 'var(--bg-3)',
          border: `2px solid ${ready || chargedButWaiting ? 'var(--accent)' : 'var(--border)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', padding: 0, color: 'inherit',
          boxShadow: ready || chargedButWaiting ? '0 0 12px color-mix(in srgb,var(--accent) 50%,transparent)' : 'none',
          transition: 'box-shadow .2s, border-color .2s',
        }}
      >
        <svg width="52" height="52" viewBox="0 0 52 52" style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
          <circle cx="26" cy="26" r={R} fill="none" stroke="var(--border)" strokeWidth="3" />
          <circle cx="26" cy="26" r={R} fill="none"
            stroke={ready ? 'var(--accent)' : 'color-mix(in srgb,var(--accent) 60%,var(--bg-3))'}
            strokeWidth="3" strokeDasharray={`${dash} ${C}`} strokeLinecap="round"
            style={{ transition: 'stroke-dasharray .4s ease' }} />
        </svg>
        <span style={{ fontSize: 20, zIndex: 1 }}>{pu ? pu.icon : '🔒'}</span>
        <span style={{ position: 'absolute', bottom: -3, right: -3, fontSize: 9, fontWeight: 800, padding: '1px 5px', borderRadius: 8, background: ready ? 'var(--accent)' : 'var(--bg-2)', color: ready ? '#04150a' : 'var(--muted)', border: '1px solid var(--border)' }}>{pct}%</span>
      </button>
      {open && pu ? (
        <Modal onClose={() => setOpen(false)}>
          <div style={{ textAlign: 'center', padding: 8 }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>{pu.icon}</div>
            <h3 style={{ margin: '0 0 6px' }}>{pu.name}</h3>
            <div className="muted" style={{ fontSize: 13, lineHeight: 1.4, marginBottom: 12, maxWidth: 280 }}>{pu.desc}</div>
            <div className="muted small" style={{ marginBottom: 12 }}>
              {pl.powerUpUsed ? 'Already used this match.' : ready ? 'Fully charged — ready to activate!' : chargedButWaiting ? 'Fully charged — throw at least one dart this visit to activate.' : `${pct}% charged — keep hitting doubles, triples and bulls to charge.`}
            </div>
            <div className="row" style={{ gap: 8, justifyContent: 'center' }}>
              <button className="btn ghost" onClick={() => setOpen(false)}>Close</button>
              <button className="btn primary" disabled={!ready} onClick={() => { setOpen(false); onActivate(); }}>Use Power-Up</button>
            </div>
          </div>
        </Modal>
      ) : null}
    </>
  );
}

function AttributeStrip({ playerId, players, mode }: { playerId: string; players: Player[]; mode: string }) {
  if (mode !== 'battle') return null;
  const player = players.find(p => p.id === playerId);
  if (!player) return null;
  const attrs = player.attributes;
  if (!attrs) return null;
  return (
    <div className="row wrap" style={{ gap: 4, marginTop: 2 }}>
      <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--muted)' }}>❤️ {attrs.health}</span>
      <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--muted)' }}>🛡️ {attrs.armor}%</span>
      <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--muted)' }}>⚡ {attrs.power}%</span>
    </div>
  );
}

export function PlayView({ players, games, settings, activeGame, setActiveGame, setGames, setPlayers, toast, music, onQuit, onGameOver, popups }: Props) {
  const game = activeGame;
  const setGame = setActiveGame;
  const [showdown, setShowdown] = useState<Game | null>(null);

  useEffect(() => {
    if (game && !game.finished) music.startContext('match', settings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (showdown) {
    return <Showdown game={showdown} players={players} games={games} settings={settings} music={music}
      onClose={() => {
        Sound.play('showdown_close', {}, settings);
        setShowdown(null);
        music.startContext('match', settings);
      }} />;
  }

  if (game) {
    return <GameBoard game={game} setGame={setGame} settings={settings} players={players} games={games} setGames={setGames} setPlayers={setPlayers} toast={toast} music={music}
      onQuit={() => { setGame(null); onQuit(); }} onGameOver={onGameOver} popups={popups} />;
  }
  return <SetupView players={players} onStart={(mode, ids, dbl, legs, teamMode, teamAssignment, powerUps) => {
    const g = createGame(mode, ids, players, dbl, legs, teamMode, teamAssignment, powerUps, settings);
    Sound.play('showdown', {}, settings);
    music.stop();
    setActiveGame(g);
    setShowdown(g);
  }} />;
}

function SetupView({ players, onStart }: { players: Player[]; onStart: (mode: string, ids: string[], dbl: boolean, legs: number, teamMode: boolean, teamAssignment: number[], powerUps: boolean) => void }) {
  const [mode, setMode] = useState('301');
  const [doubleOut, setDoubleOut] = useState(false);
  const [legs, setLegs] = useState(1);
  const [picked, setPicked] = useState<string[]>(players.length ? [players[0].id] : []);
  const [teamMode, setTeamMode] = useState(false);
  const [powerUps, setPowerUps] = useState(false);
  const [teams, setTeams] = useState<number[]>([]);
  const [teamCount, setTeamCount] = useState(2);

  useEffect(() => {
    setTeams(prev => {
      const next = picked.map((_, i) => {
        const t = prev[i];
        if (t == null || t >= teamCount) return i % teamCount;
        return t;
      });
      return next;
    });
  }, [picked, teamCount]);

  if (!players.length) return <div className="view-scroll"><div className="card empty">Add a player before starting a game.</div></div>;
  const m = MODES[mode];
  const noX01 = !!(m.practice || m.atc || m.killer || m.party);

  const teamValid = !teamMode || (picked.length >= teamCount && teams.every(t => t != null && t < teamCount) && new Set(teams).size >= 1);

  return (
    <div className="view-scroll">
      <div className="card">
        <h2 style={{ marginBottom: 14 }}>New Game</h2>
        <label className="field"><span>Game Mode</span>
          <select value={mode} onChange={e => setMode(e.target.value)}>
            <option value="501">501</option><option value="301">301</option>
            <option value="701">701</option><option value="101">101</option>
            <option value="atc">Around the Clock</option><option value="practice">Practice (free scoring)</option>
            <option value="killer">Killer (elimination)</option>
            <option value="speed101">Speed 101 (party)</option>
            <option value="highscore">High Score (party)</option>
            <option value="battle">Battle (attributes)</option>
          </select>
        </label>
        {!noX01 && <label className="field"><span>Finish</span>
          <select value={doubleOut ? '1' : '0'} onChange={e => setDoubleOut(e.target.value === '1')}>
            <option value="0">Straight Out</option>
            <option value="1">Double Out</option>
          </select>
        </label>}
        {!noX01 && <label className="field"><span>Best of (legs)</span>
          <select value={legs} onChange={e => setLegs(+e.target.value)}>
            <option>1</option><option>3</option><option>5</option><option>7</option>
          </select>
        </label>}

        <div className="row between" style={{ margin: '10px 0 8px' }}>
          <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>Teams</span>
          <button className={teamMode ? 'pill' : 'pill'} style={{ background: teamMode ? 'var(--accent)' : 'var(--bg-3)', color: teamMode ? '#04150a' : 'var(--text)' }}
            onClick={() => setTeamMode(v => !v)}>
            {teamMode ? 'ON' : 'OFF'}
          </button>
        </div>

        <div className="row between" style={{ margin: '0 0 10px' }}>
          <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>Power-Ups</span>
          <button className="pill" style={{ background: powerUps ? 'var(--accent)' : 'var(--bg-3)', color: powerUps ? '#04150a' : 'var(--text)' }}
            onClick={() => setPowerUps(v => !v)} title="Toggle to enable equipped power-ups for this match. Power-up matches are tracked separately in stats.">
            {powerUps ? 'ON' : 'OFF'}
          </button>
        </div>
        {powerUps && (
          <div className="muted small" style={{ marginBottom: 10, fontStyle: 'italic' }}>Power-ups are active. Each player's equipped power-up charges from doubles, triples and bullseyes, then can be activated during play. Power-up games are tracked separately in Stats.</div>
        )}

        {teamMode && (
          <>
            <label className="field" style={{ marginBottom: 8 }}><span>Number of teams</span>
              <select value={teamCount} onChange={e => { const n = +e.target.value; setTeamCount(n); }}>
                <option value={2}>2 teams</option>
                <option value={3}>3 teams</option>
                <option value={4}>4 teams</option>
              </select>
            </label>
            <div className="muted small" style={{ marginBottom: 6 }}>Tap a player to cycle through teams.</div>
            <div className="row wrap" style={{ gap: 8, marginBottom: 10 }}>
              {picked.map((id, i) => {
                const p = players.find(pp => pp.id === id)!;
                const t = teams[i] ?? 0;
                const color = TEAM_COLORS[t % TEAM_COLORS.length];
                return (
                  <button key={id} className="pill" style={{ background: color, color: '#04150a', borderColor: 'transparent' }}
                    onClick={() => setTeams(prev => prev.map((x, j) => j === i ? (x + 1) % teamCount : x))}>
                    <span className="avatar" style={{ width: 18, height: 18, fontSize: 9, background: 'rgba(0,0,0,.25)' }}>{initials(p.name)}</span>
                    {p.name} · T{t + 1}
                  </button>
                );
              })}
            </div>
          </>
        )}

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
        {m.desc && <div className="muted small" style={{ marginBottom: 10, fontStyle: 'italic' }}>{m.desc}</div>}
        <details className="help-box" style={{ marginBottom: 16 }}>
          <summary>How to play {m.label}</summary>
          <ul>
            {m.rules.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </details>
        <div className="muted small" style={{ marginBottom: 16 }}>
          {picked.length === 0 ? 'Select at least one player' :
            teamMode ? (
              <div>
                <div>Teams: {teamCount} · {picked.length} players</div>
                <div style={{ marginTop: 4 }}>
                  {Array.from({ length: teamCount }, (_, ti) => {
                    const members = picked.filter((_, i) => teams[i] === ti).map(id => players.find(p => p.id === id)!.name).join(', ');
                    return <div key={ti}><b style={{ color: TEAM_COLORS[ti % TEAM_COLORS.length] }}>Team {ti + 1}:</b> {members || '—'}</div>;
                  })}
                </div>
              </div>
            )
            : 'Order: ' + picked.map(id => players.find(p => p.id === id)!.name).join(' → ')
          }
        </div>
        <button className="btn primary block" disabled={!picked.length || !teamValid}
          onClick={() => { if (!picked.length || !teamValid) return; onStart(mode, picked, doubleOut, legs, teamMode, teamMode ? teams : [], powerUps); }}>
          Start Game
        </button>
      </div>
    </div>
  );
}

function GameBoard({ game, setGame, settings, players, games, setGames, setPlayers, toast, music, onQuit, onGameOver, popups }: {
  game: Game; setGame: (g: Game | null) => void; settings: Settings; players: Player[]; games: GameRecord[];
  setGames: (updater: any) => void; setPlayers: (updater: any) => void; toast: (m: string) => void;
  music: MusicEngine; onQuit: () => void; onGameOver: () => void; popups: PopupControls;
}) {
  if (game.atc) return <AtcBoard game={game} setGame={setGame} settings={settings} toast={toast} music={music} onQuit={onQuit} setGames={setGames} setPlayers={setPlayers} />;
  if (game.mode === 'killer') return <KillerBoard game={game} setGame={setGame} settings={settings} toast={toast} music={music} onQuit={onQuit} setGames={setGames} setPlayers={setPlayers} popups={popups} onGameOver={onGameOver} />;
  if (game.mode === 'highscore') return <HighScoreBoard game={game} setGame={setGame} settings={settings} toast={toast} music={music} onQuit={onQuit} setGames={setGames} setPlayers={setPlayers} popups={popups} onGameOver={onGameOver} />;
  if (game.mode === 'battle') return <BattleBoard game={game} setGame={setGame} settings={settings} toast={toast} music={music} onQuit={onQuit} setGames={setGames} setPlayers={setPlayers} popups={popups} onGameOver={onGameOver} />;
  if (game.finished) return <GameOver game={game} onNewGame={() => { setGame(null); onGameOver(); music.startContext('setup', settings); }} onViewStats={() => { setGame(null); onGameOver(); }} />;

  const p = game.players[game.turn];
  const buffScored = game.darts.reduce((a, d) => a + d.value, 0);
  const projected = game.practice ? p.score + buffScored : p.score - buffScored;
  const others = [...game.players.slice(game.turn + 1), ...game.players.slice(0, game.turn)];
  const throwOrder = (idx: number) => (idx - game.roundStartTurn + game.players.length) % game.players.length;
  const curXp = getPlayerXPById(p.id, players);
  const curBadge = getBadgeInfo(curXp.selectedBadge);

  const curTeam = game.teamMode ? (p.team ?? 0) : -1;
  const curTeamColor = game.teamMode ? TEAM_COLORS[curTeam % TEAM_COLORS.length] : p.color;

  const addDart = (base: number, mult: number, labelOverride?: string, isBull?: boolean) => {
    const maxDarts = (game.powerUpsEnabled && (game.players[game.turn] as any)._fourthDart) ? 4 : 3;
    if (game.darts.length >= maxDarts) { toast(`${maxDarts} darts already`); return; }
    let value: number, label: string;
    if (isBull) { value = 50; label = 'Bull'; }
    else if (base === 25) { value = mult === 2 ? 50 : 25; label = mult === 2 ? 'Bull' : '25'; }
    else if (base === 0) { value = 0; label = 'Miss'; }
    else { value = base * mult; label = (mult === 2 ? 'D' : mult === 3 ? 'T' : '') + base; }
    const dart = { value, label: labelOverride || label, base, mult: isBull ? 2 : (base === 25 && value === 50 ? 2 : mult), isDouble: !!(isBull || (base === 25 && value === 50) || mult === 2), isOuter: false };
    Sound.play('dart', { score: value }, settings);
    let next: Game = { ...game, darts: [...game.darts, dart], mult: 1 };
    if (game.powerUpsEnabled) next = applyCharge(next, game.turn, chargeFromDart(dart, settings), settings);
    setGame(next);
  };

  const undoDart = () => { if (game.darts.length) setGame({ ...game, darts: game.darts.slice(0, -1) }); };

  const enterVisit = () => {
    if (!game.darts.length) { toast('Add at least one dart'); return; }
    const cur0 = game.players[game.turn] as any;
    const surgeActive = !!cur0._surgeNext;
    const rawScored = game.darts.reduce((a, d) => a + d.value, 0);
    const scored = surgeActive ? rawScored * 2 : rawScored;
    const newPlayers = game.players.map((pl, i) => i === game.turn ? { ...pl } : pl);
    const cur = newPlayers[game.turn] as any;
    if (cur._surgeNext) delete cur._surgeNext;
    if (cur._fourthDart) delete cur._fourthDart;

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
        const ros: number[][] = Array.from({ length: tc }, () => []);
        newPlayers.forEach((pl, i) => { const t = pl.team ?? 0; if (t < tc) ros[t].push(i); });
        const nextTurn = ros[nextTeam][cursors[nextTeam] % ros[nextTeam].length];
        Sound.play('win', {}, settings);
        toast(`Team ${cur.team! + 1} wins leg ${game.leg}`);
        setGame({ ...game, players: newPlayers, leg: nextLeg, turn: nextTurn, teamTurn: nextTeam, teamLegsWon: teamLegs, roundStartTurn: nextTurn, checkedOutThisRound: [], thrownThisRound: [], darts: [], mult: 1 });
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
        if (np._blockedNext || np._frozenNext) {
          const flag = np._blockedNext ? 'blocked' : 'frozen';
          g = { ...g, players: g.players.map((pl, i) => i === turn ? (() => { const c = { ...pl } as any; delete c._blockedNext; delete c._frozenNext; return c; })() : pl) };
          if (flag === 'frozen') {
            const frozenPl = g.players[turn];
            const visits = [...frozenPl.visits, { darts: [], scored: 0, remaining: frozenPl.score, leg: g.leg, frozen: true, date: new Date().toISOString() }];
            g = { ...g, players: g.players.map((pl, i) => i === turn ? { ...pl, visits } : pl), thrownThisRound: [...(g.thrownThisRound || []), frozenPl.id] };
          } else {
            g = { ...g, thrownThisRound: [...(g.thrownThisRound || []), g.players[turn].id] };
          }
          toast(`${g.players[turn].name} ${flag === 'frozen' ? 'is frozen' : 'is blocked'} — visit skipped.`);
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
      <div className="play-current" style={game.teamMode ? { borderColor: curTeamColor, boxShadow: `0 0 0 2px ${curTeamColor}33` } : {}}>
        <div className="pc-header">
          <div className="row" style={{ gap: 8 }}>
            <span className={`turn-order-badge${game.turn === game.roundStartTurn ? ' starter' : ''}`}>{throwOrder(game.turn) + 1}</span>
            <span className="avatar" style={{ width: 32, height: 32, fontSize: 16, background: p.color }}>{curBadge ? curBadge.icon : initials(p.name)}</span>
            <span className="pc-name">{p.name}</span>
            {game.teamMode && <span className="pill" style={{ background: curTeamColor, color: '#04150a' }}>Team {curTeam + 1}</span>}
          </div>
          <div className="row" style={{ gap: 6 }}>
            {game.teamMode && game.legsBestOf > 1 ? <span className="pill" style={{ background: curTeamColor, color: '#04150a' }}>{(game.teamLegsWon || [])[curTeam] || 0} legs</span> : null}
            {!game.teamMode && game.legsBestOf > 1 ? <span className="pill">{p.legsWon} legs</span> : null}
            <span className="muted small">{game.practice ? 'PRACTICE' : `LEG ${game.leg} · ${game.doubleOut ? 'DOUBLE OUT' : 'STRAIGHT OUT'}`}</span>
          </div>
        </div>
        <div className="pc-remaining" style={{ color: projected < 0 ? 'var(--danger)' : 'var(--text)' }}>{projected}</div>
        <div className="checkout-hint center">{checkoutHint(game.practice ? null : projected, game.doubleOut, game.practice)}</div>
        <div className="pc-slots">
          {Array.from({ length: (game.powerUpsEnabled && (p as any)._fourthDart) ? 4 : 3 }).map((_, i) => { const d = game.darts[i]; return <div key={i} className={`pc-slot${d ? ' filled' : ''}`} style={i === 3 ? { borderColor: 'var(--accent)' } : {}}>{d ? d.label : (i === 3 ? '🎯' : '–')}</div>; })}
        </div>
        <div className="muted small">This visit: <b style={{ color: 'var(--text)' }}>{buffScored}</b> · Darts thrown: <b style={{ color: 'var(--text)' }}>{(p.visits.reduce((a, v) => a + v.darts.length, 0)) + game.darts.length}</b></div>
        <AttributeStrip playerId={p.id} players={players} mode={game.mode} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
          <PowerUpOrb game={game} curIdx={game.turn} settings={settings} toast={toast} onActivate={() => {
            const next = activatePowerUp(game, game.turn, settings, toast);
            if (next) setGame(next);
          }} />
        </div>
      </div>

      {game.players.length > 1 && (
        <div className="play-others">
          {others.map(pl => {
            const xpInfo = getPlayerXPById(pl.id, players);
            const li = levelFromXP(xpInfo.xp, settings);
            const ti = getTitleInfo(xpInfo.selectedTitle, settings.customTitles);
            const bi = getBadgeInfo(xpInfo.selectedBadge);
            const badge = leadTrailBadge(pl, game);
            const plTeam = game.teamMode ? (pl.team ?? 0) : -1;
            const plTeamColor = game.teamMode ? TEAM_COLORS[plTeam % TEAM_COLORS.length] : pl.color;
            return (
              <div key={pl.id} className="play-other" style={game.teamMode ? { borderColor: plTeamColor } : {}}>
                <div className="row between">
                  <div className="row" style={{ gap: 6 }}>
                    <span className={`turn-order-badge${game.players.indexOf(pl) === game.roundStartTurn ? ' starter' : ''}`} style={{ width: 18, height: 18, fontSize: 10 }}>{throwOrder(game.players.indexOf(pl)) + 1}</span>
                    <span className="avatar" style={{ width: 22, height: 22, fontSize: 12, background: pl.color }}>{bi ? bi.icon : initials(pl.name)}</span>
                    <span className="po-name">{pl.name}</span>
                    {game.teamMode && <span style={{ fontSize: 9, fontWeight: 800, color: plTeamColor }}>T{plTeam + 1}</span>}
                  </div>
                  <div className="row" style={{ gap: 4 }}>
                    {game.teamMode && game.legsBestOf > 1 ? <span className="pill" style={{ fontSize: 10, background: plTeamColor, color: '#04150a' }}>{(game.teamLegsWon || [])[plTeam] || 0}</span> : null}
                    {!game.teamMode && game.legsBestOf > 1 ? <span className="pill" style={{ fontSize: 10 }}>{pl.legsWon}</span> : null}
                    {badge ? <span className={`lead-badge ${badge.startsWith('+') ? 'lead' : 'trail'}`}>{badge}</span> : null}
                  </div>
                </div>
                <div className="po-score">{pl.score}</div>
                <div className="po-sub">avg {visitAvg(pl).toFixed(1)} · {pl.visits.reduce((a, v) => a + v.darts.length, 0)} 🎯 · L{li.level}{ti ? ` · ${ti.icon || ''} ${ti.name}` : ''}</div>
                <AttributeStrip playerId={pl.id} players={players} mode={game.mode} />
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

function AtcBoard({ game, setGame, settings, toast, music, onQuit, setGames, setPlayers }: {
  game: Game; setGame: (g: Game | null) => void; settings: Settings; toast: (m: string) => void; music: MusicEngine; onQuit: () => void; setGames: (updater: any) => void; setPlayers: (updater: any) => void;
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
      awardBadges(finished, setPlayers);
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
  const isTeamWin = !!(game.teamMode && game.winningTeam != null);
  const winningTeamPlayers = isTeamWin ? game.players.filter(pl => pl.team === game.winningTeam) : [];
  const winningTeamColor = isTeamWin ? TEAM_COLORS[game.winningTeam! % TEAM_COLORS.length] : 'var(--accent)';
  const titleText = game.practice ? 'Practice complete' : isTie ? "It's a tie!" : isTeamWin ? `Team ${game.winningTeam! + 1} wins!` : (w ? `${w.name} wins!` : 'Game over');
  const badgeMap = useMemo(() => computeGameBadges(game), [game]);
  const anyBadges = Object.values(badgeMap).some((arr) => arr.length > 0);
  const [badgeInfo, setBadgeInfo] = useState<{ icon: string; name: string; desc: string; player: string } | null>(null);
  return (
    <div className="view-scroll">
      <div className="card center">
        <div style={{ fontSize: 44 }}>{isTie ? '🤝' : isTeamWin ? '🛡️' : '🏆'}</div>
        <h2 style={{ margin: '8px 0', color: isTeamWin ? winningTeamColor : 'var(--text)' }}>{titleText}</h2>
        {isTeamWin ? (
          <div style={{ marginBottom: 10 }}>
            <div className="muted small" style={{ marginBottom: 6 }}>Team {game.winningTeam! + 1} · {TEAM_NAMES[game.winningTeam! % TEAM_NAMES.length]}</div>
            <div className="row wrap" style={{ justifyContent: 'center', gap: 8 }}>
              {winningTeamPlayers.map(pl => (
                <span key={pl.id} className="pill" style={{ background: pl.color, color: '#0b0e13' }}>
                  <span className="avatar" style={{ width: 18, height: 18, fontSize: 9, background: 'rgba(0,0,0,.2)' }}>{initials(pl.name)}</span>{pl.name}
                </span>
              ))}
            </div>
          </div>
        ) : isTie ? <div className="muted small" style={{ marginBottom: 8 }}>{tiedNames.join(' & ')}</div> : null}
        {game.teamMode && game.teamLegsWon ? (
          <div className="row" style={{ justifyContent: 'center', gap: 8, margin: '8px 0 14px' }}>
            {game.teamLegsWon.map((legs, ti) => (
              <span key={ti} className="pill" style={{ background: TEAM_COLORS[ti % TEAM_COLORS.length], color: '#04150a' }}>Team {ti + 1}: {legs}</span>
            ))}
          </div>
        ) : null}
        <div className="grid grid-2" style={{ margin: '14px 0' }}>
          {game.players.map(pl => {
            const best = Math.max(0, ...pl.visits.filter((v: any) => !v.bust).map((v: any) => v.scored));
            return [
              <div key={pl.id + 'a'} className="stat"><div className="v">{visitAvg(pl).toFixed(1)}</div><div className="l">{pl.name} avg</div></div>,
              <div key={pl.id + 'b'} className="stat"><div className="v">{best}</div><div className="l">{pl.name} best</div></div>,
            ];
          })}
        </div>
        {anyBadges && (
          <div style={{ margin: '14px 0', textAlign: 'left' }}>
            <h3 style={{ margin: '0 0 8px', textAlign: 'center' }}>Badges Earned</h3>
            {game.players.map(pl => {
              const ids = badgeMap[pl.id] || [];
              if (!ids.length) return null;
              return (
                <div key={pl.id} style={{ marginBottom: 10, padding: 10, borderRadius: 12, background: 'var(--bg-3)', border: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 700, marginBottom: 6, color: pl.color }}>{pl.name}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {ids.map((id) => {
                      const b = getBadgeInfo(id);
                      if (!b) return null;
                      return (
                        <button key={id} onClick={() => setBadgeInfo({ icon: b.icon, name: b.name, desc: b.desc, player: pl.name })}
                          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 999, background: 'color-mix(in srgb,var(--accent) 18%,var(--bg-2))', border: '1px solid color-mix(in srgb,var(--accent) 40%,var(--bg-2))', cursor: 'pointer' }}>
                          <span style={{ fontSize: 18 }}>{b.icon}</span>
                          <span style={{ fontWeight: 600, fontSize: 13 }}>{b.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <button className="btn primary block" onClick={onNewGame}>New Game</button>
        <button className="btn ghost block" style={{ marginTop: 8 }} onClick={onViewStats}>View Stats</button>
      </div>
      {badgeInfo && <BadgeInfoPopup icon={badgeInfo.icon} name={badgeInfo.name} desc={badgeInfo.desc} player={badgeInfo.player} onDone={() => setBadgeInfo(null)} />}
    </div>
  );
}

function runMilestones(p: GamePlayer, remaining: number, visitScore: number, settings: Settings, popups: PopupControls, setPlayers: (updater: any) => void, game: Game, players: Player[], games: GameRecord[]) {
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

function awardBadges(game: Game, setPlayers: (updater: any) => void) {
  const map = computeGameBadges(game);
  setPlayers((prev: Player[]) => prev.map(p => {
    const ids = map[p.id] || [];
    if (!ids.length) return p;
    const existing = new Set(p.unlockedBadges || []);
    const counts: Record<string, number> = { ...(p.badgeCounts || {}) };
    let changed = false;
    const uniqueThisGame = Array.from(new Set(ids));
    uniqueThisGame.forEach((id) => {
      if (!existing.has(id)) { existing.add(id); changed = true; }
      counts[id] = (counts[id] || 0) + 1;
      changed = true;
    });
    return changed ? { ...p, unlockedBadges: Array.from(existing), badgeCounts: counts } : p;
  }));
}

function finishSimpleGame(g: Game, winner: GamePlayer | null, settings: Settings, setGame: (g: Game | null) => void, setGames: (updater: any) => void, setPlayers: (updater: any) => void, popups: PopupControls, music: MusicEngine, players: Player[], games: GameRecord[]) {
  if (g.finished) return;
  const finished: Game = { ...g, finished: true, winner: winner ? winner.id : null, tied: false, tiedPlayers: null };
  Sound.play('win', {}, settings);
  music.startContext('setup', settings);
  setGames((prev: GameRecord[]) => [...prev, recordFromGame(finished)]);
  if (winner) awardXP(winner.id, settings.xpConfig.win, 'Winning the game', settings, setPlayers, popups);
  finished.players.forEach(pl => checkTitleUnlocks(pl, settings, popups, setPlayers, finished, players, games));
  awardBadges(finished, setPlayers);
  setGame(finished);
}

function KillerBoard({ game, setGame, settings, toast, music, onQuit, setGames, setPlayers, popups, onGameOver }: {
  game: Game; setGame: (g: Game | null) => void; settings: Settings; toast: (m: string) => void; music: MusicEngine; onQuit: () => void; setGames: (updater: any) => void; setPlayers: (updater: any) => void; popups: PopupControls; onGameOver: () => void;
}) {
  const p = game.players[game.turn];
  const others = [...game.players.slice(game.turn + 1), ...game.players.slice(0, game.turn)];
  const alive = game.players.filter(pl => !pl.eliminated);

  const addDart = (base: number, mult: number, labelOverride?: string, isBull?: boolean) => {
    const maxDarts = (game.powerUpsEnabled && (game.players[game.turn] as any)._fourthDart) ? 4 : 3;
    if (game.darts.length >= maxDarts) { toast(`${maxDarts} darts already`); return; }
    let value: number, label: string;
    if (isBull) { value = 50; label = 'Bull'; }
    else if (base === 25) { value = mult === 2 ? 50 : 25; label = mult === 2 ? 'Bull' : '25'; }
    else if (base === 0) { value = 0; label = 'Miss'; }
    else { value = base * mult; label = (mult === 2 ? 'D' : mult === 3 ? 'T' : '') + base; }
    const dart = { value, label: labelOverride || label, base, mult: isBull ? 2 : (base === 25 && value === 50 ? 2 : mult), isDouble: !!(isBull || (base === 25 && value === 50) || mult === 2), isOuter: false };
    Sound.play('dart', { score: value }, settings);
    let next: Game = { ...game, darts: [...game.darts, dart], mult: 1 };
    if (game.powerUpsEnabled) next = applyCharge(next, game.turn, chargeFromDart(dart, settings), settings);
    setGame(next);
  };

  const undoDart = () => { if (game.darts.length) setGame({ ...game, darts: game.darts.slice(0, -1) }); };

  const enterVisit = () => {
    if (!game.darts.length) { toast('Add at least one dart'); return; }
    const newPlayers = game.players.map(pl => ({ ...pl }));
    const cur = newPlayers[game.turn] as any;
    if (cur._fourthDart) delete cur._fourthDart;
    const isKiller = (cur.killerHits || 0) >= 5;
    let killedThisVisit: { killer: string; victim: string } | null = null;
    const dartsLog: any[] = [];

    for (const dart of game.darts) {
      dartsLog.push(dart);
      if (dart.base === 0) continue;
      if (!isKiller) {
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

    const scored = game.darts.reduce((a, d) => a + d.value, 0);
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
    let nextTurn = (game.turn + 1) % game.players.length;
    while (newPlayers[nextTurn].eliminated) nextTurn = (nextTurn + 1) % game.players.length;
    if (game.powerUpsEnabled) {
      let guards = 0;
      while (guards < newPlayers.length) {
        const np = newPlayers[nextTurn] as any;
        if (np._blockedNext || np._frozenNext) {
          const flag = np._blockedNext ? 'blocked' : 'frozen';
          delete np._blockedNext; delete np._frozenNext;
          if (flag === 'frozen') {
            np.visits.push({ darts: [], scored: 0, remaining: np.lives, leg: 1, mode: 'killer', date: new Date().toISOString(), frozen: true, hits: (np.kills || []).length });
          }
          toast(`${np.name} ${flag === 'frozen' ? 'is frozen' : 'is blocked'} — visit skipped.`);
          nextTurn = (nextTurn + 1) % newPlayers.length;
          while (newPlayers[nextTurn].eliminated) nextTurn = (nextTurn + 1) % newPlayers.length;
          guards++;
        } else break;
      }
    }
    setGame({ ...finishedState, turn: nextTurn });
  };

  if (game.finished) return <GameOver game={game} onNewGame={() => { setGame(null); onGameOver(); music.startContext('setup', settings); }} onViewStats={() => { setGame(null); onGameOver(); }} />;

  return (
    <div className="view-noscroll">
      <div className="play-current">
        <div className="pc-header">
          <div className="row" style={{ gap: 8 }}>
            <span className="avatar" style={{ width: 32, height: 32, fontSize: 13, background: p.color }}>{initials(p.name)}</span>
            <span className="pc-name">{p.name}</span>
            {(p.killerHits || 0) >= 5 && <span className="pill" style={{ background: '#ef4444', color: '#fff', fontSize: 10 }}>KILLER</span>}
          </div>
          <span className="muted small">KILLER · {alive.length} ALIVE</span>
        </div>
        <div className="pc-remaining" style={{ fontSize: 28 }}>
          {(p.killerHits || 0) >= 5 ? '🎯 Aim at opponents' : `Hit ${p.killerNumber}`}
        </div>
        <div className="checkout-hint center">
          {(p.killerHits || 0) < 5 ? `Become a Killer: ${p.killerHits || 0}/5 hits on ${p.killerNumber}` : 'Hit opponent numbers to eliminate them'}
        </div>
        <div className="pc-slots">
          {Array.from({ length: (game.powerUpsEnabled && (p as any)._fourthDart) ? 4 : 3 }).map((_, i) => { const d = game.darts[i]; return <div key={i} className={`pc-slot${d ? ' filled' : ''}`} style={i === 3 ? { borderColor: 'var(--accent)' } : {}}>{d ? d.label : (i === 3 ? '🎯' : '–')}</div>; })}
        </div>
        <div className="muted small">Lives: <b style={{ color: 'var(--text)' }}>{'❤️'.repeat(p.lives || 0) || 'none'}</b></div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
          <PowerUpOrb game={game} curIdx={game.turn} settings={settings} toast={toast} onActivate={() => {
            const next = activatePowerUp(game, game.turn, settings, toast);
            if (next) setGame(next);
          }} />
        </div>
      </div>

      <div className="play-others">
        {others.filter(pl => !pl.eliminated).map(pl => (
          <div key={pl.id} className="play-other">
            <div className="row between">
              <div className="row" style={{ gap: 6 }}>
                <span className="avatar" style={{ width: 22, height: 22, fontSize: 10, background: pl.color }}>{initials(pl.name)}</span>
                <span className="po-name">{pl.name}</span>
                {(pl.killerHits || 0) >= 5 && <span className="pill" style={{ background: '#ef4444', color: '#fff', fontSize: 9 }}>KILLER</span>}
              </div>
              <span className="pill" style={{ fontSize: 10 }}>{'❤️'.repeat(pl.lives || 0) || '💀'}</span>
            </div>
            <div className="po-score">#{pl.killerNumber}</div>
            <div className="po-sub">{(pl.killerHits || 0) >= 5 ? 'Killer' : `${pl.killerHits || 0}/5 to kill`} · {pl.kills?.length || 0} kills</div>
          </div>
        ))}
      </div>

      <div className="play-input">
        <div className="pad-card">
          <div className="mult">
            <button className={game.mult === 1 ? 'on' : ''} onClick={() => setGame({ ...game, mult: 1 })}>Single</button>
            <button className={game.mult === 2 ? 'on' : ''} onClick={() => setGame({ ...game, mult: 2 })}>Double</button>
            <button className={game.mult === 3 ? 'on' : ''} onClick={() => setGame({ ...game, mult: 3 })}>Triple</button>
          </div>
          <div className="keypad">
            {[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20].map(n => (
              <button key={n} className={`key${n === p.killerNumber ? ' killer-target' : ''}`} onClick={() => addDart(n, game.mult)}>{n}</button>
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
      <button className="btn danger sm" style={{ alignSelf: 'flex-end' }} onClick={() => { if (confirm('Quit this game?')) onQuit(); }}>Quit</button>
    </div>
  );
}

const HIGH_SCORE_VISITS = 7;

function HighScoreBoard({ game, setGame, settings, toast, music, onQuit, setGames, setPlayers, popups, onGameOver }: {
  game: Game; setGame: (g: Game | null) => void; settings: Settings; toast: (m: string) => void; music: MusicEngine; onQuit: () => void; setGames: (updater: any) => void; setPlayers: (updater: any) => void; popups: PopupControls; onGameOver: () => void;
}) {
  const p = game.players[game.turn];
  const others = [...game.players.slice(game.turn + 1), ...game.players.slice(0, game.turn)];
  const visitNum = p.visits.length + 1;

  const addDart = (base: number, mult: number, labelOverride?: string, isBull?: boolean) => {
    const maxDarts = (game.powerUpsEnabled && (game.players[game.turn] as any)._fourthDart) ? 4 : 3;
    if (game.darts.length >= maxDarts) { toast(`${maxDarts} darts already`); return; }
    let value: number, label: string;
    if (isBull) { value = 50; label = 'Bull'; }
    else if (base === 25) { value = mult === 2 ? 50 : 25; label = mult === 2 ? 'Bull' : '25'; }
    else if (base === 0) { value = 0; label = 'Miss'; }
    else { value = base * mult; label = (mult === 2 ? 'D' : mult === 3 ? 'T' : '') + base; }
    const dart = { value, label: labelOverride || label, base, mult: isBull ? 2 : (base === 25 && value === 50 ? 2 : mult), isDouble: !!(isBull || (base === 25 && value === 50) || mult === 2), isOuter: false };
    Sound.play('dart', { score: value }, settings);
    let next: Game = { ...game, darts: [...game.darts, dart], mult: 1 };
    if (game.powerUpsEnabled) next = applyCharge(next, game.turn, chargeFromDart(dart, settings), settings);
    setGame(next);
  };

  const undoDart = () => { if (game.darts.length) setGame({ ...game, darts: game.darts.slice(0, -1) }); };

  const enterVisit = () => {
    if (!game.darts.length) { toast('Add at least one dart'); return; }
    const cur0 = game.players[game.turn] as any;
    const surgeActive = !!cur0._surgeNext;
    const rawScored = game.darts.reduce((a, d) => a + d.value, 0);
    const scored = surgeActive ? rawScored * 2 : rawScored;
    const newPlayers = game.players.map((pl, i) => i === game.turn ? { ...pl } : pl);
    const cur = newPlayers[game.turn] as any;
    if (cur._surgeNext) delete cur._surgeNext;
    if (cur._fourthDart) delete cur._fourthDart;
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
    let nextTurn = (game.turn + 1) % game.players.length;
    while (newPlayers[nextTurn].visits.length >= HIGH_SCORE_VISITS) nextTurn = (nextTurn + 1) % newPlayers.length;
    if (game.powerUpsEnabled) {
      let guards = 0;
      while (guards < newPlayers.length) {
        const np = newPlayers[nextTurn] as any;
        if (np._blockedNext || np._frozenNext) {
          const flag = np._blockedNext ? 'blocked' : 'frozen';
          delete np._blockedNext; delete np._frozenNext;
          if (flag === 'frozen') {
            np.visits.push({ darts: [], scored: 0, remaining: np.score, leg: 1, mode: 'highscore', date: new Date().toISOString(), frozen: true });
          }
          toast(`${np.name} ${flag === 'frozen' ? 'is frozen' : 'is blocked'} — visit skipped.`);
          nextTurn = (nextTurn + 1) % newPlayers.length;
          while (newPlayers[nextTurn].visits.length >= HIGH_SCORE_VISITS) nextTurn = (nextTurn + 1) % newPlayers.length;
          guards++;
        } else break;
      }
    }
    setGame({ ...finishedState, turn: nextTurn });
  };

  if (game.finished) return <GameOver game={game} onNewGame={() => { setGame(null); onGameOver(); music.startContext('setup', settings); }} onViewStats={() => { setGame(null); onGameOver(); }} />;

  return (
    <div className="view-noscroll">
      <div className="play-current">
        <div className="pc-header">
          <div className="row" style={{ gap: 8 }}>
            <span className="avatar" style={{ width: 32, height: 32, fontSize: 13, background: p.color }}>{initials(p.name)}</span>
            <span className="pc-name">{p.name}</span>
          </div>
          <span className="muted small">HIGH SCORE · VISIT {visitNum}/{HIGH_SCORE_VISITS}</span>
        </div>
        <div className="pc-remaining">{p.score}</div>
        <div className="checkout-hint center">{visitNum >= HIGH_SCORE_VISITS ? 'Final visit — go big!' : 'Score as high as you can!'}</div>
        <div className="pc-slots">
          {Array.from({ length: (game.powerUpsEnabled && (p as any)._fourthDart) ? 4 : 3 }).map((_, i) => { const d = game.darts[i]; return <div key={i} className={`pc-slot${d ? ' filled' : ''}`} style={i === 3 ? { borderColor: 'var(--accent)' } : {}}>{d ? d.label : (i === 3 ? '🎯' : '–')}</div>; })}
        </div>
        <div className="muted small">This visit: <b style={{ color: 'var(--text)' }}>{game.darts.reduce((a, d) => a + d.value, 0)}</b></div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
          <PowerUpOrb game={game} curIdx={game.turn} settings={settings} toast={toast} onActivate={() => {
            const next = activatePowerUp(game, game.turn, settings, toast);
            if (next) setGame(next);
          }} />
        </div>
      </div>

      {game.players.length > 1 && (
        <div className="play-others">
          {others.map(pl => (
            <div key={pl.id} className="play-other">
              <div className="row between">
                <div className="row" style={{ gap: 6 }}>
                  <span className="avatar" style={{ width: 22, height: 22, fontSize: 10, background: pl.color }}>{initials(pl.name)}</span>
                  <span className="po-name">{pl.name}</span>
                </div>
                <span className="pill" style={{ fontSize: 10 }}>{pl.visits.length}/{HIGH_SCORE_VISITS}</span>
              </div>
              <div className="po-score">{pl.score}</div>
              <div className="po-sub">avg {visitAvg(pl).toFixed(1)}</div>
            </div>
          ))}
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
      <button className="btn danger sm" style={{ alignSelf: 'flex-end' }} onClick={() => { if (confirm('Quit this game?')) onQuit(); }}>Quit</button>
    </div>
  );
}

function BattleBoard({ game, setGame, settings, toast, music, onQuit, setGames, setPlayers, popups, onGameOver }: {
  game: Game; setGame: (g: Game | null) => void; settings: Settings; toast: (m: string) => void; music: MusicEngine; onQuit: () => void; setGames: (updater: any) => void; setPlayers: (updater: any) => void; popups: PopupControls; onGameOver: () => void;
}) {
  const [targetId, setTargetId] = useState<string | null>(null);
  const [shaking, setShaking] = useState<Record<string, number>>({});
  const [lastHit, setLastHit] = useState<{ target: string; damage: number } | null>(null);
  const p = game.players[game.turn];
  const others = [...game.players.slice(game.turn + 1), ...game.players.slice(0, game.turn)];
  const alive = game.players.filter(pl => !pl.defeated);
  const aliveOthers = others.filter(pl => !pl.defeated);

  useEffect(() => {
    if (aliveOthers.length === 1) setTargetId(aliveOthers[0].id);
    else setTargetId(null);
  }, [game.turn, aliveOthers.length]);

  const triggerShake = (id: string) => {
    setShaking(s => ({ ...s, [id]: (s[id] || 0) + 1 }));
  };

  const addDart = (base: number, mult: number, labelOverride?: string, isBull?: boolean) => {
    const maxDarts = (game.powerUpsEnabled && (game.players[game.turn] as any)._fourthDart) ? 4 : 3;
    if (game.darts.length >= maxDarts) { toast(`${maxDarts} darts already`); return; }
    let value: number, label: string;
    if (isBull) { value = 50; label = 'Bull'; }
    else if (base === 25) { value = mult === 2 ? 50 : 25; label = mult === 2 ? 'Bull' : '25'; }
    else if (base === 0) { value = 0; label = 'Miss'; }
    else { value = base * mult; label = (mult === 2 ? 'D' : mult === 3 ? 'T' : '') + base; }
    const dart = { value, label: labelOverride || label, base, mult: isBull ? 2 : (base === 25 && value === 50 ? 2 : mult), isDouble: !!(isBull || (base === 25 && value === 50) || mult === 2), isOuter: false };
    Sound.play('dart', { score: value }, settings);
    let next: Game = { ...game, darts: [...game.darts, dart], mult: 1 };
    if (game.powerUpsEnabled) next = applyCharge(next, game.turn, chargeFromDart(dart, settings), settings);
    setGame(next);
  };

  const undoDart = () => { if (game.darts.length) setGame({ ...game, darts: game.darts.slice(0, -1) }); };

  const enterVisit = () => {
    if (!game.darts.length) { toast('Add at least one dart'); return; }
    const cur0 = game.players[game.turn] as any;
    const surgeActive = !!cur0._surgeNext;
    const rawScored = game.darts.reduce((a, d) => a + d.value, 0);
    const scored = surgeActive ? rawScored * 2 : rawScored;
    const newPlayers = game.players.map((pl, i) => i === game.turn ? { ...pl } : pl);
    const cur = newPlayers[game.turn] as any;
    if (cur._surgeNext) delete cur._surgeNext;
    if (cur._fourthDart) delete cur._fourthDart;

    let target = targetId;
    const aliveTargets = newPlayers.filter((pl: any) => pl.id !== cur.id && !pl.defeated);
    if (aliveTargets.length === 1) target = aliveTargets[0].id;
    if (!target) { toast('Pick a target to attack'); return; }
    const victim = newPlayers.find((pl: any) => pl.id === target);
    if (!victim || victim.defeated) { toast('That opponent is already defeated'); return; }

    const damage = computeBattleDamage(scored, cur.powerPct || 0, victim.armorPct || 0, settings);
    victim.hp = Math.max(0, (victim.hp || 0) - damage);
    cur.damageDealt = (cur.damageDealt || 0) + damage;
    victim.damageTaken = (victim.damageTaken || 0) + damage;
    cur.attacks = [...(cur.attacks || []), { target: victim.id, damage, visit: cur.visits.length + 1, date: new Date().toISOString() }];
    cur.score += scored;
    cur.visits.push({ darts: [...game.darts], scored, remaining: cur.hp, leg: 1, mode: 'battle', date: new Date().toISOString() });
    cur.dartsThrown += game.darts.length;
    Sound.play('impact', {}, settings);
    setLastHit({ target: victim.id, damage });
    triggerShake(victim.id);

    if (victim.hp <= 0 && !victim.defeated) {
      victim.defeated = true;
      popups.setKill({ killer: cur.name, victim: victim.name });
      Sound.play('kill', {}, settings);
    }

    if (settings.popups.scores) {
      for (const sp of SCORE_POPUPS) { if (scored >= sp.min) { popups.setMilestone({ emoji: sp.emoji, title: sp.title, sub: sp.sub }); Sound.play('milestone', {}, settings); break; } }
    }

    const remainingAlive = newPlayers.filter((pl: any) => !pl.defeated);
    const finishedState = { ...game, players: newPlayers, darts: [], mult: 1 };
    if (remainingAlive.length <= 1) {
      const winner = remainingAlive[0] || null;
      setTimeout(() => finishSimpleGame(finishedState, winner, settings, setGame, setGames, setPlayers, popups, music, [], []), 1200);
      return;
    }
    Sound.play('enter', {}, settings);
    let nextTurn = (game.turn + 1) % newPlayers.length;
    while (newPlayers[nextTurn].defeated) nextTurn = (nextTurn + 1) % newPlayers.length;
    if (game.powerUpsEnabled) {
      let guards = 0;
      while (guards < newPlayers.length) {
        const np = newPlayers[nextTurn] as any;
        if (np._blockedNext || np._frozenNext) {
          const flag = np._blockedNext ? 'blocked' : 'frozen';
          delete np._blockedNext; delete np._frozenNext;
          if (flag === 'frozen') {
            np.visits.push({ darts: [], scored: 0, remaining: np.hp, leg: 1, mode: 'battle', date: new Date().toISOString(), frozen: true });
          }
          toast(`${np.name} ${flag === 'frozen' ? 'is frozen' : 'is blocked'} — visit skipped.`);
          nextTurn = (nextTurn + 1) % newPlayers.length;
          while (newPlayers[nextTurn].defeated) nextTurn = (nextTurn + 1) % newPlayers.length;
          guards++;
        } else break;
      }
    }
    setGame({ ...finishedState, turn: nextTurn });
  };

  if (game.finished) return <GameOver game={game} onNewGame={() => { setGame(null); onGameOver(); music.startContext('setup', settings); }} onViewStats={() => { setGame(null); onGameOver(); }} />;

  const hpPct = (pl: any) => Math.max(0, Math.min(100, ((pl.hp || 0) / (pl.maxHp || 1)) * 100));

  return (
    <div className="view-noscroll">
      <div className="play-current">
        <div className="pc-header">
          <div className="row" style={{ gap: 8 }}>
            <span className="avatar" style={{ width: 32, height: 32, fontSize: 13, background: p.color }}>{initials(p.name)}</span>
            <span className="pc-name">{p.name}</span>
          </div>
          <span className="muted small">BATTLE · {alive.length} ALIVE</span>
        </div>
        <div className="pc-remaining" style={{ fontSize: 28 }}>{p.hp} HP</div>
        <div className="checkout-hint center">❤️ {p.hp}/{p.maxHp} · 🛡️ {p.armorPct}% armor · ⚡ {p.powerPct}% power</div>
        <div style={{ width: '100%', height: 8, borderRadius: 4, background: 'var(--bg-3)', overflow: 'hidden', margin: '4px 0' }}>
          <div style={{ height: '100%', width: `${hpPct(p)}%`, background: p.color, transition: 'width .3s' }} />
        </div>
        <div className="pc-slots">
          {Array.from({ length: (game.powerUpsEnabled && (p as any)._fourthDart) ? 4 : 3 }).map((_, i) => { const d = game.darts[i]; return <div key={i} className={`pc-slot${d ? ' filled' : ''}`} style={i === 3 ? { borderColor: 'var(--accent)' } : {}}>{d ? d.label : (i === 3 ? '🎯' : '–')}</div>; })}
        </div>
        <div className="muted small">This visit: <b style={{ color: 'var(--text)' }}>{game.darts.reduce((a, d) => a + d.value, 0)}</b>{lastHit && lastHit.target ? <span style={{ marginLeft: 8, color: 'var(--danger)' }}> · {lastHit.damage} dmg → {game.players.find(pl => pl.id === lastHit.target)?.name || 'target'}</span> : null}</div>
        {aliveOthers.length > 1 && (
          <div style={{ width: '100%', marginTop: 6 }}>
            <div className="muted small" style={{ marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>Attack target</div>
            <div className="row wrap" style={{ gap: 6 }}>
              {aliveOthers.map(pl => (
                <button key={pl.id} className="pill" style={{ background: targetId === pl.id ? pl.color : 'var(--bg-3)', color: targetId === pl.id ? '#0b0e13' : 'var(--text)', cursor: 'pointer' }}
                  onClick={() => setTargetId(pl.id)}>
                  <span className="avatar" style={{ width: 18, height: 18, fontSize: 9, background: targetId === pl.id ? 'rgba(0,0,0,.2)' : pl.color }}>{initials(pl.name)}</span>{pl.name}
                </button>
              ))}
            </div>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
          <PowerUpOrb game={game} curIdx={game.turn} settings={settings} toast={toast} onActivate={() => {
            const next = activatePowerUp(game, game.turn, settings, toast);
            if (next) setGame(next);
          }} />
        </div>
      </div>

      <div className="play-others">
        {others.map(pl => {
          const shake = shaking[pl.id] || 0;
          const defeated = pl.defeated;
          return (
            <div key={`${pl.id}-${shake}`} className="play-other" style={{
              ...(defeated ? { opacity: 0.4, filter: 'grayscale(.6)' } : {}),
              animation: shake > 0 ? `dmgShake${shake % 2 === 0 ? 'B' : 'A'} .4s ease` : undefined,
            }}
            >
              <div className="row between">
                <div className="row" style={{ gap: 6 }}>
                  <span className="avatar" style={{ width: 22, height: 22, fontSize: 10, background: pl.color }}>{initials(pl.name)}</span>
                  <span className="po-name">{pl.name}</span>
                  {defeated && <span className="pill" style={{ fontSize: 9, background: '#ef4444', color: '#fff' }}>DEFEATED</span>}
                </div>
                <span className="pill" style={{ fontSize: 10 }}>{pl.hp} HP</span>
              </div>
              <div style={{ marginTop: 4, height: 6, borderRadius: 3, background: 'var(--bg-3)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${hpPct(pl)}%`, background: pl.color, transition: 'width .3s' }} />
              </div>
              <div className="po-sub">🛡️ {pl.armorPct}% · ⚡ {pl.powerPct}%{pl.damageDealt ? ` · 💥 ${pl.damageDealt}` : ''}</div>
            </div>
          );
        })}
      </div>

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
            <button className="btn block primary" onClick={enterVisit}>Attack!</button>
          </div>
        </div>
      </div>
      <button className="btn danger sm" style={{ alignSelf: 'flex-end' }} onClick={() => { if (confirm('Quit this game?')) onQuit(); }}>Quit</button>
    </div>
  );
}

const SHOWDOWN_TAGLINES = [
  'The oche is set.', 'Let the darts fly.', 'Three darts. One winner.', 'Steady hand, sharp eye.',
  'No mercy on the board.', 'Aim true.', 'Chalk ready, game on.', 'Bullseye or bust.',
  'Leg by leg.', 'The crowd goes quiet...', 'Tension rising.', 'One leg closer to glory.',
];

function pickTagline(seed: number) {
  return SHOWDOWN_TAGLINES[seed % SHOWDOWN_TAGLINES.length];
}

function Showdown({ game, players, games, settings, onClose }: {
  game: Game; players: Player[]; games: GameRecord[]; settings: Settings; music: MusicEngine; onClose: () => void;
}) {
  const teamMode = !!game.teamMode;
  const teamCount = game.teamCount || 2;
  const mode = MODES[game.mode];
  const modeName = mode?.label || game.mode;
  const legsLabel = game.legsBestOf > 1 ? `Best of ${game.legsBestOf}` : 'Single leg';
  const powerUpsOn = !!game.powerUpsEnabled;

  const sides = useMemo(() => {
    if (!teamMode) {
      return game.players.map((pl, i) => {
        const p = players.find(pp => pp.id === pl.id);
        const xp = getPlayerXPById(pl.id, players);
        const li = levelFromXP(xp.xp, settings);
        const ti = getTitleInfo(xp.selectedTitle, settings.customTitles);
        const bi = getBadgeInfo(xp.selectedBadge);
        const ctx = xp.showBadgeContext ? getBadgeContext(xp.selectedBadge, pl.id, games as any) : null;
        const pu = getPowerUpInfo(p?.powerUps?.active);
        const stats = playerStats(pl.id, games as any);
        return {
          kind: 'player' as const, idx: i, name: pl.name, color: pl.color,
          members: [{ id: pl.id, name: pl.name, color: pl.color }],
          level: li.level, title: ti, badge: bi, badgeCtx: ctx, powerUp: pu, stats,
        };
      });
    }
    return Array.from({ length: teamCount }, (_, ti) => {
      const members = game.players.filter(pl => pl.team === ti).map(pl => {
        const p = players.find(pp => pp.id === pl.id);
        const xp = getPlayerXPById(pl.id, players);
        const li = levelFromXP(xp.xp, settings);
        const tinfo = getTitleInfo(xp.selectedTitle, settings.customTitles);
        const binfo = getBadgeInfo(xp.selectedBadge);
        const bctx = xp.showBadgeContext ? getBadgeContext(xp.selectedBadge, pl.id, games as any) : null;
        const pu = getPowerUpInfo(p?.powerUps?.active);
        return { id: pl.id, name: pl.name, color: pl.color, level: li.level, title: tinfo, badge: binfo, badgeCtx: bctx, powerUp: pu };
      });
      const name = `Team ${ti + 1}`;
      return { kind: 'team' as const, idx: ti, name, color: TEAM_COLORS[ti % TEAM_COLORS.length], members };
    });
  }, [game.players, teamMode, teamCount, players, settings, games]);

  // Champion = highest level player (only when 2+ players and no tie at the top).
  const championIdx = useMemo(() => {
    if (teamMode || sides.length < 2) return -1;
    const ps = sides.filter(s => s.kind === 'player') as any[];
    if (ps.length < 2) return -1;
    const maxLevel = Math.max(...ps.map((s: any) => s.level || 1));
    const top = ps.filter((s: any) => (s.level || 1) === maxLevel);
    if (top.length !== 1) return -1;
    return (top[0] as any).idx;
  }, [sides, teamMode]);

  const tagline = useMemo(() => pickTagline(Math.floor(Math.random() * SHOWDOWN_TAGLINES.length)), []);

  useEffect(() => {
    const t = setTimeout(() => Sound.play('vs', {}, settings), 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    sides.forEach((s, i) => {
      if (s.kind !== 'player') return;
      const p = players.find(pp => pp.id === s.members[0]?.id);
      if (!p || !p.sound || p.sound === 'none') return;
      const t = setTimeout(() => Sound.playPlayerSound(p.sound!, settings), 1200 + i * 600);
      timers.push(t);
    });
    return () => { timers.forEach(t => clearTimeout(t)); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="showdown-bg" style={{ background: showdownBgFor(players) }} onClick={onClose}>
      <div className="showdown-flash" />
      <div className="showdown-header">
        <div className="sd-mode-name">{modeName}</div>
        <div className="sd-tagline">{tagline}</div>
        <div className="sd-meta-row">
          <span className="sd-chip">{legsLabel}</span>
          {game.doubleOut && <span className="sd-chip">Double Out</span>}
          {powerUpsOn && <span className="sd-chip sd-chip-accent">⚡ Power-Ups</span>}
          {teamMode && <span className="sd-chip">Teams</span>}
        </div>
      </div>
      <div className={`showdown-grid showdown-cols-${sides.length}`}>
        {sides.map((s, i) => {
          const isChampion = !teamMode && s.kind === 'player' && s.idx === championIdx;
          const stat = !teamMode && (s as any).stats ? (s as any).stats : null;
          const statLabel = stat ? (stat.competitiveGames >= 2 && stat.winRate > 0
            ? `${Math.round(stat.winRate)}% wins`
            : stat.highScore > 0 ? `Best ${stat.highScore}` : null) : null;
          return (
          <div key={i} className={`showdown-card${isChampion ? ' sd-champion' : ''}`} style={{ animationDelay: `${0.15 + i * 0.18}s`, borderColor: s.color }}>
            <div className="sd-team-color" style={{ background: s.color }} />
            {isChampion && <div className="sd-crown" title="Highest level — the defending champion">👑 Champion</div>}
            <div className="sd-card-inner">
              <div className="sd-name" style={{ color: s.color }}>{s.name}</div>
              {teamMode && s.kind === 'team' ? (
                <div className="sd-members">
                  {s.members.map(m => (
                    <div key={m.id} className="sd-member">
                      <span className="avatar" style={{ width: 28, height: 28, fontSize: 13, background: m.color }}>{m.badge ? m.badge.icon : initials(m.name)}</span>
                      <span className="sd-member-name">{m.name}</span>
                      {m.level > 1 && <span className="sd-lvl-mini">L{m.level}</span>}
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <div className="sd-solo-avatar" style={{ background: s.color }}>
                    {s.badge ? s.badge.icon : initials(s.name)}
                  </div>
                  {s.badgeCtx ? (
                    <div className="sd-badge-ctx" title={`${s.badgeCtx.label}: ${s.badgeCtx.value}`}>{s.badge?.icon} {s.badgeCtx.value}</div>
                  ) : null}
                  {statLabel ? <div className="sd-stat-teaser">{statLabel}</div> : null}
                </>
              )}
              <div className="sd-accents">
                {!teamMode && s.level > 1 ? <span className="sd-acc sd-acc-lvl">Lvl {s.level}</span> : null}
                {!teamMode && s.title ? <span className="sd-acc sd-acc-title" title={s.title.desc}>{s.title.icon || ''} {s.title.name}</span> : null}
                {!teamMode && s.badge ? <span className="sd-acc sd-acc-badge" title={s.badge.desc}>{s.badge.icon} {s.badge.name}</span> : null}
                {!teamMode && s.powerUp ? <span className="sd-acc sd-acc-pu" title={s.powerUp.desc}>{s.powerUp.icon} {s.powerUp.name}</span> : null}
              </div>
            </div>
          </div>
          );
        })}
      </div>
      {sides.length >= 2 && Array.from({ length: Math.max(1, sides.length - 1) }, (_, i) => (
        <div key={`vs-${i}`} className="showdown-vs" style={{ animationDelay: `${0.5 + i * 0.2}s` }}>VS</div>
      ))}
      <div className="showdown-tap" style={{ animationDelay: '1.2s' }}>Tap to start ▸</div>
    </div>
  );
}
