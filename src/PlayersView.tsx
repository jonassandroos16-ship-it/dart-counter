import { useMemo, useState } from 'react';
import type { Player, PlayerSoundId, Settings, CustomTitle } from './types';
import { COLORS, allTitles, getTitleInfo, conditionLabel, titleProgressInfo, PLAYER_SOUNDS, SHOWDOWN_BGS, type TitleCtx } from './constants';
import { levelFromXP, getPlayerXP, playerStats, allVisitsFor, defaultAttributes, defaultPowerUps, totalAttributePointsForLevel, totalPowerUpPointsForLevel } from './logic';
import { initials, uid } from './store';
import { Modal } from './Popups';
import { BADGES, getBadgeInfo, getBadgeContext, computeLifetimeBadgeCounts, buildCoopBadgeCtx } from './badges';
import { POWER_UPS, getPowerUpInfo } from './powerups';
import { COOP_POWER_UPS, getCoopPowerUp, unlockedCoopPowerUps, COOP_CLASSES, getCoopClass, getCoopPassive, passivesForClass, unlockedPassivesForPlayer, selectClassForPlayer, equipPassiveForPlayer, defaultCoopProgress } from './campaign/engine';
import { CAMPAIGN_CHAPTERS } from './campaign/campaignLevels';
import { useCampaignProgress } from './campaign/progress';
import type { CoopPowerUpId, CoopPowerUpDef, CoopClassId, CoopPassiveId, PlayerCoopProgress } from './campaign/types';
import { Sound } from './sound';

// Resolve a player's effective level from XP (the source of truth) rather than
// the cached `player.level` field, which can be stale on older saves/imports.
function effectiveLevel(player: Player, settings: Settings): number {
  return levelFromXP(player.xp ?? 0, settings).level;
}

function spentOn(current: number, start: number, perPoint: number): number {
  if (!Number.isFinite(current) || !Number.isFinite(start)) return 0;
  if (!Number.isFinite(perPoint) || perPoint <= 0) return 0;
  const diff = current - start;
  if (diff <= 0) return 0;
  return Math.round(diff / perPoint);
}

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
        <button className="btn primary sm" onClick={() => {
          const newPlayer: Player = {
            id: uid(),
            name: '',
            color: COLORS[players.length % COLORS.length],
            xp: 0,
            unlockedTitles: [],
            selectedTitle: null,
            unlockedBadges: [],
            badgeCounts: {},
            selectedBadge: null,
            attributes: defaultAttributes(settings),
            powerUps: defaultPowerUps(settings),
          };
          setPlayers((prev: Player[]) => [...prev, newPlayer]);
          setEditing(newPlayer);
          setIsNew(true);
        }}>+ Add Player</button>
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
        const ctx = xp.showBadgeContext ? getBadgeContext(xp.selectedBadge, p.id, games as any, buildCoopBadgeCtx()) : null;
        const attrs = p.attributes || defaultAttributes(settings);
        const pwr = p.powerUps || defaultPowerUps(settings);
        const activePu = getPowerUpInfo(pwr.active);
        return (
          <div key={p.id} className="card player-card" style={{ padding: 12, borderLeft: `5px solid ${p.color}`, background: `linear-gradient(135deg, color-mix(in srgb, ${p.color} 10%, var(--bg-2)) 0%, var(--bg-2) 60%)` }}>
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
                <div className="muted small" style={{ marginTop: 2 }}>❤️ {Number.isFinite(attrs.health) ? attrs.health : 0} HP · 🛡️ {Number.isFinite(attrs.armor) ? attrs.armor : 0} armor · ⚡ {Number.isFinite(attrs.power) ? attrs.power : 0} power · {pwr.unlocked.length} power-ups · {pwr.pointsAvailable} PU pts · {attrs.pointsAvailable} attr pts</div>
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
      {editing && <EditPlayerModal player={editing} players={players} isNew={isNew} games={games} settings={settings} onClose={(saved) => {
        // `saved` is true when the user clicked Save in the modal — in that
        // case the player is already committed with a name and must NOT be
        // discarded. Without this flag, the stale `editing.name` snapshot
        // (still '') would delete the player we just saved.
        if (isNew && !saved) setPlayers((prev: Player[]) => prev.filter(p => p.id !== editing.id));
        setEditing(null);
      }} setPlayers={setPlayers} toast={toast} />}
    </div>
  );
}

