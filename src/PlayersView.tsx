import { useMemo, useState } from 'react';
import type { Player, PlayerSoundId, Settings, CustomTitle } from './types';
import { COLORS, allTitles, getTitleInfo, conditionLabel, titleProgressInfo, PLAYER_SOUNDS, SHOWDOWN_BGS, type TitleCtx } from './constants';
import { levelFromXP, getPlayerXP, playerStats, allVisitsFor, defaultAttributes, defaultPowerUps, totalAttributePointsForLevel, totalPowerUpPointsForLevel } from './logic';
import { initials, uid } from './store';
import { Modal } from './Popups';
import { BADGES, getBadgeInfo, getBadgeContext, computeLifetimeBadgeCounts } from './badges';
import { POWER_UPS, getPowerUpInfo } from './powerups';
import { Sound } from './sound';

export function PlayersView({ players, games, settings, setPlayers, toast }: {
  players: Player[]; games: any[]; settings: Settings;
  setPlayers: (updater: any) => void; toast: (m: string) => void;
}) {
  const [editing, setEditing] = useState<Player | null>(null);
  const [isNew, setIsNew] = useState(false);

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
        const ctx = xp.showBadgeContext ? getBadgeContext(xp.selectedBadge, p.id, games as any) : null;
        const attrs = p.attributes || defaultAttributes(settings);
        const pwr = p.powerUps || defaultPowerUps(settings);
        const activePu = getPowerUpInfo(pwr.active);
        return (
          <div key={p.id} className="card" style={{ padding: 12 }}>
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
                <div className="muted small" style={{ marginTop: 2 }}>❤️ {attrs.health} HP · 🛡️ {attrs.armor}% armor · ⚡ {attrs.power}% power · {pwr.unlocked.length} power-ups · {pwr.pointsAvailable} PU pts · {attrs.pointsAvailable} attr pts</div>
                <div className="xp-bar" style={{ width: '100%', maxWidth: 240 }}><div style={{ width: `${Math.round(li.xpIntoLevel / li.xpNeeded * 100)}%` }} /></div>
              </div>
            </div>
            <div className="row wrap" style={{ gap: 6, marginTop: 10 }}>
              <button className="btn primary sm" onClick={() => { setEditing(p); setIsNew(false); }}>Edit</button>
              <button className="btn danger sm" onClick={() => { if (confirm(`Delete ${p.name}?`)) { setPlayers((prev: Player[]) => prev.filter(x => x.id !== p.id)); toast('Player deleted'); } }}>Delete</button>
            </div>
          </div>
        );
      })}
      {editing && <EditPlayerModal player={editing} players={players} isNew={isNew} games={games} settings={settings} onClose={() => setEditing(null)} onSave={(p) => {
        if (isNew) setPlayers((prev: Player[]) => [...prev, p]);
        else setPlayers((prev: Player[]) => prev.map(x => x.id === p.id ? p : x));
        setEditing(null); toast(isNew ? 'Player added' : 'Saved');
      }} setPlayers={setPlayers} toast={toast} />}
    </div>
  );
}

