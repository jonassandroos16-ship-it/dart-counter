import { useState } from 'react';
import type { Player, Settings } from '../types';
import { defaultPowerUps, totalPowerUpPointsForLevel } from '../logic';
import { POWER_UPS, getPowerUpInfo } from '../powerups';
import {
  COOP_POWER_UPS, getCoopPowerUp, unlockedCoopPowerUps,
} from '../campaign/engine';
import { CAMPAIGN_CHAPTERS } from '../campaign/campaignLevels';
import { useCampaignProgress } from '../campaign/progress';
import type { CoopPowerUpId, CoopPowerUpDef } from '../campaign/types';
import { effectiveLevel } from './helpers';
import type { SetPlayers, Toast } from './BasicTab';

// Map each advanced coop power-up id to the campaign level that unlocks it,
// so locked entries can show "Unlocks at Lvl X" / a BOSS badge.
function buildAdvancedUnlockLevel(): Record<string, { levelId: number; levelName: string; isBoss: boolean } | null> {
  const map: Record<string, { levelId: number; levelName: string; isBoss: boolean } | null> = {};
  for (const lvl of CAMPAIGN_CHAPTERS.flatMap(ch => ch.levels)) {
    const reward = lvl.reward_power_up;
    if (reward) map[reward] = { levelId: lvl.level_id, levelName: lvl.name, isBoss: lvl.is_boss };
  }
  return map;
}

export function PowerUpsTab({ player, settings, setPlayers, toast }: {
  player: Player;
  settings: Settings;
  setPlayers: SetPlayers;
  toast: Toast;
}) {
  const cfg = settings.powerUpScaling;
  const pwr = player.powerUps || defaultPowerUps(settings);
  const level = effectiveLevel(player, settings);
  const totalPoints = totalPowerUpPointsForLevel(level, settings);
  const spent = pwr.unlocked.length;
  const available = Math.max(0, totalPoints - spent);
  const [selectedId, setSelectedId] = useState<string | null>(pwr.active);
  const selected = getPowerUpInfo(selectedId) || null;

  const { progress } = useCampaignProgress();
  const unlockedCoopIds = unlockedCoopPowerUps(progress);
  const [selectedCoopId, setSelectedCoopId] = useState<string | null>(pwr.coopActive ?? null);
  const selectedCoop = selectedCoopId ? getCoopPowerUp(selectedCoopId as CoopPowerUpId) : null;

  const advancedUnlockLevel = buildAdvancedUnlockLevel();

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
