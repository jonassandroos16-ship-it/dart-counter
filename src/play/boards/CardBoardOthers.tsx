import type { Game, Player, Settings } from '../../types';
import { TEAM_COLORS, getTitleInfo } from '../../constants';
import { leadTrailBadge, visitAvg, levelFromXP, getPlayerXPById } from '../../logic';
import { AttributeStrip, BadgeAvatar } from '../common';

interface Props {
  game: Game;
  players: Player[];
  games: any[];
  settings: Settings;
  isBattle: boolean;
  isKiller: boolean;
  isHighScore: boolean;
  throwOrder: (idx: number) => number;
  hpPct: (pl: any) => number;
}

export function CardBoardOthers({
  game, players, games, settings, isBattle, isKiller, isHighScore, throwOrder, hpPct,
}: Props) {
  const others = [...game.players.slice(game.turn + 1), ...game.players.slice(0, game.turn)];

  return (
    <div className="play-others">
      {others.map(pl => {
        const xpInfo = getPlayerXPById(pl.id, players);
        const li = levelFromXP(xpInfo.xp, settings);
        const ti = getTitleInfo(xpInfo.selectedTitle ?? '', settings.customTitles);
        const badge = leadTrailBadge(pl, game);
        const plTeam = game.teamMode ? (pl.team ?? 0) : -1;
        const plTeamColor = game.teamMode ? TEAM_COLORS[plTeam % TEAM_COLORS.length] : pl.color;
        const defeated = isBattle && pl.defeated;
        const eliminated = isKiller && pl.eliminated;
        const hidden = defeated || eliminated;
        return (
          <div key={pl.id} className="play-other" style={{ ...(hidden ? { opacity: 0.4, filter: 'grayscale(.6)' } : {}), ...(game.teamMode ? { borderColor: plTeamColor } : {}) }}>
            <div className="row between">
              <div className="row" style={{ gap: 6 }}>
                <span className={`turn-order-badge${game.players.indexOf(pl) === game.roundStartTurn ? ' starter' : ''}`} style={{ width: 18, height: 18, fontSize: 10 }}>{throwOrder(game.players.indexOf(pl)) + 1}</span>
                <BadgeAvatar playerId={pl.id} players={players} games={games} size={22} fontSize={12} color={pl.color} />
                <span className="po-name">{pl.name}</span>
                {game.teamMode && <span style={{ fontSize: 9, fontWeight: 800, color: plTeamColor }}>T{plTeam + 1}</span>}
                {isKiller && (pl.killerHits || 0) >= 5 && !eliminated && <span className="pill" style={{ background: '#ef4444', color: '#fff', fontSize: 9 }}>KILLER</span>}
                {defeated && <span className="pill" style={{ fontSize: 9, background: '#ef4444', color: '#fff' }}>DEFEATED</span>}
                {eliminated && <span className="pill" style={{ fontSize: 9, background: '#ef4444', color: '#fff' }}>ELIMINATED</span>}
              </div>
              <div className="row" style={{ gap: 4 }}>
                {!game.teamMode && game.legsBestOf > 1 && !isBattle && !isKiller && !isHighScore ? <span className="pill" style={{ fontSize: 10 }}>{pl.legsWon}</span> : null}
                {isBattle ? <span className="pill" style={{ fontSize: 10 }}>{pl.hp} HP</span> :
                 isKiller ? <span className="pill" style={{ fontSize: 10 }}>{'❤️'.repeat(pl.lives || 0) || '💀'}</span> :
                 isHighScore ? <span className="pill" style={{ fontSize: 10 }}>{pl.visits.length}/{7}</span> :
                 badge ? <span className={`lead-badge ${badge.startsWith('+') ? 'lead' : 'trail'}`}>{badge}</span> : null}
              </div>
            </div>
            {isBattle ? (
              <>
                <div style={{ marginTop: 4, height: 6, borderRadius: 3, background: 'var(--bg-3)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${hpPct(pl)}%`, background: pl.color, transition: 'width .3s' }} />
                </div>
                <div className="po-sub">🛡️ {pl.armorPct}% · ⚡ {pl.powerPct}{pl.damageDealt ? ` · 💥 ${pl.damageDealt}` : ''}</div>
              </>
            ) : isKiller ? (
              <>
                <div className="po-score">#{pl.killerNumber}</div>
                <div className="po-sub">{(pl.killerHits || 0) >= 5 ? 'Killer' : `${pl.killerHits || 0}/5 to kill`} · {pl.kills?.length || 0} kills</div>
              </>
            ) : isHighScore ? (
              <>
                <div className="po-score">{pl.score}</div>
                <div className="po-sub">avg {visitAvg(pl).toFixed(1)}</div>
              </>
            ) : (
              <>
                <div className="po-score">{pl.score}</div>
                <div className="po-sub">avg {visitAvg(pl).toFixed(1)} · {pl.visits.reduce((a, v) => a + v.darts.length, 0)} 🎯 · L{li.level}{ti ? ` · ${ti.icon || ''} ${ti.name}` : ''}</div>
                <AttributeStrip playerId={pl.id} players={players} mode={game.mode} settings={settings} />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
