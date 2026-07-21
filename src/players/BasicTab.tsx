import type { Player, Settings, PlayerSoundId } from '../types';
import { COLORS, allTitles, SHOWDOWN_BGS, PLAYER_SOUNDS } from '../constants';
import { defaultAttributes } from '../logic';
import { BADGES } from '../badges';
import { POWER_UPS } from '../powerups';
import { COOP_POWER_UPS, passivesForClass, defaultCoopProgress } from '../campaign/engine';
import { Sound } from '../sound';

export type SetPlayers = (updater: (prev: Player[]) => Player[]) => void;
export type Toast = (m: string) => void;

export function BasicTab({ player, isNew, name, color, showdownBg, livePlayer, settings, setPlayers, toast, setName, setColor, setShowdownBg, setDevMode }: {
  player: Player;
  isNew: boolean;
  name: string;
  color: string;
  showdownBg: string;
  livePlayer: Player;
  settings: Settings;
  setPlayers: SetPlayers;
  toast: Toast;
  setName: (v: string) => void;
  setColor: (c: string) => void;
  setShowdownBg: (bg: string) => void;
  setDevMode: (on: boolean) => void;
}) {
  return (
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
            setPlayers((prev: Player[]) => prev.map(p => {
              if (p.id !== player.id) return p;
              if (!on) return { ...p, developerMode: false };
              return applyDevMode(p, settings);
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
  );
}

export function applyDevMode(p: Player, settings: Settings): Player {
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
        unlockedPassives: allPassives,
        equippedPassives: cur.equippedPassives?.length ? cur.equippedPassives : [allPassives[allPassives.length - 1]],
      };
    })(),
  };
}

export function SoundTab({ sound, settings, onSoundChange }: {
  sound: PlayerSoundId;
  settings: Settings;
  onSoundChange: (s: PlayerSoundId) => void;
}) {
  return (
    <>
      <div className="muted small" style={{ marginBottom: 10 }}>Pick an entrance sound — played in showdown card order before a match.</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {PLAYER_SOUNDS.map((s: { id: PlayerSoundId; label: string; desc: string }) => (
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
  );
}
