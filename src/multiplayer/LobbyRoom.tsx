import { useEffect, useState, useRef } from 'react';
import { Users, Play, Copy, Check, LogOut, Target, Layers } from 'lucide-react';
import type { Player, Settings } from '../types';
import type { Lobby, LobbyPlayer, GameConfig, MultiplayerGameMode } from './client';
import { getDeviceId, setLobbyGameMode } from './client';
import { createGame } from '../logic';
import { initials } from '../store';
import { MODES, TEAM_COLORS } from '../constants';

interface Props {
  lobby: Lobby;
  players: LobbyPlayer[];
  localPlayers: Player[];
  settings: Settings;
  isHost: boolean;
  onStartGame: (config: GameConfig, game: any) => void;
  onLeave: () => void;
  onAddLocalPlayer: (player: Player) => void;
}

export function LobbyRoom({ lobby, players, localPlayers, settings, isHost, onStartGame, onLeave, onAddLocalPlayer }: Props) {
  const [mode, setMode] = useState('301');
  const [doubleOut, setDoubleOut] = useState(false);
  const [legs, setLegs] = useState(1);
  const [teamMode, setTeamMode] = useState(false);
  const [powerUps, setPowerUps] = useState(false);
  const [teamCount, setTeamCount] = useState(2);
  const [teams, setTeams] = useState<number[]>([]);
  const [copied, setCopied] = useState(false);
  const joinedRef = useRef(false);

  const lobbyGameMode: MultiplayerGameMode = lobby.game_mode ?? settings.gameMode;

  const handleSetGameMode = (gm: MultiplayerGameMode) => {
    if (!isHost) return;
    void setLobbyGameMode(lobby.id, gm);
  };

  const allLobbyPlayers = players;

  const joinedLocalIds = new Set(
    allLobbyPlayers
      .filter(lp => lp.device_id === getDeviceId())
      .map(lp => lp.player_id),
  );

  useEffect(() => {
    if (joinedRef.current) return;
    joinedRef.current = true;
  }, []);

  useEffect(() => {
    setTeams(prev => {
      const next = allLobbyPlayers.map((_, i) => {
        const t = prev[i];
        if (t == null || t >= teamCount) return i % teamCount;
        return t;
      });
      return next;
    });
  }, [allLobbyPlayers.length, teamCount]);

  const copyCode = () => {
    void navigator.clipboard.writeText(lobby.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleStart = () => {
    const playerIds = allLobbyPlayers.map(lp => lp.player_id);
    const gamePlayers: Player[] = allLobbyPlayers.map(lp => ({
      id: lp.player_id,
      name: lp.player_name,
      color: lp.player_color,
    }));
    const teamAssignment = teamMode ? allLobbyPlayers.map((_, i) => teams[i] ?? (i % teamCount)) : [];
    const config: GameConfig = { mode, doubleOut, legs, teamMode, teamAssignment, powerUps };
    const game = createGame(mode, playerIds, gamePlayers, doubleOut, legs, teamMode, teamAssignment, powerUps, settings);
    onStartGame(config, game);
  };

  const m = MODES[mode];
  const noX01 = !!(m.practice || m.atc || m.killer || m.party);
  const teamValid = !teamMode || (allLobbyPlayers.length >= teamCount && teams.every(t => t != null && t < teamCount) && new Set(teams).size >= 1);

  return (
    <div className="view-scroll">
      <div className="card">
        <div className="row between" style={{ marginBottom: 14, alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>{lobby.name}</h2>
          <button className="btn danger sm" style={{ display: 'flex', alignItems: 'center', gap: 4 }} onClick={onLeave}>
            <LogOut size={14} /> Leave
          </button>
        </div>

        <div className="row" style={{ gap: 10, marginBottom: 16, alignItems: 'center' }}>
          <div style={{
            padding: '10px 16px', borderRadius: 10,
            background: 'color-mix(in srgb, var(--accent) 12%, var(--bg-3))',
            border: '1px solid color-mix(in srgb, var(--accent) 40%, var(--border))',
            fontWeight: 800, fontSize: 20, letterSpacing: '0.15em', color: 'var(--accent)',
          }}>
            {lobby.code}
          </div>
          <button className="btn sm" style={{ display: 'flex', alignItems: 'center', gap: 4 }} onClick={copyCode}>
            {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied!' : 'Copy'}
          </button>
          <span className="muted small">Share this code with other players</span>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>Game Mode (set by host)</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <button
              onClick={() => handleSetGameMode('dartboard')}
              disabled={!isHost}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: 12, borderRadius: 10,
                background: lobbyGameMode === 'dartboard' ? 'color-mix(in srgb,var(--accent) 22%,var(--bg-3))' : 'var(--bg-3)',
                border: `2px solid ${lobbyGameMode === 'dartboard' ? 'var(--accent)' : 'var(--border)'}`,
                cursor: isHost ? 'pointer' : 'default', opacity: isHost ? 1 : 0.7, color: 'inherit',
              }}>
              <Target size={24} color={lobbyGameMode === 'dartboard' ? 'var(--accent)' : 'var(--muted)'} />
              <div style={{ fontWeight: 700, fontSize: 13 }}>Dart Board</div>
            </button>
            <button
              onClick={() => handleSetGameMode('cards')}
              disabled={!isHost}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: 12, borderRadius: 10,
                background: lobbyGameMode === 'cards' ? 'color-mix(in srgb,var(--accent) 22%,var(--bg-3))' : 'var(--bg-3)',
                border: `2px solid ${lobbyGameMode === 'cards' ? 'var(--accent)' : 'var(--border)'}`,
                cursor: isHost ? 'pointer' : 'default', opacity: isHost ? 1 : 0.7, color: 'inherit',
              }}>
              <Layers size={24} color={lobbyGameMode === 'cards' ? 'var(--accent)' : 'var(--muted)'} />
              <div style={{ fontWeight: 700, fontSize: 13 }}>Card Based</div>
            </button>
          </div>
          {!isHost && <div className="muted small" style={{ marginTop: 6, textAlign: 'center' }}>The host determines the game mode for this lobby.</div>}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <Users size={16} style={{ color: 'var(--muted)' }} />
          <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>
            Players ({allLobbyPlayers.length})
          </span>
        </div>
        <div className="row wrap" style={{ gap: 8, marginBottom: 16 }}>
          {allLobbyPlayers.map(lp => (
            <div key={lp.id} className="pill" style={{
              background: lp.player_color, color: '#0b0e13', borderColor: 'transparent',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span className="avatar" style={{ width: 20, height: 20, fontSize: 10, background: 'rgba(0,0,0,.2)' }}>{initials(lp.player_name)}</span>
              {lp.player_name}
              {lobby.host_player_id === lp.player_id && <span style={{ fontSize: 10, opacity: .7 }}>★</span>}
            </div>
          ))}
          {allLobbyPlayers.length === 0 && <span className="muted small">Waiting for players to join…</span>}
        </div>

        {localPlayers.length > joinedLocalIds.size && (
          <>
            <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>Add a player from this device</div>
            <div className="row wrap" style={{ gap: 8, marginBottom: 16 }}>
              {localPlayers.filter(p => !joinedLocalIds.has(p.id)).map(p => (
                <button key={p.id} className="pill" style={{ background: 'var(--bg-3)', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}
                  onClick={() => onAddLocalPlayer(p)}>
                  <span className="avatar" style={{ width: 20, height: 20, fontSize: 10, background: p.color }}>{initials(p.name)}</span>
                  + {p.name}
                </button>
              ))}
            </div>
          </>
        )}

        {isHost ? (
          <>
            <label className="field"><span>Game Mode</span>
              <select value={mode} onChange={e => setMode(e.target.value)}>
                <option value="501">501</option>
                <option value="301">301</option>
                <option value="701">701</option>
                <option value="101">101</option>
                <option value="practice">Practice (free scoring)</option>
                <option value="killer">Killer (elimination)</option>
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
              <button className="pill" style={{ background: teamMode ? 'var(--accent)' : 'var(--bg-3)', color: teamMode ? '#04150a' : 'var(--text)' }}
                onClick={() => setTeamMode(v => !v)}>
                {teamMode ? 'ON' : 'OFF'}
              </button>
            </div>
            <div className="row between" style={{ margin: '0 0 10px' }}>
              <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>Power-Ups</span>
              <button className="pill" style={{ background: powerUps ? 'var(--accent)' : 'var(--bg-3)', color: powerUps ? '#04150a' : 'var(--text)' }}
                onClick={() => setPowerUps(v => !v)}>
                {powerUps ? 'ON' : 'OFF'}
              </button>
            </div>

            {teamMode && (
              <>
                <label className="field" style={{ marginBottom: 8 }}><span>Number of teams</span>
                  <select value={teamCount} onChange={e => setTeamCount(+e.target.value)}>
                    <option value={2}>2 teams</option>
                    <option value={3}>3 teams</option>
                    <option value={4}>4 teams</option>
                  </select>
                </label>
                <div className="muted small" style={{ marginBottom: 6 }}>Tap a player to cycle through teams.</div>
                <div className="row wrap" style={{ gap: 8, marginBottom: 10 }}>
                  {allLobbyPlayers.map((lp, i) => {
                    const t = teams[i] ?? 0;
                    const color = TEAM_COLORS[t % TEAM_COLORS.length];
                    return (
                      <button key={lp.id} className="pill" style={{ background: color, color: '#04150a', borderColor: 'transparent' }}
                        onClick={() => setTeams(prev => prev.map((x, j) => j === i ? (x + 1) % teamCount : x))}>
                        <span className="avatar" style={{ width: 18, height: 18, fontSize: 9, background: 'rgba(0,0,0,.25)' }}>{initials(lp.player_name)}</span>
                        {lp.player_name} · T{t + 1}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            <button className="btn primary block" style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              disabled={allLobbyPlayers.length < 1 || !teamValid}
              onClick={handleStart}>
              <Play size={18} /> Start Game ({allLobbyPlayers.length} players)
            </button>
          </>
        ) : (
          <div className="muted small center" style={{ padding: '16px 0' }}>
            Waiting for the host to start the game…
          </div>
        )}
      </div>
    </div>
  );
}