function EditPlayerModal({ player, players, isNew, games, settings, onClose, onSave, setPlayers, toast }: { player: Player; players: Player[]; isNew: boolean; games: any[]; settings: Settings; onClose: () => void; onSave: (p: Player) => void; setPlayers: (updater: any) => void; toast: (m: string) => void }) {
  const [tab, setTab] = useState<'basic' | 'titles' | 'badges' | 'sound' | 'attributes' | 'powerups'>('basic');
  const [name, setName] = useState(player.name);
  const [color, setColor] = useState(player.color || COLORS[0]);
  const [sound, setSound] = useState<PlayerSoundId>(player.sound || 'none');
  const [showdownBg, setShowdownBg] = useState<string>(player.showdownBg || 'default');

  const [devMode, setDevMode] = useState<boolean>(!!player.developerMode);
  const livePlayer = isNew ? { ...player, developerMode: devMode } : (players.find(p => p.id === player.id) || player);

  const save = () => {
    if (!name.trim()) return;
    const base: Player = {
      ...player,
      id: player.id || uid(),
      name: name.trim(),
      color,
      sound,
      attributes: livePlayer.attributes,
      powerUps: livePlayer.powerUps,
      developerMode: livePlayer.developerMode,
      showdownBg,
    };
    onSave(base);
  };

  return (
    <Modal onClose={onClose}>
      <h3 style={{ marginBottom: 8 }}>{isNew ? 'Add' : 'Edit'} Player — {name || livePlayer.name}</h3>
      <div className="tabbar" style={{ marginBottom: 14 }}>
        <button className={tab === 'basic' ? 'on' : ''} onClick={() => setTab('basic')}>Basic</button>
        <button className={tab === 'titles' ? 'on' : ''} onClick={() => setTab('titles')}>Titles</button>
        <button className={tab === 'badges' ? 'on' : ''} onClick={() => setTab('badges')}>Badges</button>
        <button className={tab === 'sound' ? 'on' : ''} onClick={() => setTab('sound')}>Sound</button>
        <button className={tab === 'attributes' ? 'on' : ''} onClick={() => setTab('attributes')}>Stats</button>
        <button className={tab === 'powerups' ? 'on' : ''} onClick={() => setTab('powerups')}>Power-Ups</button>
      </div>

      {tab === 'basic' && (
        <>
          <label className="field"><span>Name</span><input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Jonas" maxLength={20} /></label>
          <span style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>Color</span>
          <div className="row wrap" style={{ gap: 10, marginBottom: 18 }}>
            {COLORS.map(c => <button key={c} className={`swatch${c === color ? ' on' : ''}`} style={{ background: c }} onClick={() => setColor(c)} />)}
          </div>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: 12, borderRadius: 10, background: 'var(--bg-3)', border: `1px solid ${livePlayer.developerMode ? 'var(--accent)' : 'var(--border)'}`, cursor: 'pointer', marginBottom: 6 }}>
            <input type="checkbox" checked={!!livePlayer.developerMode} onChange={e => {
              const on = e.target.checked;
              if (isNew) {
                setDevMode(on);
              } else {
                setPlayers((prev: Player[]) => prev.map(p => p.id === player.id ? { ...p, developerMode: on } : p));
              }
              toast(on ? 'Developer mode on — +100 attribute & power-up points' : 'Developer mode off');
            }} style={{ marginTop: 2, cursor: 'pointer' }} />
            <span>
              <span style={{ fontWeight: 700, fontSize: 14, display: 'block' }}>Developer mode</span>
              <span className="muted" style={{ fontSize: 12, lineHeight: 1.3, display: 'block', marginTop: 2 }}>Grants +100 attribute points and +100 power-up points for testing power-ups and battle stats without grinding XP.</span>
            </span>
          </label>
          <span style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 6, marginTop: 14, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>Showdown Background</span>
          <div className="muted small" style={{ marginBottom: 8 }}>Pick a dramatic backdrop shown during the pre-match showdown intro.</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))', gap: 8 }}>
            {SHOWDOWN_BGS.map(bg => (
              <button key={bg.id} onClick={() => setShowdownBg(bg.id)}
                title={bg.label}
                style={{
                  position: 'relative', height: 56, borderRadius: 10, cursor: 'pointer', padding: 0,
                  background: bg.css,
                  border: `2px solid ${showdownBg === bg.id ? 'var(--accent)' : 'var(--border)'}`,
                  boxShadow: showdownBg === bg.id ? '0 0 10px color-mix(in srgb,var(--accent) 60%,transparent)' : 'none',
                  overflow: 'hidden',
                }}>
                <span style={{ position: 'absolute', bottom: 3, left: 0, right: 0, textAlign: 'center', fontSize: 10, fontWeight: 700, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,.8)' }}>{bg.label}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {tab === 'titles' && (
        <TitlesTab player={livePlayer} games={games} settings={settings} setPlayers={setPlayers} toast={toast} />
      )}

      {tab === 'badges' && (
        <BadgesTab player={livePlayer} games={games} setPlayers={setPlayers} toast={toast} />
      )}

      {tab === 'sound' && (
        <>
          <div className="muted small" style={{ marginBottom: 10 }}>Pick an entrance sound — played in showdown card order before a match.</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {PLAYER_SOUNDS.map(s => (
              <button key={s.id} onClick={() => setSound(s.id)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, padding: 10, borderRadius: 10,
                  background: sound === s.id ? 'color-mix(in srgb,var(--accent) 22%,var(--bg-3))' : 'var(--bg-3)',
                  border: `1px solid ${sound === s.id ? 'var(--accent)' : 'var(--border)'}`,
                  cursor: 'pointer', color: 'inherit', textAlign: 'left',
                }}>
                <span style={{ fontWeight: 700 }}>{s.label}</span>
                <span className="muted small">{s.desc}</span>
              </button>
            ))}
          </div>
          <button className="btn ghost sm block" style={{ marginTop: 12 }} onClick={() => Sound.playPlayerSound(sound === 'none' ? 'hero' : sound, { ...settings, sound: true })}>Preview sound</button>
        </>
      )}

      {tab === 'attributes' && (
        <AttributesTab player={livePlayer} settings={settings} setPlayers={setPlayers} toast={toast} />
      )}

      {tab === 'powerups' && (
        <PowerUpsTab player={livePlayer} settings={settings} setPlayers={setPlayers} toast={toast} />
      )}

      <div className="row" style={{ gap: 10, marginTop: 16 }}>
        <button className="btn block ghost" onClick={onClose}>Cancel</button>
        <button className="btn block primary" onClick={save}>Save</button>
      </div>
    </Modal>
  );
}

