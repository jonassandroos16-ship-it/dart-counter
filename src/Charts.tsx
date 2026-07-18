import { useEffect, useMemo, useRef } from 'react';
import { DARTBOARD_NUMBERS } from './constants';

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// Canvas fillStyle can't parse var() or color-mix(), so resolve a CSS color to
// concrete [r,g,b] by letting the browser compute it on a hidden element.
function toRGB(cssVal: string): [number, number, number] {
  const probe = document.createElement('span');
  probe.style.color = cssVal;
  probe.style.display = 'none';
  document.body.appendChild(probe);
  const computed = getComputedStyle(probe).color;
  document.body.removeChild(probe);
  const m = computed.match(/\d+(?:\.\d+)?/g);
  return m ? [+m[0], +m[1], +m[2]] : [128, 128, 128];
}

function dartLabel(base: number, mult: number): string {
  if (base === 50) return 'Bull';
  if (base === 25) return '25';
  if (mult === 3) return 'T' + base;
  if (mult === 2) return 'D' + base;
  return String(base);
}

interface HitEntry { key: string; label: string; base: number; mult: number; hits: number; }

function dpiSetup(canvas: HTMLCanvasElement, h: number) {
  const ratio = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  canvas.width = w * ratio; canvas.height = h * ratio;
  const ctx = canvas.getContext('2d')!; ctx.scale(ratio, ratio);
  return { ctx, w, h };
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  if (h < r) r = h;
  ctx.beginPath(); ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, 0);
  ctx.arcTo(x, y + h, x, y, 0); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

