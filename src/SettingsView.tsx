import { useEffect, useRef, useState } from 'react';
import type { Player, GameRecord, Settings, CustomTitle, XPConfig, PowerUpScalingConfig } from './types';
import { COLORS, conditionLabel } from './constants';
import { tracksFor, MusicEngine } from './music';
import { uid, todayKey, mergeBackup, type BackupShape, type SyncResult } from './store';
import { Modal } from './Popups';
import { CampaignEditor } from './campaign/CampaignEditor';

export function SettingsView({ players, games, settings, setSettings, setPlayers, setGames, toast, hasDatabase, connected, upToDate, lastSync, syncing, onSync }: { players: Player[]; games: GameRecord[]; settings: Settings; setSettings: (updater: any) => void; setPlayers: (updater: any) => void; setGames: (updater: any) => void; toast: (m: string) => void; hasDatabase: boolean; connected: boolean; upToDate: boolean; lastSync: number | null; syncing: boolean; onSync: () => Promise<SyncResult> }) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const cfg = settings.xpConfig;
  const [xpForm, setXpForm] = useState<XPConfig>(cfg);
  const [puForm, setPuForm] = useState<PowerUpScalingConfig>(settings.powerUpScaling);
  const mergeInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<MusicEngine | null>(null);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

  if (!previewRef.current) previewRef.current = new MusicEngine();

  useEffect(() => () => { previewRef.current?.stop(); }, []);

  const update = (patch: Partial<Settings>) => setSettings((prev: Settings) => ({ ...prev, ...patch }));

  const stopPreview = () => {
    previewRef.current?.stop();
    setPreviewing(null);
  };

  const togglePreview = (trackId: string) => {
    if (previewing === trackId) { stopPreview(); return; }
    previewRef.current?.stop();
    const track = tracksFor('match').find(t => t.id === trackId);
    if (track) {
      previewRef.current?.preview(trackId, settings);
      setPreviewing(trackId);
    }
  };

  const lastSyncLabel = (() => {
    if (!lastSync) return '';
    const diff = Date.now() - lastSync;
    if (diff < 60_000) return 'just now';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    return `${Math.floor(diff / 3_600_000)}h ago`;
  })();

  const exportBackup = () => {
    const data: BackupShape = { players, games, settings, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `dart-counter-backup-${todayKey()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Backup downloaded');
  };

  const importBackup = async (file: File) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text) as BackupShape;
      const merged = mergeBackup({ players, games, settings }, data);
      setPlayers(merged.players);
      setGames(merged.games);
      setSettings(merged.settings);
      toast('Backup imported');
    } catch { toast('Invalid backup file'); }
  };

  const xpFields: { key: keyof XPConfig; label: string; min?: number; step?: number }[] = [
    { key: 'win', label: 'XP per win', min: 0 },
    { key: 'visit60', label: 'XP per 60+ visit', min: 0 },
    { key: 'visit80', label: 'XP per 80+ visit', min: 0 },
    { key: 'visit100', label: 'XP per 100+ visit', min: 0 },
    { key: 'visit120', label: 'XP per 120+ visit', min: 0 },
    { key: 'visit140', label: 'XP per 140+ visit', min: 0 },
    { key: 'visit180', label: 'XP per 180 visit', min: 0 },
    { key: 'checkout', label: 'XP per checkout', min: 0 },
    { key: 'perDart', label: 'XP per dart thrown', min: 0 },
    { key: 'baseLevelXp', label: 'Base level XP', min: 1 },
    { key: 'levelMult', label: 'Level multiplier', min: 1, step: 0.1 },
  ];

  const puFields: { key: keyof PowerUpScalingConfig; label: string; min?: number; max?: number; step?: number }[] = [
    { key: 'chargePerDouble', label: 'Charge per double (%)', min: 0, step: 0.5 },
    { key: 'chargePerTriple', label: 'Charge per triple (%)', min: 0, step: 0.5 },
    { key: 'chargePerBull', label: 'Charge per bull (%)', min: 0, step: 0.5 },
    { key: 'chargePerScorePoint', label: 'Charge per score point', min: 0, step: 0.01 },
    { key: 'chargeMax', label: 'Max charge', min: 10, step: 5 },
    { key: 'pointsPerLevel', label: 'Power-up points per level', min: 0 },
    { key: 'startingPoints', label: 'Starting power-up points', min: 0 },
    { key: 'attributePointsPerLevel', label: 'Attribute points per level', min: 0 },
    { key: 'healthPerPoint', label: 'Health per point', min: 1 },
    { key: 'armorPerPoint', label: 'Armor per point', min: 0 },
    { key: 'powerPerPoint', label: 'Power per point', min: 0 },
    { key: 'armorMax', label: 'Armor cap (%)', min: 0 },
    { key: 'powerMax', label: 'Power cap', min: 0 },
    { key: 'healthMax', label: 'Health cap', min: 1 },
    { key: 'battleMinDamage', label: 'Battle min damage', min: 0 },
  ];

  return (
    <div className="view-scroll">
      <div className="card">
        <h2 style={{ marginBottom: 12 }}>Settings</h2>

        <div className="muted small" style={{ marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>Sound</div>
        <label className="row" style={{ marginBottom: 8 }}>
          <input type="checkbox" checked={settings.sound} onChange={e => update({ sound: e.target.checked })} />
          <span>Sound effects</span>
        </label>
        {settings.sound && (
          <>
            <label className="field" style={{ marginBottom: 8 }}>
              <span>SFX volume · {Math.round((settings.sfxVolume ?? 0.9) * 100)}%</span>
              <input type="range" min={0} max={1} step={0.05} value={settings.sfxVolume ?? 0.9} onChange={e => update({ sfxVolume: +e.target.value })} />
            </label>
            <label className="field" style={{ marginBottom: 8 }}>
              <span>Hit sound pack · played on dart damage</span>
              <select value={settings.hitSoundPack ?? 'thud'} onChange={e => update({ hitSoundPack: e.target.value as Settings['hitSoundPack'] })}>
                <option value="thud">Thud (default)</option>
                <option value="board">Board</option>
                <option value="punch">Punch</option>
                <option value="arcade">Arcade</option>
              </select>
            </label>
            <label className="field" style={{ marginBottom: 8 }}>
              <span>Button click sound · UI feedback</span>
              <select value={settings.clickSound ?? 'none'} onChange={e => update({ clickSound: e.target.value as Settings['clickSound'] })}>
                <option value="none">None</option>
                <option value="tick">Tick</option>
                <option value="pop">Pop</option>
                <option value="tap">Tap</option>
              </select>
            </label>
            {settings.clickSound && settings.clickSound !== 'none' && (
              <label className="field" style={{ marginBottom: 8 }}>
                <span>Click volume · {Math.round((settings.clickVolume ?? 0.6) * 100)}%</span>
                <input type="range" min={0} max={1} step={0.05} value={settings.clickVolume ?? 0.6} onChange={e => update({ clickVolume: +e.target.value })} />
              </label>
            )}
          </>
        )}
        <label className="row" style={{ marginBottom: 8 }}>
          <input type="checkbox" checked={settings.music} onChange={e => update({ music: e.target.checked })} />
          <span>Music</span>
        </label>
        {settings.music && (
          <>
            <label className="field" style={{ marginBottom: 8 }}>
              <span>Music volume · {Math.round((settings.musicVolume ?? 0.9) * 100)}%</span>
              <input type="range" min={0} max={1} step={0.05} value={settings.musicVolume ?? 0.9} onChange={e => { update({ musicVolume: +e.target.value }); if (previewing) previewRef.current?.preview(previewing, { ...settings, music: true, musicVolume: +e.target.value }); }} />
            </label>
            <div style={{ marginTop: 10, marginBottom: 4, fontSize: 13, fontWeight: 600 }}>Music tracks</div>
            <TrackRow label="Start screen" value={settings.musicStartTrack} onChange={v => update({ musicStartTrack: v })} context="start" previewing={previewing} onTogglePreview={togglePreview} onStopPreview={stopPreview} />
            <TrackRow label="Setup" value={settings.musicSetupTrack} onChange={v => update({ musicSetupTrack: v })} context="setup" previewing={previewing} onTogglePreview={togglePreview} onStopPreview={stopPreview} />
            <TrackRow label="Match" value={settings.musicMatchTrack} onChange={v => update({ musicMatchTrack: v })} context="match" previewing={previewing} onTogglePreview={togglePreview} onStopPreview={stopPreview} />
            <TrackRow label="Co-op" value={settings.musicCoopTrack} onChange={v => update({ musicCoopTrack: v })} context="coop" previewing={previewing} onTogglePreview={togglePreview} onStopPreview={stopPreview} />
          </>
        )}

        <div className="muted small" style={{ marginTop: 14, marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>Appearance</div>
        <label className="field" style={{ marginBottom: 10 }}>
          <span>Theme</span>
          <select value={settings.theme} onChange={e => update({ theme: e.target.value as Settings['theme'] })}>
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </label>
        <label className="field" style={{ marginBottom: 10 }}>
          <span>Accent color</span>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            {COLORS.map(c => (
              <button key={c} onClick={() => update({ accent: c })} style={{ width: 28, height: 28, borderRadius: '50%', border: settings.accent === c ? '2px solid var(--text)' : '2px solid transparent', background: c, cursor: 'pointer' }} aria-label={c} />
            ))}
          </div>
        </label>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 10 }}>Cloud Sync</h3>
        {!hasDatabase && <div className="muted small" style={{ marginBottom: 10 }}>Not configured — using local storage only.</div>}
        {hasDatabase && !connected && <div className="muted small" style={{ marginBottom: 10, color: 'var(--error)' }}>Not connected — check your database settings.</div>}
        <button className="btn block primary" onClick={async () => { const r = await onSync(); setSyncResult(r); toast(r.message); }} disabled={syncing || !hasDatabase} style={{ marginBottom: 8 }}>
          {syncing ? 'Syncing…' : 'Sync now'}
        </button>
        {syncResult && !syncing && (
          <div className="small" style={{ marginBottom: 8, padding: '8px 10px', borderRadius: 8, background: syncResult.ok ? 'var(--success-bg, #1a3a2a)' : 'var(--error-bg, #3a1a1a)', border: `1px solid ${syncResult.ok ? 'var(--success, #2a7a4a)' : 'var(--error, #aa3333)'}`, color: 'var(--text)' }}>
            <strong>{syncResult.ok ? 'Synced' : 'Sync failed'}</strong> — {syncResult.message}
          </div>
        )}
        {(upToDate && hasDatabase && connected) && <div className="muted small center">Up to date{lastSyncLabel ? ` · ${lastSyncLabel}` : ''}</div>}
        {hasDatabase && !connected && !syncResult && <div className="muted small" style={{ marginTop: 6 }}>The last sync attempt could not reach the database. Your changes are saved locally and will sync when the connection is restored.</div>}
        {hasDatabase && connected && !upToDate && !syncing && <div className="muted small" style={{ marginTop: 6 }}>You have unsaved changes. Press "Sync now" to push them to the cloud.</div>}
        <div style={{ marginTop: 12, padding: 10, borderRadius: 8, background: 'var(--bg-3)', border: '1px solid var(--border)', fontSize: 11, lineHeight: 1.5, wordBreak: 'break-all' }}>
          <div className="muted small" style={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>Connection</div>
          <div className="muted small">URL: <code style={{ color: 'var(--text)' }}>{import.meta.env.VITE_SUPABASE_URL || 'not configured'}</code></div>
          <div className="muted small">Key: <code style={{ color: 'var(--text)' }}>{import.meta.env.VITE_SUPABASE_ANON_KEY ? `${import.meta.env.VITE_SUPABASE_ANON_KEY.slice(0, 12)}…${import.meta.env.VITE_SUPABASE_ANON_KEY.slice(-6)}` : 'not configured'}</code></div>
          <div className="muted small">Client: <code style={{ color: 'var(--text)' }}>{hasDatabase ? 'active' : 'null (local-only mode)'}</code></div>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 10 }}>Backup</h3>
        <div className="row" style={{ gap: 8, marginBottom: 10 }}>
          <button className="btn block ghost" onClick={exportBackup}>Export</button>
          <button className="btn block ghost" onClick={() => mergeInputRef.current?.click()}>Import</button>
          <input ref={mergeInputRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) importBackup(f); e.target.value = ''; }} />
        </div>
        <div className="muted small">Export saves players, games, and settings to a JSON file. Import merges it into your current data.</div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 10 }}>XP & Leveling</h3>
        {xpFields.map(f => (
          <label key={f.key} className="field" style={{ marginBottom: 10 }}>
            <span>{f.label}</span>
            <input type="number" value={xpForm[f.key]} min={f.min ?? 0} step={f.step} onChange={e => setXpForm({ ...xpForm, [f.key]: f.key === 'levelMult' ? Math.max(1, +e.target.value || 1) : (f.min ? Math.max(f.min, +e.target.value || f.min) : +e.target.value || 0) })} />
          </label>
        ))}
        <div className="row" style={{ gap: 8 }}>
          <button className="btn block primary" onClick={() => { update({ xpConfig: xpForm }); toast('XP settings saved'); }}>Save</button>
          <button className="btn block ghost" onClick={() => setXpForm(cfg)}>Reset</button>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 10 }}>Power-Up Scaling</h3>
        {puFields.map(f => (
          <label key={f.key} className="field" style={{ marginBottom: 10 }}>
            <span>{f.label}</span>
            <input type="number" value={puForm[f.key] as number} min={f.min ?? 0} max={f.max} step={f.step} onChange={e => setPuForm({ ...puForm, [f.key]: +e.target.value || 0 })} />
          </label>
        ))}
        <div className="muted small" style={{ marginBottom: 10 }}>Adjusts power-up charge rates and attribute scaling.</div>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn block primary" onClick={() => { update({ powerUpScaling: puForm }); toast('Power-up scaling saved'); }}>Save</button>
          <button className="btn block ghost" onClick={() => setPuForm(settings.powerUpScaling)}>Reset</button>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 10 }}>Custom Titles</h3>
        <div className="muted small" style={{ marginBottom: 10 }}>Awarded automatically based on in-game achievements.</div>
        {settings.customTitles.length === 0 && <div className="muted small">No custom titles yet.</div>}
        {settings.customTitles.map(t => (
          <div key={t.id} className="row" style={{ marginBottom: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 20, marginRight: 8 }}>{t.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>{t.name}</div>
              <div className="muted small">{conditionLabel(t)}</div>
            </div>
            <button className="btn danger sm" onClick={() => update({ customTitles: settings.customTitles.filter(x => x.id !== t.id) })}>✕</button>
          </div>
        ))}
        <button className="btn block ghost" style={{ marginTop: 10 }} onClick={() => setEditingTitle(true)}>+ Add custom title</button>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 10 }}>Campaign Editor</h3>
        <div className="muted small" style={{ marginBottom: 10 }}>Create and edit custom co-op campaigns.</div>
        <button className="btn block primary" onClick={() => setShowEditor(true)}>Open Campaign Editor</button>
      </div>

      {showEditor && <CampaignEditor onBack={() => setShowEditor(false)} />}

      {editingTitle && <EditCustomTitleModal onClose={() => setEditingTitle(false)} onSave={(t) => { update({ customTitles: [...settings.customTitles, t] }); setEditingTitle(false); toast('Custom title added'); }} />}

      <div className="muted small center" style={{ padding: '12px 0' }}>v{import.meta.env.VITE_COMMIT_SHA ? import.meta.env.VITE_COMMIT_SHA.slice(0, 7) : 'dev'}</div>
    </div>
  );
}

function EditCustomTitleModal({ onClose, onSave }: { onClose: () => void; onSave: (t: CustomTitle) => void }) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [icon, setIcon] = useState('🏅');
  const [condType, setCondType] = useState<'combo' | 'sequence' | 'sum'>('combo');
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
            <select value={mult} onChange={e => setMult(+e.target.value)}><option value="1">Single</option><option value="2">Double</option><option value="3">Triple</option></select>
          </label>
          <label className="field"><span>Times needed (in one game)</span><input type="number" value={count} min={1} max={50} onChange={e => setCount(+e.target.value || 1)} /></label>
        </div>
      ) : condType === 'sequence' ? (
        <div>
          <div className="muted small" style={{ marginBottom: 8 }}>Awarded when a visit contains all these darts (any order):</div>
          {seqDarts.map((d, i) => (
            <div key={i} className="row" style={{ gap: 6, marginBottom: 6 }}>
              <select style={{ flex: 1 }} value={d.base} onChange={e => { const n = [...seqDarts]; n[i] = { ...n[i], base: +e.target.value }; setSeqDarts(n); }}>{numOptions.map(n => <option key={n} value={n}>{n === 50 ? 'Bull' : n === 25 ? '25' : n}</option>)}</select>
              <select style={{ flex: 1 }} value={d.mult} onChange={e => { const n = [...seqDarts]; n[i] = { ...n[i], mult: +e.target.value }; setSeqDarts(n); }}><option value="1">Single</option><option value="2">Double</option><option value="3">Triple</option></select>
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

function TrackRow({ label, value, onChange, context, previewing, onTogglePreview, onStopPreview }: { label: string; value: string; onChange: (v: string) => void; context: 'start' | 'setup' | 'match' | 'coop'; previewing: string | null; onTogglePreview: (id: string) => void; onStopPreview: () => void }) {
  const tracks = tracksFor(context);
  return (
    <div style={{ marginBottom: 14 }}>
      <div className="muted small" style={{ marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
      <div className="row" style={{ gap: 8 }}>
        <select value={value} onChange={e => { onStopPreview(); onChange(e.target.value); }} style={{ flex: 1 }}>{tracks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
        <button className="btn" style={{ width: 86 }} onClick={() => onTogglePreview(value)}>{previewing === value ? 'Stop' : 'Listen'}</button>
      </div>
    </div>
  );
}
