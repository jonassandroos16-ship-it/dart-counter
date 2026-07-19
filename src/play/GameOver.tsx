import { useMemo, useState } from 'react';
import type { Game } from '../types';
import { TEAM_COLORS, TEAM_NAMES } from '../constants';
import { visitAvg } from '../logic';
import { initials } from '../store';
import { computeGameBadges, getBadgeInfo } from '../badges';
import { BadgeInfoPopup } from '../Popups';

export function GameOver({ game, onNewGame, onViewStats }: { game: Game; onNewGame: () => void; onViewStats: () => void }) {
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
