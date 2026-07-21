import { useEffect, useRef, useState } from 'react';
import { Target, Layers } from 'lucide-react';
import type { Player, GameRecord, Settings, CustomTitle } from './types';
import { COLORS, conditionLabel } from './constants';
import { tracksFor, MusicEngine } from './music';
import { uid, todayKey, mergeBackup, type BackupShape, type SyncResult } from './store';
import { Modal } from './Popups';
import { POWER_UPS } from './powerups';
import { COOP_POWER_UPS } from './campaign/engine';
import { CampaignEditor } from './campaign/CampaignEditor';

export function SettingsView({ players, games, settings, setSettings, setPlayers, setGames, toast, hasDatabase, connected, upToDate, lastSync, syncing, onSync }: { players: Player[]; games: GameRecord[]; settings: Settings; setSettings: (updater: any) => void; setPlayers: (updater: any) => void; setGames: (updater: any) => void; toast: (m: string) => void; hasDatabase: boolean; connected: boolean; upToDate: boolean; lastSync: number | null; syncing: boolean; onSync: () => Promise<SyncResult> }) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const cfg = settings.xpConfig;
  const [xpForm, setXpForm] = useState(cfg);
  const [puForm, setPuForm] = useState(settings.powerUpScaling);
  const mergeInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<MusicEngine | null>(null);
  const [previewing, setPreviewing] = useState<string | null>(null);

  if (!previewRef.current) previewRef.current = new MusicEngine();

  useEffect(() => () => { previewRef.current?.stop(); }, []);

  const update = (patch: Partial<Settings>) => setSettings((prev: Settings) => ({ ...prev, ...patch }));

  const stopPreview = () => {
    previewRef.current?.stop();
    setPreviewing(null);
  };

  const togglePreview = (trackId: string) => {
    if (previewing === trackId) {
      stopPreview();
      return;
    }
    previewRef.current?.preview(trackId, { ...settings, music: true });
    setPreviewing(trackId);
  };

  const statusLabel = !hasDatabase ? 'Local storage only'
    : syncing ? 'Syncing…'
    : !connected ? 'Offline · local storage'
    : upToDate ? 'Cloud sync up to date'
    : 'Local changes pending sync';
  const dotClass = !hasDatabase || !connected ? 'sync-dot offline' : upToDate ? 'sync-dot online' : 'sync-dot pending';

  const handleSync = async () => {
    const res = await onSync();
    toast(res.message);
  };

  const lastSyncLabel = lastSync ? `Last sync ${new Date(lastSync).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : '';

  if (showEditor) return <CampaignEditor onBack={() => setShowEditor(false)} />;

  return (
    <div className="view-scroll">
      <h2 style={{ marginBottom: 12 }}>Settings</h2>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="muted small" style={{ marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>Game Mode</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <button onClick={() => { update({ gameMode: 'dartboard' }); toast('Dart Board mode selected'); }}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: 16, borderRadius: 12,
              background: settings.gameMode === 'dartboard' ? 'color-mix(in srgb,var(--accent) 22%,var(--bg-3))' : 'var(--bg-3)',
              border: `2px solid ${settings.gameMode === 'dartboard' ? 'var(--accent)' : 'var(--border)'}`,
              boxShadow: settings.gameMode === 'dartboard' ? '0 0 12px color-mix(in srgb,var(--accent) 35%,transparent)' : 'none',
              cursor: 'pointer', color: 'inherit',
            }}>
            <Target size={32} color={settings.gameMode === 'dartboard' ? 'var(--accent)' : 'var(--muted)'} />
            <div style={{ fontWeight: 800, fontSize: 15 }}>Dart Board</div>
            <div className="muted" style={{ fontSize: 11, textAlign: 'center' }}>Classic dart-throwing gameplay</div>
          </button>
          <button onClick={() => { update({ gameMode: 'cards' }); toast('Card Based mode selected'); }}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: 16, borderRadius: 12,
              background: settings.gameMode === 'cards' ? 'color-mix(in srgb,var(--accent) 22%,var(--bg-3))' : 'var(--bg-3)',
              border: `2px solid ${settings.gameMode === 'cards' ? 'var(--accent)' : 'var(--border)'}`,
              boxShadow: settings.gameMode === 'cards' ? '0 0 12px color-mix(in srgb,var(--accent) 35%,transparent)' : 'none',
              cursor: 'pointer', color: 'inherit',
            }}>
            <Layers size={32} color={settings.gameMode === 'cards' ? 'var(--accent)' : 'var(--muted)'} />
            <div style={{ fontWeight: 800, fontSize: 15 }}>Card Based</div>
            <div className="muted" style={{ fontSize: 11, textAlign: 'center' }}>Tactical deck-builder gameplay</div>
          </button>
        </div>
      </div>
      <div className="card">
        <button className="btn block" style={{ marginBottom: 10, background: 'linear-gradient(135deg, color-mix(in srgb,#ef4444 28%,var(--bg-3)) 0%, var(--bg-3) 80%)', borderColor: 'color-mix(in srgb,#ef4444 50%,var(--border))' }} onClick={() => setShowEditor(true)}>
          ⚔️ Campaign Level Editor
        </button>
      </div>
      <div className="card">
        <div className="row between" style={{ marginBottom: 6 }}>
          <div className="row" style={{ gap: 8 }}>
            <span className={dotClass} />
            <b>Cloud Sync</b>
          </div>
          <span className="muted small">{statusLabel}</span>
        </div>
        <div className="muted small" style={{ marginBottom: 10 }}>
          {hasDatabase
            ? (connected
                ? (upToDate ? 'Your data is backed up to the cloud and up to date.' : 'Local changes will sync shortly, or press Sync now.')
                : 'Database unreachable — changes are saved locally and will sync when reconnected.')
            : 'No database configured. Your data is saved on this device only.'}
        </div>
        <button className="btn block primary" disabled={!hasDatabase || syncing} onClick={handleSync} style={{ marginBottom: 8 }}>
          {syncing ? 'Syncing…' : 'Sync now'}
        </button>
        {(upToDate && hasDatabase && connected) && <div className="muted small center">Up to date{lastSyncLabel ? ` · ${lastSyncLabel}` : ''}</div>}
      </div>

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
        {settings.sound && (
          <>
            <label className="field" style={{ marginBottom: 14 }}>
              <span><b>SFX volume</b> · {Math.round((settings.sfxVolume ?? 0.9) * 100)}%</span>
              <input type="range" min={0} max={1} step={0.05} value={settings.sfxVolume ?? 0.9} onChange={e => update({ sfxVolume: +e.target.value })} />
            </label>
            <label className="field" style={{ marginBottom: 14 }}>
              <span><b>Hit sound pack</b> · played on dart damage</span>
              <select value={settings.hitSoundPack ?? 'thud'} onChange={e => update({ hitSoundPack: e.target.value as any })}>
                <option value="thud">Thud (default)</option>
                <option value="board">Board</option>
                <option value="punch">Punch</option>
                <option value="arcade">Arcade</option>
              </select>
            </label>
            <label className="field" style={{ marginBottom: 14 }}>
              <span><b>Button click sound</b> · UI feedback</span>
              <select value={settings.clickSound ?? 'none'} onChange={e => update({ clickSound: e.target.value as any })}>
                <option value="none">None</option>
                <option value="tick">Tick</option>
                <option value="pop">Pop</option>
                <option value="tap">Tap</option>
              </select>
            </label>
            {settings.clickSound && settings.clickSound !== 'none' && (
              <label className="field" style={{ marginBottom: 14 }}>
                <span><b>Click volume</b> · {Math.round((settings.clickVolume ?? 0.6) * 100)}%</span>
                <input type="range" min={0} max={1} step={0.05} value={settings.clickVolume ?? 0.6} onChange={e => update({ clickVolume: +e.target.value })} />
              </label>
            )}
          </>
        )}
        <label className="row between" style={{ marginBottom: 14 }}><b>Background music</b><input type="checkbox" checked={settings.music} onChange={e => update({ music: e.target.checked })} style={{ width: 'auto' }} /></label>
        {settings.music && (
          <>
            <label className="field" style={{ marginBottom: 14 }}>
              <span><b>Music volume</b> · {Math.round((settings.musicVolume ?? 0.9) * 100)}%</span>
              <input type="range" min={0} max={1} step={0.05} value={settings.musicVolume ?? 0.9} onChange={e => { update({ musicVolume: +e.target.value }); if (previewing) previewRef.current?.preview(previewing, { ...settings, music: true, musicVolume: +e.target.value }); }} />
            </label>
            <TrackRow label="Start screen track" value={settings.musicStartTrack} onChange={v => update({ musicStartTrack: v })} context="start" previewing={previewing} onTogglePreview={togglePreview} onStopPreview={stopPreview} />
            <TrackRow label="Setup screen track" value={settings.musicSetupTrack} onChange={v => update({ musicSetupTrack: v })} context="setup" previewing={previewing} onTogglePreview={togglePreview} onStopPreview={stopPreview} />
            <TrackRow label="Match track" value={settings.musicMatchTrack} onChange={v => update({ musicMatchTrack: v })} context="match" previewing={previewing} onTogglePreview={togglePreview} onStopPreview={stopPreview} />
            <TrackRow label="Coop campaign track" value={settings.musicCoopTrack} onChange={v => update({ musicCoopTrack: v })} context="coop" previewing={previewing} onTogglePreview={togglePreview} onStopPreview={stopPreview} />
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
        <h3 style={{ marginBottom: 4 }}>Power-Ups & Attributes</h3>
        <div className="muted small" style={{ marginBottom: 12 }}>Tune how power-ups charge, how many points players get, and attribute scaling</div>
        <div className="muted small" style={{ marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>Charge</div>
        <div className="grid grid-2">
          {([['Charge per double (%)', 'chargePerDouble'], ['Charge per triple (%)', 'chargePerTriple'], ['Charge per bull (%)', 'chargePerBull'], ['Charge per score point', 'chargePerScorePoint'], ['Charge cap', 'chargeMax']] as [string, keyof typeof puForm][]).map(([label, key]) => (
            <label key={key} className="field"><span>{label}</span>
              <input type="number" value={puForm[key] as number} min={0} step={key === 'chargePerScorePoint' ? 0.01 : 1} onChange={e => setPuForm({ ...puForm, [key]: +e.target.value || 0 })} />
            </label>
          ))}
        </div>
        <div className="muted small" style={{ margin: '14px 0 8px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>Points</div>
        <div className="grid grid-2">
          {([['Power-up points per level', 'pointsPerLevel'], ['Starting power-up points', 'startingPoints'], ['Attribute points per level', 'attributePointsPerLevel']] as [string, keyof typeof puForm][]).map(([label, key]) => (
            <label key={key} className="field"><span>{label}</span>
              <input type="number" value={puForm[key] as number} min={0} step={1} onChange={e => setPuForm({ ...puForm, [key]: +e.target.value || 0 })} />
            </label>
          ))}
        </div>
        <div className="muted small" style={{ margin: '14px 0 8px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>Attributes</div>
        <div className="grid grid-2">
          {([['Starting HP', 'attributeStartHealth'], ['Starting armor', 'attributeStartArmor'], ['Starting power', 'attributeStartPower'], ['HP per point', 'healthPerPoint'], ['Armor per point', 'armorPerPoint'], ['Power per point', 'powerPerPoint'], ['Armor cap', 'armorMax'], ['Power cap', 'powerMax'], ['Health cap', 'healthMax']] as [string, keyof typeof puForm][]).map(([label, key]) => (
            <label key={key} className="field"><span>{label}</span>
              <input type="number" value={puForm[key] as number} min={0} step={1} onChange={e => setPuForm({ ...puForm, [key]: +e.target.value || 0 })} />
            </label>
          ))}
        </div>
        <div className="muted small" style={{ margin: '14px 0 8px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>Battle Mode</div>
        <div className="grid grid-2">
          {([['Min damage per hit', 'battleMinDamage']] as [string, keyof typeof puForm][]).map(([label, key]) => (
            <label key={key} className="field"><span>{label}</span>
              <input type="number" value={puForm[key] as number} min={0} step={1} onChange={e => setPuForm({ ...puForm, [key]: +e.target.value || 0 })} />
            </label>
          ))}
        </div>
        <div className="muted small" style={{ margin: '14px 0 8px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>Starting Charge</div>
        <div className="muted small" style={{ marginBottom: 8 }}>Some power-ups begin a match partially charged. Surge is an early-game power-up, so it defaults to 40%. Set 0 to start empty.</div>
        <div className="muted small" style={{ marginBottom: 4, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>Competitive</div>
        <div className="grid grid-2">
          {POWER_UPS.map((pu) => {
            const sc = (puForm.startingCharge || {})[pu.id] ?? 0;
            return (
              <label key={pu.id} className="field"><span>{pu.icon} {pu.name} start (%)</span>
                <input type="number" value={sc} min={0} max={puForm.chargeMax} step={5}
                  onChange={e => setPuForm({ ...puForm, startingCharge: { ...(puForm.startingCharge || {}), [pu.id]: Math.max(0, Math.min(puForm.chargeMax, +e.target.value || 0)) } })} />
              </label>
            );
          })}
        </div>
        <div className="muted small" style={{ margin: '12px 0 4px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>Coop <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight:500 }}>(used in Co-op Campaign)</span></div>
        <div className="grid grid-2">
          {COOP_POWER_UPS.map((pu) => {
            const sc = (puForm.startingCharge || {})[pu.id] ?? 0;
            return (
              <label key={pu.id} className="field"><span>{pu.icon} {pu.name} start (%)</span>
                <input type="number" value={sc} min={0} max={puForm.chargeMax} step={5}
                  onChange={e => setPuForm({ ...puForm, startingCharge: { ...(puForm.startingCharge || {}), [pu.id]: Math.max(0, Math.min(puForm.chargeMax, +e.target.value || 0)) } })} />
              </label>
            );
          })}
        </div>
        <div className="muted small" style={{ margin: '14px 0 8px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>Charges Needed to Activate</div>
        <div className="muted small" style={{ marginBottom: 8 }}>Set how full each competitive power-up's orb must be before it can be activated. Lower = easier to use, higher = more impactful. Defaults to the charge cap ({puForm.chargeMax}) when blank.</div>
        <div className="grid grid-2">
          {POWER_UPS.map((pu) => {
            const v = (puForm.chargesNeeded || {})[pu.id];
            const cn = v == null || !Number.isFinite(v) ? '' : String(v);
            return (
              <label key={pu.id} className="field"><span>{pu.icon} {pu.name} needed (%)</span>
                <input type="number" value={cn} placeholder={String(puForm.chargeMax)} min={0} max={puForm.chargeMax} step={5}
                  onChange={e => {
                    const raw = e.target.value;
                    const num = raw === '' ? NaN : +raw;
                    const nextMap = { ...(puForm.chargesNeeded || {}) };
                    if (!Number.isFinite(num)) delete nextMap[pu.id];
                    else nextMap[pu.id] = Math.max(0, Math.min(puForm.chargeMax, num));
                    setPuForm({ ...puForm, chargesNeeded: nextMap });
                  }} />
              </label>
            );
          })}
        </div>
        <button className="btn primary block" style={{ marginTop: 10 }} onClick={() => { update({ powerUpScaling: puForm }); toast('Power-up & attribute settings saved'); }}>Save Power-Up Settings</button>
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
        <button className="btn block" style={{ marginBottom: 8 }} onClick={() => mergeInputRef.current?.click()}>Merge from backup file…</button>
        <input ref={mergeInputRef} type="file" accept="application/json,.json" className="hidden" onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          try {
            const text = await file.text();
            const parsed = JSON.parse(text) as BackupShape;
            if (!parsed || (!parsed.players && !parsed.games && !parsed.settings)) { toast('Not a valid backup file'); return; }
            const merged = mergeBackup({ players, games, settings }, parsed);
            const newPlayers = merged.players.length - players.length;
            const newGames = merged.games.length - games.length;
            setPlayers(merged.players);
            setGames(merged.games);
            setSettings(merged.settings);
            toast(`Merged: +${newPlayers} players, +${newGames} games`);
          } catch (err) {
            console.error(err);
            toast('Could not read backup file');
          }
        }} />
        <div className="muted small" style={{ marginTop: 6 }}>Merge combines players, games, and custom titles from another backup file with your current data — handy for syncing multiple devices.</div>
        <button className="btn block danger" onClick={() => {
          if (confirm('Erase ALL players, games and settings? This cannot be undone.')) {
            localStorage.removeItem('dc_players'); localStorage.removeItem('dc_games'); localStorage.removeItem('dc_settings');
            window.location.reload();
          }
        }}>Erase all data</button>
        <div className="muted small center" style={{ marginTop: 12 }}>{players.length} players · {games.length} games stored locally</div>
      </div>

      <div className="muted small center" style={{ marginTop: 8, fontSize: 11, opacity: 0.7 }}>
        {(() => {
          const sha = import.meta.env.VITE_COMMIT_SHA;
          if (!sha) return 'Version: dev';
          const short = sha.slice(0, 7);
          return <>Version: <a href={`https://github.com/jonassandroos16-ship-it/dart-counter/commit/${sha}`} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>{short}</a></>;
        })()}
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
