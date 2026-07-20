import { useMemo, useState } from 'react';
import type { GameRecord, Player } from '../types';
import { getPlayerXP } from '../logic';
import { initials } from '../store';
import { BADGES, getBadgeContext, computeLifetimeBadgeCounts, buildCoopBadgeCtx } from '../badges';
import type { SetPlayers, Toast } from './BasicTab';

export function BadgesTab({ player, games, setPlayers, toast }: {
  player: Player;
  games: GameRecord[];
  setPlayers: SetPlayers;
  toast: Toast;
}) {
  const xp = getPlayerXP(player);
  const unlocked = xp.unlockedBadges || [];
  const [equipped, setEquipped] = useState<string | null>(xp.selectedBadge);
  const [selectedId, setSelectedId] = useState<string | null>(xp.selectedBadge);
  const [showContext, setShowContext] = useState<boolean>(xp.showBadgeContext ?? false);
  const selected = BADGES.find(b => b.id === selectedId) || null;
  const badgeCounts = useMemo(() => {
    const stored = xp.badgeCounts || {};
    const fromHistory = computeLifetimeBadgeCounts(player.id, games);
    const merged: Record<string, number> = { ...fromHistory };
    for (const [k, v] of Object.entries(stored)) merged[k] = Math.max(merged[k] || 0, v);
    return merged;
  }, [xp.badgeCounts, player.id, games]);
  const totalEarns = Object.values(badgeCounts).reduce((a: number, b: number) => a + b, 0);
  const previewCtx = selected && selected.context ? getBadgeContext(selected.id, player.id, games, buildCoopBadgeCtx()) : null;

  const equip = (id: string | null) => {
    setEquipped(id); setSelectedId(id);
    setPlayers((prev: Player[]) => prev.map(p => p.id === player.id ? { ...p, selectedBadge: id, showBadgeContext: showContext } : p));
    toast(id ? 'Badge equipped' : 'Badge removed');
  };
  const toggleContext = (on: boolean) => {
    setShowContext(on);
    setPlayers((prev: Player[]) => prev.map(p => p.id === player.id ? { ...p, showBadgeContext: on } : p));
  };

  return (
    <>
      <div className="muted small" style={{ marginBottom: 10 }}>Tap a badge to select it, then Equip. {unlocked.length} / {BADGES.length} unlocked · {totalEarns} earned.</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))', gap: 8, maxHeight: '34vh', overflow: 'auto' }}>
        <button onClick={() => setSelectedId(null)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: 10, borderRadius: 10, background: selectedId === null ? 'color-mix(in srgb,var(--accent) 22%,var(--bg-3))' : 'var(--bg-3)', border: `1px solid ${equipped === null && selectedId === null ? 'var(--accent)' : selectedId === null ? 'color-mix(in srgb,var(--accent) 50%,var(--border))' : 'var(--border)'}`, cursor: 'pointer', color: 'inherit' }}>
          <div className="avatar" style={{ background: player.color, width: 30, height: 30, fontSize: 12 }}>{initials(player.name)}</div>
          <div style={{ fontSize: 11, fontWeight: 700 }}>None</div>
          {equipped === null ? <span className="xp-pill" style={{ fontSize: 9 }}>Equipped</span> : null}
        </button>
        {BADGES.map((b) => {
          const isUnlocked = unlocked.includes(b.id);
          const isEquipped = equipped === b.id;
          const isSelected = selectedId === b.id;
          const count = badgeCounts[b.id] || 0;
          return (
            <button key={b.id} onClick={() => setSelectedId(b.id)} title={`${b.desc}${count > 0 ? ` (earned ${count}×)` : ''}`}
              style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: 10, borderRadius: 10, background: isSelected ? 'color-mix(in srgb,var(--accent) 22%,var(--bg-3))' : 'var(--bg-3)', border: `1px solid ${isEquipped ? 'var(--accent)' : isSelected ? 'color-mix(in srgb,var(--accent) 50%,var(--border))' : 'var(--border)'}`, opacity: isUnlocked ? 1 : 0.5, cursor: 'pointer', color: 'inherit' }}>
              <div style={{ fontSize: 22 }}>{isUnlocked ? b.icon : '🔒'}</div>
              <div style={{ fontSize: 10, fontWeight: 700, textAlign: 'center', lineHeight: 1.1 }}>{b.name}</div>
              {isEquipped ? <span className="xp-pill" style={{ fontSize: 9 }}>Equipped</span> : null}
              {count > 1 ? <span style={{ position: 'absolute', top: 4, right: 4, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 8, background: 'var(--accent)', color: '#04150a', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{count}</span> : null}
            </button>
          );
        })}
      </div>
      {selected ? (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: 'var(--bg-3)', border: '1px solid var(--border)' }}>
          <div className="row" style={{ gap: 10, alignItems: 'center' }}>
            <div style={{ fontSize: 26 }}>{unlocked.includes(selected.id) ? selected.icon : '🔒'}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{selected.name}</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 2, lineHeight: 1.3 }}>{selected.desc}</div>
              <div className="muted small" style={{ marginTop: 4 }}>{unlocked.includes(selected.id) ? `Earned ${badgeCounts[selected.id] || 0}× — equip to show it as your icon.` : 'Locked — earn it in a future game to unlock.'}</div>
            </div>
          </div>
          {selected.context ? (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, padding: '8px 10px', borderRadius: 8, background: 'var(--bg-2)', border: '1px solid var(--border)', cursor: 'pointer' }}>
              <input type="checkbox" checked={showContext} onChange={e => toggleContext(e.target.checked)} style={{ cursor: 'pointer' }} />
              <span style={{ fontSize: 12, fontWeight: 600 }}>Show {selected.contextLabel || 'context'} on icon{previewCtx ? <span className="muted" style={{ fontWeight: 500 }}> — current: {previewCtx.value}</span> : null}</span>
            </label>
          ) : null}
          <button className="btn block primary" style={{ marginTop: 10 }} disabled={!unlocked.includes(selected.id) || equipped === selected.id} onClick={() => equip(selected.id)}>{equipped === selected.id ? 'Equipped' : unlocked.includes(selected.id) ? 'Equip' : 'Locked'}</button>
        </div>
      ) : (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: 'var(--bg-3)', border: '1px solid var(--border)' }}>
          <div className="row" style={{ gap: 10, alignItems: 'center' }}>
            <div className="avatar" style={{ background: player.color, width: 32, height: 32, fontSize: 12 }}>{initials(player.name)}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>No badge</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>Show your initials instead of a badge icon.</div>
            </div>
          </div>
          <button className="btn block primary" style={{ marginTop: 10 }} disabled={equipped === null} onClick={() => equip(null)}>{equipped === null ? 'Equipped' : 'Equip'}</button>
        </div>
      )}
    </>
  );
}
