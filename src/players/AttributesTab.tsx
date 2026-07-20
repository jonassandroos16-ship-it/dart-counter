import type { Player, Settings } from '../types';
import { defaultAttributes, totalAttributePointsForLevel } from '../logic';
import { spentOn, effectiveLevel } from './helpers';
import type { SetPlayers, Toast } from './BasicTab';

export function AttributesTab({ player, settings, setPlayers, toast }: {
  player: Player;
  settings: Settings;
  setPlayers: SetPlayers;
  toast: Toast;
}) {
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
      <div className="muted small" style={{ marginBottom: 10 }}>Players start with {cfg.attributeStartHealth} HP, {cfg.attributeStartArmor}% armor and {cfg.attributeStartPower} power. Each level grants {cfg.attributePointsPerLevel} attribute points. Health caps at {cfg.healthMax}, armor at {cfg.armorMax}% (percentage damage reduction per dart) and power at {cfg.powerMax} (flat per dart).</div>
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
        <div className="row between"><b>🛡️ Armor</b><span style={{ fontWeight: 800, fontSize: 18 }}>{safeArmor}%{armorAtCap ? <span className="muted small" style={{ marginLeft: 6 }}>MAX</span> : null}</span></div>
        <div className="muted small" style={{ marginTop: 4 }}>Each point adds +{cfg.armorPerPoint}% armor (max {cfg.armorMax}%). Percentage damage reduction applied to EVERY dart in Battle.</div>
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
