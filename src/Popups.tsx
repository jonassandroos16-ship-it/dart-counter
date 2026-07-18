import { useEffect, useState } from 'react';

export function Toast({ msg }: { msg: string | null }) {
  return <div className={`toast${msg ? ' show' : ''}`}>{msg || ''}</div>;
}

export function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="modal-bg" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">{children}</div>
    </div>
  );
}

export function MilestonePopup({ emoji, title, sub, record, onDone }: { emoji: string; title: string; sub: string; record?: boolean; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 2500); return () => clearTimeout(t); }, [onDone]);
  return (
    <div className="milestone-bg" onClick={onDone}>
      <div className="milestone">
        <div className="ms-emoji">{emoji}</div>
        <div className="ms-title">{title}</div>
        <div className="ms-sub">{sub}</div>
        {record ? <div className="ms-record">★</div> : null}
      </div>
    </div>
  );
}

export function LevelUpPopup({ level, name, xpGained, reason, onDone }: { level: number; name: string; xpGained: number; reason: string; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 3000); return () => clearTimeout(t); }, [onDone]);
  return (
    <div className="levelup-bg" onClick={onDone}>
      <div className="levelup">
        <div className="lu-ring"><div className="lu-level">{level}</div></div>
        <div className="lu-title">Level Up!</div>
        <div className="lu-sub">{name} reached level {level}</div>
        <div className="lu-xp">+{xpGained} XP · {reason}</div>
      </div>
    </div>
  );
}

export function TitleUnlockPopup({ icon, name, player, desc, onDone }: { icon: string; name: string; player: string; desc: string; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 3500); return () => clearTimeout(t); }, [onDone]);
  return (
    <div className="levelup-bg" onClick={onDone}>
      <div className="levelup">
        <div className="lu-ring" style={{ borderColor: 'var(--accent)', background: 'color-mix(in srgb,var(--accent) 15%,var(--bg-2))' }}>
          <div style={{ fontSize: 44 }}>{icon || '🏅'}</div>
        </div>
        <div className="lu-title">Title Unlocked!</div>
        <div className="lu-sub">{player} earned "{name}"</div>
        <div className="lu-sub" style={{ marginTop: 2, fontSize: 12 }}>{desc}</div>
      </div>
    </div>
  );
}

export function KillPopup({ killer, victim, onDone }: { killer: string; victim: string; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 2200); return () => clearTimeout(t); }, [onDone]);
  return (
    <div className="kill-bg" onClick={onDone}>
      <div className="kill">
        <div className="kill-emoji">💀</div>
        <div className="kill-title">ELIMINATED!</div>
        <div className="kill-sub"><b>{killer}</b> knocked out <b>{victim}</b></div>
      </div>
    </div>
  );
}

export function BadgeInfoPopup({ icon, name, desc, player, onDone }: { icon: string; name: string; desc: string; player?: string; onDone: () => void }) {
  return (
    <div className="levelup-bg" onClick={onDone}>
      <div className="levelup" onClick={(e) => e.stopPropagation()}>
        <div className="lu-ring" style={{ borderColor: 'var(--accent)', background: 'color-mix(in srgb,var(--accent) 15%,var(--bg-2))' }}>
          <div style={{ fontSize: 44 }}>{icon}</div>
        </div>
        <div className="lu-title">{name}</div>
        {player ? <div className="lu-sub">{player} earned this badge</div> : null}
        <div className="lu-sub" style={{ marginTop: 6, fontSize: 13, maxWidth: 280, textAlign: 'center' }}>{desc}</div>
        <button className="btn primary block" style={{ marginTop: 16 }} onClick={onDone}>Close</button>
      </div>
    </div>
  );
}

export interface PopupState {
  milestone: { emoji: string; title: string; sub: string; record?: boolean } | null;
  levelUp: { level: number; name: string; xpGained: number; reason: string } | null;
  titleUnlock: { icon: string; name: string; player: string; desc: string } | null;
  kill: { killer: string; victim: string } | null;
}

export function usePopupState(): PopupState & {
  setMilestone: (p: PopupState['milestone']) => void;
  setLevelUp: (p: PopupState['levelUp']) => void;
  setTitleUnlock: (p: PopupState['titleUnlock']) => void;
  setKill: (p: PopupState['kill']) => void;
} {
  const [milestone, setMilestone] = useState<PopupState['milestone']>(null);
  const [levelUp, setLevelUp] = useState<PopupState['levelUp']>(null);
  const [titleUnlock, setTitleUnlock] = useState<PopupState['titleUnlock']>(null);
  const [kill, setKill] = useState<PopupState['kill']>(null);
  return { milestone, setMilestone, levelUp, setLevelUp, titleUnlock, setTitleUnlock, kill, setKill };
}

export type PopupControls = Pick<ReturnType<typeof usePopupState>, 'setMilestone' | 'setLevelUp' | 'setTitleUnlock' | 'setKill'>;