function EditPlayerModal({ player, players, isNew, games, settings, onClose, setPlayers, toast }: { player: Player; players: Player[]; isNew: boolean; games: any[]; settings: Settings; onClose: (saved: boolean) => void; setPlayers: (updater: any) => void; toast: (m: string) => void }) {
  const [tab, setTab] = useState<'basic' | 'titles' | 'badges' | 'sound' | 'attributes' | 'powerups' | 'class'>('basic');
  const [name, setName] = useState(player.name);
  const [color, setColor] = useState(player.color || COLORS[0]);
  const [sound, setSound] = useState<PlayerSoundId>(player.sound || 'none');
  const [showdownBg, setShowdownBg] = useState<string>(player.showdownBg || 'default');

  const [devMode, setDevMode] = useState<boolean>(!!player.developerMode);
  const livePlayer = isNew ? { ...player, developerMode: devMode } : (players.find(p => p.id === player.id) || player);

  // For existing players, basic fields (name/color/sound/showdownBg) auto-save
  // on change. For new players these stay in local state until the Save button
  // is pressed, since the player is only committed once the user confirms.
  const patchPlayer = (patch: Partial<Player>) => {
    setPlayers((prev: Player[]) => prev.map(p => p.id === player.id ? { ...p, ...patch } : p));
  };

  const onNameChange = (value: string) => {
    setName(value);
    if (!isNew) patchPlayer({ name: value.trim() });
  };
  const onColorChange = (c: string) => {
    setColor(c);
    if (!isNew) patchPlayer({ color: c });
  };
  const onSoundChange = (s: PlayerSoundId) => {
    setSound(s);
    if (!isNew) patchPlayer({ sound: s });
  };
  const onShowdownBgChange = (bg: string) => {
    setShowdownBg(bg);
    if (!isNew) patchPlayer({ showdownBg: bg });
  };

  const saveNew = () => {
    if (!name.trim()) { toast('Enter a name first'); return; }
    patchPlayer({ name: name.trim(), color, sound, showdownBg });
    toast('Player added');
    onClose(true);
  };

  return (
    <Modal onClose={() => onClose(false)}>
      <h3 style={{ marginBottom: 8 }}>{isNew ? 'Add' : 'Edit'} Player — {name || livePlayer.name}</h3>
      <div className="tabbar" style={{ marginBottom: 14 }}>
        <button className={tab === 'basic' ? 'on' : ''} onClick={() => setTab('basic')}>Basic</button>
        <button className={tab === 'titles' ? 'on' : ''} onClick={() => setTab('titles')}>Titles</button>
        <button className={tab === 'badges' ? 'on' : ''} onClick={() => setTab('badges')}>Badges</button>
        <button className={tab === 'sound' ? 'on' : ''} onClick={() => setTab('sound')}>Sound</button>
        <button className={tab === 'attributes' ? 'on' : ''} onClick={() => setTab('attributes')}>Stats</button>
        <button className={tab === 'powerups' ? 'on' : ''} onClick={() => setTab('powerups')}>Power-Ups</button>
        <button className={tab === 'class' ? 'on' : ''} onClick={() => setTab('class')}>Class</button>
      </div>

      {tab === 'basic' && (
        <>
          <label className="field"><span>Name</span><input value={name} onChange={e => onNameChange(e.target.value)} placeholder="e.g. Jonas" maxLength={20} /></label>
          <span style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>Color</span>
          <div className="row wrap" style={{ gap: 10, marginBottom: 18 }}>
            {COLORS.map(c => <button key={c} className={`swatch${c === color ? ' on' : ''}`} style={{ background: c }} onClick={() => onColorChange(c)} />)}
          </div>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: 12, borderRadius: 10, background: 'var(--bg-3)', border: `1px solid ${livePlayer.developerMode ? 'var(--accent)' : 'var(--border)'}`, cursor: 'pointer', marginBottom: 6 }}>
            <input type="checkbox" checked={!!livePlayer.developerMode} onChange={e => {
              const on = e.target.checked;
              if (isNew) {
                setDevMode(on);
              } else {
                setPlayers((prev: Player[]) => prev.map(p => {
                  if (p.id !== player.id) return p;
                  if (!on) return { ...p, developerMode: false };
                  const allTitleIds = allTitles(settings.customTitles).map(t => t.id);
                  const allBadgeIds = BADGES.map(b => b.id);
                  const allPuIds = POWER_UPS.map(pu => pu.id);
                  const existingBadgeCounts = { ...(p.badgeCounts || {}) };
                  for (const bid of allBadgeIds) {
                    if (!existingBadgeCounts[bid]) existingBadgeCounts[bid] = 1;
                  }
                  return {
                    ...p,
                    developerMode: true,
                    unlockedTitles: Array.from(new Set([...(p.unlockedTitles || []), ...allTitleIds])),
                    unlockedBadges: Array.from(new Set([...(p.unlockedBadges || []), ...allBadgeIds])),
                    badgeCounts: existingBadgeCounts,
                    powerUps: {
                      unlocked: Array.from(new Set([...((p.powerUps?.unlocked || [])), ...allPuIds])),
                      active: p.powerUps?.active ?? null,
                      pointsAvailable: (p.powerUps?.pointsAvailable ?? 0) + 100,
                      coopUnlocked: COOP_POWER_UPS.map(pu => pu.id),
                      coopActive: p.powerUps?.coopActive ?? null,
                    },
                    attributes: {
                      ...(p.attributes || defaultAttributes(settings)),
                      pointsAvailable: (p.attributes?.pointsAvailable ?? 0) + 100,
                    },
                    // Grant max Coop XP and unlock all passives for the
                    // player's currently selected class (or default to
                    // warrior so the dev sees something immediately).
                    coopProgress: (() => {
                      const cur = p.coopProgress || defaultCoopProgress();
                      const classId = cur.classId || 'warrior';
                      const allPassives = passivesForClass(classId).map(pp => pp.id);
                      return {
                        classId,
                        xp: 9999,
                        unlockedPassives: allPassives,
                        equippedPassives: cur.equippedPassives?.length ? cur.equippedPassives : [allPassives[allPassives.length - 1]],
                      };
                    })(),
                  };
                }));
              }
              toast(on ? 'Developer mode on — everything unlocked' : 'Developer mode off');
            }} style={{ marginTop: 2, cursor: 'pointer' }} />
            <span>
              <span style={{ fontWeight: 700, fontSize: 14, display: 'block' }}>Developer mode</span>
              <span className="muted" style={{ fontSize: 12, lineHeight: 1.3, display: 'block', marginTop: 2 }}>Unlocks every title, badge and power-up, and grants +100 attribute & power-up points for testing without grinding XP.</span>
            </span>
          </label>
          <span style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 6, marginTop: 14, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>Showdown Background</span>
          <div className="muted small" style={{ marginBottom: 8 }}>Pick a dramatic backdrop shown during the pre-match showdown intro.</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))', gap: 8 }}>
            {SHOWDOWN_BGS.map(bg => (
              <button key={bg.id} onClick={() => onShowdownBgChange(bg.id)}
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
              <button key={s.id} onClick={() => onSoundChange(s.id)}
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

      {tab === 'class' && (
        <ClassTab player={livePlayer} setPlayers={setPlayers} toast={toast} />
      )}

      <div className="row" style={{ gap: 10, marginTop: 16 }}>
        <button className="btn block ghost" onClick={() => onClose(false)}>Cancel</button>
        {isNew && <button className="btn block primary" onClick={saveNew}>Save</button>}
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
  const previewCtx = selected && selected.context ? getBadgeContext(selected.id, player.id, games as any, buildCoopBadgeCtx()) : null;

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
  const level = effectiveLevel(player, settings);
  const totalPoints = totalAttributePointsForLevel(level, settings) + (player.developerMode ? 100 : 0);
  const healthMax = Number.isFinite(cfg.healthMax) ? cfg.healthMax : Number.MAX_SAFE_INTEGER;
  const armorMax = Number.isFinite(cfg.armorMax) ? cfg.armorMax : Number.MAX_SAFE_INTEGER;
  const powerMax = Number.isFinite(cfg.powerMax) ? cfg.powerMax : Number.MAX_SAFE_INTEGER;
  const safeHealth = Number.isFinite(attrs.health) ? attrs.health : cfg.attributeStartHealth;
  const safeArmor = Number.isFinite(attrs.armor) ? attrs.armor : cfg.attributeStartArmor;
  const safePower = Number.isFinite(attrs.power) ? attrs.power : cfg.attributeStartPower;
  const spent = spentOn(safeHealth, cfg.attributeStartHealth, cfg.healthPerPoint)
    + spentOn(safeArmor, cfg.attributeStartArmor, cfg.armorPerPoint)
    + spentOn(safePower, cfg.attributeStartPower, cfg.powerPerPoint);
  const available = Math.max(0, totalPoints - spent);
  const armorAtCap = safeArmor >= armorMax;
  const powerAtCap = safePower >= powerMax;
  const healthAtCap = safeHealth >= healthMax;

  const spend = (kind: 'health' | 'armor' | 'power') => {
    if (!Number.isFinite(available) || available <= 0) { toast('No attribute points available'); return; }
    setPlayers((prev: Player[]) => prev.map(p => {
      if (p.id !== player.id) return p;
      const a = p.attributes || defaultAttributes(settings);
      const curHealth = Number.isFinite(a.health) ? a.health : cfg.attributeStartHealth;
      const curArmor = Number.isFinite(a.armor) ? a.armor : cfg.attributeStartArmor;
      const curPower = Number.isFinite(a.power) ? a.power : cfg.attributeStartPower;
      if (kind === 'health') {
        if (curHealth >= healthMax) { toast(`Health capped at ${healthMax}`); return p; }
        const step = Number.isFinite(cfg.healthPerPoint) && cfg.healthPerPoint > 0 ? cfg.healthPerPoint : 1;
        return { ...p, attributes: { ...a, health: Math.min(healthMax, curHealth + step), pointsAvailable: Math.max(0, available - 1) } };
      }
      if (kind === 'armor') {
        if (curArmor >= armorMax) { toast(`Armor capped at ${armorMax}`); return p; }
        const step = Number.isFinite(cfg.armorPerPoint) && cfg.armorPerPoint > 0 ? cfg.armorPerPoint : 1;
        return { ...p, attributes: { ...a, armor: Math.min(armorMax, curArmor + step), pointsAvailable: Math.max(0, available - 1) } };
      }
      if (curPower >= powerMax) { toast(`Power capped at ${powerMax}`); return p; }
      const step = Number.isFinite(cfg.powerPerPoint) && cfg.powerPerPoint > 0 ? cfg.powerPerPoint : 1;
      return { ...p, attributes: { ...a, power: Math.min(powerMax, curPower + step), pointsAvailable: Math.max(0, available - 1) } };
    }));
  };

  const reset = () => {
    setPlayers((prev: Player[]) => prev.map(p => p.id === player.id ? { ...p, attributes: { ...defaultAttributes(settings), pointsAvailable: totalPoints } } : p));
    toast('Attributes reset');
  };

  return (
    <>
      <div className="muted small" style={{ marginBottom: 10 }}>Players start with {cfg.attributeStartHealth} HP, {cfg.attributeStartArmor} armor and {cfg.attributeStartPower} power. Each level grants {cfg.attributePointsPerLevel} attribute points. Health caps at {cfg.healthMax}, armor at {cfg.armorMax} (flat per dart) and power at {cfg.powerMax} (flat per dart).</div>
      <div className="card" style={{ padding: 12, marginBottom: 10 }}>
        <div className="row between"><b>Level</b><span className="xp-pill">Lvl {level}</span></div>
        <div className="row between" style={{ marginTop: 6 }}><span className="muted small">Total points earned</span><span className="small"><b>{totalPoints}</b></span></div>
        <div className="row between" style={{ marginTop: 4 }}><span className="muted small">Points spent</span><span className="small"><b>{spent}</b></span></div>
        <div className="row between" style={{ marginTop: 4 }}><span className="muted small">Available</span><span className="xp-pill">{available} pts</span></div>
      </div>
      <div className="card" style={{ padding: 12, marginBottom: 10 }}>
        <div className="row between"><b>❤️ Health</b><span style={{ fontWeight: 800, fontSize: 18 }}>{safeHealth} HP{healthAtCap ? <span className="muted small" style={{ marginLeft: 6 }}>MAX</span> : null}</span></div>
        <div className="muted small" style={{ marginTop: 4 }}>Each point adds +{cfg.healthPerPoint} HP (max {cfg.healthMax}). Your total damage pool in Battle.</div>
        <button className="btn primary block" style={{ marginTop: 8 }} disabled={!Number.isFinite(available) || available <= 0 || healthAtCap} onClick={() => spend('health')}>{healthAtCap ? 'Health at cap' : '+ Spend 1 point on Health'}</button>
      </div>
      <div className="card" style={{ padding: 12, marginBottom: 10 }}>
        <div className="row between"><b>🛡️ Armor</b><span style={{ fontWeight: 800, fontSize: 18 }}>{safeArmor}{armorAtCap ? <span className="muted small" style={{ marginLeft: 6 }}>MAX</span> : null}</span></div>
        <div className="muted small" style={{ marginTop: 4 }}>Each point adds +{cfg.armorPerPoint} armor (max {cfg.armorMax}). Flat damage reduction applied to EVERY dart in Battle.</div>
        <button className="btn primary block" style={{ marginTop: 8 }} disabled={!Number.isFinite(available) || available <= 0 || armorAtCap} onClick={() => spend('armor')}>{armorAtCap ? 'Armor at cap' : '+ Spend 1 point on Armor'}</button>
      </div>
      <div className="card" style={{ padding: 12, marginBottom: 10 }}>
        <div className="row between"><b>⚡ Power</b><span style={{ fontWeight: 800, fontSize: 18 }}>{safePower}{powerAtCap ? <span className="muted small" style={{ marginLeft: 6 }}>MAX</span> : null}</span></div>
        <div className="muted small" style={{ marginTop: 4 }}>Each point adds +{cfg.powerPerPoint} power (max {cfg.powerMax}). Flat damage bonus added to EVERY dart that hits in Battle.</div>
        <button className="btn primary block" style={{ marginTop: 8 }} disabled={!Number.isFinite(available) || available <= 0 || powerAtCap} onClick={() => spend('power')}>{powerAtCap ? 'Power at cap' : '+ Spend 1 point on Power'}</button>
      </div>
      <button className="btn ghost sm block" onClick={reset}>Reset attributes</button>
    </>
  );
}

function PowerUpsTab({ player, settings, setPlayers, toast }: { player: Player; settings: Settings; setPlayers: (updater: any) => void; toast: (m: string) => void }) {
  const cfg = settings.powerUpScaling;
  const pwr = player.powerUps || defaultPowerUps(settings);
  const level = effectiveLevel(player, settings);
  const totalPoints = totalPowerUpPointsForLevel(level, settings);
  const spent = pwr.unlocked.length;
  const available = Math.max(0, totalPoints - spent);
  const [selectedId, setSelectedId] = useState<string | null>(pwr.active);
  const selected = getPowerUpInfo(selectedId) || null;

  // Coop power-ups: starter tier is always available; advanced tier unlocks as
  // campaign level rewards. We pull the player's campaign progress to compute
  // which advanced entries they can equip.
  const { progress } = useCampaignProgress();
  const unlockedCoopIds = unlockedCoopPowerUps(progress);
  const [selectedCoopId, setSelectedCoopId] = useState<string | null>(pwr.coopActive ?? null);
  const selectedCoop = selectedCoopId ? getCoopPowerUp(selectedCoopId as CoopPowerUpId) : null;

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

  const equipCoop = (id: string | null) => {
    setPlayers((prev: Player[]) => prev.map(p => p.id === player.id ? { ...p, powerUps: { ...pwr, coopActive: id } } : p));
    setSelectedCoopId(id);
    toast(id ? 'Coop power-up equipped' : 'Coop power-up unequipped');
  };

  // Map each advanced coop power-up id to the campaign level that unlocks it,
  // so locked entries can show "Unlocks at Lvl X" / a BOSS badge.
  const advancedUnlockLevel: Record<string, { levelId: number; levelName: string; isBoss: boolean } | null> = {};
  for (const lvl of getLevelNames()) {
    const reward = lvl.reward_power_up;
    if (reward) advancedUnlockLevel[reward] = { levelId: lvl.level_id, levelName: lvl.name, isBoss: lvl.is_boss };
  }

  const starterCoop = COOP_POWER_UPS.filter(p => p.tier === 'starter');
  const advancedCoop = COOP_POWER_UPS.filter(p => p.tier === 'advanced');

  const renderCoopTile = (pu: CoopPowerUpDef) => {
    const isUnlocked = unlockedCoopIds.includes(pu.id);
    const isActive = pwr.coopActive === pu.id;
    const isSelected = selectedCoopId === pu.id;
    const unlockInfo = advancedUnlockLevel[pu.id] || null;
    return (
      <button key={pu.id} onClick={() => setSelectedCoopId(pu.id)} title={pu.desc}
        style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: 10, borderRadius: 10, background: isSelected ? 'color-mix(in srgb,#fca5a5 22%,var(--bg-3))' : 'var(--bg-3)', border: `1px solid ${isActive ? '#ef4444' : isSelected ? 'color-mix(in srgb,#ef4444 50%,var(--border))' : 'var(--border)'}`, opacity: isUnlocked ? 1 : 0.55, cursor: 'pointer', color: 'inherit', textAlign: 'center' }}>
        <div style={{ fontSize: 24 }}>{isUnlocked ? pu.icon : '🔒'}</div>
        <div style={{ fontSize: 11, fontWeight: 700, lineHeight: 1.1 }}>{pu.name}</div>
        {isActive ? <span className="xp-pill" style={{ fontSize: 9, background: '#ef4444', color: '#fff' }}>Active</span>
          : !isUnlocked && unlockInfo ? (
            <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 999, background: unlockInfo.isBoss ? '#ef4444' : 'color-mix(in srgb,#fbbf24 22%,var(--bg-3))', color: unlockInfo.isBoss ? '#fff' : '#fbbf24' }}>
              {unlockInfo.isBoss ? 'BOSS' : `Lvl ${unlockInfo.levelId}`}
            </span>
          ) : null}
      </button>
    );
  };

  return (
    <>
      <div className="muted small" style={{ marginBottom: 10 }}>Competitive power-ups are used in normal game modes. Unlock them with points (you earn {cfg.pointsPerLevel} per level, starting with {cfg.startingPoints}). Equip one per type — only a single power-up can be active at a time.</div>
      <div className="card" style={{ padding: 12, marginBottom: 10 }}>
        <div className="row between"><b>Level</b><span className="xp-pill">Lvl {level}</span></div>
        <div className="row between" style={{ marginTop: 6 }}><span className="muted small">Total points earned</span><span className="small"><b>{totalPoints}</b></span></div>
        <div className="row between" style={{ marginTop: 4 }}><span className="muted small">Unlocked</span><span className="small"><b>{spent}</b> / {POWER_UPS.length}</span></div>
        <div className="row between" style={{ marginTop: 4 }}><span className="muted small">Available</span><span className="xp-pill">{available} pts</span></div>
      </div>

      <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6, marginTop: 4 }}>Competitive Power-Ups</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8, maxHeight: '26vh', overflow: 'auto' }}>
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

      <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6, marginTop: 18 }}>Coop Power-Ups <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>(used in Co-op Campaign)</span></div>
      <div className="muted small" style={{ marginBottom: 8 }}>Starter power-ups are always available. Advanced power-ups unlock as rewards for clearing Coop campaign levels — equip one to use it during Coop battles.</div>

      <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>Starter</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8, marginBottom: 10 }}>
        {starterCoop.map(renderCoopTile)}
      </div>

      <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>Advanced <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>(campaign rewards)</span></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8, maxHeight: '24vh', overflow: 'auto' }}>
        {advancedCoop.map(renderCoopTile)}
      </div>
      {selectedCoop ? (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: 'var(--bg-3)', border: '1px solid var(--border)' }}>
          <div className="row" style={{ gap: 10, alignItems: 'center' }}>
            <div style={{ fontSize: 26 }}>{selectedCoop.icon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{selectedCoop.name}</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 2, lineHeight: 1.3 }}>{selectedCoop.desc}</div>
            </div>
          </div>
          <div className="row" style={{ gap: 8, marginTop: 10 }}>
            {pwr.coopActive === selectedCoop.id ? (
              <button className="btn block ghost" onClick={() => equipCoop(null)}>Unequip</button>
            ) : (
              <button className="btn block primary" onClick={() => equipCoop(selectedCoop.id)}>Equip</button>
            )}
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: 'var(--bg-3)', border: '1px solid var(--border)' }}>
          <div className="muted small">Select a Coop power-up to see its description and equip it.</div>
        </div>
      )}
    </>
  );
}

