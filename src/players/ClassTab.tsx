import type { Player } from '../types';
import {
  COOP_CLASSES, getCoopClass, getCoopPassive,
  passivesForClass, unlockedPassivesForPlayer,
  selectClassForPlayer, equipPassiveForPlayer,
  defaultCoopProgress,
} from '../campaign/engine';
import type { CoopClassId, CoopPassiveId, PlayerCoopProgress } from '../campaign/types';
import type { SetPlayers, Toast } from './BasicTab';

export function ClassTab({ player, setPlayers, toast }: {
  player: Player;
  setPlayers: SetPlayers;
  toast: Toast;
}) {
  const prog: PlayerCoopProgress = player.coopProgress || defaultCoopProgress();
  const selectedClass = getCoopClass(prog.classId);
  const classPassives = selectedClass ? passivesForClass(selectedClass.id) : [];
  const unlockedIds = unlockedPassivesForPlayer(prog);

  const pickClass = (classId: CoopClassId) => {
    setPlayers((prev: Player[]) => prev.map(p => {
      if (p.id !== player.id) return p;
      const cur = p.coopProgress || defaultCoopProgress();
      const next = selectClassForPlayer(cur, classId);
      return { ...p, coopProgress: next };
    }));
    const cls = getCoopClass(classId);
    toast(`${cls?.name || classId} class selected — starter passive equipped`);
  };

  const equip = (passiveId: CoopPassiveId) => {
    setPlayers((prev: Player[]) => prev.map(p => {
      if (p.id !== player.id) return p;
      const cur = p.coopProgress || defaultCoopProgress();
      const next = equipPassiveForPlayer(cur, passiveId);
      return { ...p, coopProgress: next };
    }));
    const def = getCoopPassive(passiveId);
    toast(`${def?.name || passiveId} equipped`);
  };

  return (
    <>
      <div className="muted small" style={{ marginBottom: 10 }}>
        Pick a Coop class to grant your party a team-wide passive bonus during Coop battles. Each class has three tiers of passives with three options per tier — one starter passive is auto-equipped, and you can swap to any unlocked passive anytime.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8, marginBottom: 14 }}>
        {COOP_CLASSES.map(c => {
          const isSelected = prog.classId === c.id;
          return (
            <button key={c.id} onClick={() => pickClass(c.id)} title={c.desc}
              style={{
                position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: 12, borderRadius: 10,
                background: isSelected ? 'color-mix(in srgb,var(--accent) 22%,var(--bg-3))' : 'var(--bg-3)',
                border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                boxShadow: isSelected ? '0 0 10px color-mix(in srgb,var(--accent) 40%,transparent)' : 'none',
                cursor: 'pointer', color: 'inherit', textAlign: 'center',
              }}>
              <div style={{ fontSize: 28 }}>{c.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 800 }}>{c.name}</div>
              {isSelected ? <span className="xp-pill" style={{ fontSize: 10 }}>Selected</span> : null}
            </button>
          );
        })}
      </div>

      {selectedClass ? (
        <>
          <div className="card" style={{ padding: 12, marginBottom: 12 }}>
            <div className="row" style={{ gap: 10, alignItems: 'center' }}>
              <div style={{ fontSize: 26 }}>{selectedClass.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{selectedClass.name}</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 2, lineHeight: 1.3 }}>{selectedClass.desc}</div>
              </div>
            </div>
            <div className="row between" style={{ marginTop: 10 }}>
              <span className="muted small">Coop XP</span>
              <span className="xp-pill">{prog.xp || 0} XP</span>
            </div>
            <div className="xp-bar" style={{ width: '100%', marginTop: 6 }}>
              <div style={{ width: `${Math.min(100, Math.round(((prog.xp || 0) % 150) / 150 * 100))}%` }} />
            </div>
            <div className="muted small" style={{ marginTop: 4 }}>Earn Coop XP by playing Coop battles — wins give more than losses.</div>
          </div>

          <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>Passives</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '34vh', overflow: 'auto' }}>
            {classPassives.map(p => {
              const isUnlocked = unlockedIds.includes(p.id);
              const isEquipped = (prog.equippedPassives || []).includes(p.id);
              const xpPct = p.xpRequired > 0 ? Math.min(100, Math.round(((prog.xp || 0) / p.xpRequired) * 100)) : 100;
              return (
                <div key={p.id} style={{
                  position: 'relative',
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: 14, borderRadius: 12, background: 'var(--bg-3)',
                  border: `1px solid ${isEquipped ? 'var(--accent)' : 'var(--border)'}`,
                  opacity: isUnlocked ? 1 : 0.7, overflow: 'hidden', minHeight: 64,
                }}>
                  {isUnlocked ? null : (
                    <div style={{ position: 'absolute', inset: 0, width: `${xpPct}%`, background: 'color-mix(in srgb,var(--accent) 18%,var(--bg-3))', transition: 'width .4s ease', pointerEvents: 'none', zIndex: 0 }} />
                  )}
                  <div style={{ position: 'relative', zIndex: 1, fontSize: 26, width: 34, textAlign: 'center' }}>{isUnlocked ? p.icon : '🔒'}</div>
                  <div style={{ position: 'relative', zIndex: 1, flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.2 }}>
                      {p.name}
                      <span className="pill" style={{ fontSize: 10, marginLeft: 6 }}>TIER {p.tier}</span>
                    </div>
                    <div className="muted" style={{ fontSize: 11, marginTop: 2, lineHeight: 1.3 }}>{p.desc}</div>
                    {!isUnlocked && (
                      <div className="muted" style={{ fontSize: 11, marginTop: 4, fontWeight: 600 }}>
                        {prog.xp || 0} / {p.xpRequired} Coop XP to unlock
                      </div>
                    )}
                  </div>
                  <div style={{ position: 'relative', zIndex: 1 }}>
                    {isEquipped ? <span className="xp-pill" style={{ fontSize: 11 }}>Equipped</span>
                      : isUnlocked ? <button className="btn sm ghost" style={{ fontSize: 12, padding: '6px 10px' }} onClick={() => equip(p.id)}>Equip</button>
                        : <span className="muted" style={{ fontSize: 11 }}>Locked</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div style={{ padding: 18, borderRadius: 12, background: 'var(--bg-3)', border: '1px solid var(--border)', textAlign: 'center' }}>
          <div style={{ fontSize: 28, marginBottom: 6 }}>🛡️</div>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>No class selected</div>
          <div className="muted" style={{ fontSize: 12, lineHeight: 1.4 }}>Pick a class above to start earning Coop XP and unlocking passives. Your equipped passive grants a team-wide stat bonus to the whole party during Coop battles.</div>
        </div>
      )}
    </>
  );
}
