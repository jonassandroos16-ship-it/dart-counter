import type { GameRecord, Player, Settings, CustomTitle } from '../types';
import { levelFromXP, getPlayerXP, playerStats, defaultAttributes, defaultPowerUps } from '../logic';
import { getTitleInfo } from '../constants';
import { initials } from '../store';
import { getBadgeInfo, getBadgeContext, buildCoopBadgeCtx } from '../badges';
import { getPowerUpInfo } from '../powerups';

export function PlayerCard({ player, games, settings, customTitles, onEdit, onDelete }: {
  player: Player;
  games: GameRecord[];
  settings: Settings;
  customTitles: CustomTitle[];
  onEdit: () => void;
  onDelete: () => void;
}) {
  const p = player;
  const s = playerStats(p.id, games);
  const xp = getPlayerXP(p);
  const li = levelFromXP(xp.xp, settings);
  const ti = getTitleInfo(xp.selectedTitle, customTitles);
  const bi = getBadgeInfo(xp.selectedBadge);
  const avatarContent = bi ? bi.icon : initials(p.name);
  const totalBadgeEarns = Object.values(xp.badgeCounts || {}).reduce((a: number, b: number) => a + b, 0);
  const ctx = xp.showBadgeContext ? getBadgeContext(xp.selectedBadge, p.id, games, buildCoopBadgeCtx()) : null;
  const attrs = p.attributes || defaultAttributes(settings);
  const pwr = p.powerUps || defaultPowerUps(settings);
  const activePu = getPowerUpInfo(pwr.active);

  return (
    <div className="card player-card" style={{ padding: 12, borderLeft: `5px solid ${p.color}`, background: `linear-gradient(135deg, color-mix(in srgb, ${p.color} 10%, var(--bg-2)) 0%, var(--bg-2) 60%)` }}>
      <div className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
        <div style={{ position: 'relative', width: 34, height: 34, flex: '0 0 auto' }}>
          <div className="avatar" style={{ background: p.color, fontSize: bi ? 18 : undefined, width: 34, height: 34 }}>{avatarContent}</div>
          {ctx ? (
            <span
              title={`${ctx.label}: ${ctx.value}`}
              style={{
                position: 'absolute', bottom: -3, right: -3, minWidth: 18, height: 18, padding: '0 4px',
                borderRadius: 9, background: 'var(--accent)', color: '#04150a',
                fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '2px solid var(--bg-2)', lineHeight: 1, boxSizing: 'border-box',
              }}
            >{ctx.value}</span>
          ) : null}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="row wrap" style={{ gap: 6, alignItems: 'baseline' }}>
            <span style={{ fontWeight: 700 }}>{p.name}</span>
            <span className="xp-pill">Lvl {li.level}</span>
            {ti ? <span className="title-badge">{ti.icon || ''} {ti.name}</span> : null}
            {bi ? <span className="title-badge" title={bi.desc}>{bi.icon} {bi.name}</span> : null}
            {activePu ? <span className="title-badge" title={activePu.desc}>{activePu.icon} {activePu.name}</span> : null}
            {p.developerMode ? <span className="xp-pill" title="Developer mode — bonus points for testing">DEV</span> : null}
          </div>
          <div className="muted small">{s.games} games ({s.competitiveGames} competitive) · {s.avg.toFixed(1)} avg · {s.n180} × 180 · {xp.xp} XP · {(xp.unlockedBadges || []).length} badges · {totalBadgeEarns} earned</div>
          <div className="muted small" style={{ marginTop: 2 }}>❤️ {Number.isFinite(attrs.health) ? attrs.health : 0} HP · 🛡️ {Number.isFinite(attrs.armor) ? attrs.armor : 0}% armor · ⚡ {Number.isFinite(attrs.power) ? attrs.power : 0} power · {pwr.unlocked.length} power-ups · {pwr.pointsAvailable} PU pts · {attrs.pointsAvailable} attr pts</div>
          <div className="xp-bar" style={{ width: '100%', maxWidth: 240 }}><div style={{ width: `${Math.round(li.xpIntoLevel / li.xpNeeded * 100)}%` }} /></div>
        </div>
      </div>
      <div className="row wrap" style={{ gap: 6, marginTop: 10 }}>
        <button className="btn primary sm" onClick={onEdit}>Edit</button>
        <button className="btn danger sm" onClick={onDelete}>Delete</button>
      </div>
    </div>
  );
}
