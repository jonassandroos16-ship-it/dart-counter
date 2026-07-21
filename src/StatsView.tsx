import { useMemo, useState } from 'react';
import type { Player, Settings } from './types';
import { MODES, MODE_KEYS } from './constants';
import { playerStats, levelFromXP, getPlayerXP, bucketAverages, allVisitsFor, filterGamesByDate, headToHeadStats } from './logic';
import { LineChart, BarChart, DartboardHeatmap } from './Charts';
import { CalendarPicker, filterForPeriod, describeFilter, type Period } from './CalendarPicker';
import { BADGES, computeLifetimeBadgeCounts, getBadgeContext, buildCoopBadgeCtx } from './badges';
import { loadDartliteGlobalStats } from './dartlite/stats';
import { ALL_TRINKET_IDS, getTrinket } from './dartlite/trinkets';

// For each stat: which direction is "better"? higher = bigger is better, lower = smaller is better.
// null = neutral (no comparison). Used to color the comparison value red/green.
type StatKey =
  | 'avg' | 'first9' | 'games' | 'n180' | 'n140' | 'tons'
  | 'highScore' | 'highCheckout' | 'legsWon' | 'dartsThrown'
  | 'finishMin' | 'finishMax' | 'finishAvg' | 'legsFinished'
  | 'level' | 'xp' | 'titles' | 'kills' | 'defeated' | 'battleGames';

const STAT_META: { key: StatKey; label: string; better: 'higher' | 'lower' | null; format: (v: number) => string; empty?: string }[] = [
  { key: 'avg', label: '3-dart avg', better: 'higher', format: v => v.toFixed(1) },
  { key: 'first9', label: 'First 9', better: 'higher', format: v => v.toFixed(1) },
  { key: 'games', label: 'Games', better: null, format: v => String(v) },
  { key: 'n180', label: '180s', better: 'higher', format: v => String(v) },
  { key: 'n140', label: '140+', better: 'higher', format: v => String(v) },
  { key: 'tons', label: '100+', better: 'higher', format: v => String(v) },
  { key: 'highScore', label: 'High score', better: 'higher', format: v => String(v) },
  { key: 'highCheckout', label: 'High checkout', better: 'higher', format: v => String(v) },
  { key: 'legsWon', label: 'Legs won', better: 'higher', format: v => String(v) },
  { key: 'dartsThrown', label: 'Darts thrown', better: null, format: v => String(v) },
  { key: 'finishMin', label: 'Best finish', better: 'lower', format: v => String(v), empty: '—' },
  { key: 'finishMax', label: 'Worst finish', better: 'higher', format: v => String(v), empty: '—' },
  { key: 'finishAvg', label: 'Avg finish', better: 'lower', format: v => v.toFixed(1), empty: '—' },
  { key: 'legsFinished', label: 'Legs finished', better: 'higher', format: v => String(v) },
  { key: 'level', label: 'Level', better: 'higher', format: v => String(v) },
  { key: 'xp', label: 'Total XP', better: 'higher', format: v => String(v) },
  { key: 'titles', label: 'Titles', better: 'higher', format: v => String(v) },
  { key: 'kills', label: 'Kills', better: 'higher', format: v => String(v), empty: '—' },
  { key: 'defeated', label: 'Times KO\'d', better: 'lower', format: v => String(v), empty: '—' },
  { key: 'battleGames', label: 'Battle games', better: null, format: v => String(v), empty: '—' },
];

function statValue(meta: typeof STAT_META[number], s: ReturnType<typeof playerStats>, li: { level: number }, xp: ReturnType<typeof getPlayerXP>): number {
  switch (meta.key) {
    case 'avg': return s.avg;
    case 'first9': return s.first9;
    case 'games': return s.games;
    case 'n180': return s.n180;
    case 'n140': return s.n140;
    case 'tons': return s.tons;
    case 'highScore': return s.highScore;
    case 'highCheckout': return s.highCheckout;
    case 'legsWon': return s.legsWon;
    case 'dartsThrown': return s.dartsThrown;
    case 'finishMin': return s.finishMin;
    case 'finishMax': return s.finishMax;
    case 'finishAvg': return s.finishAvg;
    case 'legsFinished': return s.legsFinished;
    case 'level': return li.level;
    case 'xp': return xp.xp || 0;
    case 'titles': return xp.unlockedTitles.length;
    case 'kills': return s.kills || 0;
    case 'defeated': return s.defeatedCount || 0;
    case 'battleGames': return s.battleGames || 0;
  }
}

