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

export interface PopupState {
  milestone: { emoji: string; title: string; sub: string; record?: boolean } | null;
  levelUp: { level: number; name: string; xpGained: number; reason: string } | null;
  titleUnlock: { icon: string; name: string; player: string; desc: string } | null;
}

export function usePopupState(): PopupState & {
  setMilestone: (p: PopupState['milestone']) => void;
  setLevelUp: (p: PopupState['levelUp']) => void;
  setTitleUnlock: (p: PopupState['titleUnlock']) => void;
} {
  const [milestone, setMilestone] = useState<PopupState['milestone']>(null);
  const [levelUp, setLevelUp] = useState<PopupState['levelUp']>(null);
  const [titleUnlock, setTitleUnlock] = useState<PopupState['titleUnlock']>(null);
  return { milestone, setMilestone, levelUp, setLevelUp, titleUnlock, setTitleUnlock };
}

export type PopupControls = Pick<ReturnType<typeof usePopupState>, 'setMilestone' | 'setLevelUp' | 'setTitleUnlock'>;
