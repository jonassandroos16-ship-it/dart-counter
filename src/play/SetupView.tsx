import { useEffect, useState } from 'react';
import type { Player, Settings } from '../types';
import { MODES, TEAM_COLORS } from '../constants';
import { initials } from '../store';

export function SetupView({ players, settings, onStart, onOpenCampaign, onBackToModeSelect }: { players: Player[]; settings: Settings; onStart: (mode: string, ids: string[], dbl: boolean, legs: number, teamMode: boolean, teamAssignment: number[], powerUps: boolean) => void; onOpenCampaign?: () => void; onBackToModeSelect?: () => void }) {
  const cardMode = settings.gameMode === 'cards';
  const [mode, setMode] = useState(cardMode ? '501' : '301');
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
        <div className="row between" style={{ marginBottom: 14, alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>New Game</h2>
          {onBackToModeSelect && (
            <button className="btn ghost sm" onClick={onBackToModeSelect}>← Modes</button>
          )}
        </div>
        {onOpenCampaign && (
          <button className="btn block" style={{ marginBottom: 12, background: 'linear-gradient(135deg, color-mix(in srgb,#ef4444 30%,var(--bg-3)) 0%, var(--bg-3) 80%)', borderColor: 'color-mix(in srgb,#ef4444 50%,var(--border))' }} onClick={onOpenCampaign}>
            ⚔️ Co-op Campaign
          </button>
        )}
        {cardMode && (
          <div className="muted small" style={{ marginBottom: 10, padding: '8px 10px', borderRadius: 8, background: 'color-mix(in srgb, var(--accent) 12%, var(--bg-3))', border: '1px solid color-mix(in srgb, var(--accent) 40%, var(--border))', fontStyle: 'italic' }}>
            Card mode is active. You play cards from your deck instead of throwing darts. Checkout modes (501, 301, 701, 101, Speed 101) and Practice are supported. Modes that require hitting specific board segments (Around the Clock, Killer, High Score, Battle) are disabled.
          </div>
        )}
        <label className="field"><span>Game Mode</span>
          <select value={mode} onChange={e => setMode(e.target.value)}>
            <option value="501">501</option>
            <option value="301">301</option>
            <option value="701">701</option>
            <option value="101">101</option>
            <option value="atc" disabled={cardMode}>Around the Clock{cardMode ? ' (disabled)' : ''}</option>
            <option value="practice">Practice (free scoring)</option>
            <option value="killer" disabled={cardMode}>Killer (elimination){cardMode ? ' (disabled)' : ''}</option>
            <option value="speed101">Speed 101 (party)</option>
            <option value="highscore" disabled={cardMode}>High Score (party){cardMode ? ' (disabled)' : ''}</option>
            <option value="battle" disabled={cardMode}>Battle (attributes){cardMode ? ' (disabled)' : ''}</option>
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
