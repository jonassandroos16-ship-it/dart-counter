import { useState } from 'react';
import type { Player, PlayerSoundId, Settings, CustomTitle } from './types';
import { COLORS, allTitles, getTitleInfo, conditionLabel, PLAYER_SOUNDS, SHOWDOWN_BGS } from './constants';
import { levelFromXP, getPlayerXP, playerStats, defaultAttributes, defaultPowerUps } from './logic';
import { initials, uid } from './store';
import { Modal } from './Popups';
import { BADGES, getBadgeInfo, getBadgeContext, buildCoopBadgeCtx } from './badges';
import { POWER_UPS, getPowerUpInfo } from './powerups';
import { COOP_POWER_UPS, passivesForClass, defaultCoopProgress } from './campaign/engine';
import { Sound } from './sound';
import { TitlesTab } from './players/TitlesTab';
import { BadgesTab } from './players/BadgesTab';
import { AttributesTab } from './players/AttributesTab';
import { PowerUpsTab } from './players/PowerUpsTab';
import { ClassTab } from './players/ClassTab';

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
                <div className="muted small" style={{ marginTop: 2 }}>❤️ {Number.isFinite(attrs.health) ? attrs.health : 0} HP · 🛡️ {Number.isFinite(attrs.armor) ? attrs.armor : 0}% armor · ⚡ {Number.isFinite(attrs.power) ? attrs.power : 0} power · {pwr.unlocked.length} power-ups · {pwr.pointsAvailable} PU pts · {attrs.pointsAvailable} attr pts</div>
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
      <div className="tabbar-scroll" style={{ marginBottom: 14 }}>
        <button className={tab === 'basic' ? 'on' : ''} onClick={() => setTab('basic')}><span className="tab-ico">👤</span>Basic</button>
        <button className={tab === 'titles' ? 'on' : ''} onClick={() => setTab('titles')}><span className="tab-ico">🏅</span>Titles</button>
        <button className={tab === 'badges' ? 'on' : ''} onClick={() => setTab('badges')}><span className="tab-ico">🎖️</span>Badges</button>
        <button className={tab === 'sound' ? 'on' : ''} onClick={() => setTab('sound')}><span className="tab-ico">🔊</span>Sound</button>
        <button className={tab === 'attributes' ? 'on' : ''} onClick={() => setTab('attributes')}><span className="tab-ico">📊</span>Stats</button>
        <button className={tab === 'powerups' ? 'on' : ''} onClick={() => setTab('powerups')}><span className="tab-ico">⚡</span>Power-Ups</button>
        <button className={tab === 'class' ? 'on' : ''} onClick={() => setTab('class')}><span className="tab-ico">🛡️</span>Class</button>
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

export { conditionLabel };
export type { CustomTitle };
