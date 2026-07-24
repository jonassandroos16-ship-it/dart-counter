import { useMemo, useState } from 'react';
import type { Player, Settings } from './types';
import { playerStats, levelFromXP, getPlayerXP, bucketAverages, filterGamesByDate, headToHeadStats } from './logic';
import { LineChart, BarChart, DartboardHeatmap } from './Charts';
import { CalendarPicker, filterForPeriod, describeFilter, type Period } from './CalendarPicker';
import { STAT_META, statValue } from './stats/StatMeta';
import { ClassXpSection } from './stats/ClassXpSection';
import { CoopStatsSection, DartliteStatsSection } from './stats/StatsSections';
import type { SetPlayers, Toast } from './players/BasicTab';

export function StatsView({ players, games, settings, setPlayers, toast }: { players: Player[]; games: any[]; settings: Settings; setPlayers: SetPlayers; toast: Toast }) {
  const [pid, setPid] = useState<string>(players[0]?.id || '');
  const [compareId, setCompareId] = useState<string>('none');
  const [period, setPeriod] = useState<Period>('Overall');
  const [refDate, setRefDate] = useState<Date>(() => new Date());

  const player = players.find(p => p.id === pid) || players[0];
  const comparePlayer = compareId !== 'none' ? players.find(p => p.id === compareId) : null;

  const filter = period === 'Overall' ? null : filterForPeriod(period, refDate);
  const filteredGames = useMemo(() => filterGamesByDate(games, filter), [games, filter]);
  const playerGames = useMemo(() => filteredGames.filter((g: any) => g.players.some((p: any) => p.id === pid)), [filteredGames, pid]);
  const compareGames = useMemo(() => comparePlayer ? filteredGames.filter((g: any) => g.players.some((p: any) => p.id === comparePlayer.id)) : [], [filteredGames, comparePlayer]);

  const stats = useMemo(() => playerGames.length ? playerStats(player!.id, playerGames) : null, [player, playerGames]);
  const xp = useMemo(() => player ? getPlayerXP(player) : { xp: 0, level: 1, unlockedTitles: [] as string[], selectedTitle: null as string | null, unlockedBadges: [] as string[], badgeCounts: {} as Record<string, number>, selectedBadge: null as string | null, showBadgeContext: false }, [player]);
  const li = useMemo(() => player ? levelFromXP(xp.xp || 0, settings) : { level: 1, xpIntoLevel: 0, xpNeeded: 100 }, [xp, settings]);

  const compareStats = useMemo(() => comparePlayer && compareGames.length ? playerStats(comparePlayer.id, compareGames) : null, [comparePlayer, compareGames]);
  const compareXp = useMemo(() => comparePlayer ? getPlayerXP(comparePlayer) : null, [comparePlayer]);
  const compareLi = useMemo(() => compareXp ? levelFromXP(compareXp.xp || 0, settings) : null, [compareXp, settings]);

  if (!player) return <div style={{ padding: 20 }} className="muted">No players yet. Add one in the Players tab.</div>;

  return (
    <div className="view-scroll">
      <div className="row" style={{ gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <select value={pid} onChange={e => setPid(e.target.value)} style={{ flex: 1, minWidth: 120 }}>
          {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={compareId} onChange={e => setCompareId(e.target.value)} style={{ flex: 1, minWidth: 120 }}>
          <option value="none">No comparison</option>
          {players.filter(p => p.id !== pid).map(p => <option key={p.id} value={p.id}>vs {p.name}</option>)}
        </select>
      </div>
      <div className="tabbar">
        {(['Overall', 'Daily', 'Weekly', 'Monthly', 'Yearly'] as Period[]).map(t => (
          <button key={t} className={t === period ? 'on' : ''} onClick={() => setPeriod(t)}>{t}</button>
        ))}
      </div>
      {period !== 'Overall' && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="row between" style={{ marginBottom: 10 }}>
            <h3 style={{ margin: 0 }}>Filter: {describeFilter(period, refDate)}</h3>
            <button className="btn sm ghost" onClick={() => setRefDate(new Date())}>Today</button>
          </div>
          <CalendarPicker period={period} value={refDate} onChange={setRefDate} />
        </div>
      )}

      {stats && (
        <>
          <div className="card" style={{ marginBottom: 12 }}>
            <h3 style={{ marginBottom: 8 }}>{player.name}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
              {STAT_META.map(m => {
                const val = statValue(stats, xp, li, m.key);
                const cVal = compareStats && compareXp && compareLi ? statValue(compareStats, compareXp, compareLi, m.key) : null;
                const fmt = (v: number) => v === 0 && m.empty ? m.empty : m.format(v);
                let color = 'var(--text)';
                if (cVal != null && m.better) {
                  if (m.better === 'higher') color = val > cVal ? 'var(--accent)' : val < cVal ? 'var(--danger)' : 'var(--text)';
                  else color = val < cVal ? 'var(--accent)' : val > cVal ? 'var(--danger)' : 'var(--text)';
                }
                return (
                  <div key={m.key} style={{ padding: 8, background: 'var(--bg-3)', borderRadius: 6 }}>
                    <div className="muted small">{m.label}</div>
                    <div style={{ fontWeight: 800, fontSize: 18, color }}>{fmt(val)}</div>
                    {cVal != null && <div className="muted small" style={{ color: 'var(--muted)' }}>{fmt(cVal)}</div>}
                  </div>
                );
              })}
            </div>
          </div>

          <ClassXpSection player={player} settings={settings} setPlayers={setPlayers} toast={toast} />
          <CoopStatsSection players={players} />
          <DartliteStatsSection players={players} />

          {playerGames.length > 0 && (
            <>
              <div className="card" style={{ marginTop: 12 }}>
                <h3 style={{ marginBottom: 8 }}>Score trend</h3>
                {(() => { const ba = bucketAverages(playerGames.flatMap((g: any) => (g.players.find((p: any) => p.id === pid)?.visits || []).filter((v: any) => !v.bust).map((v: any) => ({ ...v, date: v.date || g.date }))), 'Monthly'); return <LineChart labels={ba.labels} values={ba.values} />; })()}
              </div>
              <div className="card" style={{ marginTop: 12 }}>
                <h3 style={{ marginBottom: 8 }}>Checkout % by remaining score</h3>
                {(() => {
                  const allVisits = playerGames.flatMap((g: any) => (g.players.find((p: any) => p.id === pid)?.visits || []));
                  const bins = [2, 40, 80, 120, 160, 200, 300, 400];
                  const labels = ['2-39', '40-79', '80-119', '120-159', '160-199', '200-299', '300-399', '400+'];
                  const values = bins.map((b, i) => {
                    const lo = i === 0 ? 2 : bins[i - 1] + 1;
                    const hi = b;
                    const visits = allVisits.filter((v: any) => v.remaining != null && v.remaining >= lo && v.remaining <= hi);
                    const attempts = visits.length;
                    const checkouts = visits.filter((v: any) => v.remaining === 0).length;
                    return attempts > 0 ? Math.round(checkouts / attempts * 100) : 0;
                  });
                  return <BarChart labels={labels} values={values} />;
                })()}
              </div>
              <div className="card" style={{ marginTop: 12 }}>
                <h3 style={{ marginBottom: 8 }}>Dartboard heatmap</h3>
                <DartboardHeatmap visits={playerGames.flatMap((g: any) => (g.players.find((p: any) => p.id === pid)?.visits || []))} />
              </div>
            </>
          )}

          {compareStats && (
            <div className="card" style={{ marginTop: 12 }}>
              <h3 style={{ marginBottom: 8 }}>{comparePlayer!.name} vs {player.name}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, fontSize: 13 }}>
                <div style={{ fontWeight: 800, padding: '4px 8px' }}>Stat</div>
                <div style={{ fontWeight: 800, padding: '4px 8px', textAlign: 'center' }}>{player.name}</div>
                <div style={{ fontWeight: 800, padding: '4px 8px', textAlign: 'center' }}>{comparePlayer!.name}</div>
                {STAT_META.map(m => {
                  const val = statValue(stats, xp, li, m.key);
                  const cVal = statValue(compareStats, compareXp!, compareLi!, m.key);
                  return (
                    <div key={m.key} style={{ display: 'contents' }}>
                      <div style={{ padding: '4px 8px' }}>{m.label}</div>
                      <div style={{ padding: '4px 8px', textAlign: 'center', fontWeight: 700, color: m.better === 'higher' ? (val > cVal ? 'var(--accent)' : val < cVal ? 'var(--danger)' : 'var(--text)') : m.better === 'lower' ? (val < cVal ? 'var(--accent)' : val > cVal ? 'var(--danger)' : 'var(--text)') : 'var(--text)' }}>{m.format(val)}</div>
                      <div style={{ padding: '4px 8px', textAlign: 'center', fontWeight: 700, color: m.better === 'higher' ? (cVal > val ? 'var(--accent)' : cVal < val ? 'var(--danger)' : 'var(--text)') : m.better === 'lower' ? (cVal < val ? 'var(--accent)' : cVal > val ? 'var(--danger)' : 'var(--text)') : 'var(--text)' }}>{m.format(cVal)}</div>
                    </div>
                  );
                })}
              </div>
              {(() => {
                const h2h = headToHeadStats(player!.id, comparePlayer!.id, playerGames.filter((g: any) => g.players.some((p: any) => p.id === comparePlayer!.id)));
                if (h2h.games === 0) return null;
                return (
                <div style={{ marginTop: 12, padding: 12, background: 'var(--bg-3)', borderRadius: 8 }}>
                  <h4 style={{ marginBottom: 6 }}>Head-to-head</h4>
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    <div><span className="muted">Games: </span><b>{h2h.games}</b></div>
                    <div><span className="muted">{player.name} wins: </span><b style={{ color: 'var(--accent)' }}>{h2h.gamesWon}</b></div>
                    <div><span className="muted">{comparePlayer!.name} wins: </span><b style={{ color: 'var(--accent)' }}>{h2h.gamesTied}</b></div>
                    <div><span className="muted">Ties: </span><b>{h2h.gamesTied}</b></div>
                  </div>
                </div>
                );
              })()}
            </div>
          )}
        </>
      )}
    </div>
  );
}
