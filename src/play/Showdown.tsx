import { useEffect, useMemo } from 'react';
import type { Game, GameRecord, Player, Settings } from '../types';
import { MODES, TEAM_COLORS, getTitleInfo, showdownBgCssForId } from '../constants';
import { getPlayerXPById, levelFromXP, playerStats } from '../logic';
import { getBadgeInfo, getBadgeContext } from '../badges';
import { getPowerUpInfo } from '../powerups';
import { initials } from '../store';
import { Sound } from '../sound';
import type { MusicEngine } from '../music';

const SHOWDOWN_TAGLINES = [
  'The oche is set.', 'Let the darts fly.', 'Three darts. One winner.', 'Steady hand, sharp eye.',
  'No mercy on the board.', 'Aim true.', 'Chalk ready, game on.', 'Bullseye or bust.',
  'Leg by leg.', 'The crowd goes quiet...', 'Tension rising.', 'One leg closer to glory.',
];

function pickTagline(seed: number) {
  return SHOWDOWN_TAGLINES[seed % SHOWDOWN_TAGLINES.length];
}

// Showdown titles: each player can earn one highlight title based on their
// lifetime stats. The first matching rule (in priority order) wins, and a
// rule only fires when exactly one player is the leader so ties are skipped.
type ShowdownTitle = {
  id: string;
  label: string;
  icon: string;
  pick: (stats: ReturnType<typeof playerStats>) => number;
  desc: string;
};

const SHOWDOWN_TITLES: ShowdownTitle[] = [
  { id: 'champion', label: 'Champion', icon: '👑', desc: 'Highest level — the defending champion',
    pick: () => 0 }, // handled separately via level, but kept for ordering
  { id: 'top_scorer', label: 'Top Scorer', icon: '📈', desc: 'Highest single-visit score',
    pick: (s) => s.highScore || 0 },
  { id: 'ton_master', label: 'Ton Master', icon: '💯', desc: 'Most 100+ visits',
    pick: (s) => (s.tons || 0) + (s.n140 || 0) + (s.n180 || 0) },
  { id: 'max_king', label: 'Maximum King', icon: '💥', desc: 'Most 180s',
    pick: (s) => s.n180 || 0 },
  { id: 'checkout_master', label: 'Checkout Master', icon: '🎯', desc: 'Highest checkout',
    pick: (s) => s.highCheckout || 0 },
  { id: 'win_rate_king', label: 'Winner', icon: '🏆', desc: 'Best win rate (min 2 games)',
    pick: (s) => s.competitiveGames >= 2 ? s.winRate : -1 },
  { id: 'first9_flyer', label: 'Fast Starter', icon: '🚀', desc: 'Best first-9 average',
    pick: (s) => s.first9 || 0 },
  { id: 'sharpshooter', label: 'Sharpshooter', icon: '🔫', desc: 'Best 3-dart average',
    pick: (s) => s.avg || 0 },
  { id: 'finisher', label: 'The Finisher', icon: '✅', desc: 'Most legs finished',
    pick: (s) => s.legsFinished || 0 },
  { id: 'veteran', label: 'Veteran', icon: '🎖️', desc: 'Most games played',
    pick: (s) => s.games || 0 },
];

