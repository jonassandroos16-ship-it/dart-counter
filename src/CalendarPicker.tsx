import { useState } from 'react';
import { fmtDateLong } from './store';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTHS_LONG = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function startOfDay(d: Date): Date {
  const x = new Date(d); x.setHours(0, 0, 0, 0); return x;
}
function startOfWeek(d: Date): Date {
  const x = startOfDay(d); const day = (x.getDay() + 6) % 7; x.setDate(x.getDate() - day); return x;
}
function startOfMonth(d: Date): Date { return new Date(d.getFullYear(), d.getMonth(), 1); }
function startOfYear(d: Date): Date { return new Date(d.getFullYear(), 0, 1); }
function iso(d: Date): string { return d.toISOString(); }

export interface DateFilter { start: string; end: string; period: 'Daily' | 'Weekly' | 'Monthly' | 'Yearly'; }

export function filterThisWeek(ref: Date): DateFilter {
  const s = startOfWeek(ref);
  return { start: iso(s), end: iso(new Date(s.getTime() + 7 * 86400000)), period: 'Daily' };
}
export function filterThisMonth(ref: Date): DateFilter {
  const s = startOfMonth(ref);
  return { start: iso(s), end: iso(new Date(s.getFullYear(), s.getMonth() + 1, 1)), period: 'Weekly' };
}
export function filterThisYear(ref: Date): DateFilter {
  const s = startOfYear(ref);
  return { start: iso(s), end: iso(new Date(s.getFullYear() + 1, 0, 1)), period: 'Monthly' };
}
export function filterAllTime(): DateFilter {
  return { start: iso(new Date(2000, 0, 1)), end: iso(new Date(2100, 0, 1)), period: 'Monthly' };
}

export function describeFilter(ref: Date, period: string): string {
  if (period === 'Daily') return fmtDateLong(ref);
  if (period === 'Weekly') {
    const s = startOfWeek(ref); const e = new Date(s); e.setDate(e.getDate() + 6);
    return `${s.getDate()} ${MONTHS[s.getMonth()]} – ${e.getDate()} ${MONTHS[e.getMonth()]} ${e.getFullYear()}`;
  }
  if (period === 'Monthly') return `${MONTHS_LONG[ref.getMonth()]} ${ref.getFullYear()}`;
  if (period === 'Yearly') return String(ref.getFullYear());
  return '';
}

export function CalendarPicker({ value, onChange }: { value: Date; onChange: (d: Date) => void }) {
  const [view, setView] = useState(() => new Date(value));

  const renderYears = () => {
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 9 }, (_, i) => currentYear - 4 + i);
    return (
      <div className="cal-grid cal-years">
        {years.map(y => (
          <button key={y} className={`cal-cell${y === value.getFullYear() ? ' on' : ''}`} onClick={() => { onChange(new Date(y, 0, 1)); }}>
            {y}
          </button>
        ))}
      </div>
    );
  };

  const renderMonths = () => {
    const year = view.getFullYear();
    const selectedMonth = value.getMonth();
    return (
      <div className="cal-grid cal-months">
        {MONTHS_LONG.map((m, i) => (
          <button key={m} className={`cal-cell${i === selectedMonth && year === value.getFullYear() ? ' on' : ''}`}
            onClick={() => { onChange(new Date(year, i, 1)); }}>
            {m}
          </button>
        ))}
      </div>
    );
  };

  const renderDays = () => {
    const year = view.getFullYear();
    const month = view.getMonth();
    const first = new Date(year, month, 1);
    const startOffset = (first.getDay() + 6) % 7; // Monday-first
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (number | null)[] = [
      ...Array(startOffset).fill(null),
      ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];
    while (cells.length % 7 !== 0) cells.push(null);

    const isSel = (d: number) =>
      d === value.getDate() && month === value.getMonth() && year === value.getFullYear();
    const inWeek = (d: number) => {
      if (!d) return false;
      const cellDate = new Date(year, month, d);
      const ws = startOfWeek(value).getTime();
      return cellDate.getTime() >= ws && cellDate.getTime() < ws + 7 * 86400000;
    };
    const isToday = (d: number) => {
      if (!d) return false;
      const cellDate = new Date(year, month, d);
      const now = new Date();
      return cellDate.getDate() === now.getDate() && cellDate.getMonth() === now.getMonth() && cellDate.getFullYear() === now.getFullYear();
    };

    return (
      <>
        <div className="cal-dow"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div>
        <div className="cal-grid cal-days">
          {cells.map((d, i) => (
            <button key={i} disabled={!d} className={`cal-cell${d ? '' : ' empty'}${isSel(d!) ? ' on' : ''}${inWeek(d!) ? ' in-week' : ''}${isToday(d!) ? '' : ''}`}
              onClick={() => { onChange(new Date(year, month, d!)); }}>
              {d || ''}
            </button>
          ))}
        </div>
      </>
    );
  };

  const year = view.getFullYear();
  const month = view.getMonth();
  const level = view.getFullYear() === value.getFullYear() ? (view.getMonth() === value.getMonth() ? 'days' : 'months') : 'months';

  return (
    <div className="calendar-picker">
      <div className="cal-nav">
        <button className="cal-arrow" onClick={() => setView(new Date(year - 1, 0, 1))}>‹</button>
        <div className="cal-title">
          {level === 'days' ? `${MONTHS_LONG[month]} ${year}` : year}
        </div>
        <button className="cal-arrow" onClick={() => setView(new Date(year + 1, 0, 1))}>›</button>
      </div>
      {level === 'days' && (
        <div className="cal-nav" style={{ marginBottom: 8 }}>
          <button className="cal-arrow" onClick={() => setView(new Date(year, month - 1, 1))}>‹</button>
          <div className="cal-title">{MONTHS[month]}</div>
          <button className="cal-arrow" onClick={() => setView(new Date(year, month + 1, 1))}>›</button>
        </div>
      )}
      {level === 'days' ? renderDays() : level === 'months' ? renderMonths() : renderYears()}
      {/* year view handled via renderYears when level === 'years' */}
      {level === 'months' && (
        <div className="cal-dow" style={{ marginTop: 8 }}><span>Year</span></div>
      )}
    </div>
  );
}
