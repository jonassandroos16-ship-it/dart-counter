import { useMemo, useState } from 'react';
import type { Player, Settings, CustomTitle } from './types';
import { COLORS, allTitles, getTitleInfo, conditionLabel, titleProgressInfo, type TitleCtx } from './constants';
import { levelFromXP, getPlayerXP, playerStats, allVisitsFor } from './logic';
import { initials, uid } from './store';
import { Modal } from './Popups';
import { BADGES, getBadgeInfo, computeLifetimeBadgeCounts } from './badges';

export function PlayersView({ players, games, settings, setPlayers, toast }: {
  players: Player[]; games: any[]; settings: Settings;
  setPlayers: (updater: any) => void; toast: (m: string) => void;
}) {
  const [editing, setEditing] = useState<Player | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [titlesFor, setTitlesFor] = useState<Player | null>(null);
  const [badgesFor, setBadgesFor] = useState<Player | null>(null);

  return (
    <div>
      <div className="row between" style={{ marginBottom: 12 }}>
        <h2>Players</h2>
        <button className="btn primary sm" onClick={() => { setEditing({ id: '', name: '', color: COLORS[players.length % COLORS.length] }); setIsNew(true); }}>+ Add Player</button>
      </div>
      {!players.length && <div className="empty">No players yet.<br />Add your first player to get started.</div>}
      {players.map(p => {
        const s = playerStats(p.id, games as any);
        const xp = getPlayerXP(p);
        const li = levelFromXP(xp.xp, settings);
        const ti = getTitleInfo(xp.selectedTitle, settings.customTitles);
        const bi = getBadgeInfo(xp.selectedBadge);
        const avatarContent = bi ? bi.icon : initials(p.name);
        const totalBadgeEarns = Object.values(xp.badgeCounts || {}).reduce((a: number, b: number) => a + b, 0);
        return (
          <div key={p.id} className="card" style={{ padding: 12 }}>
            <div className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
              <div className="avatar" style={{ background: p.color, fontSize: bi ? 18 : undefined }}>{avatarContent}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="row wrap" style={{ gap: 6, alignItems: 'baseline' }}>
                  <span style={{ fontWeight: 700 }}>{p.name}</span>
                  <span className="xp-pill">Lvl {li.level}</span>
                  {ti ? <span className="title-badge">{ti.icon || ''} {ti.name}</span> : null}
                  {bi ? <span className="title-badge" title={bi.desc}>{bi.icon} {bi.name}</span> : null}
                </div>
                <div className="muted small">{s.games} games · {s.avg.toFixed(1)} avg · {s.n180} × 180 · {xp.xp} XP · {(xp.unlockedBadges || []).length} badges · {totalBadgeEarns} earned</div>
                <div className="xp-bar" style={{ width: '100%', maxWidth: 240 }}><div style={{ width: `${Math.round(li.xpIntoLevel / li.xpNeeded * 100)}%` }} /></div>
              </div>
            </div>
            <div className="row wrap" style={{ gap: 6, marginTop: 10 }}>
              <button className="btn ghost sm" onClick={() => setTitlesFor(p)}>Titles</button>
              <button className="btn ghost sm" onClick={() => setBadgesFor(p)}>Badges</button>
              <button className="btn ghost sm" onClick={() => { setEditing(p); setIsNew(false); }}>Edit</button>
              <button className="btn danger sm" onClick={() => { if (confirm(`Delete ${p.name}?`)) { setPlayers((prev: Player[]) => prev.filter(x => x.id !== p.id)); toast('Player deleted'); } }}>Delete</button>
            </div>
          </div>
        );
      })}
      {editing && <EditPlayerModal player={editing} isNew={isNew} onClose={() => setEditing(null)} onSave={(p) => {
        if (isNew) setPlayers((prev: Player[]) => [...prev, p]);
        else setPlayers((prev: Player[]) => prev.map(x => x.id === p.id ? p : x));
        setEditing(null); toast(isNew ? 'Player added' : 'Saved');
      }} />}
      {titlesFor && <TitlesModal player={players.find(p => p.id === titlesFor.id) || titlesFor} games={games} settings={settings} setPlayers={setPlayers} onClose={() => setTitlesFor(null)} toast={toast} />}
      {badgesFor && <BadgesModal player={players.find(p => p.id === badgesFor.id) || badgesFor} games={games} setPlayers={setPlayers} onClose={() => setBadgesFor(null)} toast={toast} />}
    </div>
  );
}

