import { useMemo, useState } from 'react';
import type { Player, Settings } from './types';
import { playerStats, levelFromXP, getPlayerXP, bucketAverages, filterGamesByDate, headToHeadStats } from './logic';
import { LineChart, BarChart, DartboardHeatmap } from './Charts';
import { CalendarPicker, filterForPeriod, describeFilter, type Period } from './CalendarPicker';
import { loadDartliteGlobalStats } from './dartlite/stats';
import { ALL_TRINKET_IDS, getTrinket } from './dartlite/trinkets';
import { COOP_CLASSES, getClassXp } from './campaign/engine/classes';
import type { CoopClassId } from './campaign/types';

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
  { key: 'dartsThrown', label: 'Darts thrown', better: 'higher', format: v => String(v) },
  { key: 'finishMin', label: 'Fastest finish', better: 'lower', format: v => String(v), empty: '—' },
  { key: 'finishMax', label: 'Slowest finish', better: 'higher', format: v => String(v), empty: '—' },
  { key: 'finishAvg', label: 'Avg finish', better: 'lower', format: v => v.toFixed(1), empty: '—' },
  { key: 'legsFinished', label: 'Legs finished', better: 'higher', format: v => String(v) },
  { key: 'level', label: 'Level', better: 'higher', format: v => String(v) },
  { key: 'xp', label: 'Class XP', better: 'higher', format: v => String(v) },
  { key: 'titles', label: 'Titles', better: 'higher', format: v => String(v) },
  { key: 'kills', label: 'Kills', better: 'higher', format: v => String(v) },
  { key: 'defeated', label: 'Times defeated', better: 'lower', format: v => String(v) },
  { key: 'battleGames', label: 'Battle games', better: 'higher', format: v => String(v) },
];

function statValue(s: ReturnType<typeof playerStats>, xp: ReturnType<typeof getPlayerXP>, li: ReturnType<typeof levelFromXP>, key: StatKey): number {
  switch (key) {
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

          <ClassXpSection player={player} settings={settings} />
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

// ── Per-class XP section ───────────────────────────────────────────────

function ClassXpSection({ player, settings }: { player: Player; settings: Settings }) {
  const prog = player.coopProgress;
  if (!prog) return null;
  return (
    <div className="card">
      <h3 style={{ marginBottom: 10 }}>✨ Class XP</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {COOP_CLASSES.map(cls => {
          const xp = getClassXp(prog, cls.id as CoopClassId);
          const li = levelFromXP(xp, settings);
          const isCurrent = prog.classId === cls.id;
          return (
            <div key={cls.id} style={{ padding: 12, background: 'var(--bg-3)', borderRadius: 8, border: isCurrent ? '1px solid var(--accent)' : '1px solid transparent' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontWeight: 800, fontSize: 14 }}>{cls.icon} {cls.name}{isCurrent ? ' (active)' : ''}</span>
                <span style={{ fontWeight: 900, fontSize: 16 }}>Lv {li.level}</span>
              </div>
              <div style={{ height: 8, background: 'var(--bg-2)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: `${li.xpNeeded > 0 ? (li.xpIntoLevel / li.xpNeeded) * 100 : 0}%`, height: '100%', background: 'var(--accent)', borderRadius: 4, transition: 'width .3s' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                <span className="muted small">{xp} XP</span>
                <span className="muted small">{li.xpIntoLevel}/{li.xpNeeded}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Coop Campaign stats section ───────────────────────────────────────

function CoopStatsSection({ players }: { players: Player[] }) {
  const campaignKills = players.reduce((a, p) => a + ((p as any).campaignKills || 0), 0);
  const levelsCleared = players.reduce((a, p) => a + (p.campaignProgress?.highest_level_beaten || 0), 0);

  return (
    <div className="card" style={{ marginTop: 12 }}>
      <h3 style={{ marginBottom: 8 }}>⚔️ Co-op Campaign</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>
        <div style={{ padding: 10, background: 'var(--bg-3)', borderRadius: 8 }}>
          <div style={{ fontSize: 20, fontWeight: 900 }}>{campaignKills}</div>
          <div className="muted small">Campaign Kills</div>
        </div>
        <div style={{ padding: 10, background: 'var(--bg-3)', borderRadius: 8 }}>
          <div style={{ fontSize: 20, fontWeight: 900 }}>{levelsCleared}</div>
          <div className="muted small">Levels Cleared</div>
        </div>
      </div>
    </div>
  );
}

function DartliteStatsSection({ players }: { players: Player[] }) {
  const g = loadDartliteGlobalStats();
  const totalSeen = players.reduce((a, p) => a + (p.dartliteStats?.seenTrinkets.length || 0), 0);
  const uniqueSeen = new Set(players.flatMap(p => p.dartliteStats?.seenTrinkets || [])).size;

  return (
    <div className="card" style={{ marginTop: 12 }}>
      <h3 style={{ marginBottom: 8 }}>🎲 Dartlite</h3>
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
