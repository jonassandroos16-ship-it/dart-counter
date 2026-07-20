import { useMemo, useState } from 'react';
import type { Player, Settings } from '../types';
import { initials } from '../store';
import {
  partyMaxHpFor,
  partyArmorFor,
  partyPowerFor,
  computePartyPassiveBonus,
  getCoopClass,
  COOP_CLASSES,
  COOP_PASSIVES,
} from './engine';
import type { CoopClassId, CoopPassiveId } from './types';

export interface CoopSetupProps {
  players: Player[];
  settings: Settings;
  onStart: (playerIds: string[]) => void;
  onBack: () => void;
}

// Player selection screen for the Co-op Campaign. The party's combined HP,
// armor and power are computed live from the selected players' attributes
// so the player can see how their team composition affects the upcoming
// battle. Armor and power are averaged (sum / playerCount) so adding more
// players can't push them above the configured caps.
export function CoopSetupView({ players, settings, onStart, onBack }: CoopSetupProps) {
  const [picked, setPicked] = useState<string[]>(players.length ? [players[0].id] : []);

  const selected = useMemo(
    () => picked.map(id => players.find(p => p.id === id)).filter(Boolean) as Player[],
    [picked, players],
  );

  const partyHp = useMemo(() => partyMaxHpFor(selected, settings), [selected, settings]);
  const partyArmor = useMemo(() => partyArmorFor(selected, settings), [selected, settings]);
  const partyPower = useMemo(() => partyPowerFor(selected, settings), [selected, settings]);
  const passiveBonus = useMemo(() => computePartyPassiveBonus(selected), [selected]);

  // Distinct classes represented in the selected party, in canonical order.
  const partyClasses = useMemo(() => {
    const ids = new Set<CoopClassId>();
    for (const p of selected) {
      if (p.coopProgress?.classId) ids.add(p.coopProgress.classId);
    }
    return COOP_CLASSES.filter(c => ids.has(c.id));
  }, [selected]);

  // Distinct equipped passives across the selected party, in canonical order.
  const partyPassives = useMemo(() => {
    const ids = new Set<CoopPassiveId>();
    for (const p of selected) {
      for (const pid of p.coopProgress?.equippedPassives || []) ids.add(pid);
    }
    return COOP_PASSIVES.filter(p => ids.has(p.id));
  }, [selected]);

  return (
    <div className="view-scroll">
      <div className="row between" style={{ marginBottom: 12 }}>
        <button className="btn ghost sm" onClick={onBack}>← Back</button>
        <h2 style={{ margin: 0 }}>Co-op Campaign</h2>
        <span style={{ width: 64 }} />
      </div>
      <div className="card">
        <span style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>Select your party (1–4 players)</span>
        {!players.length && <div className="muted small">Add players first in the Players tab.</div>}
        <div className="row wrap" style={{ gap: 8, marginBottom: 12 }}>
          {players.map(p => {
            const on = picked.includes(p.id);
            const cls = getCoopClass(p.coopProgress?.classId);
            return (
              <button key={p.id} className="pill" style={{ background: on ? p.color : 'var(--bg-3)', color: on ? '#0b0e13' : 'var(--text)' }}
                onClick={() => setPicked(on ? picked.filter(x => x !== p.id) : picked.length >= 4 ? picked : [...picked, p.id])}>
                <span className="avatar" style={{ width: 20, height: 20, fontSize: 10, background: on ? 'rgba(0,0,0,.2)' : p.color }}>{initials(p.name)}</span>{p.name}
                {cls && <span style={{ marginLeft: 4, fontSize: 14, lineHeight: 1 }} title={cls.name}>{cls.icon}</span>}
              </button>
            );
          })}
        </div>
        <div className="card" style={{ padding: 10, marginBottom: 12, background: 'var(--bg-3)' }}>
          <div className="muted small" style={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>Party preview</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <div>
              <div className="muted small">Party HP</div>
              <div style={{ fontWeight: 900, fontSize: 18, color: '#fca5a5' }}>{partyHp}</div>
            </div>
            <div>
              <div className="muted small">Armor (avg)</div>
              <div style={{ fontWeight: 900, fontSize: 18 }}>{Math.round(partyArmor)}</div>
            </div>
            <div>
              <div className="muted small">Power (avg)</div>
              <div style={{ fontWeight: 900, fontSize: 18 }}>{Math.round(partyPower)}</div>
            </div>
          </div>
          <div className="muted small" style={{ marginTop: 6, fontStyle: 'italic' }}>
            HP is the total of all players' health. Armor & power are averaged so adding more players can't push them above the cap.
          </div>
        </div>
        <div className="card" style={{ padding: 10, marginBottom: 12, background: 'var(--bg-3)' }}>
          <div className="muted small" style={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>Party composition</div>

          <div style={{ marginBottom: 8 }}>
            <div className="muted small" style={{ marginBottom: 4 }}>Classes</div>
            {!partyClasses.length && <div className="muted small" style={{ fontStyle: 'italic' }}>No classes selected — pick players who have chosen a Coop class.</div>}
            <div className="row wrap" style={{ gap: 6 }}>
              {partyClasses.map(c => (
                <span key={c.id} className="pill" style={{ background: 'var(--bg-2)', color: 'var(--text)', fontSize: 12 }}>
                  <span style={{ fontSize: 14 }}>{c.icon}</span> {c.name}
                </span>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 8 }}>
            <div className="muted small" style={{ marginBottom: 4 }}>Passives</div>
            {!partyPassives.length && <div className="muted small" style={{ fontStyle: 'italic' }}>No passives equipped.</div>}
            <div className="row wrap" style={{ gap: 6 }}>
              {partyPassives.map(p => (
                <span key={p.id} className="pill" style={{ background: 'var(--bg-2)', color: 'var(--text)', fontSize: 12 }} title={p.desc}>
                  <span style={{ fontSize: 14 }}>{p.icon}</span> {p.name}
                </span>
              ))}
            </div>
          </div>

          <div>
            <div className="muted small" style={{ marginBottom: 4 }}>Total buffs</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <div>
                <div className="muted small">Power</div>
                <div style={{ fontWeight: 900, fontSize: 16, color: '#fca5a5' }}>+{passiveBonus.power}</div>
              </div>
              <div>
                <div className="muted small">Max HP</div>
                <div style={{ fontWeight: 900, fontSize: 16, color: '#86efac' }}>+{passiveBonus.health}</div>
              </div>
              <div>
                <div className="muted small">Armor</div>
                <div style={{ fontWeight: 900, fontSize: 16, color: '#93c5fd' }}>+{passiveBonus.armor}</div>
              </div>
            </div>
            <div className="muted small" style={{ marginTop: 6, fontStyle: 'italic' }}>
              Each unique passive buffs the party once — duplicates don't stack.
            </div>
          </div>
        </div>
        <button className="btn primary block" disabled={!picked.length} onClick={() => picked.length && onStart(picked)}>
          Continue to chapter select
        </button>
      </div>
    </div>
  );
}
