import type { GameRecord, Player, Settings } from '../types';
import { allTitles, titleProgressInfo, type TitleCtx } from '../constants';
import { getPlayerXP, allVisitsFor } from '../logic';
import type { SetPlayers, Toast } from './BasicTab';

export function TitlesTab({ player, games, settings, setPlayers, toast }: {
  player: Player;
  games: GameRecord[];
  settings: Settings;
  setPlayers: SetPlayers;
  toast: Toast;
}) {
  const xp = getPlayerXP(player);
  const titles = allTitles(settings.customTitles);

  const playerGames = games.filter(g => g.players.some(p => p.id === player.id));
  const gamesWon = playerGames.filter(g => g.players.length >= 2 && g.winner === player.id).length;
  const ctx: TitleCtx = {
    playerId: player.id,
    games: playerGames,
    gamesPlayed: playerGames.length,
    gamesWon,
    lifetimeVisits: allVisitsFor(player.id, games),
  };

  const sorted = [...titles].map(t => {
    const unlocked = xp.unlockedTitles.includes(t.id);
    const prog = titleProgressInfo(t, ctx);
    return { t, unlocked, prog };
  }).sort((a, b) => {
    if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
    const ap = a.prog ? a.prog.pct : -1;
    const bp = b.prog ? b.prog.pct : -1;
    if (bp !== ap) return bp - ap;
    return a.t.name.localeCompare(b.t.name);
  });

  return (
    <>
      <div className="muted small" style={{ marginBottom: 10 }}>Tap to equip. Locked titles are earned through play.</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '40vh', overflow: 'auto' }}>
        {sorted.map(({ t, unlocked, prog }) => {
          const equipped = xp.selectedTitle === t.id;
          const pct = prog ? prog.pct : 0;
          const fillBg = unlocked
            ? 'color-mix(in srgb,var(--accent) 28%,var(--bg-3))'
            : 'color-mix(in srgb,var(--accent) 18%,var(--bg-3))';
          return (
            <div key={t.id} style={{
              position: 'relative',
              display: 'flex', alignItems: 'center', gap: 12,
              padding: 14, borderRadius: 12, background: 'var(--bg-3)',
              border: `1px solid ${equipped ? 'var(--accent)' : 'var(--border)'}`,
              opacity: unlocked ? 1 : 0.65, overflow: 'hidden', minHeight: 64,
            }}>
              <div style={{ position: 'absolute', inset: 0, width: `${pct}%`, background: fillBg, transition: 'width .4s ease', pointerEvents: 'none', zIndex: 0 }} />
              <div style={{ position: 'relative', zIndex: 1, fontSize: 26, width: 34, textAlign: 'center' }}>{unlocked ? (t.icon || '🏅') : '🔒'}</div>
              <div style={{ position: 'relative', zIndex: 1, flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.2 }}>{t.name}{t.custom ? <span className="pill" style={{ fontSize: 10, marginLeft: 6 }}>CUSTOM</span> : null}</div>
                <div className="muted" style={{ fontSize: 11, marginTop: 2, lineHeight: 1.3 }}>{t.desc || ''}</div>
                {prog && !unlocked ? <div className="muted" style={{ fontSize: 11, marginTop: 4, fontWeight: 600 }}>{prog.current.toLocaleString()} / {prog.target.toLocaleString()}</div> : null}
              </div>
              <div style={{ position: 'relative', zIndex: 1 }}>
                {equipped ? <span className="xp-pill" style={{ fontSize: 11 }}>Equipped</span>
                  : unlocked ? <button className="btn sm ghost" style={{ fontSize: 12, padding: '6px 10px' }} onClick={() => { setPlayers((prev: Player[]) => prev.map(p => p.id === player.id ? { ...p, selectedTitle: t.id } : p)); toast('Title equipped'); }}>Equip</button>
                  : <span className="muted" style={{ fontSize: 11 }}>Locked</span>}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
