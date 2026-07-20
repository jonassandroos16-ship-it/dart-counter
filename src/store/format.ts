export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export const todayKey = (d: Date = new Date()) => d.toISOString().slice(0, 10);
export const initials = (n: string) => (n || '?').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();

// European (en-GB) date formatting helpers — DD/MM/YYYY, 24-hour time.
const LOCALE = 'en-GB';
export const fmtDate = (d: Date | string) => new Date(d).toLocaleDateString(LOCALE);
export const fmtTime = (d: Date | string) => new Date(d).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' });
export const fmtDateTime = (d: Date | string) => new Date(d).toLocaleString(LOCALE);
export const fmtDateLong = (d: Date | string) => new Date(d).toLocaleDateString(LOCALE, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
