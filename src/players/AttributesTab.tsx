import type { Player, Settings, ClassAttributes } from '../types';
import { totalAttributePointsForLevel, defaultClassAttributes, classStartHealth, classStartArmor, classStartPower, classStartCrit, classHealthMax, classArmorMax, classPowerMax, classCritMax } from '../logic';
import { COOP_CLASSES, getCoopClass, selectClassForPlayer } from '../campaign/engine';
import type { CoopClassId } from '../campaign/types';
import { spentOn, effectiveLevel } from './helpers';
import type { SetPlayers, Toast } from './BasicTab';

export function AttributesTab({ player, settings, setPlayers, toast }: {
  player: Player;
  settings: Settings;
  setPlayers: SetPlayers;
  toast: Toast;
}) {
  const cfg = settings.powerUpScaling;
  const activeClassId = (player.coopProgress?.classId || 'warrior') as CoopClassId;
  const activeClass = getCoopClass(activeClassId);
  const classAttrs = player.classAttributes || {};
  const active = classAttrs[activeClassId] || defaultClassAttributes(activeClassId, settings);
  const level = effectiveLevel(player, settings);
  const totalPoints = totalAttributePointsForLevel(level, settings) + (player.developerMode ? 100 : 0);
  const hMax = classHealthMax(activeClassId, settings);
  const aMax = classArmorMax(activeClassId, settings);
  const pMax = classPowerMax(activeClassId, settings);
  const cMax = classCritMax(activeClassId, settings);
  const startH = classStartHealth(activeClassId, settings);
  const startA = classStartArmor(activeClassId, settings);
  const startP = classStartPower(activeClassId, settings);
  const startC = classStartCrit(activeClassId, settings);
  const safeHealth = Number.isFinite(active.health) ? active.health : startH;
  const safeArmor = Number.isFinite(active.armor) ? active.armor : startA;
  const safePower = Number.isFinite(active.power) ? active.power : startP;
  const safeCrit = Number.isFinite(active.crit) ? active.crit : startC;
  const spent = spentOn(safeHealth, startH, cfg.healthPerPoint)
    + spentOn(safeArmor, startA, cfg.armorPerPoint)
    + spentOn(safePower, startP, cfg.powerPerPoint)
    + spentOn(safeCrit, startC, cfg.critPerPoint);
  const available = Math.max(0, totalPoints - spent);

  const pickClass = (classId: CoopClassId) => {
    if (activeClassId === classId) return;
    setPlayers((prev: Player[]) => prev.map(p => {
      if (p.id !== player.id) return p;
      const cur = p.coopProgress || { classId: null, unlockedPassives: [], equippedPassives: [] };
      const next = selectClassForPlayer(cur, classId);
      const caMap = { ...(p.classAttributes || {}) };
      if (!caMap[classId]) {
        caMap[classId] = defaultClassAttributes(classId, settings);
      }
      const activeAttrs = caMap[classId];
      return { ...p, coopProgress: next, classAttributes: caMap, attributes: { ...activeAttrs } };
    }));
    const cls = getCoopClass(classId);
    toast(`${cls?.name || classId} class selected`);
  };

  const healthAtCap = safeHealth >= hMax;
  const armorAtCap = safeArmor >= aMax;
  const powerAtCap = safePower >= pMax;
  const critAtCap = safeCrit >= cMax;

  const spend = (kind: 'health' | 'armor' | 'power' | 'crit') => {
    if (!Number.isFinite(available) || available <= 0) { toast('No attribute points available'); return; }
    setPlayers((prev: Player[]) => prev.map(p => {
      if (p.id !== player.id) return p;
      const cid = (p.coopProgress?.classId || 'warrior') as CoopClassId;
      const caMap = { ...(p.classAttributes || {}) };
      const ca = caMap[cid] || defaultClassAttributes(cid, settings);
      const cH = classStartHealth(cid, settings);
      const cA = classStartArmor(cid, settings);
      const cP = classStartPower(cid, settings);
      const cC = classStartCrit(cid, settings);
      const cHMax = classHealthMax(cid, settings);
      const cAMax = classArmorMax(cid, settings);
      const cPMax = classPowerMax(cid, settings);
      const cCMax = classCritMax(cid, settings);
      const curH = Number.isFinite(ca.health) ? ca.health : cH;
      const curA = Number.isFinite(ca.armor) ? ca.armor : cA;
      const curP = Number.isFinite(ca.power) ? ca.power : cP;
      const curC = Number.isFinite(ca.crit) ? ca.crit : cC;
      const lv = effectiveLevel(p, settings);
      const tp = totalAttributePointsForLevel(lv, settings) + (p.developerMode ? 100 : 0);
      const sp = spentOn(curH, cH, cfg.healthPerPoint) + spentOn(curA, cA, cfg.armorPerPoint) + spentOn(curP, cP, cfg.powerPerPoint) + spentOn(curC, cC, cfg.critPerPoint);
      const avail = Math.max(0, tp - sp);
      if (kind === 'health') {
        if (curH >= cHMax) { toast(`Health capped at ${cHMax}`); return p; }
        const step = Number.isFinite(cfg.healthPerPoint) && cfg.healthPerPoint > 0 ? cfg.healthPerPoint : 1;
        const nextCa: ClassAttributes = { ...ca, health: Math.min(cHMax, curH + step), pointsAvailable: Math.max(0, avail - 1) };
        caMap[cid] = nextCa;
        return { ...p, classAttributes: caMap, attributes: { ...nextCa } };
      }
      if (kind === 'armor') {
        if (curA >= cAMax) { toast(`Armor capped at ${cAMax}`); return p; }
        const step = Number.isFinite(cfg.armorPerPoint) && cfg.armorPerPoint > 0 ? cfg.armorPerPoint : 1;
        const nextCa: ClassAttributes = { ...ca, armor: Math.min(cAMax, curA + step), pointsAvailable: Math.max(0, avail - 1) };
        caMap[cid] = nextCa;
        return { ...p, classAttributes: caMap, attributes: { ...nextCa } };
      }
      if (kind === 'power') {
        if (curP >= cPMax) { toast(`Power capped at ${cPMax}`); return p; }
        const step = Number.isFinite(cfg.powerPerPoint) && cfg.powerPerPoint > 0 ? cfg.powerPerPoint : 1;
        const nextCa: ClassAttributes = { ...ca, power: Math.min(cPMax, curP + step), pointsAvailable: Math.max(0, avail - 1) };
        caMap[cid] = nextCa;
        return { ...p, classAttributes: caMap, attributes: { ...nextCa } };
      }
      if (curC >= cCMax) { toast(`Crit capped at ${cCMax}%`); return p; }
      const step = Number.isFinite(cfg.critPerPoint) && cfg.critPerPoint > 0 ? cfg.critPerPoint : 1;
      const nextCa: ClassAttributes = { ...ca, crit: Math.min(cCMax, curC + step), pointsAvailable: Math.max(0, avail - 1) };
      caMap[cid] = nextCa;
      return { ...p, classAttributes: caMap, attributes: { ...nextCa } };
    }));
  };

  const reset = () => {
    setPlayers((prev: Player[]) => prev.map(p => {
      if (p.id !== player.id) return p;
      const cid = (p.coopProgress?.classId || 'warrior') as CoopClassId;
      const caMap = { ...(p.classAttributes || {}) };
      const lv = effectiveLevel(p, settings);
      const tp = totalAttributePointsForLevel(lv, settings) + (p.developerMode ? 100 : 0);
      const resetCa: ClassAttributes = { ...defaultClassAttributes(cid, settings), pointsAvailable: tp };
      caMap[cid] = resetCa;
      return { ...p, classAttributes: caMap, attributes: { ...resetCa } };
    }));
    toast(`${activeClass?.name || 'Class'} attributes reset`);
  };

  return (
    <>
      <div className="muted small" style={{ marginBottom: 10 }}>
        {activeClass ? `${activeClass.icon} ${activeClass.name}` : 'No class'} starts with {startH} HP, {startA}% armor, {startP} power and {startC}% crit. Each level grants {cfg.attributePointsPerLevel} attribute points. Health caps at {hMax}, armor at {aMax}% (percentage damage reduction per dart), power at {pMax} (flat per dart) and crit at {cMax}% (chance to double damage before armor).
      </div>
      <div className="card" style={{ padding: 12, marginBottom: 10 }}>
        <div className="row between"><b>{activeClass ? `${activeClass.icon} ${activeClass.name}` : 'No Class'}</b><span className="xp-pill">Lvl {level}</span></div>
        <div className="row between" style={{ marginTop: 6 }}><span className="muted small">Total points earned</span><span className="small"><b>{totalPoints}</b></span></div>
        <div className="row between" style={{ marginTop: 4 }}><span className="muted small">Points spent on {activeClass?.name}</span><span className="small"><b>{spent}</b></span></div>
        <div className="row between" style={{ marginTop: 4 }}><span className="muted small">Available</span><span className="xp-pill">{available} pts</span></div>
      </div>
      <div className="card" style={{ padding: 12, marginBottom: 10 }}>
        <div className="row between"><b>❤️ Health</b><span style={{ fontWeight: 800, fontSize: 18 }}>{safeHealth} HP{healthAtCap ? <span className="muted small" style={{ marginLeft: 6 }}>MAX</span> : null}</span></div>
        <div className="muted small" style={{ marginTop: 4 }}>Each point adds +{cfg.healthPerPoint} HP (max {hMax}). Your total damage pool in Battle.</div>
        <button className="btn primary block" style={{ marginTop: 8 }} disabled={!Number.isFinite(available) || available <= 0 || healthAtCap} onClick={() => spend('health')}>{healthAtCap ? 'Health at cap' : '+ Spend 1 point on Health'}</button>
      </div>
      <div className="card" style={{ padding: 12, marginBottom: 10 }}>
        <div className="row between"><b>🛡️ Armor</b><span style={{ fontWeight: 800, fontSize: 18 }}>{safeArmor}%{armorAtCap ? <span className="muted small" style={{ marginLeft: 6 }}>MAX</span> : null}</span></div>
        <div className="muted small" style={{ marginTop: 4 }}>Each point adds +{cfg.armorPerPoint}% armor (max {aMax}%). Percentage damage reduction applied to EVERY dart in Battle.</div>
        <button className="btn primary block" style={{ marginTop: 8 }} disabled={!Number.isFinite(available) || available <= 0 || armorAtCap} onClick={() => spend('armor')}>{armorAtCap ? 'Armor at cap' : '+ Spend 1 point on Armor'}</button>
      </div>
      <div className="card" style={{ padding: 12, marginBottom: 10 }}>
        <div className="row between"><b>⚡ Power</b><span style={{ fontWeight: 800, fontSize: 18 }}>{safePower}{powerAtCap ? <span className="muted small" style={{ marginLeft: 6 }}>MAX</span> : null}</span></div>
        <div className="muted small" style={{ marginTop: 4 }}>Each point adds +{cfg.powerPerPoint} power (max {pMax}). Flat damage bonus added to EVERY dart that hits in Battle.</div>
        <button className="btn primary block" style={{ marginTop: 8 }} disabled={!Number.isFinite(available) || available <= 0 || powerAtCap} onClick={() => spend('power')}>{powerAtCap ? 'Power at cap' : '+ Spend 1 point on Power'}</button>
      </div>
      <div className="card" style={{ padding: 12, marginBottom: 10 }}>
        <div className="row between"><b>🎯 Crit</b><span style={{ fontWeight: 800, fontSize: 18 }}>{safeCrit}%{critAtCap ? <span className="muted small" style={{ marginLeft: 6 }}>MAX</span> : null}</span></div>
        <div className="muted small" style={{ marginTop: 4 }}>Each point adds +{cfg.critPerPoint}% crit (max {cMax}%). Chance to double flat damage before armor on each dart in Battle.</div>
        <button className="btn primary block" style={{ marginTop: 8 }} disabled={!Number.isFinite(available) || available <= 0 || critAtCap} onClick={() => spend('crit')}>{critAtCap ? 'Crit at cap' : '+ Spend 1 point on Crit'}</button>
      </div>

      {/* Per-class overview */}
      <div className="card" style={{ padding: 12, marginBottom: 10 }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>All Classes Overview</div>
        <div className="muted small" style={{ marginBottom: 8 }}>Tap a class to switch your active class.</div>
        {COOP_CLASSES.map(cls => {
          const ca = classAttrs[cls.id] || defaultClassAttributes(cls.id, settings);
          const isCurrent = cls.id === activeClassId;
          const clsXp = player.coopProgress?.classXp?.[cls.id] ?? 0;
          const clsLv = clsXp > 0 ? effectiveLevel({ ...player, coopProgress: { ...player.coopProgress!, classId: cls.id as CoopClassId } }, settings) : 1;
          const clsTotal = totalAttributePointsForLevel(clsLv, settings) + (player.developerMode ? 100 : 0);
          const cStartH = classStartHealth(cls.id, settings);
          const cStartA = classStartArmor(cls.id, settings);
          const cStartP = classStartPower(cls.id, settings);
          const cStartC = classStartCrit(cls.id, settings);
          const clsSpent = spentOn(ca.health, cStartH, cfg.healthPerPoint) + spentOn(ca.armor, cStartA, cfg.armorPerPoint) + spentOn(ca.power, cStartP, cfg.powerPerPoint) + spentOn(ca.crit, cStartC, cfg.critPerPoint);
          const clsAvail = Math.max(0, clsTotal - clsSpent);
          return (
            <button key={cls.id} onClick={() => pickClass(cls.id as CoopClassId)} disabled={isCurrent}
              style={{
                padding: 10, marginBottom: 6, borderRadius: 8, background: 'var(--bg-3)',
                border: isCurrent ? '1px solid var(--accent)' : '1px solid transparent',
                cursor: isCurrent ? 'default' : 'pointer', color: 'inherit', textAlign: 'left',
                display: 'block', width: '100%',
                boxShadow: isCurrent ? '0 0 10px color-mix(in srgb,var(--accent) 40%,transparent)' : 'none',
                transition: 'border-color .15s ease, box-shadow .15s ease',
              }}>
              <div className="row between" style={{ alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: 13 }}>{cls.icon} {cls.name}{isCurrent ? ' (active)' : ''}</span>
                <span className="muted small">Lvl {clsLv}</span>
              </div>
              <div className="muted small" style={{ marginTop: 4 }}>
                ❤️ {ca.health} HP · 🛡️ {ca.armor}% · ⚡ {ca.power} · 🎯 {ca.crit}% · {clsAvail} pts available
              </div>
            </button>
          );
        })}
      </div>

      <button className="btn ghost sm block" onClick={reset}>Reset {activeClass?.name || 'class'} attributes</button>
    </>
  );
}
