import { useState } from 'react';
import type { GameRecord, Player, Settings } from './types';
import { MODES, ATC_TARGETS } from './constants';
import { playerStats, levelFromXP, getPlayerXP, visitAvgStatic } from './logic';
import { initials, fmtDate, fmtTime, fmtDateTime } from './store';
import { Modal } from './Popups';

export function HistoryView({ players, games, settings, setGames, toast }: { players: Player[]; games: GameRecord[]; settings: Settings; setGames: (updater: any) => void; toast: (m: string) => void }) {
  const [detail, setDetail] = useState<GameRecord | null>(null);

  if (!games.length) return <div className="view-scroll"><h2 style={{ marginBottom: 12 }}>Match History</h2><div className="card empty">No games played yet.</div></div>;

  const playerIds = [...new Set(games.flatMap(g => g.players.map(p => p.id)))];

  return (
    <div className="view-scroll">
      <h2 style={{ marginBottom: 12 }}>Match History</h2>
      {playerIds.length > 0 && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="muted small" style={{ marginBottom: 8 }}>Win Rate Summary</div>
          {playerIds.map(pid => {
            const pName = games.flatMap(g => g.players.find(p => p.id === pid)).filter(Boolean)[0]?.name || 'Unknown';
            const stats = playerStats(pid, games);
            return (
              <div key={pid} className="row between" style={{ marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 600 }}>{pName}</span>
                  <span className="muted small">{stats.gamesWon}/{stats.games} games · L{levelFromXP(getPlayerXP(players.find(p => p.id === pid)).xp, settings).level}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 100, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${stats.winRate}%`, height: '100%', background: 'var(--accent)', borderRadius: 3, transition: 'width .4s ease' }} />
                  </div>
                  <span style={{ fontWeight: 700, fontSize: 14, minWidth: 40, textAlign: 'right' }}>{stats.winRate.toFixed(0)}%</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {[...games].reverse().map(g => {
        const w = g.players.find(p => p.id === g.winner);
        const tiedPlayers = g.tied ? (g.tiedPlayers || []).map(id => g.players.find(p => p.id === id)).filter(Boolean) : [];
        const scoreline = g.players.map(p => p.legsWon).join('–');
        const gameLabel = g.atc ? (w ? 'Winner: ' + w.name : 'Around the Clock')
          : g.practice ? 'Practice session'
          : g.tied ? 'Tied: ' + tiedPlayers.filter(Boolean).map(p => p!.name).join(' & ')
          : (w ? 'Winner: ' + w.name + '  ·  legs ' + scoreline : 'Legs ' + scoreline);
        return (
          <div key={g.id} className="card" style={{ padding: 12, cursor: 'pointer' }} onClick={() => setDetail(g)}>
            <div className="row between">
              <div>
                <div className="row" style={{ gap: 8 }}>
                  <span className="pill">{MODES[g.mode]?.label || g.mode}</span>
                  {g.tied ? <span className="pill" style={{ background: 'color-mix(in srgb,var(--accent) 20%,var(--bg-3))' }}>TIE</span> : null}
                  <span className="muted small">{fmtDate(g.date)} {fmtTime(g.date)}</span>
                </div>
                <div style={{ marginTop: 8, fontWeight: 700 }}>{g.players.map(p => p.name).join('  vs  ')}</div>
                <div className="muted small" style={{ marginTop: 2 }}>{gameLabel}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                {g.players.map(p => g.atc
                  ? <div key={p.id} className="small"><b>{p.dartsThrown || 0}</b> <span className="muted">darts</span></div>
                  : <div key={p.id} className="small"><b>{visitAvgStatic(p).toFixed(1)}</b> <span className="muted">avg</span></div>)}
              </div>
            </div>
          </div>
        );
      })}
      {detail && <GameDetail g={detail} onClose={() => setDetail(null)} onDelete={() => { setGames((prev: GameRecord[]) => prev.filter(x => x.id !== detail.id)); setDetail(null); toast('Game deleted'); }} />}
    </div>
  );
}

function GameDetail({ g, onClose, onDelete }: { g: GameRecord; onClose: () => void; onDelete: () => void }) {
  return (
    <Modal onClose={onClose}>
      <div style={{ maxHeight: '70vh', overflow: 'auto' }}>
        <h3 style={{ marginBottom: 4 }}>{MODES[g.mode]?.label || g.mode}</h3>
        <div className="muted small" style={{ marginBottom: 12 }}>{fmtDateTime(g.date)}</div>
        {g.players.map(p => {
          if (g.atc) {
            const totalHits = (p.visits || []).reduce((a, v) => a + (v.hits || 0), 0);
            const cleared = (p.visits || []).some(v => (v.endIdx || 0) >= ATC_TARGETS.length);
            return (
              <div key={p.id} className="list-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
                <div className="row between"><b><span className="avatar" style={{ width: 22, height: 22, fontSize: 10, background: p.color }}>{initials(p.name)}</span> {p.name}</b>
                  <span className="muted small">{p.dartsThrown || 0} darts · {totalHits} hits · {cleared ? 'cleared ✓' : 'did not finish'}</span></div>
                <div className="muted small" style={{ lineHeight: 1.7 }}>{(p.visits || []).map(v => <span key={v.date} className="pill" style={{ margin: '2px 2px 0 0', background: v.hits ? 'color-mix(in srgb,var(--accent) 30%,var(--bg-3))' : 'var(--bg)' }}>{v.hits}/{v.darts.length}</span>)}</div>
              </div>
            );
          }
          const best = Math.max(0, ...p.visits.filter((v: any) => !v.bust).map((v: any) => v.scored));
          return (
            <div key={p.id} className="list-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
              <div className="row between"><b><span className="avatar" style={{ width: 22, height: 22, fontSize: 10, background: p.color }}>{initials(p.name)}</span> {p.name}</b>
                <span className="muted small">{visitAvgStatic(p).toFixed(1)} avg · best {best} · {p.legsWon} legs</span></div>
              <div className="muted small" style={{ lineHeight: 1.7 }}>{p.visits.map((v, vi) => {
                const darts = (v.darts || []).map(d => d.label || d.value).join(', ');
                return <span key={vi} className="pill" style={{ margin: '2px 2px 0 0', background: v.bust ? 'color-mix(in srgb,var(--danger) 25%,var(--bg-3))' : v.remaining === 0 ? 'color-mix(in srgb,var(--accent) 30%,var(--bg-3))' : 'var(--bg)' }}>{v.bust ? 'BUST' : v.scored} <span style={{ color: 'var(--muted)', marginLeft: 4 }}>({darts})</span></span>;
              })}</div>
            </div>
          );
        })}
        <div className="row" style={{ gap: 8, marginTop: 12 }}>
          <button className="btn block danger" onClick={onDelete}>Delete</button>
          <button className="btn block primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </Modal>
  );
}
