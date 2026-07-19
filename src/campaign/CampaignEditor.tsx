import { useMemo, useState } from 'react';
import type { CampaignConfig, CampaignLevel, Difficulty, EnemyDatabase, ExactTarget, ShieldLayer, ShieldType, SpanTarget } from './types';
import { CAMPAIGN_LEVELS } from './campaignLevels';
import { ENEMY_DATABASE } from './enemyDatabase';
import { uid } from '../store';

const SPAN_TARGETS: SpanTarget[] = ['TOP_HALF', 'BOTTOM_HALF', 'LEFT_HALF', 'RIGHT_HALF', 'ANY_DOUBLE', 'ANY_TRIPLE', 'ANY_BULL'];
const EXACT_PRESETS: ExactTarget[] = [
  '20', 'D20', 'T20', '19', 'D19', 'T19', '18', 'D18', 'T18',
  '17', '16', '15', 'T15', '14', '13', '12', '11', '10',
  '25', 'Bull',
];

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'enemy';

export function CampaignEditor({ onBack }: { onBack: () => void }) {
  const [levels, setLevels] = useState<CampaignConfig>(() => JSON.parse(JSON.stringify(CAMPAIGN_LEVELS)));
  const [enemies, setEnemies] = useState<EnemyDatabase>(() => JSON.parse(JSON.stringify(ENEMY_DATABASE)));
  const [selectedLevelId, setSelectedLevelId] = useState<number | null>(levels.levels[0]?.level_id ?? null);
  const [selectedEnemyId, setSelectedEnemyId] = useState<string | null>(Object.keys(enemies)[0] ?? null);
  const [jsonOut, setJsonOut] = useState<string | null>(null);

  const selectedLevel = useMemo(
    () => levels.levels.find(l => l.level_id === selectedLevelId) || null,
    [levels, selectedLevelId],
  );
  const selectedEnemy = selectedEnemyId ? enemies[selectedEnemyId] : null;

  // ── Level ops ──────────────────────────────────────────────────────
  const createLevel = () => {
    const nextId = (levels.levels.reduce((m, l) => Math.max(m, l.level_id), 0) || 0) + 1;
    const newLevel: CampaignLevel = { level_id: nextId, name: `Level ${nextId}`, is_boss: false, enemies: [] };
    setLevels(prev => ({ levels: [...prev.levels, newLevel] }));
    setSelectedLevelId(nextId);
  };
  const updateLevel = (patch: Partial<CampaignLevel>) => {
    if (selectedLevelId == null) return;
    setLevels(prev => ({
      levels: prev.levels.map(l => l.level_id === selectedLevelId ? { ...l, ...patch } : l),
    }));
  };
  const deleteLevel = () => {
    if (selectedLevelId == null) return;
    setLevels(prev => ({ levels: prev.levels.filter(l => l.level_id !== selectedLevelId) }));
    setSelectedLevelId(levels.levels.find(l => l.level_id !== selectedLevelId)?.level_id ?? null);
  };
  const addEnemyToLevel = (enemyId: string) => {
    if (!selectedLevel) return;
    updateLevel({ enemies: [...selectedLevel.enemies, enemyId] });
  };
  const removeEnemyFromLevel = (idx: number) => {
    if (!selectedLevel) return;
    updateLevel({ enemies: selectedLevel.enemies.filter((_, i) => i !== idx) });
  };

  // ── Enemy ops ──────────────────────────────────────────────────────
  const createEnemy = () => {
    const name = `New Enemy ${Object.keys(enemies).length + 1}`;
    const id = slugify(name) + '_' + uid().slice(-5);
    setEnemies(prev => ({ ...prev, [id]: { name, difficulty: 'Easy', max_hp: 50, armor: 0, accuracy: 0.4, precision: 0.4, shields: [] } }));
    setSelectedEnemyId(id);
  };
  const updateEnemy = (patch: Partial<typeof enemies[string]>) => {
    if (!selectedEnemyId) return;
    setEnemies(prev => ({ ...prev, [selectedEnemyId]: { ...prev[selectedEnemyId], ...patch } }));
  };
  const deleteEnemy = (id: string) => {
    setEnemies(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    // Also remove from any levels that referenced it.
    setLevels(prev => ({
      levels: prev.levels.map(l => ({ ...l, enemies: l.enemies.filter(e => e !== id) })),
    }));
    if (selectedEnemyId === id) setSelectedEnemyId(Object.keys(enemies)[0] ?? null);
  };
  const addShield = () => {
    if (!selectedEnemy) return;
    updateEnemy({ shields: [...selectedEnemy.shields, { type: 'span', target_value: 'TOP_HALF' }] });
  };
  const updateShield = (idx: number, patch: Partial<ShieldLayer>) => {
    if (!selectedEnemy) return;
    const shields = selectedEnemy.shields.map((s, i) => i === idx ? { ...s, ...patch } : s);
    updateEnemy({ shields });
  };
  const removeShield = (idx: number) => {
    if (!selectedEnemy) return;
    updateEnemy({ shields: selectedEnemy.shields.filter((_, i) => i !== idx) });
  };

  const generateJson = () => {
    const out = {
      campaign_levels: levels,
      enemy_database: enemies,
    };
    setJsonOut(JSON.stringify(out, null, 2));
  };

  return (
    <div className="view-scroll">
      <div className="row between" style={{ marginBottom: 12 }}>
        <button className="btn ghost sm" onClick={onBack}>← Back to Settings</button>
        <h2 style={{ margin: 0 }}>Campaign Level Editor</h2>
        <span className="muted small">v1</span>
      </div>

      {/* ── Level management ─────────────────────────────────────────── */}
      <div className="card">
        <div className="row between" style={{ marginBottom: 10 }}>
          <h3 style={{ margin: 0 }}>Levels</h3>
          <div className="row" style={{ gap: 6 }}>
            <select
              style={{ width: 'auto', minWidth: 160 }}
              value={selectedLevelId ?? ''}
              onChange={e => setSelectedLevelId(e.target.value ? Number(e.target.value) : null)}
            >
              {levels.levels.map(l => (
                <option key={l.level_id} value={l.level_id}>#{l.level_id} · {l.name}{l.is_boss ? ' ☠' : ''}</option>
              ))}
            </select>
            <button className="btn primary sm" onClick={createLevel}>+ New</button>
            <button className="btn danger sm" onClick={deleteLevel} disabled={selectedLevelId == null}>✕</button>
          </div>
        </div>
        {selectedLevel ? (
          <>
            <div className="grid grid-2">
              <label className="field"><span>Level ID</span>
                <input type="number" value={selectedLevel.level_id} onChange={e => updateLevel({ level_id: +e.target.value })} />
              </label>
              <label className="field"><span>Level name</span>
                <input value={selectedLevel.name} onChange={e => updateLevel({ name: e.target.value })} maxLength={40} />
              </label>
            </div>
            <label className="row between" style={{ marginBottom: 10 }}>
              <b>Boss level</b>
              <input type="checkbox" checked={selectedLevel.is_boss} onChange={e => updateLevel({ is_boss: e.target.checked })} style={{ width: 'auto' }} />
            </label>
            <div className="muted small" style={{ marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>Current wave</div>
            <div className="row wrap" style={{ gap: 6, marginBottom: 8 }}>
              {selectedLevel.enemies.length === 0 && <span className="muted small">No enemies yet.</span>}
              {selectedLevel.enemies.map((id, i) => (
                <span key={i} className="pill" style={{ background: 'var(--bg-3)' }}>
                  {enemies[id]?.name || id}
                  <button onClick={() => removeEnemyFromLevel(i)} style={{ marginLeft: 4, color: 'var(--danger)', fontWeight: 800 }}>✕</button>
                </span>
              ))}
            </div>
            <div className="row" style={{ gap: 6 }}>
              <select style={{ flex: 1 }} value="" onChange={e => { if (e.target.value) addEnemyToLevel(e.target.value); }}>
                <option value="">+ Add enemy to wave…</option>
                {Object.entries(enemies).map(([id, def]) => (
                  <option key={id} value={id}>{def.name} ({id})</option>
                ))}
              </select>
            </div>
          </>
        ) : (
          <div className="muted small">No level selected. Click "+ New" to create one.</div>
        )}
      </div>

      {/* ── Enemy profiles ──────────────────────────────────────────── */}
      <div className="card">
        <div className="row between" style={{ marginBottom: 10 }}>
          <h3 style={{ margin: 0 }}>Enemy Profiles & Balancing</h3>
          <div className="row" style={{ gap: 6 }}>
            <select
              style={{ width: 'auto', minWidth: 180 }}
              value={selectedEnemyId ?? ''}
              onChange={e => setSelectedEnemyId(e.target.value || null)}
            >
              {Object.entries(enemies).map(([id, def]) => (
                <option key={id} value={id}>{def.name} ({id})</option>
              ))}
            </select>
            <button className="btn primary sm" onClick={createEnemy}>+ New</button>
            <button className="btn danger sm" onClick={() => selectedEnemyId && deleteEnemy(selectedEnemyId)} disabled={!selectedEnemyId}>✕</button>
          </div>
        </div>
        {selectedEnemy ? (
          <>
            <div className="grid grid-2">
              <label className="field"><span>Name</span><input value={selectedEnemy.name} onChange={e => updateEnemy({ name: e.target.value })} maxLength={30} /></label>
              <label className="field">
                <span>Difficulty</span>
                <select value={selectedEnemy.difficulty} onChange={e => updateEnemy({ difficulty: e.target.value as Difficulty })}>
                  <option value="Easy">Easy</option>
                  <option value="Hard">Hard</option>
                  <option value="Boss">Boss</option>
                </select>
              </label>
              <label className="field"><span>Max HP</span><input type="number" min={1} value={selectedEnemy.max_hp} onChange={e => updateEnemy({ max_hp: +e.target.value || 1 })} /></label>
              <label className="field"><span>Armor</span><input type="number" min={0} value={selectedEnemy.armor} onChange={e => updateEnemy({ armor: +e.target.value || 0 })} /></label>
              <label className="field"><span>Accuracy ({Math.round(selectedEnemy.accuracy * 100)}%)</span>
                <input type="range" min={0} max={1} step={0.01} value={selectedEnemy.accuracy} onChange={e => updateEnemy({ accuracy: +e.target.value })} />
              </label>
              <label className="field"><span>Precision ({Math.round(selectedEnemy.precision * 100)}%)</span>
                <input type="range" min={0} max={1} step={0.01} value={selectedEnemy.precision} onChange={e => updateEnemy({ precision: +e.target.value })} />
              </label>
            </div>

            <div className="muted small" style={{ margin: '14px 0 8px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>Shield Configuration</div>
            <button className="btn ghost sm block" style={{ marginBottom: 8 }} onClick={addShield}>+ Add Shield Layer</button>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {selectedEnemy.shields.map((s, i) => (
                <div key={i} className="row" style={{ gap: 6, padding: 8, borderRadius: 10, background: 'var(--bg-3)' }}>
                  <span className="muted small" style={{ fontWeight: 700 }}>#{i + 1}</span>
                  <select style={{ width: 'auto', minWidth: 100 }} value={s.type} onChange={e => {
                    const type = e.target.value as ShieldType;
                    const target_value = type === 'span' ? 'TOP_HALF' : '20';
                    updateShield(i, { type, target_value });
                  }}>
                    <option value="span">Span</option>
                    <option value="exact">Exact</option>
                  </select>
                  <select style={{ flex: 1 }} value={s.target_value} onChange={e => updateShield(i, { target_value: e.target.value })}>
                    {s.type === 'span'
                      ? SPAN_TARGETS.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)
                      : EXACT_PRESETS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <button className="btn danger sm" onClick={() => removeShield(i)}>✕</button>
                </div>
              ))}
              {selectedEnemy.shields.length === 0 && <span className="muted small">No shields — all darts deal damage directly.</span>}
            </div>
          </>
        ) : (
          <div className="muted small">No enemy selected.</div>
        )}
      </div>

      {/* ── JSON output ─────────────────────────────────────────────── */}
      <div className="card">
        <div className="row between" style={{ marginBottom: 10 }}>
          <h3 style={{ margin: 0 }}>Export</h3>
          <button className="btn primary sm" onClick={generateJson}>Generate JSON Out</button>
        </div>
        {jsonOut ? (
          <>
            <textarea
              readOnly
              value={jsonOut}
              style={{ width: '100%', minHeight: 240, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12, background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 10, padding: 10 }}
              onFocus={e => e.target.select()}
            />
            <button className="btn ghost sm block" style={{ marginTop: 8 }} onClick={() => { navigator.clipboard?.writeText(jsonOut); }}>Copy to clipboard</button>
            <div className="muted small" style={{ marginTop: 6 }}>Paste this into <code>campaign_levels.ts</code> and <code>enemyDatabase.ts</code> to ship new content.</div>
          </>
        ) : (
          <div className="muted small">Click "Generate JSON Out" to dump the current configuration as a raw JSON block.</div>
        )}
      </div>
    </div>
  );
}
