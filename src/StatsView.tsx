import { useMemo, useState } from 'react';
import type { Player, Settings } from './types';
import { getTitleInfo, MODES, MODE_KEYS } from './constants';
import { playerStats, levelFromXP, getPlayerXP, bucketAverages, allVisitsFor, filterGamesByDate } from './logic';
import { LineChart, BarChart, DartboardHeatmap } from './Charts';
import { CalendarPicker, filterForPeriod, describeFilter, type Period } from './CalendarPicker';
import { BADGES, getBadgeInfo } from './badges';

export function StatsView({ players, games, settings }: { players: Player[]; games: any[]; settings: Settings }) {
  const [pid, setPid] = useState<string>(players[0]?.id || '');
  const [period, setPeriod] = useState<Period>('Overall');
  const [refDate, setRefDate] = useState<Date>(() => new Date());
  const [modeFilter, setModeFilter] = useState<string>('all');

  if (!players.length) return <div className="view-scroll"><div className="card empty">No players yet.</div></div>;
  const p = players.find(x => x.id === pid) || players[0];

  const filter = period === 'Overall' ? null : filterForPeriod(period, refDate);
  const dateFiltered = useMemo(() => filterGamesByDate(games as any, filter), [games, filter]);
  const modeFiltered = useMemo(() => modeFilter === 'all' ? dateFiltered : dateFiltered.filter(g => g.mode === modeFilter), [dateFiltered, modeFilter]);
  const s = playerStats(p.id, modeFiltered);
  const xp = getPlayerXP(p);
  const li = levelFromXP(xp.xp, settings);
  const ti = getTitleInfo(xp.selectedTitle, settings.customTitles);
  const visits = allVisitsFor(p.id, modeFiltered);
  const series = bucketAverages(visits.filter((v: any) => !v.practice && !v.atc), period);
  const buckets: Record<string, number> = { '0-39': 0, '40-59': 0, '60-79': 0, '80-99': 0, '100-139': 0, '140-179': 0, '180': 0 };
  visits.filter((v: any) => !v.bust && !v.atc).forEach((v: any) => {
    const sc = v.scored;
    if (sc === 180) buckets['180']++;
    else if (sc >= 140) buckets['140-179']++;
    else if (sc >= 100) buckets['100-139']++;
    else if (sc >= 80) buckets['80-99']++;
    else if (sc >= 60) buckets['60-79']++;
    else if (sc >= 40) buckets['40-59']++;
    else buckets['0-39']++;
  });

  const cells: [string, string | number][] = [
    ['3-dart avg', s.avg.toFixed(1)], ['First 9', s.first9.toFixed(1)], ['Games', s.games],
    ['180s', s.n180], ['140+', s.n140], ['100+', s.tons],
    ['High score', s.highScore], ['High checkout', s.highCheckout], ['Legs won', s.legsWon],
    ['Darts thrown', s.dartsThrown],
    ['Best finish', s.finishMin || '—'],
    ['Worst finish', s.finishMax || '—'],
    ['Avg finish', s.legsFinished ? s.finishAvg.toFixed(1) : '—'],
    ['Legs finished', s.legsFinished],
    ['Level', li.level], ['Total XP', xp.xp || 0], ['Titles', xp.unlockedTitles.length],
  ];

  const filterActive = period !== 'Overall';
  const modeLabel = modeFilter === 'all' ? '' : ` · ${MODES[modeFilter].label}`;

  return (
    <div className="view-scroll">
      <select value={pid} onChange={e => setPid(e.target.value)} style={{ marginBottom: 12 }}>
        {players.map(pl => <option key={pl.id} value={pl.id}>{pl.name}</option>)}
      </select>
      <div className="row" style={{ gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <button className={`btn sm ${modeFilter === 'all' ? 'primary' : 'ghost'}`} onClick={() => setModeFilter('all')}>All modes</button>
        {MODE_KEYS.map(k => (
          <button key={k} className={`btn sm ${modeFilter === k ? 'primary' : 'ghost'}`} onClick={() => setModeFilter(k)}>{MODES[k].label}</button>
        ))}
      </div>
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
        <div style={{ position: 'relative', width: 80, height: 80, flexShrink: 0 }}>
          <svg width="80" height="80" viewBox="0 0 80 80" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="40" cy="40" r="34" fill="none" stroke="var(--border)" strokeWidth="6" />
            <circle cx="40" cy="40" r="34" fill="none" stroke="var(--accent)" strokeWidth="6"
              strokeDasharray={2 * Math.PI * 34} strokeDashoffset={2 * Math.PI * 34 * (1 - s.winRate / 100)}
              strokeLinecap="round" style={{ transition: 'stroke-dashoffset .6s ease' }} />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800 }}>{s.winRate.toFixed(0)}%</div>
        </div>
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: '0 0 4px' }}>Win Rate</h3>
          <div className="muted small">{s.gamesWon} won out of {s.games} games</div>
          <div className="muted small" style={{ marginTop: 2 }}>{s.legsWon} legs won</div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div className="xp-pill" style={{ marginBottom: 4 }}>Level {li.level}</div>
          {ti ? <div className="title-badge" style={{ marginBottom: 4 }}>{ti.icon || ''} {ti.name}</div> : null}
          <div className="muted small">{xp.xp || 0} total XP</div>
          <div className="xp-bar" style={{ width: 80, marginTop: 4 }}><div style={{ width: `${Math.round(li.xpIntoLevel / li.xpNeeded * 100)}%` }} /></div>
          <div className="muted small" style={{ marginTop: 2 }}>{li.xpIntoLevel}/{li.xpNeeded}</div>
        </div>
      </div>
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
        <div style={{ position: 'relative', width: 80, height: 80, flexShrink: 0 }}>
          <svg width="80" height="80" viewBox="0 0 80 80" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="40" cy="40" r="34" fill="none" stroke="var(--border)" strokeWidth="6" />
            <circle cx="40" cy="40" r="34" fill="none" stroke="var(--muted)" strokeWidth="6"
              strokeDasharray={2 * Math.PI * 34} strokeDashoffset={2 * Math.PI * 34 * (1 - s.tieRate / 100)}
              strokeLinecap="round" style={{ transition: 'stroke-dashoffset .6s ease' }} />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800 }}>{s.tieRate.toFixed(0)}%</div>
        </div>
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: '0 0 4px' }}>Tie Rate</h3>
          <div className="muted small">{s.gamesTied} tied out of {s.games} games</div>
        </div>
      </div>
      <div className="grid grid-3" style={{ marginBottom: 12 }}>
        {cells.map(([l, v]) => <div key={l} className="stat"><div className="v">{v}</div><div className="l">{l}</div></div>)}
      </div>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="row between" style={{ marginBottom: 8 }}>
          <h3 style={{ margin: 0 }}>Badges</h3>
          <span className="muted small">{(xp.unlockedBadges || []).length} / {BADGES.length} unlocked</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))', gap: 8 }}>
          {BADGES.map((b) => {
            const unlocked = (xp.unlockedBadges || []).includes(b.id);
            return (
              <div key={b.id} title={`${b.name} — ${b.desc}`} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                padding: '8px 4px', borderRadius: 10, textAlign: 'center',
                background: unlocked ? 'color-mix(in srgb,var(--accent) 14%,var(--bg-3))' : 'var(--bg-3)',
                border: `1px solid ${unlocked ? 'color-mix(in srgb,var(--accent) 40%,var(--bg-3))' : 'var(--border)'}`,
                opacity: unlocked ? 1 : 0.5,
              }}>
                <div style={{ fontSize: 22 }}>{unlocked ? b.icon : '🔒'}</div>
                <div style={{ fontSize: 10, fontWeight: 700, lineHeight: 1.1 }}>{b.name}</div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="tabbar">
        {(['Overall', 'Daily', 'Weekly', 'Monthly', 'Yearly'] as Period[]).map(t => (
          <button key={t} className={t === period ? 'on' : ''} onClick={() => setPeriod(t)}>{t}</button>
        ))}
      </div>
      {filterActive && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="row between" style={{ marginBottom: 10 }}>
            <h3 style={{ margin: 0 }}>Filter: {describeFilter(period, refDate)}{modeLabel}</h3>
            <button className="btn sm ghost" onClick={() => setRefDate(new Date())}>Today</button>
          </div>
          <CalendarPicker period={period} value={refDate} onChange={setRefDate} />
        </div>
      )}
      <div className="card">
        <h3 style={{ marginBottom: 4 }}>Average — {period}{filterActive ? ` · ${describeFilter(period, refDate)}` : ''}{modeLabel}</h3>
        <div className="muted small" style={{ marginBottom: 10 }}>3-dart average per period</div>
        <LineChart labels={series.labels} values={series.values} />
      </div>
      <div className="card">
        <h3 style={{ marginBottom: 10 }}>Scoring distribution{filterActive ? ` — ${describeFilter(period, refDate)}` : ''}{modeLabel}</h3>
        <BarChart labels={Object.keys(buckets)} values={Object.values(buckets)} />
      </div>
      <div className="card">
        <h3 style={{ marginBottom: 4 }}>Dartboard Heatmap{filterActive ? ` — ${describeFilter(period, refDate)}` : ''}{modeLabel}</h3>
        <div className="muted small" style={{ marginBottom: 10 }}>Where your darts land · hotter = more hits</div>
        <div className="dartboard-wrap"><DartboardHeatmap visits={visits} /></div>
        <div className="dartboard-legend">
          <span>Less</span>
          <span className="ll" style={{ background: 'color-mix(in srgb,var(--accent) 20%,var(--bg-3))' }} />
          <span className="ll" style={{ background: 'color-mix(in srgb,var(--accent) 45%,var(--bg-3))' }} />
          <span className="ll" style={{ background: 'color-mix(in srgb,var(--accent) 70%,var(--bg-3))' }} />
          <span className="ll" style={{ background: 'var(--accent)' }} />
          <span>More</span>
        </div>
      </div>
    </div>
  );
}