export function StatsView({ players, games, settings }: { players: Player[]; games: any[]; settings: Settings }) {
  const [pid, setPid] = useState<string>(players[0]?.id || '');
  const [compareId, setCompareId] = useState<string>('none');
  const [period, setPeriod] = useState<Period>('Overall');
  const [refDate, setRefDate] = useState<Date>(() => new Date());
  const [modeFilter, setModeFilter] = useState<string>('all');
  const [selectedBadge, setSelectedBadge] = useState<string | null>(null);
  const [powerUpFilter, setPowerUpFilter] = useState<'all' | 'standard' | 'powerups'>('all');

  if (!players.length) return <div className="view-scroll"><div className="card empty">No players yet.</div></div>;
  const p = players.find(x => x.id === pid) || players[0];
  const cmpPlayer = compareId !== 'none' ? players.find(x => x.id === compareId) : null;

  const filter = period === 'Overall' ? null : filterForPeriod(period, refDate);
  const dateFiltered = useMemo(() => filterGamesByDate(games as any, filter), [games, filter]);
  const modeFiltered = useMemo(() => modeFilter === 'all' ? dateFiltered : dateFiltered.filter(g => g.mode === modeFilter), [dateFiltered, modeFilter]);
  const puFiltered = useMemo(() => {
    if (powerUpFilter === 'all') return modeFiltered;
    if (powerUpFilter === 'powerups') return modeFiltered.filter(g => g.powerUpsEnabled);
    return modeFiltered.filter(g => !g.powerUpsEnabled);
  }, [modeFiltered, powerUpFilter]);
  const s = playerStats(p.id, puFiltered);
  const xp = getPlayerXP(p);
  const li = levelFromXP(xp.xp, settings);
  const visits = allVisitsFor(p.id, puFiltered);
  const cmpS = cmpPlayer ? playerStats(cmpPlayer.id, puFiltered) : null;
  const cmpXp = cmpPlayer ? getPlayerXP(cmpPlayer) : null;
  const cmpLi = cmpXp ? levelFromXP(cmpXp.xp, settings) : null;
  // When comparing, ring rates are head-to-head vs the selected opponent only.
  const h2h = cmpPlayer ? headToHeadStats(p.id, cmpPlayer.id, puFiltered as any) : null;
  const cmpH2h = cmpPlayer ? headToHeadStats(cmpPlayer.id, p.id, puFiltered as any) : null;
  const ringWinRate = h2h ? h2h.winRate : s.winRate;
  const ringTieRate = h2h ? h2h.tieRate : s.tieRate;
  const cmpRingWinRate = cmpH2h ? cmpH2h.winRate : (cmpS ? cmpS.winRate : 0);
  const badgeCounts = useMemo(() => {
    const stored = xp.badgeCounts || {};
    const fromHistory = computeLifetimeBadgeCounts(p.id, puFiltered as any);
    const merged: Record<string, number> = { ...fromHistory };
    for (const [k, v] of Object.entries(stored)) merged[k] = Math.max(merged[k] || 0, v);
    return merged;
  }, [xp.badgeCounts, p.id, puFiltered]);
  const totalBadgeEarns = Object.values(badgeCounts).reduce((a: number, b: number) => a + b, 0);
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

  const filterActive = period !== 'Overall';
  const modeLabel = modeFilter === 'all' ? '' : ` · ${MODES[modeFilter].label}`;

  return (
    <div className="view-scroll">
      <div className="row" style={{ gap: 8, marginBottom: 12, alignItems: 'stretch' }}>
        <label className="field" style={{ flex: 1, marginBottom: 0 }}>
          <span>Player</span>
          <select value={pid} onChange={e => setPid(e.target.value)}>
            {players.map(pl => <option key={pl.id} value={pl.id}>{pl.name}</option>)}
          </select>
        </label>
        <label className="field" style={{ flex: 1, marginBottom: 0 }}>
          <span>Compare with</span>
          <select value={compareId} onChange={e => setCompareId(e.target.value)}>
            <option value="none">— None —</option>
            {players.filter(pl => pl.id !== pid).map(pl => <option key={pl.id} value={pl.id}>{pl.name}</option>)}
          </select>
        </label>
      </div>
      <div className="row" style={{ gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <button className={`btn sm ${modeFilter === 'all' ? 'primary' : 'ghost'}`} onClick={() => setModeFilter('all')}>All modes</button>
        {MODE_KEYS.map(k => (
          <button key={k} className={`btn sm ${modeFilter === k ? 'primary' : 'ghost'}`} onClick={() => setModeFilter(k)}>{MODES[k].label}</button>
        ))}
      </div>
      <div className="row" style={{ gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <span className="muted small" style={{ alignSelf: 'center' }}>Power-ups:</span>
        <button className={`btn sm ${powerUpFilter === 'all' ? 'primary' : 'ghost'}`} onClick={() => setPowerUpFilter('all')}>All games</button>
        <button className={`btn sm ${powerUpFilter === 'standard' ? 'primary' : 'ghost'}`} onClick={() => setPowerUpFilter('standard')}>Standard only</button>
        <button className={`btn sm ${powerUpFilter === 'powerups' ? 'primary' : 'ghost'}`} onClick={() => setPowerUpFilter('powerups')}>Power-up games</button>
      </div>
      <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <div style={{ position: 'relative', width: 80, height: 80 }}>
            <svg width="80" height="80" viewBox="0 0 80 80" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="40" cy="40" r="34" fill="none" stroke="var(--border)" strokeWidth="6" />
              <circle cx="40" cy="40" r="34" fill="none" stroke="var(--accent)" strokeWidth="6"
                strokeDasharray={2 * Math.PI * 34} strokeDashoffset={2 * Math.PI * 34 * (1 - ringWinRate / 100)}
                strokeLinecap="round" style={{ transition: 'stroke-dashoffset .6s ease' }} />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800 }}>{ringWinRate.toFixed(0)}%</div>
          </div>
          <div className="muted small" style={{ fontWeight: 700 }}>Win Rate{cmpPlayer ? ` vs ${cmpPlayer.name}` : ''}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <div style={{ position: 'relative', width: 80, height: 80 }}>
            <svg width="80" height="80" viewBox="0 0 80 80" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="40" cy="40" r="34" fill="none" stroke="var(--border)" strokeWidth="6" />
              <circle cx="40" cy="40" r="34" fill="none" stroke="var(--muted)" strokeWidth="6"
                strokeDasharray={2 * Math.PI * 34} strokeDashoffset={2 * Math.PI * 34 * (1 - ringTieRate / 100)}
                strokeLinecap="round" style={{ transition: 'stroke-dashoffset .6s ease' }} />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800 }}>{ringTieRate.toFixed(0)}%</div>
          </div>
          <div className="muted small" style={{ fontWeight: 700 }}>Tie Rate{cmpPlayer ? ` vs ${cmpPlayer.name}` : ''}</div>
        </div>
        {cmpPlayer ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <div style={{ position: 'relative', width: 80, height: 80 }}>
              <svg width="80" height="80" viewBox="0 0 80 80" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="40" cy="40" r="34" fill="none" stroke="var(--border)" strokeWidth="6" />
                <circle cx="40" cy="40" r="34" fill="none" stroke="var(--accent)" strokeWidth="6"
                  strokeDasharray={2 * Math.PI * 34} strokeDashoffset={2 * Math.PI * 34 * (1 - cmpRingWinRate / 100)}
                  strokeLinecap="round" style={{ transition: 'stroke-dashoffset .6s ease' }} />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800 }}>{cmpRingWinRate.toFixed(0)}%</div>
            </div>
            <div className="muted small" style={{ fontWeight: 700 }}>Win Rate vs {p.name}</div>
          </div>
        ) : null}
      </div>
      {cmpPlayer ? (
        <div className="card stat-vs-header" style={{ marginBottom: 12 }}>
          <div className="stat-vs-name" style={{ flex: 1, textAlign: 'center', fontWeight: 800 }}>{p.name}</div>
          <div className="stat-vs-vs">vs</div>
          <div className="stat-vs-name" style={{ flex: 1, textAlign: 'center', fontWeight: 800 }}>{cmpPlayer.name}</div>
        </div>
      ) : null}
      <div className="grid grid-3" style={{ marginBottom: 12 }}>
        {STAT_META.map(meta => {
          const val = statValue(meta, s, li, xp);
          const hasVal = meta.empty ? (val > 0) : true;
          const display = hasVal ? meta.format(val) : (meta.empty || '—');
          let cmpDisplay: string | null = null;
          let cmpClass: 'better' | 'worse' | 'neutral' = 'neutral';
          let cmpVal = 0;
          if (cmpPlayer && cmpS && cmpXp && cmpLi) {
            cmpVal = statValue(meta, cmpS, cmpLi, cmpXp);
            const cmpHasVal = meta.empty ? (cmpVal > 0) : true;
            if (cmpHasVal) {
              cmpDisplay = meta.format(cmpVal);
              if (meta.better === 'higher') cmpClass = cmpVal > val ? 'worse' : cmpVal < val ? 'better' : 'neutral';
              else if (meta.better === 'lower') cmpClass = cmpVal < val ? 'worse' : cmpVal > val ? 'better' : 'neutral';
            }
          }
          if (cmpPlayer && cmpDisplay) {
            return (
              <div key={meta.key} className="stat stat-vs">
                <div className="stat-vs-row">
                  <div className="stat-vs-cell">
                    <div className={`stat-vs-val ${cmpClass === 'better' ? 'is-better' : cmpClass === 'worse' ? 'is-worse' : ''}`}>{display}</div>
                  </div>
                  <div className="stat-vs-sep">·</div>
                  <div className="stat-vs-cell">
                    <div className={`stat-vs-val ${cmpClass === 'better' ? 'is-worse' : cmpClass === 'worse' ? 'is-better' : ''}`}>{cmpDisplay}</div>
                  </div>
                </div>
                <div className="l">{meta.label}</div>
              </div>
            );
          }
          return (
            <div key={meta.key} className="stat">
              <div className="v">{display}</div>
              <div className="l">{meta.label}</div>
            </div>
          );
        })}
      </div>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="row between" style={{ marginBottom: 8 }}>
          <h3 style={{ margin: 0 }}>Badges</h3>
          <span className="muted small">{(xp.unlockedBadges || []).length} / {BADGES.length} unlocked · {totalBadgeEarns} earned</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))', gap: 8 }}>
          {BADGES.map((b) => {
            const unlocked = (xp.unlockedBadges || []).includes(b.id);
            const count = badgeCounts[b.id] || 0;
            const isSelected = selectedBadge === b.id;
            return (
              <button
                key={b.id}
                onClick={() => setSelectedBadge(isSelected ? null : b.id)}
                title={`${b.name} — ${b.desc}${count > 0 ? ` (earned ${count}×)` : ''}`}
                style={{
                  position: 'relative',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  padding: '8px 4px', borderRadius: 10, textAlign: 'center',
                  background: isSelected ? 'color-mix(in srgb,var(--accent) 22%,var(--bg-3))' : unlocked ? 'color-mix(in srgb,var(--accent) 14%,var(--bg-3))' : 'var(--bg-3)',
                  border: `1px solid ${isSelected ? 'var(--accent)' : unlocked ? 'color-mix(in srgb,var(--accent) 40%,var(--bg-3))' : 'var(--border)'}`,
                  opacity: unlocked ? 1 : 0.5,
                  cursor: 'pointer', color: 'inherit',
                }}
              >
                <div style={{ fontSize: 22 }}>{unlocked ? b.icon : '🔒'}</div>
                <div style={{ fontSize: 10, fontWeight: 700, lineHeight: 1.1 }}>{b.name}</div>
                {count > 1 ? (
                  <span style={{ position: 'absolute', top: 4, right: 4, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 8, background: 'var(--accent)', color: '#04150a', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{count}</span>
                ) : null}
              </button>
            );
          })}
        </div>
        {selectedBadge ? (() => {
          const b = BADGES.find(x => x.id === selectedBadge);
          if (!b) return null;
          const unlocked = (xp.unlockedBadges || []).includes(b.id);
          const ctxInfo = getBadgeContext(b.id, p.id, puFiltered as any, buildCoopBadgeCtx());
          return (
            <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: 'var(--bg-3)', border: '1px solid var(--border)' }}>
              <div className="row" style={{ gap: 10, alignItems: 'center' }}>
                <div style={{ fontSize: 28 }}>{unlocked ? b.icon : '🔒'}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{b.name}</div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 2, lineHeight: 1.3 }}>{b.desc}</div>
                  <div className="muted small" style={{ marginTop: 4 }}>
                    {unlocked ? `Earned ${badgeCounts[b.id] || 0}× — equip it from the Players screen to show it as your icon.` : 'Locked — earn it in a future game to unlock.'}
                  </div>
                  {ctxInfo ? (
                    <div className="muted small" style={{ marginTop: 4 }}>
                      Lifetime {ctxInfo.label}: <strong style={{ color: 'var(--text)' }}>{ctxInfo.value}</strong>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })() : null}
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
      <CoopStatsSection players={players} />
      <DartliteStatsSection players={players} />
    </div>
  );
}

