import { useState } from 'react';
import type { GameRecord, Player, Settings } from './types';
import { MODES, ATC_TARGETS } from './constants';
import { playerStats, levelFromXP, getPlayerXP, visitAvgStatic } from './logic';
import { initials, fmtDate, fmtTime, fmtDateTime } from './store';
import { Modal } from './Popups';

export function HistoryView({ players, games, settings, setGames, toast }: { players: Player[]; games: GameRecord[]; settings: Settings; setGames: (updater: any) => void; toast: (m: string) => void }) {
  const [selected, setSelected] = useState<GameRecord | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const sorted = [...games].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="view-scroll">
      <h2 style={{ marginBottom: 12 }}>Match History</h2>
      {sorted.length === 0 && <div className="empty">No games played yet.</div>}
      {sorted.map(g => {
        const mode = MODES[g.mode] || { label: g.mode };
        const winner = g.players.find(p => p.id === g.winner);
        return (
          <div key={g.id} className="list-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
            <div className="row between">
              <b>{mode.label}{g.legsBestOf > 1 ? ` (Bo${g.legsBestOf})` : ''}</b>
              <button className="btn danger sm" onClick={() => { setSelected(g); setConfirmDelete(true); }}>Delete</button>
            </div>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              {g.players.map(p => {
                const isWinner = p.id === g.winner;
                return (
                  <span key={p.id} className="pill" style={{ opacity: isWinner ? 1 : 0.55, borderColor: isWinner ? 'var(--accent)' : 'transparent' }}>
                    {p.legsWon}L · {p.name}{isWinner ? ' 👑' : ''}
                  </span>
                );
              })}
            </div>
            <span className="muted small">{fmtDate(g.date)} {fmtTime(g.date)}</span>
          </div>
        );
      })}

      {selected && !confirmDelete && (
        <Modal onClose={() => setSelected(null)}>
          <h3 style={{ marginBottom: 6 }}>Match Detail</h3>
          <div className="muted small" style={{ marginBottom: 12 }}>{fmtDateTime(selected.date)}</div>
          {selected.players.map(p => (
            <div key={p.id} className="card" style={{ marginBottom: 10 }}>
              <div className="row between" style={{ marginBottom: 8 }}>
                <div className="row" style={{ gap: 8 }}>
                  <span className="avatar" style={{ background: p.color }}>{initials(p.name)}</span>
                  <b>{p.name}</b>
                </div>
                <span className="pill">{p.legsWon} legs</span>
              </div>
              <div className="muted small" style={{ marginBottom: 6 }}>Avg: {visitAvgStatic(p).toFixed(1)} · {p.dartsThrown} darts</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {p.visits.map((v, i) => (
                  <div key={i} className="row" style={{ gap: 8, fontSize: 13 }}>
                    <span className="muted" style={{ width: 28 }}>{i + 1}.</span>
                    {v.atc ? (
                      <span style={{ flex: 1 }}>ATC: {v.hits ?? 0} hits</span>
                    ) : (
                      <span style={{ flex: 1 }}>{v.darts.map(d => d.label).join(' ')} = <b>{v.scored}</b>{v.bust ? ' (bust)' : ''}{v.remaining === 0 ? ' ✓' : ''}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </Modal>
      )}

      {selected && confirmDelete && (
        <Modal onClose={() => setConfirmDelete(false)}>
          <h3 style={{ marginBottom: 10 }}>Delete this match?</h3>
          <div className="muted small" style={{ marginBottom: 16 }}>This will remove the match from history and recompute stats. XP earned from it will be lost.</div>
          <div className="row" style={{ gap: 10 }}>
            <button className="btn block ghost" onClick={() => setConfirmDelete(false)}>Cancel</button>
            <button className="btn block danger" onClick={() => {
              setGames((prev: GameRecord[]) => prev.filter(g => g.id !== selected.id));
              toast('Match deleted');
              setSelected(null); setConfirmDelete(false);
            }}>Delete</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