function TitlesTab({ player, games, settings, setPlayers, toast }: { player: Player; games: any[]; settings: Settings; setPlayers: (updater: any) => void; toast: (m: string) => void }) {
  const xp = getPlayerXP(player);
  const titles = allTitles(settings.customTitles);

  const playerGames = (games as any[]).filter(g => g.players.some((p: any) => p.id === player.id));
  const gamesWon = playerGames.filter(g => g.players.length >= 2 && g.winner === player.id).length;
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

function BadgesTab({ player, games, setPlayers, toast }: { player: Player; games: any[]; setPlayers: (updater: any) => void; toast: (m: string) => void }) {
  const xp = getPlayerXP(player);
  const unlocked = xp.unlockedBadges || [];
  const [equipped, setEquipped] = useState<string | null>(xp.selectedBadge);
  const [selectedId, setSelectedId] = useState<string | null>(xp.selectedBadge);
  const [showContext, setShowContext] = useState<boolean>(xp.showBadgeContext ?? false);
  const selected = BADGES.find(b => b.id === selectedId) || null;
  const badgeCounts = useMemo(() => {
    const stored = xp.badgeCounts || {};
    const fromHistory = computeLifetimeBadgeCounts(player.id, games as any);
    const merged: Record<string, number> = { ...fromHistory };
    for (const [k, v] of Object.entries(stored)) merged[k] = Math.max(merged[k] || 0, v);
    return merged;
  }, [xp.badgeCounts, player.id, games]);
  const totalEarns = Object.values(badgeCounts).reduce((a: number, b: number) => a + b, 0);
  const previewCtx = selected && selected.context ? getBadgeContext(selected.id, player.id, games as any) : null;

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

function AttributesTab({ player, settings, setPlayers, toast }: { player: Player; settings: Settings; setPlayers: (updater: any) => void; toast: (m: string) => void }) {
  const cfg = settings.powerUpScaling;
  const attrs = player.attributes || defaultAttributes(settings);
  const level = player.level ?? 1;
  const totalPoints = totalAttributePointsForLevel(level, settings);
  const spent = Math.round((attrs.health - cfg.attributeStartHealth) / cfg.healthPerPoint)
    + Math.round((attrs.armor - cfg.attributeStartArmor) / cfg.armorPerPoint)
    + Math.round((attrs.power - cfg.attributeStartPower) / cfg.powerPerPoint);
  const available = Math.max(0, totalPoints - spent);
  const armorAtCap = attrs.armor >= cfg.armorMax;
  const powerAtCap = attrs.power >= cfg.powerMax;

  const spend = (kind: 'health' | 'armor' | 'power') => {
    if (available <= 0) { toast('No attribute points available'); return; }
    setPlayers((prev: Player[]) => prev.map(p => {
      if (p.id !== player.id) return p;
      const a = p.attributes || defaultAttributes(settings);
      if (kind === 'health') return { ...p, attributes: { ...a, health: a.health + cfg.healthPerPoint, pointsAvailable: Math.max(0, available - 1) } };
      if (kind === 'armor') {
        if (a.armor >= cfg.armorMax) { toast(`Armor capped at ${cfg.armorMax}%`); return p; }
        return { ...p, attributes: { ...a, armor: Math.min(cfg.armorMax, a.armor + cfg.armorPerPoint), pointsAvailable: Math.max(0, available - 1) } };
      }
      if (a.power >= cfg.powerMax) { toast(`Power capped at ${cfg.powerMax}%`); return p; }
      return { ...p, attributes: { ...a, power: Math.min(cfg.powerMax, a.power + cfg.powerPerPoint), pointsAvailable: Math.max(0, available - 1) } };
    }));
  };

  const reset = () => {
    setPlayers((prev: Player[]) => prev.map(p => p.id === player.id ? { ...p, attributes: { ...defaultAttributes(settings), pointsAvailable: totalPoints } } : p));
    toast('Attributes reset');
  };

  return (
    <>
      <div className="muted small" style={{ marginBottom: 10 }}>Players start with {cfg.attributeStartHealth} HP, {cfg.attributeStartArmor}% armor and {cfg.attributeStartPower}% power. Each level grants {cfg.attributePointsPerLevel} attribute points. Armor caps at {cfg.armorMax}% and power at {cfg.powerMax}%.</div>
      <div className="card" style={{ padding: 12, marginBottom: 10 }}>
        <div className="row between"><b>Level</b><span className="xp-pill">Lvl {level}</span></div>
        <div className="row between" style={{ marginTop: 6 }}><span className="muted small">Total points earned</span><span className="small"><b>{totalPoints}</b></span></div>
        <div className="row between" style={{ marginTop: 4 }}><span className="muted small">Points spent</span><span className="small"><b>{spent}</b></span></div>
        <div className="row between" style={{ marginTop: 4 }}><span className="muted small">Available</span><span className="xp-pill">{available} pts</span></div>
      </div>
      <div className="card" style={{ padding: 12, marginBottom: 10 }}>
        <div className="row between"><b>❤️ Health</b><span style={{ fontWeight: 800, fontSize: 18 }}>{attrs.health} HP</span></div>
        <div className="muted small" style={{ marginTop: 4 }}>Each point adds +{cfg.healthPerPoint} HP.</div>
        <button className="btn primary block" style={{ marginTop: 8 }} disabled={available <= 0} onClick={() => spend('health')}>+ Spend 1 point on Health</button>
      </div>
      <div className="card" style={{ padding: 12, marginBottom: 10 }}>
        <div className="row between"><b>🛡️ Armor</b><span style={{ fontWeight: 800, fontSize: 18 }}>{attrs.armor}%{armorAtCap ? <span className="muted small" style={{ marginLeft: 6 }}>MAX</span> : null}</span></div>
        <div className="muted small" style={{ marginTop: 4 }}>Each point adds +{cfg.armorPerPoint}% armor (max {cfg.armorMax}%). Reduces incoming damage in Battle.</div>
        <button className="btn primary block" style={{ marginTop: 8 }} disabled={available <= 0 || armorAtCap} onClick={() => spend('armor')}>{armorAtCap ? 'Armor at cap' : '+ Spend 1 point on Armor'}</button>
      </div>
      <div className="card" style={{ padding: 12, marginBottom: 10 }}>
        <div className="row between"><b>⚡ Power</b><span style={{ fontWeight: 800, fontSize: 18 }}>{attrs.power}%{powerAtCap ? <span className="muted small" style={{ marginLeft: 6 }}>MAX</span> : null}</span></div>
        <div className="muted small" style={{ marginTop: 4 }}>Each point adds +{cfg.powerPerPoint}% power (max {cfg.powerMax}%). Boosts attack damage in Battle.</div>
        <button className="btn primary block" style={{ marginTop: 8 }} disabled={available <= 0 || powerAtCap} onClick={() => spend('power')}>{powerAtCap ? 'Power at cap' : '+ Spend 1 point on Power'}</button>
      </div>
      <button className="btn ghost sm block" onClick={reset}>Reset attributes</button>
    </>
  );
}

function PowerUpsTab({ player, settings, setPlayers, toast }: { player: Player; settings: Settings; setPlayers: (updater: any) => void; toast: (m: string) => void }) {
  const cfg = settings.powerUpScaling;
  const pwr = player.powerUps || defaultPowerUps(settings);
  const level = player.level ?? 1;
  const totalPoints = totalPowerUpPointsForLevel(level, settings);
  const spent = pwr.unlocked.length;
  const available = Math.max(0, totalPoints - spent);
  const [selectedId, setSelectedId] = useState<string | null>(pwr.active);
  const selected = getPowerUpInfo(selectedId) || null;

  const unlock = (id: string) => {
    if (pwr.unlocked.includes(id)) return;
    if (available <= 0) { toast('No power-up points available'); return; }
    setPlayers((prev: Player[]) => prev.map(p => p.id === player.id ? { ...p, powerUps: { ...pwr, unlocked: [...pwr.unlocked, id] } } : p));
    toast('Power-up unlocked');
  };

  const equip = (id: string | null) => {
    setPlayers((prev: Player[]) => prev.map(p => p.id === player.id ? { ...p, powerUps: { ...pwr, active: id } } : p));
    setSelectedId(id);
    toast(id ? 'Power-up equipped' : 'Power-up unequipped');
  };

  return (
    <>
      <div className="muted small" style={{ marginBottom: 10 }}>Unlock power-ups with points (you earn {cfg.pointsPerLevel} per level, starting with {cfg.startingPoints}). Equip one — only a single power-up can be active at a time.</div>
      <div className="card" style={{ padding: 12, marginBottom: 10 }}>
        <div className="row between"><b>Level</b><span className="xp-pill">Lvl {level}</span></div>
        <div className="row between" style={{ marginTop: 6 }}><span className="muted small">Total points earned</span><span className="small"><b>{totalPoints}</b></span></div>
        <div className="row between" style={{ marginTop: 4 }}><span className="muted small">Unlocked</span><span className="small"><b>{spent}</b> / {POWER_UPS.length}</span></div>
        <div className="row between" style={{ marginTop: 4 }}><span className="muted small">Available</span><span className="xp-pill">{available} pts</span></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8, maxHeight: '34vh', overflow: 'auto' }}>
        {POWER_UPS.map((pu) => {
          const isUnlocked = pwr.unlocked.includes(pu.id);
          const isActive = pwr.active === pu.id;
          const isSelected = selectedId === pu.id;
          return (
            <button key={pu.id} onClick={() => setSelectedId(pu.id)} title={pu.desc}
              style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: 10, borderRadius: 10, background: isSelected ? 'color-mix(in srgb,var(--accent) 22%,var(--bg-3))' : 'var(--bg-3)', border: `1px solid ${isActive ? 'var(--accent)' : isSelected ? 'color-mix(in srgb,var(--accent) 50%,var(--border))' : 'var(--border)'}`, opacity: isUnlocked ? 1 : 0.55, cursor: 'pointer', color: 'inherit', textAlign: 'center' }}>
              <div style={{ fontSize: 24 }}>{isUnlocked ? pu.icon : '🔒'}</div>
              <div style={{ fontSize: 11, fontWeight: 700, lineHeight: 1.1 }}>{pu.name}</div>
              {isActive ? <span className="xp-pill" style={{ fontSize: 9 }}>Active</span> : null}
            </button>
          );
        })}
      </div>
      {selected ? (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: 'var(--bg-3)', border: '1px solid var(--border)' }}>
          <div className="row" style={{ gap: 10, alignItems: 'center' }}>
            <div style={{ fontSize: 26 }}>{pwr.unlocked.includes(selected.id) ? selected.icon : '🔒'}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{selected.name}</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 2, lineHeight: 1.3 }}>{selected.desc}</div>
            </div>
          </div>
          <div className="row" style={{ gap: 8, marginTop: 10 }}>
            {!pwr.unlocked.includes(selected.id) ? (
              <button className="btn block primary" disabled={available <= 0} onClick={() => unlock(selected.id)}>{available > 0 ? `Unlock (1 pt)` : 'No points'}</button>
            ) : pwr.active === selected.id ? (
              <button className="btn block ghost" onClick={() => equip(null)}>Unequip</button>
            ) : (
              <button className="btn block primary" onClick={() => equip(selected.id)}>Equip</button>
            )}
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: 'var(--bg-3)', border: '1px solid var(--border)' }}>
          <div className="muted small">Select a power-up to see its description and unlock/equip it.</div>
        </div>
      )}
    </>
  );
}

export { conditionLabel };
export type { CustomTitle };