function BadgesModal({ player, games, setPlayers, onClose, toast }: { player: Player; games: any[]; setPlayers: (updater: any) => void; onClose: () => void; toast: (m: string) => void }) {
  const xp = getPlayerXP(player);
  const unlocked = xp.unlockedBadges || [];
  const [equipped, setEquipped] = useState<string | null>(xp.selectedBadge);
  const [selectedId, setSelectedId] = useState<string | null>(xp.selectedBadge);
  const selected = BADGES.find(b => b.id === selectedId) || null;
  const badgeCounts = useMemo(() => {
    const stored = xp.badgeCounts || {};
    const fromHistory = computeLifetimeBadgeCounts(player.id, games as any);
    const merged: Record<string, number> = { ...fromHistory };
    for (const [k, v] of Object.entries(stored)) merged[k] = Math.max(merged[k] || 0, v);
    return merged;
  }, [xp.badgeCounts, player.id, games]);
  const totalEarns = Object.values(badgeCounts).reduce((a: number, b: number) => a + b, 0);

  const equip = (id: string | null) => {
    setEquipped(id);
    setSelectedId(id);
    setPlayers((prev: Player[]) => prev.map(p => p.id === player.id ? { ...p, selectedBadge: id } : p));
    toast(id ? 'Badge equipped' : 'Badge removed');
  };

  return (
    <Modal onClose={onClose}>
      <h3 style={{ marginBottom: 4 }}>Badges — {player.name}</h3>
      <div className="muted small" style={{ marginBottom: 14 }}>Tap a badge to select it, then Equip. {unlocked.length} / {BADGES.length} unlocked · {totalEarns} earned.</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 8, maxHeight: '44vh', overflow: 'auto' }}>
        <button
          onClick={() => setSelectedId(null)}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: 10, borderRadius: 10,
            background: selectedId === null ? 'color-mix(in srgb,var(--accent) 22%,var(--bg-3))' : 'var(--bg-3)',
            border: `1px solid ${equipped === null && selectedId === null ? 'var(--accent)' : selectedId === null ? 'color-mix(in srgb,var(--accent) 50%,var(--border))' : 'var(--border)'}`,
            cursor: 'pointer', color: 'inherit',
          }}
        >
          <div className="avatar" style={{ background: player.color, width: 32, height: 32, fontSize: 12 }}>{initials(player.name)}</div>
          <div style={{ fontSize: 11, fontWeight: 700 }}>None</div>
          {equipped === null ? <span className="xp-pill" style={{ fontSize: 9 }}>Equipped</span> : null}
        </button>
        {BADGES.map((b) => {
          const isUnlocked = unlocked.includes(b.id);
          const isEquipped = equipped === b.id;
          const isSelected = selectedId === b.id;
          const count = badgeCounts[b.id] || 0;
          return (
            <button
              key={b.id}
              onClick={() => setSelectedId(b.id)}
              title={`${b.desc}${count > 0 ? ` (earned ${count}×)` : ''}`}
              style={{
                position: 'relative',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: 10, borderRadius: 10,
                background: isSelected ? 'color-mix(in srgb,var(--accent) 22%,var(--bg-3))' : 'var(--bg-3)',
                border: `1px solid ${isEquipped ? 'var(--accent)' : isSelected ? 'color-mix(in srgb,var(--accent) 50%,var(--border))' : 'var(--border)'}`,
                opacity: isUnlocked ? 1 : 0.5,
                cursor: 'pointer', color: 'inherit',
              }}
            >
              <div style={{ fontSize: 24 }}>{isUnlocked ? b.icon : '🔒'}</div>
              <div style={{ fontSize: 11, fontWeight: 700, textAlign: 'center', lineHeight: 1.1 }}>{b.name}</div>
              {isEquipped ? <span className="xp-pill" style={{ fontSize: 9 }}>Equipped</span> : null}
              {count > 1 ? (
                <span style={{ position: 'absolute', top: 4, right: 4, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 8, background: 'var(--accent)', color: '#04150a', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{count}</span>
              ) : null}
            </button>
          );
        })}
      </div>

      {selected ? (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: 'var(--bg-3)', border: '1px solid var(--border)' }}>
          <div className="row" style={{ gap: 10, alignItems: 'center' }}>
            <div style={{ fontSize: 28 }}>{unlocked.includes(selected.id) ? selected.icon : '🔒'}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{selected.name}</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 2, lineHeight: 1.3 }}>{selected.desc}</div>
              <div className="muted small" style={{ marginTop: 4 }}>
                {unlocked.includes(selected.id) ? `Earned ${badgeCounts[selected.id] || 0}× — equip to show it as your icon.` : 'Locked — earn it in a future game to unlock.'}
              </div>
            </div>
          </div>
          <button
            className="btn block primary"
            style={{ marginTop: 10 }}
            disabled={!unlocked.includes(selected.id) || equipped === selected.id}
            onClick={() => equip(selected.id)}
          >
            {equipped === selected.id ? 'Equipped' : unlocked.includes(selected.id) ? 'Equip' : 'Locked'}
          </button>
        </div>
      ) : (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: 'var(--bg-3)', border: '1px solid var(--border)' }}>
          <div className="row" style={{ gap: 10, alignItems: 'center' }}>
            <div className="avatar" style={{ background: player.color, width: 36, height: 36, fontSize: 13 }}>{initials(player.name)}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>No badge</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 2, lineHeight: 1.3 }}>Show your initials instead of a badge icon.</div>
            </div>
          </div>
          <button
            className="btn block primary"
            style={{ marginTop: 10 }}
            disabled={equipped === null}
            onClick={() => equip(null)}
          >
            {equipped === null ? 'Equipped' : 'Equip'}
          </button>
        </div>
      )}

      <button className="btn block ghost" style={{ marginTop: 14 }} onClick={onClose}>Close</button>
    </Modal>
  );
}

