interface DartKeypadProps {
  mult: number;
  onSetMult: (m: number) => void;
  onAdd: (base: number, m: number, labelOverride?: string, isBull?: boolean) => void;
  onUndo: () => void;
  onEnter: () => void;
  canThrow: boolean;
  darts: { label: string; value: number }[];
}

export function DartKeypad({ mult, onSetMult, onAdd, onUndo, onEnter, canThrow, darts }: DartKeypadProps) {
  return (
    <div className="play-input">
      <div className="pad-card">
        <div className="mult">
          <button className={mult === 1 ? 'on' : ''} onClick={() => onSetMult(1)}>Single</button>
          <button className={mult === 2 ? 'on' : ''} onClick={() => onSetMult(2)}>Double</button>
          <button className={mult === 3 ? 'on' : ''} onClick={() => onSetMult(3)}>Triple</button>
        </div>
        <div className="keypad">
          {[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20].map(n => (
            <button key={n} disabled={!canThrow} className="key" onClick={() => onAdd(n, mult)}>{n}</button>
          ))}
          <button disabled={!canThrow} className="key" style={{ background: 'color-mix(in srgb,var(--accent) 20%,var(--bg-3))' }} onClick={() => onAdd(25, mult === 2 ? 2 : 1)}>25</button>
          <button disabled={!canThrow} className="key" style={{ gridColumn: 'span 2', background: 'color-mix(in srgb,var(--accent) 30%,var(--bg-3))' }} onClick={() => onAdd(50, 1, 'Bull', true)}>Bull<br /><small>50</small></button>
          <button disabled={!canThrow} className="key" style={{ gridColumn: 'span 2', color: 'var(--muted)' }} onClick={() => onAdd(0, 1, '0')}>Miss</button>
        </div>
        <div className="row" style={{ gap: 8, marginTop: 8 }}>
          <button className="btn block ghost" onClick={onUndo} disabled={!canThrow || !darts.length}>↶ Undo</button>
          <button className="btn block primary" onClick={onEnter} disabled={!canThrow || !darts.length}>End visit</button>
        </div>
      </div>
    </div>
  );
}