// ── Coop Campaign stats section ───────────────────────────────────────

function CoopStatsSection({ players }: { players: Player[] }) {
  const campaignKills = players.reduce((a, p) => a + ((p as any).campaignKills || 0), 0);

  return (
    <div className="card">
      <h3 style={{ marginBottom: 10 }}>⚔️ Coop Campaign</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>
        <div style={{ padding: 10, background: 'var(--bg-3)', borderRadius: 8 }}>
          <div style={{ fontSize: 20, fontWeight: 900 }}>{campaignKills}</div>
          <div className="muted small">Campaign Kills</div>
        </div>
      </div>
      <div style={{ marginTop: 12 }}>
        <div className="muted small" style={{ fontWeight: 700, marginBottom: 6 }}>Levels Cleared</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {players.map(pl => (
            <div key={pl.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: 'var(--bg-3)', borderRadius: 8 }}>
              <span style={{ fontWeight: 700, fontSize: 13 }}>{pl.name}</span>
              <span style={{ fontSize: 18, fontWeight: 900 }}>{pl.campaignProgress?.highest_level_beaten || 0}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Dartlite rogue-lite stats section ─────────────────────────────────

function DartliteStatsSection({ players }: { players: Player[] }) {
  const g = loadDartliteGlobalStats();
  const totalSeen = players.reduce((a, p) => a + (p.dartliteStats?.seenTrinkets.length || 0), 0);
  const uniqueSeen = new Set(players.flatMap(p => p.dartliteStats?.seenTrinkets || [])).size;

  return (
    <div className="card">
      <h3 style={{ marginBottom: 10 }}>🎲 Dartlite</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>
        <div style={{ padding: 10, background: 'var(--bg-3)', borderRadius: 8 }}>
          <div style={{ fontSize: 20, fontWeight: 900 }}>{g.totalKills}</div>
          <div className="muted small">Total Kills</div>
        </div>
        <div style={{ padding: 10, background: 'var(--bg-3)', borderRadius: 8 }}>
          <div style={{ fontSize: 20, fontWeight: 900 }}>{g.totalBattles}</div>
          <div className="muted small">Battles Won</div>
        </div>
        <div style={{ padding: 10, background: 'var(--bg-3)', borderRadius: 8 }}>
          <div style={{ fontSize: 20, fontWeight: 900 }}>{g.totalMiniBosses}</div>
          <div className="muted small">Mini-Bosses</div>
        </div>
        <div style={{ padding: 10, background: 'var(--bg-3)', borderRadius: 8 }}>
          <div style={{ fontSize: 20, fontWeight: 900 }}>{g.totalBosses}</div>
          <div className="muted small">Bosses</div>
        </div>
        <div style={{ padding: 10, background: 'var(--bg-3)', borderRadius: 8 }}>
          <div style={{ fontSize: 20, fontWeight: 900 }}>{g.bestRound}</div>
          <div className="muted small">Best Round</div>
        </div>
        <div style={{ padding: 10, background: 'var(--bg-3)', borderRadius: 8 }}>
          <div style={{ fontSize: 20, fontWeight: 900 }}>{g.totalRuns}</div>
          <div className="muted small">Runs</div>
        </div>
        <div style={{ padding: 10, background: 'var(--bg-3)', borderRadius: 8 }}>
          <div style={{ fontSize: 20, fontWeight: 900 }}>{g.totalXp}</div>
          <div className="muted small">XP Gained</div>
        </div>
        <div style={{ padding: 10, background: 'var(--bg-3)', borderRadius: 8 }}>
          <div style={{ fontSize: 20, fontWeight: 900 }}>{uniqueSeen}/{ALL_TRINKET_IDS.length}</div>
          <div className="muted small">Trinkets Seen</div>
        </div>
      </div>
      {uniqueSeen > 0 && (
        <div style={{ marginTop: 12 }}>
          <div className="muted small" style={{ fontWeight: 700, marginBottom: 6 }}>Discovered Trinkets</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {ALL_TRINKET_IDS.filter(id => players.some(p => p.dartliteStats?.seenTrinkets.includes(id))).map(id => {
              const t = getTrinket(id);
              return (
                <span key={id} title={t.desc} className="pill" style={{ fontSize: 11, background: 'color-mix(in srgb,#7c3aed 18%,var(--bg-3))', color: '#c4b5fd', borderColor: 'transparent' }}>
                  {t.icon} {t.name}
                </span>
              );
            })}
          </div>
        </div>
      )}
      <div className="muted small" style={{ marginTop: 8 }}>Total trinket discoveries across all players: {totalSeen}</div>
    </div>
  );
}