function EditPlayerModal({ player, isNew, onClose, onSave }: { player: Player; isNew: boolean; onClose: () => void; onSave: (p: Player) => void }) {
  const [name, setName] = useState(player.name);
  const [color, setColor] = useState(player.color || COLORS[0]);
  return (
    <Modal onClose={onClose}>
      <h3 style={{ marginBottom: 14 }}>{isNew ? 'Add' : 'Edit'} Player</h3>
      <label className="field"><span>Name</span><input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Jonas" maxLength={20} /></label>
      <span style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>Color</span>
      <div className="row wrap" style={{ gap: 10, marginBottom: 18 }}>
        {COLORS.map(c => <button key={c} className={`swatch${c === color ? ' on' : ''}`} style={{ background: c }} onClick={() => setColor(c)} />)}
      </div>
      <div className="row" style={{ gap: 10 }}>
        <button className="btn block ghost" onClick={onClose}>Cancel</button>
        <button className="btn block primary" onClick={() => { if (!name.trim()) return; onSave({ ...player, id: player.id || uid(), name: name.trim(), color }); }}>Save</button>
      </div>
    </Modal>
  );
}

function TitlesModal({ player, games, settings, setPlayers, onClose, toast }: { player: Player; games: any[]; settings: Settings; setPlayers: (updater: any) => void; onClose: () => void; toast: (m: string) => void }) {
  const xp = getPlayerXP(player);
  const titles = allTitles(settings.customTitles);

  const playerGames = (games as any[]).filter(g => g.players.some((p: any) => p.id === player.id));
  const gamesWon = playerGames.filter(g => g.winner === player.id).length;
  const ctx: TitleCtx = {
    playerId: player.id,
    games: playerGames,
    gamesPlayed: playerGames.length,
    gamesWon,
    lifetimeVisits: allVisitsFor(player.id, games as any[]),
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
    <Modal onClose={onClose}>
      <h3 style={{ marginBottom: 4 }}>Titles — {player.name}</h3>
      <div className="muted small" style={{ marginBottom: 14 }}>Tap to equip. Locked titles are earned through play.</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '50vh', overflow: 'auto' }}>
        {sorted.map(({ t, unlocked, prog }) => {
          const equipped = xp.selectedTitle === t.id;
          const pct = prog ? prog.pct : 0;
          const fillBg = unlocked
            ? 'color-mix(in srgb,var(--accent) 28%,var(--bg-3))'
            : 'color-mix(in srgb,var(--accent) 18%,var(--bg-3))';
          return (
            <div key={t.id} style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: 16,
              borderRadius: 12,
              background: 'var(--bg-3)',
              border: `1px solid ${equipped ? 'var(--accent)' : 'var(--border)'}`,
              opacity: unlocked ? 1 : 0.65,
              overflow: 'hidden',
              minHeight: 76,
            }}>
              <div style={{
                position: 'absolute',
                inset: 0,
                width: `${pct}%`,
                background: fillBg,
                transition: 'width .4s ease',
                pointerEvents: 'none',
                zIndex: 0,
              }} />
              <div style={{ position: 'relative', zIndex: 1, fontSize: 30, width: 38, textAlign: 'center' }}>{unlocked ? (t.icon || '🏅') : '🔒'}</div>
              <div style={{ position: 'relative', zIndex: 1, flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.2 }}>{t.name}{t.custom ? <span className="pill" style={{ fontSize: 11, marginLeft: 6 }}>CUSTOM</span> : null}</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 2, lineHeight: 1.3 }}>{t.desc || ''}</div>
                {prog && !unlocked ? (
                  <div className="muted" style={{ fontSize: 12, marginTop: 4, fontWeight: 600 }}>
                    {prog.current.toLocaleString()} / {prog.target.toLocaleString()}
                  </div>
                ) : null}
              </div>
              <div style={{ position: 'relative', zIndex: 1 }}>
                {equipped
                  ? <span className="xp-pill" style={{ fontSize: 12, padding: '4px 10px' }}>Equipped</span>
                  : unlocked
                    ? <button className="btn sm ghost" style={{ fontSize: 13, padding: '7px 12px' }} onClick={() => { setPlayers((prev: Player[]) => prev.map(p => p.id === player.id ? { ...p, selectedTitle: t.id } : p)); toast('Title equipped'); }}>Equip</button>
                    : <span className="muted" style={{ fontSize: 12 }}>Locked</span>}
              </div>
            </div>
          );
        })}
      </div>
      <button className="btn block ghost" style={{ marginTop: 14 }} onClick={onClose}>Close</button>
    </Modal>
  );
}

export { conditionLabel };
export type { CustomTitle };
