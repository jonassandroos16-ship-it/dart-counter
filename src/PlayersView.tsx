import { useState } from 'react';
import type { Player, Settings, CustomTitle } from './types';
import { COLORS, allTitles, getTitleInfo, conditionLabel, titleProgressInfo, type TitleCtx } from './constants';
import { levelFromXP, getPlayerXP, playerStats, allVisitsFor } from './logic';
import { initials, uid } from './store';
import { Modal } from './Popups';
import { BADGES, getBadgeInfo } from './badges';

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
        return (
          <div key={p.id} className="card" style={{ padding: 12 }}>
            <div className="row between">
              <div className="row">
                <div className="avatar" style={{ background: p.color, fontSize: bi ? 18 : undefined }}>{avatarContent}</div>
                <div>
                  <div className="row" style={{ gap: 6, alignItems: 'baseline' }}>
                    <span style={{ fontWeight: 700 }}>{p.name}</span>
                    <span className="xp-pill">Lvl {li.level}</span>
                    {ti ? <span className="title-badge">{ti.icon || ''} {ti.name}</span> : null}
                    {bi ? <span className="title-badge" title={bi.desc}>{bi.icon} {bi.name}</span> : null}
                  </div>
                  <div className="muted small">{s.games} games · {s.avg.toFixed(1)} avg · {s.n180} × 180 · {xp.xp} XP · {(xp.unlockedBadges || []).length} badges</div>
                  <div className="xp-bar" style={{ width: 140 }}><div style={{ width: `${Math.round(li.xpIntoLevel / li.xpNeeded * 100)}%` }} /></div>
                </div>
              </div>
              <div className="row" style={{ gap: 6 }}>
                <button className="btn ghost sm" onClick={() => setTitlesFor(p)}>Titles</button>
                <button className="btn ghost sm" onClick={() => setBadgesFor(p)}>Badges</button>
                <button className="btn ghost sm" onClick={() => { setEditing(p); setIsNew(false); }}>Edit</button>
                <button className="btn danger sm" onClick={() => { if (confirm(`Delete ${p.name}?`)) { setPlayers((prev: Player[]) => prev.filter(x => x.id !== p.id)); toast('Player deleted'); } }}>Delete</button>
              </div>
            </div>
          </div>
        );
      })}
      {editing && <EditPlayerModal player={editing} isNew={isNew} onClose={() => setEditing(null)} onSave={(p) => {
        if (isNew) setPlayers((prev: Player[]) => [...prev, p]);
        else setPlayers((prev: Player[]) => prev.map(x => x.id === p.id ? p : x));
        setEditing(null); toast(isNew ? 'Player added' : 'Saved');
      }} />}
      {titlesFor && <TitlesModal player={titlesFor} games={games} settings={settings} setPlayers={setPlayers} onClose={() => setTitlesFor(null)} toast={toast} />}
      {badgesFor && <BadgesModal player={badgesFor} setPlayers={setPlayers} onClose={() => setBadgesFor(null)} toast={toast} />}
    </div>
  );
}

function BadgesModal({ player, setPlayers, onClose, toast }: { player: Player; setPlayers: (updater: any) => void; onClose: () => void; toast: (m: string) => void }) {
  const xp = getPlayerXP(player);
  const unlocked = xp.unlockedBadges || [];
  const equipped = xp.selectedBadge;
  return (
    <Modal onClose={onClose}>
      <h3 style={{ marginBottom: 4 }}>Badges — {player.name}</h3>
      <div className="muted small" style={{ marginBottom: 14 }}>Tap to equip a badge as your icon. {unlocked.length} / {BADGES.length} unlocked.</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 8, maxHeight: '50vh', overflow: 'auto' }}>
        <button
          onClick={() => { setPlayers((prev: Player[]) => prev.map(p => p.id === player.id ? { ...p, selectedBadge: null } : p)); toast('Badge removed'); }}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: 10, borderRadius: 10,
            background: equipped === null ? 'color-mix(in srgb,var(--accent) 20%,var(--bg-3))' : 'var(--bg-3)',
            border: `1px solid ${equipped === null ? 'var(--accent)' : 'var(--border)'}`,
            cursor: 'pointer', color: 'inherit',
          }}
        >
          <div className="avatar" style={{ background: player.color, width: 32, height: 32, fontSize: 12 }}>{initials(player.name)}</div>
          <div style={{ fontSize: 11, fontWeight: 700 }}>None</div>
        </button>
        {BADGES.map((b) => {
          const isUnlocked = unlocked.includes(b.id);
          const isEquipped = equipped === b.id;
          return (
            <button
              key={b.id}
              disabled={!isUnlocked}
              onClick={() => { setPlayers((prev: Player[]) => prev.map(p => p.id === player.id ? { ...p, selectedBadge: b.id } : p)); toast('Badge equipped'); }}
              title={b.desc}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: 10, borderRadius: 10,
                background: isEquipped ? 'color-mix(in srgb,var(--accent) 20%,var(--bg-3))' : 'var(--bg-3)',
                border: `1px solid ${isEquipped ? 'var(--accent)' : 'var(--border)'}`,
                opacity: isUnlocked ? 1 : 0.5,
                cursor: isUnlocked ? 'pointer' : 'not-allowed', color: 'inherit',
              }}
            >
              <div style={{ fontSize: 24 }}>{isUnlocked ? b.icon : '🔒'}</div>
              <div style={{ fontSize: 11, fontWeight: 700, textAlign: 'center', lineHeight: 1.1 }}>{b.name}</div>
              {isEquipped ? <span className="xp-pill" style={{ fontSize: 9 }}>Equipped</span> : null}
            </button>
          );
        })}
      </div>
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
              gap: 10,
              padding: 10,
              borderRadius: 12,
              background: 'var(--bg-3)',
              border: `1px solid ${equipped ? 'var(--accent)' : 'var(--border)'}`,
              opacity: unlocked ? 1 : 0.65,
              overflow: 'hidden',
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
              <div style={{ position: 'relative', zIndex: 1, fontSize: 24 }}>{unlocked ? (t.icon || '🏅') : '🔒'}</div>
              <div style={{ position: 'relative', zIndex: 1, flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700 }}>{t.name}{t.custom ? <span className="pill" style={{ fontSize: 9, marginLeft: 4 }}>CUSTOM</span> : null}</div>
                <div className="muted small">{t.desc || ''}</div>
                {prog && !unlocked ? (
                  <div className="muted small" style={{ fontSize: 11, marginTop: 2 }}>
                    {prog.current.toLocaleString()} / {prog.target.toLocaleString()}
                  </div>
                ) : null}
              </div>
              <div style={{ position: 'relative', zIndex: 1 }}>
                {equipped
                  ? <span className="xp-pill">Equipped</span>
                  : unlocked
                    ? <button className="btn sm ghost" onClick={() => { setPlayers((prev: Player[]) => prev.map(p => p.id === player.id ? { ...p, selectedTitle: t.id } : p)); toast('Title equipped'); }}>Equip</button>
                    : <span className="muted small">Locked</span>}
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