export function Showdown({ game, players, games, settings, onClose }: {
  game: Game; players: Player[]; games: GameRecord[]; settings: Settings; music: MusicEngine; onClose: () => void;
}) {
  const teamMode = !!game.teamMode;
  const teamCount = game.teamCount || 2;
  const mode = MODES[game.mode];
  const modeName = mode?.label || game.mode;
  const legsLabel = game.legsBestOf > 1 ? `Best of ${game.legsBestOf}` : 'Single leg';
  const powerUpsOn = !!game.powerUpsEnabled;

  const sides = useMemo(() => {
    if (!teamMode) {
      return game.players.map((pl, i) => {
        const p = players.find(pp => pp.id === pl.id);
        const xp = getPlayerXPById(pl.id, players);
        const li = levelFromXP(xp.xp, settings);
        const ti = getTitleInfo(xp.selectedTitle, settings.customTitles);
        const bi = getBadgeInfo(xp.selectedBadge);
        const ctx = xp.showBadgeContext ? getBadgeContext(xp.selectedBadge, pl.id, games as any) : null;
        const pu = getPowerUpInfo(p?.powerUps?.active);
        const stats = playerStats(pl.id, games as any);
        return {
          kind: 'player' as const, idx: i, name: pl.name, color: pl.color,
          members: [{ id: pl.id, name: pl.name, color: pl.color }],
          level: li.level, title: ti, badge: bi, badgeCtx: ctx, powerUp: pu, stats,
          bgCss: showdownBgCssForId(p?.showdownBg),
        };
      });
    }
    return Array.from({ length: teamCount }, (_, ti) => {
      const members = game.players.filter(pl => pl.team === ti).map(pl => {
        const p = players.find(pp => pp.id === pl.id);
        const xp = getPlayerXPById(pl.id, players);
        const li = levelFromXP(xp.xp, settings);
        const tinfo = getTitleInfo(xp.selectedTitle, settings.customTitles);
        const binfo = getBadgeInfo(xp.selectedBadge);
        const bctx = xp.showBadgeContext ? getBadgeContext(xp.selectedBadge, pl.id, games as any) : null;
        const pu = getPowerUpInfo(p?.powerUps?.active);
        return { id: pl.id, name: pl.name, color: pl.color, level: li.level, title: tinfo, badge: binfo, badgeCtx: bctx, powerUp: pu };
      });
      const name = `Team ${ti + 1}`;
      const teamBgCss = members
        .map(m => showdownBgCssForId(players.find(pp => pp.id === m.id)?.showdownBg))
        .find(css => css) || null;
      return { kind: 'team' as const, idx: ti, name, color: TEAM_COLORS[ti % TEAM_COLORS.length], members, bgCss: teamBgCss };
    });
  }, [game.players, teamMode, teamCount, players, settings, games]);

  // Champion = highest level player (only when 2+ players and no tie at the top).
  const championIdx = useMemo(() => {
    if (teamMode || sides.length < 2) return -1;
    const ps = sides.filter(s => s.kind === 'player') as any[];
    if (ps.length < 2) return -1;
    const maxLevel = Math.max(...ps.map((s: any) => s.level || 1));
    const top = ps.filter((s: any) => (s.level || 1) === maxLevel);
    if (top.length !== 1) return -1;
    return (top[0] as any).idx;
  }, [sides, teamMode]);

  // Resolve one extra "showdown title" per player based on lifetime stats.
  // A title only fires if exactly one player leads that metric, so we never
  // show a tied label. Champion (level) is already handled above, so we skip
  // it here to avoid duplicate crowns.
  const showdownTitles = useMemo<Record<number, { label: string; icon: string; desc: string }>>(() => {
    const out: Record<number, { label: string; icon: string; desc: string }> = {};
    if (teamMode || sides.length < 2) return out;
    const ps = sides.filter(s => s.kind === 'player') as any[];
    if (ps.length < 2) return out;
    const usedByPlayer = new Set<number>();
    for (const rule of SHOWDOWN_TITLES) {
      if (rule.id === 'champion') continue; // already shown via crown
      const scored = ps.map((s: any) => ({ idx: s.idx, n: rule.pick(s.stats) }));
      const max = Math.max(...scored.map(x => x.n));
      if (max <= 0) continue;
      const leaders = scored.filter(x => x.n === max);
      if (leaders.length !== 1) continue;
      const winnerIdx = leaders[0].idx;
      if (usedByPlayer.has(winnerIdx)) continue;
      usedByPlayer.add(winnerIdx);
      out[winnerIdx] = { label: rule.label, icon: rule.icon, desc: rule.desc };
    }
    return out;
  }, [sides, teamMode]);

  const tagline = useMemo(() => pickTagline(Math.floor(Math.random() * SHOWDOWN_TAGLINES.length)), []);

  useEffect(() => {
    const t = setTimeout(() => Sound.play('vs', {}, settings), 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    sides.forEach((s, i) => {
      if (s.kind !== 'player') return;
      const p = players.find(pp => pp.id === s.members[0]?.id);
      if (!p || !p.sound || p.sound === 'none') return;
      const t = setTimeout(() => Sound.playPlayerSound(p.sound!, settings), 1200 + i * 600);
      timers.push(t);
    });
    return () => { timers.forEach(t => clearTimeout(t)); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="showdown-bg" onClick={onClose}>
      <div className="showdown-flash" />
      <div className="showdown-header">
        <div className="sd-mode-name">{modeName}</div>
        <div className="sd-tagline">{tagline}</div>
        <div className="sd-meta-row">
          <span className="sd-chip">{legsLabel}</span>
          {game.doubleOut && <span className="sd-chip">Double Out</span>}
          {powerUpsOn && <span className="sd-chip sd-chip-accent">⚡ Power-Ups</span>}
          {teamMode && <span className="sd-chip">Teams</span>}
        </div>
      </div>
      <div className={`showdown-grid showdown-cols-${sides.length}`}>
        {sides.map((s, i) => {
          const isChampion = !teamMode && s.kind === 'player' && s.idx === championIdx;
          const sdTitle = !teamMode && s.kind === 'player' ? showdownTitles[s.idx] : null;
          const stat = !teamMode && (s as any).stats ? (s as any).stats : null;
          const statLabel = stat ? (stat.competitiveGames >= 2 && stat.winRate > 0
            ? `${Math.round(stat.winRate)}% wins`
            : stat.highScore > 0 ? `Best ${stat.highScore}` : null) : null;
          return (
          <div key={i} className={`showdown-card${isChampion ? ' sd-champion' : ''}${sdTitle ? ' sd-titled' : ''}${s.bgCss ? ' sd-has-bg' : ''}`} style={{ animationDelay: `${0.15 + i * 0.18}s`, borderColor: s.color, ...(s.bgCss ? { background: s.bgCss } : {}) }}>
            <div className="sd-team-color" style={{ background: s.color }} />
            {isChampion && <div className="sd-crown" title="Highest level — the defending champion">👑 Champion</div>}
            {!isChampion && sdTitle && <div className="sd-crown sd-crown-alt" title={sdTitle.desc}>{sdTitle.icon} {sdTitle.label}</div>}
            <div className="sd-card-inner">
              <div className="sd-name" style={{ color: s.color }}>{s.name}</div>
              {teamMode && s.kind === 'team' ? (
                <div className="sd-members">
                  {s.members.map(m => (
                    <div key={m.id} className="sd-member">
                      <span className="avatar" style={{ width: 28, height: 28, fontSize: 13, background: m.color }}>{m.badge ? m.badge.icon : initials(m.name)}</span>
                      <span className="sd-member-name">{m.name}</span>
                      {m.level > 1 && <span className="sd-lvl-mini">L{m.level}</span>}
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <div className="sd-solo-avatar" style={{ background: s.color }}>
                    {s.kind === 'player' && s.badge ? s.badge.icon : initials(s.name)}
                  </div>
                  {s.kind === 'player' && s.badgeCtx ? (
                    <div className="sd-badge-ctx" title={`${s.badgeCtx.label}: ${s.badgeCtx.value}`}>{s.badge?.icon} {s.badgeCtx.value}</div>
                  ) : null}
                  {statLabel ? <div className="sd-stat-teaser">{statLabel}</div> : null}
                </>
              )}
              <div className="sd-accents">
                {!teamMode && s.kind === 'player' && s.level > 1 ? <span className="sd-acc sd-acc-lvl">Lvl {s.level}</span> : null}
                {!teamMode && s.kind === 'player' && s.title ? <span className="sd-acc sd-acc-title" title={s.title.desc}>{s.title.icon || ''} {s.title.name}</span> : null}
                {!teamMode && s.kind === 'player' && s.badge ? <span className="sd-acc sd-acc-badge" title={s.badge.desc}>{s.badge.icon} {s.badge.name}</span> : null}
                {!teamMode && s.kind === 'player' && s.powerUp ? <span className="sd-acc sd-acc-pu" title={s.powerUp.desc}>{s.powerUp.icon} {s.powerUp.name}</span> : null}
              </div>
            </div>
          </div>
          );
        })}
      </div>
      {sides.length >= 2 && Array.from({ length: Math.max(1, sides.length - 1) }, (_, i) => (
        <div key={`vs-${i}`} className="showdown-vs" style={{ animationDelay: `${0.5 + i * 0.2}s` }}>VS</div>
      ))}
      <div className="showdown-tap" style={{ animationDelay: '1.2s' }}>Tap to start ▸</div>
    </div>
  );
}
