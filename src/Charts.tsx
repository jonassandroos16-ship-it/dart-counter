import { useEffect, useRef } from 'react';
import { DARTBOARD_NUMBERS } from './constants';

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

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
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const size = 340; const ratio = window.devicePixelRatio || 1;
    canvas.width = size * ratio; canvas.height = size * ratio; canvas.style.width = '100%';
    const ctx = canvas.getContext('2d')!; ctx.scale(ratio, ratio);
    ctx.clearRect(0, 0, size, size);
    const cx = size / 2, cy = size / 2, R = size / 2 - 20;
    const rBull = R * 0.05, rBullOuter = R * 0.11, rTripleInner = R * 0.58, rTripleOuter = R * 0.63, rDoubleInner = R * 0.94, rDoubleOuter = R * 1.0;
    const segAngle = (Math.PI * 2) / 20;
    const hitMap: Record<string, number> = {};
    visits.forEach(v => { (v.darts || []).forEach((d: any) => { const key = `${d.base || 0}-${d.mult || 1}`; hitMap[key] = (hitMap[key] || 0) + 1; }); });
    const maxHits = Math.max(1, ...Object.values(hitMap));
    const heatColor = (intensity: number): string | null => {
      if (intensity <= 0) return null;
      const t = Math.min(1, intensity / maxHits);
      if (t < 0.25) return `color-mix(in srgb, var(--accent) ${t * 4 * 25}%, var(--bg-3))`;
      if (t < 0.5) return `color-mix(in srgb, var(--accent) ${t * 2 * 50}%, var(--bg-3))`;
      if (t < 0.75) return `color-mix(in srgb, var(--accent) ${t * 100}%, var(--bg-3))`;
      return 'var(--accent)';
    };
    for (let i = 0; i < 20; i++) {
      const num = DARTBOARD_NUMBERS[i];
      const startAngle = -Math.PI / 2 - segAngle / 2 + i * segAngle;
      const endAngle = startAngle + segAngle;
      const singleHits = hitMap[`${num}-1`] || 0, doubleHits = hitMap[`${num}-2`] || 0, tripleHits = hitMap[`${num}-3`] || 0;
      drawSegment(ctx, cx, cy, rBullOuter, rTripleInner, startAngle, endAngle, heatColor(singleHits) || cssVar('--bg-3'));
      drawSegment(ctx, cx, cy, rTripleOuter, rDoubleInner, startAngle, endAngle, heatColor(singleHits) || cssVar('--bg-3'));
      drawSegment(ctx, cx, cy, rTripleInner, rTripleOuter, startAngle, endAngle, heatColor(tripleHits) || cssVar('--bg-3'));
      drawSegment(ctx, cx, cy, rDoubleInner, rDoubleOuter, startAngle, endAngle, heatColor(doubleHits) || cssVar('--bg-3'));
      const labelAngle = startAngle + segAngle / 2;
      const lx = cx + Math.cos(labelAngle) * R * 1.1, ly = cy + Math.sin(labelAngle) * R * 1.1;
      ctx.fillStyle = cssVar('--muted'); ctx.font = 'bold 12px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(num), lx, ly);
    }
    ctx.beginPath(); ctx.arc(cx, cy, rBullOuter, 0, Math.PI * 2); ctx.fillStyle = heatColor(hitMap['25-1'] || 0) || cssVar('--bg-3'); ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, rBull, 0, Math.PI * 2); ctx.fillStyle = heatColor(hitMap['50-1'] || 0) || cssVar('--bg-3'); ctx.fill();
    ctx.strokeStyle = cssVar('--border'); ctx.lineWidth = 0.5;
    for (let i = 0; i < 20; i++) { const a = -Math.PI / 2 - segAngle / 2 + i * segAngle; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * rBullOuter, cy + Math.sin(a) * rBullOuter); ctx.lineTo(cx + Math.cos(a) * rDoubleOuter, cy + Math.sin(a) * rDoubleOuter); ctx.stroke(); }
    [rBull, rBullOuter, rTripleInner, rTripleOuter, rDoubleInner, rDoubleOuter].forEach(r => { ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke(); });
  }, [visits]);
  return <canvas ref={ref} height={340} />;
}
