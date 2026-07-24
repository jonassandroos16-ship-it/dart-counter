import type { Player, Settings } from '../types';
import { levelFromXP } from '../logic';
import { COOP_CLASSES, getClassXp } from '../campaign/engine/classes';
import { selectClassForPlayer, getCoopClass } from '../campaign/engine';
import type { CoopClassId } from '../campaign/types';
import { classStartHealth, classStartArmor, classStartPower, classStartCrit, defaultClassAttributes } from '../logic';
import type { SetPlayers, Toast } from '../players/BasicTab';

export function ClassXpSection({ player, settings, setPlayers, toast }: { player: Player; settings: Settings; setPlayers: SetPlayers; toast: Toast }) {
  const prog = player.coopProgress;
  if (!prog) return null;
  const cfg = settings.powerUpScaling;

  const pickClass = (classId: CoopClassId) => {
    if (prog.classId === classId) return;
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

  return (
    <div className="card">
      <h3 style={{ marginBottom: 10 }}>✨ Class XP & Attributes</h3>
      <div className="muted small" style={{ marginBottom: 10 }}>Tap a class to switch your active class.</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {COOP_CLASSES.map(cls => {
          const xp = getClassXp(prog, cls.id as CoopClassId);
          const li = levelFromXP(xp, settings);
          const isCurrent = prog.classId === cls.id;
          const ca = (player.classAttributes || {})[cls.id] || defaultClassAttributes(cls.id, settings);
          const sH = classStartHealth(cls.id, settings);
          const sA = classStartArmor(cls.id, settings);
          const sP = classStartPower(cls.id, settings);
          const sC = classStartCrit(cls.id, settings);
          const spent = Math.max(0, Math.round((ca.health - sH) / (cfg.healthPerPoint || 1)))
            + Math.max(0, Math.round((ca.armor - sA) / (cfg.armorPerPoint || 1)))
            + Math.max(0, Math.round((ca.power - sP) / (cfg.powerPerPoint || 1)))
            + Math.max(0, Math.round((ca.crit - sC) / (cfg.critPerPoint || 1)));
          return (
            <button key={cls.id} onClick={() => pickClass(cls.id as CoopClassId)} disabled={isCurrent}
              style={{
                padding: 12, background: 'var(--bg-3)', borderRadius: 8,
                border: isCurrent ? '1px solid var(--accent)' : '1px solid transparent',
                cursor: isCurrent ? 'default' : 'pointer', color: 'inherit', textAlign: 'left',
                display: 'block', width: '100%',
                boxShadow: isCurrent ? '0 0 10px color-mix(in srgb,var(--accent) 40%,transparent)' : 'none',
                transition: 'border-color .15s ease, box-shadow .15s ease',
              }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontWeight: 800, fontSize: 14 }}>{cls.icon} {cls.name}{isCurrent ? ' (active)' : ''}</span>
                <span style={{ fontWeight: 900, fontSize: 16 }}>Lv {li.level}</span>
              </div>
              <div style={{ height: 8, background: 'var(--bg-2)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: `${li.xpNeeded > 0 ? (li.xpIntoLevel / li.xpNeeded) * 100 : 0}%`, height: '100%', background: 'var(--accent)', borderRadius: 4, transition: 'width .3s' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                <span className="muted small">{xp} XP</span>
                <span className="muted small">{li.xpIntoLevel}/{li.xpNeeded}</span>
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
                <span className="small"><b>❤️ {ca.health}</b> HP</span>
                <span className="small"><b>🛡️ {ca.armor}%</b> armor</span>
                <span className="small"><b>⚡ {ca.power}</b> power</span>
                <span className="small"><b>🎯 {ca.crit}%</b> crit</span>
                <span className="muted small">{spent} pts spent</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
