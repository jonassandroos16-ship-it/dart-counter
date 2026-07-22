import { useMemo, useState } from 'react';
import type { Player, Settings } from './types';
import { MODES, MODE_KEYS } from './constants';
import { playerStats, levelFromXP, getPlayerXP, bucketAverages, allVisitsFor, filterGamesByDate, headToHeadStats } from './logic';
import { LineChart, BarChart, DartboardHeatmap } from './Charts';
import { CalendarPicker, filterForPeriod, describeFilter, type Period } from './CalendarPicker';
import { BADGES, computeLifetimeBadgeCounts, getBadgeContext, buildCoopBadgeCtx } from './badges';
import { loadDartliteGlobalStats } from './dartlite/stats';
import { ALL_TRINKET_IDS, getTrinket } from './dartlite/trinkets';
import { CARD_DEFS, getCard } from './cards/definitions';
import { getPlayerCards } from './cards/deck';
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
  const [period, setPeriod] = useState<Period>('all');
  const [customStart, setCustomStart] = useState<string | null>(null);
  const [customEnd, setCustomEnd] = useState<string | null>(null);

  const player = players.find(p => p.id === pid) || players[0];
  const comparePlayer = compareId !== 'none' ? players.find(p => p.id === compareId) : null;

  const filteredGames = useMemo(() => filterGamesByDate(games, filterForPeriod(period, customStart, customEnd)), [games, period, customStart, customEnd]);
  const playerGames = useMemo(() => filteredGames.filter((g: any) => g.players.some((p: any) => p.id === pid)), [filteredGames, pid]);
  const compareGames = useMemo(() => comparePlayer ? filteredGames.filter((g: any) => g.players.some((p: any) => p.id === comparePlayer.id)) : [], [filteredGames, comparePlayer]);

  const stats = useMemo(() => playerGames.length ? playerStats(player!, playerGames) : null, [player, playerGames]);
  const xp = useMemo(() => player ? getPlayerXP(player, settings) : { xp: 0, unlockedTitles: [] as string[] }, [player, settings]);
  const li = useMemo(() => player ? levelFromXP(xp.xp || 0, settings) : { level: 1, xpIntoLevel: 0, xpNeeded: 100 }, [xp, settings]);

  const compareStats = useMemo(() => comparePlayer && compareGames.length ? playerStats(comparePlayer, compareGames) : null, [comparePlayer, compareGames]);
  const compareXp = useMemo(() => comparePlayer ? getPlayerXP(comparePlayer, settings) : null, [comparePlayer, settings]);
  const compareLi = useMemo(() => compareXp ? levelFromXP(compareXp.xp || 0, settings) : null, [compareXp, settings]);

  if (!player) return <div style={{ padding: 20 }} className="muted">No players yet. Add one in the Players tab.</div>;

  const dartliteStats = loadDartliteGlobalStats();

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 20, paddingBottom: 60 }}>
      <div className="row" style={{ gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <select value={pid} onChange={e => setPid(e.target.value)} style={{ flex: 1, minWidth: 120 }}>
          {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={compareId} onChange={e => setCompareId(e.target.value)} style={{ flex: 1, minWidth: 120 }}>
          <option value="none">No comparison</option>
          {players.filter(p => p.id !== pid).map(p => <option key={p.id} value={p.id}>vs {p.name}</option>)}
        </select>
      </div>
      <CalendarPicker period={period} setPeriod={setPeriod} customStart={customStart} setCustomStart={setCustomStart} customEnd={customEnd} setCustomEnd={setCustomEnd} />

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
                  if (m.better === 'higher') color = val > cVal ? 'var(--success)' : val < cVal ? 'var(--error)' : 'var(--text)';
                  else color = val < cVal ? 'var(--success)' : val > cVal ? 'var(--error)' : 'var(--text)';
                }
                return (
                  <div key={m.key} style={{ padding: 8, background: 'var(--bg-3)', borderRadius: 6 }}>
                    <div className="muted small">{m.label}</div>
                    <div style={{ fontWeight: 800, fontSize: 18, color }}>{fmt(val)}</div>
                    {cVal != null && <div className="muted small" style={{ color: 'var(--text-2)' }}>{fmt(cVal)}</div>}
                  </div>
                );
              })}
            </div>
          </div>

          <ClassXpSection player={player} settings={settings} />
          <CoopStatsSection players={players} />

          {playerGames.length > 0 && (
            <>
              <div className="card" style={{ marginTop: 12 }}>
                <h3 style={{ marginBottom: 8 }}>Score trend</h3>
                <LineChart data={bucketAverages(playerGames.flatMap((g: any) => (g.players.find((p: any) => p.id === pid)?.visits || []).filter((v: any) => !v.bust).map((v: any) => v.scored)), 20)} />
              </div>
              <div className="card" style={{ marginTop: 12 }}>
                <h3 style={{ marginBottom: 8 }}>Checkout % by remaining score</h3>
                <BarChart data={(() => {
                  const allVisits = playerGames.flatMap((g: any) => (g.players.find((p: any) => p.id === pid)?.visits || []));
                  const bins = [2, 40, 80, 120, 160, 200, 300, 400];
                  const labels = ['2-39', '40-79', '80-119', '120-159', '160-199', '200-299', '300-399', '400+'];
                  return bins.map((b, i) => {
                    const lo = i === 0 ? 2 : bins[i - 1] + 1;
                    const hi = b;
                    const visits = allVisits.filter((v: any) => v.remaining != null && v.remaining >= lo && v.remaining <= hi);
                    const attempts = visits.length;
                    const checkouts = visits.filter((v: any) => v.remaining === 0).length;
                    return { label: labels[i], value: attempts > 0 ? Math.round(checkouts / attempts * 100) : 0 };
                  });
                })()} />
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
                      <div style={{ padding: '4px 8px', textAlign: 'center', fontWeight: 700, color: m.better === 'higher' ? (val > cVal ? 'var(--success)' : val < cVal ? 'var(--error)' : 'var(--text)') : m.better === 'lower' ? (val < cVal ? 'var(--success)' : val > cVal ? 'var(--error)' : 'var(--text)') : 'var(--text)' }}>{m.format(val)}</div>
                      <div style={{ padding: '4px 8px', textAlign: 'center', fontWeight: 700, color: m.better === 'higher' ? (cVal > val ? 'var(--success)' : cVal < val ? 'var(--error)' : 'var(--text)') : m.better === 'lower' ? (cVal < val ? 'var(--success)' : cVal > val ? 'var(--error)' : 'var(--text)') : 'var(--text)' }}>{m.format(cVal)}</div>
                    </div>
                  );
                })}
              </div>
              {headToHeadStats(playerGames.filter((g: any) => g.players.some((p: any) => p.id === comparePlayer!.id)), player!.id, comparePlayer!.id).totalGames > 0 && (
                <div style={{ marginTop: 12, padding: 12, background: 'var(--bg-3)', borderRadius: 8 }}>
                  <h4 style={{ marginBottom: 6 }}>Head-to-head</h4>
                  {(() => {
                    const h2h = headToHeadStats(playerGames.filter((g: any) => g.players.some((p: any) => p.id === comparePlayer!.id)), player!.id, comparePlayer!.id);
                    return (
                      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                        <div><span className="muted">Games: </span><b>{h2h.totalGames}</b></div>
                        <div><span className="muted">{player.name} wins: </span><b style={{ color: 'var(--success)' }}>{h2h.player1Wins}</b></div>
                        <div><span className="muted">{comparePlayer!.name} wins: </span><b style={{ color: 'var(--success)' }}>{h2h.player2Wins}</b></div>
                        <div><span className="muted">Ties: </span><b>{h2h.ties}</b></div>
                      </div>
                    );
                  })()}
                </div>
              )}
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
  const dartliteStats = loadDartliteGlobalStats();
  return (
    <div className="card" style={{ marginTop: 12 }}>
      <h3 style={{ marginBottom: 8 }}>🎮 Co-op Campaign</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
        <div style={{ padding: 8, background: 'var(--bg-3)', borderRadius: 6 }}>
          <div className="muted small">Levels cleared</div>
          <div style={{ fontWeight: 800, fontSize: 18 }}>{dartliteStats?.totalLevelsCleared || 0}</div>
        </div>
        <div style={{ padding: 8, background: 'var(--bg-3)', borderRadius: 6 }}>
          <div className="muted small">Bosses slain</div>
          <div style={{ fontWeight: 800, fontSize: 18 }}>{dartliteStats?.totalBossesSlain || 0}</div>
        </div>
        <div style={{ padding: 8, background: 'var(--bg-3)', borderRadius: 6 }}>
          <div className="muted small">XP gained</div>
          <div style={{ fontWeight: 800, fontSize: 18 }}>{dartliteStats?.totalXp || 0}</div>
        </div>
      </div>
    </div>
  );
}
