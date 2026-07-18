import { useState } from 'react';

export type Period = 'Overall' | 'Daily' | 'Weekly' | 'Monthly' | 'Yearly';

export interface DateFilter {
  start: string; // inclusive ISO
  end: string;   // exclusive ISO
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function startOfDay(d: Date): Date {
  const x = new Date(d); x.setHours(0, 0, 0, 0); return x;
}
function startOfWeek(d: Date): Date {
  const x = startOfDay(d); const day = (x.getDay() + 6) % 7; x.setDate(x.getDate() - day); return x;
}
function startOfMonth(d: Date): Date { return new Date(d.getFullYear(), d.getMonth(), 1); }
function startOfYear(d: Date): Date { return new Date(d.getFullYear(), 0, 1); }
function iso(d: Date): string { return d.toISOString(); }

export function filterForPeriod(period: Period, ref: Date): DateFilter | null {
  if (period === 'Overall') return null;
  if (period === 'Daily') {
    const s = startOfDay(ref);
    const e = new Date(s); e.setDate(e.getDate() + 1);
    return { start: iso(s), end: iso(e) };
  }
  if (period === 'Weekly') {
    const s = startOfWeek(ref);
    const e = new Date(s); e.setDate(e.getDate() + 7);
    return { start: iso(s), end: iso(e) };
  }
  if (period === 'Monthly') {
    const s = startOfMonth(ref);
    const e = new Date(s); e.setMonth(e.getMonth() + 1);
    return { start: iso(s), end: iso(e) };
  }
  // Yearly
  const s = startOfYear(ref);
  const e = new Date(s); e.setFullYear(e.getFullYear() + 1);
  return { start: iso(s), end: iso(e) };
}

export function describeFilter(period: Period, ref: Date): string {
  if (period === 'Daily') return ref.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  if (period === 'Weekly') {
    const s = startOfWeek(ref); const e = new Date(s); e.setDate(e.getDate() + 6);
    return `${s.getDate()} ${MONTHS[s.getMonth()]} – ${e.getDate()} ${MONTHS[e.getMonth()]} ${e.getFullYear()}`;
  }
  if (period === 'Monthly') return `${MONTHS_LONG[ref.getMonth()]} ${ref.getFullYear()}`;
  if (period === 'Yearly') return String(ref.getFullYear());
  return 'All time';
}

interface Props {
  period: Exclude<Period, 'Overall'>;
  value: Date;
  onChange: (d: Date) => void;
}

export function CalendarPicker({ period, value, onChange }: Props) {
  const [view, setView] = useState(() => new Date(value));

  if (period === 'Yearly') {
    const currentYear = new Date().getFullYear();
    const years: number[] = [];
    for (let y = currentYear; y >= currentYear - 10; y--) years.push(y);
    return (
      <div className="calendar-picker">
        <div className="cal-grid cal-years">
          {years.map(y => (
            <button key={y} className={`cal-cell${y === value.getFullYear() ? ' on' : ''}`} onClick={() => { onChange(new Date(y, 0, 1)); }}>
              {y}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (period === 'Monthly') {
    const year = view.getFullYear();
    const selectedYear = value.getFullYear();
    const selectedMonth = value.getMonth();
    return (
      <div className="calendar-picker">
        <div className="cal-nav">
          <button className="cal-arrow" onClick={() => setView(new Date(year - 1, 0, 1))}>‹</button>
          <span className="cal-title">{year}</span>
          <button className="cal-arrow" onClick={() => setView(new Date(year + 1, 0, 1))}>›</button>
        </div>
        <div className="cal-grid cal-months">
          {MONTHS.map((m, i) => (
            <button key={m}
              className={`cal-cell${year === selectedYear && i === selectedMonth ? ' on' : ''}`}
              onClick={() => { onChange(new Date(year, i, 1)); }}>
              {m}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Daily or Weekly — month grid
  const year = view.getFullYear();
  const month = view.getMonth();
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const isDailySelected = (d: number) => period === 'Daily' &&
    d === value.getDate() && month === value.getMonth() && year === value.getFullYear();
  const isWeeklySelected = (d: number) => {
    if (period !== 'Weekly') return false;
    const cellDate = new Date(year, month, d);
    return startOfWeek(cellDate).getTime() === startOfWeek(value).getTime();
  };
  const isWeeklyInSelected = (d: number) => {
    if (period !== 'Weekly') return false;
    const cellDate = new Date(year, month, d);
    return startOfWeek(cellDate).getTime() === startOfWeek(value).getTime();
  };

  return (
    <div className="calendar-picker">
      <div className="cal-nav">
        <button className="cal-arrow" onClick={() => setView(new Date(year, month - 1, 1))}>‹</button>
        <span className="cal-title">{MONTHS_LONG[month]} {year}</span>
        <button className="cal-arrow" onClick={() => setView(new Date(year, month + 1, 1))}>›</button>
      </div>
      <div className="cal-dow">{DOW.map((d, i) => <span key={i}>{d}</span>)}</div>
      <div className="cal-grid cal-days">
        {cells.map((d, i) => {
          if (d == null) return <span key={i} className="cal-cell empty" />;
          const on = isDailySelected(d) || isWeeklySelected(d);
          const inWeek = isWeeklyInSelected(d);
          return (
            <button key={i} className={`cal-cell${on ? ' on' : ''}${inWeek && !on ? ' in-week' : ''}`}
              onClick={() => { onChange(new Date(year, month, d)); }}>
              {d}
            </button>
          );
        })}
      </div>
    </div>
  );
}
