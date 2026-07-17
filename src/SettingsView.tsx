import { useState } from 'react';
import type { Player, Settings, CustomTitle } from './types';
import { COLORS, conditionLabel } from './constants';
import { tracksFor } from './music';
import { uid, todayKey } from './store';
import { Modal } from './Popups';

export function SettingsView({ players, games, settings, setSettings, toast }: { players: Player[]; games: any[]; settings: Settings; setSettings: (updater: any) => void; toast: (m: string) => void }) {
  const [editingTitle, setEditingTitle] = useState(false);
  const cfg = settings.xpConfig;
  const [xpForm, setXpForm] = useState(cfg);

  const update = (patch: Partial<Settings>) => setSettings((prev: Settings) => ({ ...prev, ...patch }));

  return (
    <div className="view-scroll">
      <h2 style={{ marginBottom: 12 }}>Settings</h2>
      <div className="card">
        <div className="row between" style={{ marginBottom: 16 }}><b>Theme</b>
          <div className="tabbar" style={{ width: 'auto', margin: 0 }}>
            <button className={settings.theme === 'dark' ? 'on' : ''} onClick={() => update({ theme: 'dark' })}>Dark</button>
            <button className={settings.theme === 'light' ? 'on' : ''} onClick={() => update({ theme: 'light' })}>Light</button>
          </div>
        </div>
        <div style={{ marginBottom: 16 }}><b>Accent color</b>
          <div className="row wrap" style={{ gap: 10, marginTop: 10 }}>
            {COLORS.map(c => <button key={c} className={`swatch${c === settings.accent ? ' on' : ''}`} style={{ background: c }} onClick={() => update({ accent: c })} />)}
          </div>
        </div>
        <label className="row between" style={{ marginBottom: 14 }}><b>Sound effects</b><input type="checkbox" checked={settings.sound} onChange={e => update({ sound: e.target.checked })} style={{ width: 'auto' }} /></label>
        <label className="row between" style={{ marginBottom: 14 }}><b>Background music</b><input type="checkbox" checked={settings.music} onChange={e => update({ music: e.target.checked })} style={{ width: 'auto' }} /></label>
        {settings.music && (
          <>
            <div style={{ marginBottom: 14 }}>
              <div className="muted small" style={{ marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>Setup screen track</div>
              <select value={settings.musicSetupTrack} onChange={e => update({ musicSetupTrack: e.target.value })}>{tracksFor('setup').map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
            </div>
            <div style={{ marginBottom: 14 }}>
              <div className="muted small" style={{ marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>Match track</div>
              <select value={settings.musicMatchTrack} onChange={e => update({ musicMatchTrack: e.target.value })}>{tracksFor('match').map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
            </div>
          </>
        )}
        <label className="row between"><b>Confirm before quitting/reset</b><input type="checkbox" checked={settings.confirmReset} onChange={e => update({ confirmReset: e.target.checked })} style={{ width: 'auto' }} /></label>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 12 }}>Popup Notifications</h3>
        <label className="row between" style={{ marginBottom: 10 }}><b>Score popups (60, 80, 100+)</b><input type="checkbox" checked={settings.popups.scores} onChange={e => update({ popups: { ...settings.popups, scores: e.target.checked } })} style={{ width: 'auto' }} /></label>
        <label className="row between" style={{ marginBottom: 10 }}><b>Milestone popups (200, 150, 100)</b><input type="checkbox" checked={settings.popups.milestones} onChange={e => update({ popups: { ...settings.popups, milestones: e.target.checked } })} style={{ width: 'auto' }} /></label>
        <label className="row between" style={{ marginBottom: 10 }}><b>XP gain popups</b><input type="checkbox" checked={settings.popups.xp} onChange={e => update({ popups: { ...settings.popups, xp: e.target.checked } })} style={{ width: 'auto' }} /></label>
        <label className="row between"><b>Title unlock popups</b><input type="checkbox" checked={settings.popups.titles} onChange={e => update({ popups: { ...settings.popups, titles: e.target.checked } })} style={{ width: 'auto' }} /></label>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 4 }}>XP & Levels</h3>
        <div className="muted small" style={{ marginBottom: 12 }}>Configure how much XP actions give and how leveling works</div>
        <div className="grid grid-2">
          {([['Win game', 'win'], ['Checkout', 'checkout'], ['Visit 60+', 'visit60'], ['Visit 80+', 'visit80'], ['Visit 100+', 'visit100'], ['Visit 120+', 'visit120'], ['Visit 140+', 'visit140'], ['Visit 180', 'visit180'], ['Per dart thrown', 'perDart'], ['Base XP for level 1', 'baseLevelXp'], ['Level XP multiplier', 'levelMult']] as [string, keyof typeof xpForm][]).map(([label, key]) => (
            <label key={key} className="field"><span>{label}</span>
              <input type="number" value={xpForm[key] as number} min={key === 'levelMult' ? 1 : 0} step={key === 'levelMult' ? 0.1 : 1} onChange={e => setXpForm({ ...xpForm, [key]: +e.target.value || 0 })} />
            </label>
          ))}
        </div>
        <button className="btn primary block" style={{ marginTop: 10 }} onClick={() => { update({ xpConfig: xpForm }); toast('XP settings saved'); }}>Save XP Settings</button>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 4 }}>Custom Titles</h3>
        <div className="muted small" style={{ marginBottom: 12 }}>Create titles tied to specific dart combinations</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
          {!settings.customTitles.length && <div className="muted small">No custom titles yet.</div>}
          {settings.customTitles.map((t, i) => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 10, borderRadius: 12, background: 'var(--bg-3)' }}>
              <div style={{ fontSize: 20 }}>{t.icon || '🏅'}</div>
              <div style={{ flex: 1 }}><b>{t.name}</b><div className="muted small">{t.desc || ''}</div>
                <div className="muted small" style={{ marginTop: 2 }}>Condition: {conditionLabel(t)}</div></div>
              <button className="btn danger sm" onClick={() => update({ customTitles: settings.customTitles.filter((_, j) => j !== i) })}>Del</button>
            </div>
          ))}
        </div>
        <button className="btn primary block sm" onClick={() => setEditingTitle(true)}>+ Add Custom Title</button>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 12 }}>Backup & Data</h3>
        <button className="btn block primary" style={{ marginBottom: 8 }} onClick={() => {
          const blob = new Blob([JSON.stringify({ players, games, settings, exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' });
          const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `dartcounter-backup-${todayKey()}.json`; a.click(); URL.revokeObjectURL(a.href); toast('Backup exported');
        }}>Export backup (.json)</button>
        <button className="btn block danger" onClick={() => {
          if (confirm('Erase ALL players, games and settings? This cannot be undone.')) {
            localStorage.removeItem('dc_players'); localStorage.removeItem('dc_games'); localStorage.removeItem('dc_settings');
            window.location.reload();
          }
        }}>Erase all data</button>
        <div className="muted small center" style={{ marginTop: 12 }}>{players.length} players · {games.length} games stored locally</div>
      </div>

      {editingTitle && <EditCustomTitleModal onClose={() => setEditingTitle(false)} onSave={(t) => { update({ customTitles: [...settings.customTitles, t] }); setEditingTitle(false); toast('Custom title created'); }} />}
    </div>
  );
}

function EditCustomTitleModal({ onClose, onSave }: { onClose: () => void; onSave: (t: CustomTitle) => void }) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [icon, setIcon] = useState('');
  const [condType, setCondType] = useState<'combo' | 'sum' | 'sequence'>('combo');
  const [base, setBase] = useState(20);
  const [mult, setMult] = useState(3);
  const [count, setCount] = useState(3);
  const [sumValue, setSumValue] = useState(26);
  const [seqDarts, setSeqDarts] = useState<{ base: number; mult: number }[]>([
    { base: 1, mult: 1 },
    { base: 20, mult: 1 },
    { base: 6, mult: 1 },
  ]);

  const numOptions = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,25,50];

  return (
    <Modal onClose={onClose}>
      <h3 style={{ marginBottom: 14 }}>New Custom Title</h3>
      <label className="field"><span>Title name</span><input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Triple 19 Sniper" maxLength={30} /></label>
      <label className="field"><span>Description</span><input value={desc} onChange={e => setDesc(e.target.value)} placeholder="e.g. Hit T19 five times in one game" maxLength={60} /></label>
      <label className="field"><span>Icon (emoji)</span><input value={icon} onChange={e => setIcon(e.target.value)} placeholder="🎯" maxLength={4} /></label>
      <div className="muted small" style={{ marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>Unlock Condition</div>
      <div className="tabbar" style={{ marginBottom: 14 }}>
        <button className={condType === 'combo' ? 'on' : ''} onClick={() => setCondType('combo')}>Dart combo</button>
        <button className={condType === 'sequence' ? 'on' : ''} onClick={() => setCondType('sequence')}>Dart sequence</button>
        <button className={condType === 'sum' ? 'on' : ''} onClick={() => setCondType('sum')}>Turn total</button>
      </div>
      {condType === 'combo' ? (
        <div className="grid grid-2">
          <label className="field"><span>Target number</span>
            <select value={base} onChange={e => setBase(+e.target.value)}>{numOptions.map(n => <option key={n} value={n}>{n === 50 ? 'Bull' : n === 25 ? '25' : n}</option>)}</select>
          </label>
          <label className="field"><span>Multiplier</span>
            <select value={mult} onChange={e => setMult(+e.target.value)}><option value={1}>Single</option><option value={2}>Double</option><option value={3}>Triple</option></select>
          </label>
          <label className="field"><span>Times needed (in one game)</span><input type="number" value={count} min={1} max={50} onChange={e => setCount(+e.target.value || 1)} /></label>
        </div>
      ) : condType === 'sequence' ? (
        <div>
          <div className="muted small" style={{ marginBottom: 8 }}>Awarded when a visit contains all these darts (any order):</div>
          {seqDarts.map((d, i) => (
            <div key={i} className="row" style={{ gap: 6, marginBottom: 6 }}>
              <select style={{ flex: 1 }} value={d.base} onChange={e => { const n = [...seqDarts]; n[i] = { ...n[i], base: +e.target.value }; setSeqDarts(n); }}>{numOptions.map(n => <option key={n} value={n}>{n === 50 ? 'Bull' : n === 25 ? '25' : n}</option>)}</select>
              <select style={{ flex: 1 }} value={d.mult} onChange={e => { const n = [...seqDarts]; n[i] = { ...n[i], mult: +e.target.value }; setSeqDarts(n); }}><option value={1}>Single</option><option value={2}>Double</option><option value={3}>Triple</option></select>
              <button className="btn danger sm" onClick={() => setSeqDarts(seqDarts.length > 1 ? seqDarts.filter((_, j) => j !== i) : seqDarts)} disabled={seqDarts.length <= 1}>✕</button>
            </div>
          ))}
          <button className="btn ghost sm" style={{ marginTop: 4 }} onClick={() => setSeqDarts([...seqDarts, { base: 20, mult: 1 }])}>+ Add dart</button>
        </div>
      ) : (
        <label className="field"><span>Awarded when a turn (3 darts) totals</span><input type="number" value={sumValue} min={0} max={180} onChange={e => setSumValue(+e.target.value)} /></label>
      )}
      <div className="row" style={{ gap: 10, marginTop: 14 }}>
        <button className="btn block ghost" onClick={onClose}>Cancel</button>
        <button className="btn block primary" onClick={() => {
          if (!name.trim()) return;
          const condition = condType === 'sum' ? { type: 'sum' as const, value: sumValue }
            : condType === 'sequence' ? { type: 'sequence' as const, darts: seqDarts }
            : { type: 'combo' as const, base, mult, count };
          onSave({ id: 'custom_' + uid(), name: name.trim(), desc: desc.trim() || undefined, icon: icon.trim() || '🏅', condition, custom: true });
        }}>Save Title</button>
      </div>
    </Modal>
  );
}