// Tiny helper that returns the campaign levels with their reward power-up
// metadata, used by PowerUpsTab to label locked advanced coop tiles. Now
// chapter-aware: returns levels across all chapters.
function getLevelNames(): { level_id: number; name: string; is_boss: boolean; reward_power_up?: string }[] {
  return CAMPAIGN_CHAPTERS.flatMap(ch => ch.levels);
}

// ── Class & Passives tab ──────────────────────────────────────────────
//
// Lets the player pick one of three Coop classes (Warrior, Priest, Rogue)
// and equip/unlock passives for that class. Passives grant team-wide stat
// bonuses during Coop battles. Higher-tier passives unlock with Coop XP,
// earned by playing Coop battles.
function ClassTab({ player, setPlayers, toast }: { player: Player; setPlayers: (updater: any) => void; toast: (m: string) => void }) {
  const prog: PlayerCoopProgress = player.coopProgress || defaultCoopProgress();
  const selectedClass = getCoopClass(prog.classId);
  const classPassives = selectedClass ? passivesForClass(selectedClass.id) : [];
  const unlockedIds = unlockedPassivesForPlayer(prog);

  const pickClass = (classId: CoopClassId) => {
    setPlayers((prev: Player[]) => prev.map(p => {
      if (p.id !== player.id) return p;
      const cur = p.coopProgress || defaultCoopProgress();
      const next = selectClassForPlayer(cur, classId);
      return { ...p, coopProgress: next };
    }));
    const cls = getCoopClass(classId);
    toast(`${cls?.name || classId} class selected — starter passive equipped`);
  };

  const equip = (passiveId: CoopPassiveId) => {
    setPlayers((prev: Player[]) => prev.map(p => {
      if (p.id !== player.id) return p;
      const cur = p.coopProgress || defaultCoopProgress();
      const next = equipPassiveForPlayer(cur, passiveId);
      return { ...p, coopProgress: next };
    }));
    const def = getCoopPassive(passiveId);
    toast(`${def?.name || passiveId} equipped`);
  };

  return (
    <>
      <div className="muted small" style={{ marginBottom: 10 }}>
        Pick a Coop class to grant your party a team-wide passive bonus during Coop battles. Each class has three tiers of passives with three options per tier — one starter passive is auto-equipped, and you can swap to any unlocked passive anytime.
      </div>

      {/* Class selection */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8, marginBottom: 14 }}>
        {COOP_CLASSES.map(c => {
          const isSelected = prog.classId === c.id;
          return (
            <button key={c.id} onClick={() => pickClass(c.id)} title={c.desc}
              style={{
                position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: 12, borderRadius: 10,
                background: isSelected ? 'color-mix(in srgb,var(--accent) 22%,var(--bg-3))' : 'var(--bg-3)',
                border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                boxShadow: isSelected ? '0 0 10px color-mix(in srgb,var(--accent) 40%,transparent)' : 'none',
                cursor: 'pointer', color: 'inherit', textAlign: 'center',
              }}>
              <div style={{ fontSize: 28 }}>{c.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 800 }}>{c.name}</div>
              {isSelected ? <span className="xp-pill" style={{ fontSize: 10 }}>Selected</span> : null}
            </button>
          );
        })}
      </div>

      {selectedClass ? (
        <>
          <div className="card" style={{ padding: 12, marginBottom: 12 }}>
            <div className="row" style={{ gap: 10, alignItems: 'center' }}>
              <div style={{ fontSize: 26 }}>{selectedClass.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{selectedClass.name}</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 2, lineHeight: 1.3 }}>{selectedClass.desc}</div>
              </div>
            </div>
            <div className="row between" style={{ marginTop: 10 }}>
              <span className="muted small">Coop XP</span>
              <span className="xp-pill">{prog.xp || 0} XP</span>
            </div>
            <div className="xp-bar" style={{ width: '100%', marginTop: 6 }}>
              <div style={{ width: `${Math.min(100, Math.round(((prog.xp || 0) % 150) / 150 * 100))}%` }} />
            </div>
            <div className="muted small" style={{ marginTop: 4 }}>Earn Coop XP by playing Coop battles — wins give more than losses.</div>
          </div>

          {/* Passives for the selected class — 3 tiers, 3 passives per tier. */}
          <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>Passives</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {classPassives.map(p => {
              const isUnlocked = unlockedIds.includes(p.id);
              const isEquipped = (prog.equippedPassives || []).includes(p.id);
              const xpPct = p.xpRequired > 0 ? Math.min(100, Math.round(((prog.xp || 0) / p.xpRequired) * 100)) : 100;
              return (
                <div key={p.id} style={{
                  position: 'relative',
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: 14, borderRadius: 12, background: 'var(--bg-3)',
                  border: `1px solid ${isEquipped ? 'var(--accent)' : isUnlocked ? 'var(--border)' : 'var(--border)'}`,
                  opacity: isUnlocked ? 1 : 0.7, overflow: 'hidden', minHeight: 64,
                }}>
                  {isUnlocked ? null : (
                    <div style={{ position: 'absolute', inset: 0, width: `${xpPct}%`, background: 'color-mix(in srgb,var(--accent) 18%,var(--bg-3))', transition: 'width .4s ease', pointerEvents: 'none', zIndex: 0 }} />
                  )}
                  <div style={{ position: 'relative', zIndex: 1, fontSize: 26, width: 34, textAlign: 'center' }}>{isUnlocked ? p.icon : '🔒'}</div>
                  <div style={{ position: 'relative', zIndex: 1, flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.2 }}>
                      {p.name}
                      <span className="pill" style={{ fontSize: 10, marginLeft: 6 }}>TIER {p.tier}</span>
                    </div>
                    <div className="muted" style={{ fontSize: 11, marginTop: 2, lineHeight: 1.3 }}>{p.desc}</div>
                    {!isUnlocked && (
                      <div className="muted" style={{ fontSize: 11, marginTop: 4, fontWeight: 600 }}>
                        {prog.xp || 0} / {p.xpRequired} Coop XP to unlock
                      </div>
                    )}
                  </div>
                  <div style={{ position: 'relative', zIndex: 1 }}>
                    {isEquipped ? <span className="xp-pill" style={{ fontSize: 11 }}>Equipped</span>
                      : isUnlocked ? <button className="btn sm ghost" style={{ fontSize: 12, padding: '6px 10px' }} onClick={() => equip(p.id)}>Equip</button>
                        : <span className="muted" style={{ fontSize: 11 }}>Locked</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div style={{ padding: 18, borderRadius: 12, background: 'var(--bg-3)', border: '1px solid var(--border)', textAlign: 'center' }}>
          <div style={{ fontSize: 28, marginBottom: 6 }}>🛡️</div>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>No class selected</div>
          <div className="muted" style={{ fontSize: 12, lineHeight: 1.4 }}>Pick a class above to start earning Coop XP and unlocking passives. Your equipped passive grants a team-wide stat bonus to the whole party during Coop battles.</div>
        </div>
      )}
    </>
  );
}

export { conditionLabel };
export type { CustomTitle };