export function LineChart({ labels, values }: { labels: string[]; values: number[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const h = 180; const { ctx, w } = dpiSetup(canvas, h);
    ctx.clearRect(0, 0, w, h);
    if (!values.length) { ctx.fillStyle = cssVar('--muted'); ctx.font = '13px system-ui'; ctx.textAlign = 'center'; ctx.fillText('No data yet', w / 2, h / 2); return; }
    const pad = { l: 34, r: 10, t: 12, b: 24 };
    const max = Math.max(60, ...values) * 1.1;
    const gx = (i: number) => pad.l + (w - pad.l - pad.r) * (values.length === 1 ? 0.5 : i / (values.length - 1));
    const gy = (v: number) => pad.t + (h - pad.t - pad.b) * (1 - v / max);
    ctx.strokeStyle = cssVar('--border'); ctx.lineWidth = 1; ctx.fillStyle = cssVar('--muted'); ctx.font = '10px system-ui';
    for (let i = 0; i <= 3; i++) { const val = max * i / 3; const y = gy(val); ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke(); ctx.textAlign = 'right'; ctx.fillText(String(Math.round(val)), pad.l - 6, y + 3); }
    const acc = cssVar('--accent');
    ctx.beginPath(); values.forEach((v, i) => { const x = gx(i), y = gy(v); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.lineTo(gx(values.length - 1), gy(0)); ctx.lineTo(gx(0), gy(0)); ctx.closePath();
    ctx.fillStyle = acc + '22'; ctx.fill();
    ctx.beginPath(); values.forEach((v, i) => { const x = gx(i), y = gy(v); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.strokeStyle = acc; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.stroke();
    values.forEach((v, i) => { const x = gx(i), y = gy(v); ctx.beginPath(); ctx.arc(x, y, 3, 0, 7); ctx.fillStyle = acc; ctx.fill(); });
    ctx.fillStyle = cssVar('--muted'); ctx.textAlign = 'center';
    const step = Math.ceil(labels.length / 6);
    labels.forEach((l, i) => { if (i % step === 0 || i === labels.length - 1) ctx.fillText(l, gx(i), h - 8); });
  }, [labels, values]);
  return <canvas ref={ref} height={180} />;
}

export function BarChart({ labels, values }: { labels: string[]; values: number[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const h = 170; const { ctx, w } = dpiSetup(canvas, h);
    ctx.clearRect(0, 0, w, h);
    const max = Math.max(1, ...values); const pad = { l: 10, r: 10, t: 12, b: 34 };
    const bw = (w - pad.l - pad.r) / labels.length; const acc = cssVar('--accent');
    values.forEach((v, i) => {
      const bh = (h - pad.t - pad.b) * (v / max); const x = pad.l + i * bw + 4; const y = h - pad.b - bh;
      ctx.fillStyle = acc; roundRect(ctx, x, y, bw - 8, bh, 4); ctx.fill();
      ctx.fillStyle = cssVar('--text'); ctx.font = 'bold 11px system-ui'; ctx.textAlign = 'center';
      if (v > 0) ctx.fillText(String(v), x + (bw - 8) / 2, y - 4);
      ctx.fillStyle = cssVar('--muted'); ctx.font = '9px system-ui';
      ctx.fillText(labels[i], x + (bw - 8) / 2, h - 12);
    });
  }, [labels, values]);
  return <canvas ref={ref} height={170} />;
}

function drawSegment(ctx: CanvasRenderingContext2D, cx: number, cy: number, rInner: number, rOuter: number, startAngle: number, endAngle: number, fillColor: string) {
  ctx.beginPath();
  ctx.arc(cx, cy, rOuter, startAngle, endAngle);
  ctx.arc(cx, cy, rInner, endAngle, startAngle, true);
  ctx.closePath();
  if (fillColor && fillColor.startsWith('var(')) { fillColor = cssVar(fillColor.match(/--[\w-]+/)![0]); }
  ctx.fillStyle = fillColor || cssVar('--bg-3'); ctx.fill();
}

export function DartboardHeatmap({ visits }: { visits: any[] }) {
  const ref = useRef<HTMLCanvasElement>(null);

  const { entries, colorFor } = useMemo(() => {
    const hitMap: Record<string, number> = {};
    visits.forEach(v => { (v.darts || []).forEach((d: any) => { const key = `${d.base || 0}-${d.mult || 1}`; hitMap[key] = (hitMap[key] || 0) + 1; }); });
    const maxHits = Math.max(1, ...Object.values(hitMap));
    const accent = toRGB(cssVar('--accent'));
    const bg3 = toRGB(cssVar('--bg-3'));
    const lerp = (a: number, b: number, t: number) => Math.round(a + (b - a) * t);
    // Ease the curve so low hit counts are still visibly tinted, not grey.
    const colorFor = (hits: number): string => {
      if (hits <= 0) return `rgb(${bg3[0]}, ${bg3[1]}, ${bg3[2]})`;
      const t = Math.min(1, hits / maxHits);
      const eased = Math.pow(t, 0.55);
      return `rgb(${lerp(bg3[0], accent[0], eased)}, ${lerp(bg3[1], accent[1], eased)}, ${lerp(bg3[2], accent[2], eased)})`;
    };
    const entries: HitEntry[] = Object.entries(hitMap)
      .map(([k, hits]) => { const [base, mult] = k.split('-').map(Number); return { key: k, label: dartLabel(base, mult), base, mult, hits }; })
      .filter(e => e.hits > 0)
      .sort((a, b) => b.hits - a.hits || a.label.localeCompare(b.label));
    return { entries, colorFor };
  }, [visits]);

  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const size = 340; const ratio = window.devicePixelRatio || 1;
    canvas.width = size * ratio; canvas.height = size * ratio; canvas.style.width = '100%';
    const ctx = canvas.getContext('2d')!; ctx.scale(ratio, ratio);
    ctx.clearRect(0, 0, size, size);
    const cx = size / 2, cy = size / 2, R = size / 2 - 20;
    const rBull = R * 0.05, rBullOuter = R * 0.11, rTripleInner = R * 0.58, rTripleOuter = R * 0.63, rDoubleInner = R * 0.94, rDoubleOuter = R * 1.0;
    const segAngle = (Math.PI * 2) / 20;
    for (let i = 0; i < 20; i++) {
      const num = DARTBOARD_NUMBERS[i];
      const startAngle = -Math.PI / 2 - segAngle / 2 + i * segAngle;
      const endAngle = startAngle + segAngle;
      const singleHits = (hitMapFor(visits, `${num}-1`));
      const doubleHits = (hitMapFor(visits, `${num}-2`));
      const tripleHits = (hitMapFor(visits, `${num}-3`));
      drawSegment(ctx, cx, cy, rBullOuter, rTripleInner, startAngle, endAngle, colorFor(singleHits));
      drawSegment(ctx, cx, cy, rTripleOuter, rDoubleInner, startAngle, endAngle, colorFor(singleHits));
      drawSegment(ctx, cx, cy, rTripleInner, rTripleOuter, startAngle, endAngle, colorFor(tripleHits));
      drawSegment(ctx, cx, cy, rDoubleInner, rDoubleOuter, startAngle, endAngle, colorFor(doubleHits));
      const labelAngle = startAngle + segAngle / 2;
      const lx = cx + Math.cos(labelAngle) * R * 1.1, ly = cy + Math.sin(labelAngle) * R * 1.1;
      ctx.fillStyle = cssVar('--muted'); ctx.font = 'bold 12px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(num), lx, ly);
    }
    ctx.beginPath(); ctx.arc(cx, cy, rBullOuter, 0, Math.PI * 2); ctx.fillStyle = colorFor(hitMapFor(visits, '25-1')); ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, rBull, 0, Math.PI * 2); ctx.fillStyle = colorFor(hitMapFor(visits, '50-1')); ctx.fill();
    ctx.strokeStyle = cssVar('--border'); ctx.lineWidth = 0.5;
    for (let i = 0; i < 20; i++) { const a = -Math.PI / 2 - segAngle / 2 + i * segAngle; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * rBullOuter, cy + Math.sin(a) * rBullOuter); ctx.lineTo(cx + Math.cos(a) * rDoubleOuter, cy + Math.sin(a) * rDoubleOuter); ctx.stroke(); }
    [rBull, rBullOuter, rTripleInner, rTripleOuter, rDoubleInner, rDoubleOuter].forEach(r => { ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke(); });
  }, [visits, colorFor]);

  return (
    <>
      <canvas ref={ref} height={340} />
      {entries.length > 0 ? (
        <div style={{ marginTop: 14 }}>
          <div className="muted small" style={{ marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>Hit counts · most first</div>
          <div className="row wrap" style={{ gap: 6 }}>
            {entries.map(e => (
              <span key={e.key} className="pill" style={{ background: 'var(--bg-3)', borderLeft: `3px solid ${colorFor(e.hits)}`, paddingLeft: 8 }}>
                <b>{e.label}</b> <span className="muted">{e.hits}</span>
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className="muted small" style={{ marginTop: 12 }}>No hits recorded yet.</div>
      )}
    </>
  );
}

function hitMapFor(visits: any[], key: string): number {
  let n = 0;
  visits.forEach(v => { (v.darts || []).forEach((d: any) => { if (`${d.base || 0}-${d.mult || 1}` === key) n++; }); });
  return n;
}
