/**
 * Every date is formatted through an explicit club timezone rather than the
 * runtime's, so a server component and a client component render the same
 * string and React never reports a hydration mismatch.
 */

const cache = new Map<string, Intl.DateTimeFormat>();

function fmt(tz: string, opts: Intl.DateTimeFormatOptions, locale = 'en-US'): Intl.DateTimeFormat {
  const key = `${locale}|${tz}|${JSON.stringify(opts)}`;
  let f = cache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(locale, { timeZone: tz, ...opts });
    cache.set(key, f);
  }
  return f;
}

export const toDate = (d: Date | string): Date => (d instanceof Date ? d : new Date(d));

/** 'YYYY-MM-DD' as seen in the club's timezone — the key every calendar bucket uses. */
export function dayKey(d: Date | string, tz: string): string {
  return fmt(tz, { year: 'numeric', month: '2-digit', day: '2-digit' }, 'en-CA').format(toDate(d));
}

export function parts(d: Date | string, tz: string) {
  const p = fmt(tz, {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }, 'en-CA').formatToParts(toDate(d));
  const get = (t: string) => Number(p.find((x) => x.type === t)?.value ?? 0);
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute') };
}

export const timeLabel = (d: Date | string, tz: string) =>
  fmt(tz, { hour: 'numeric', minute: '2-digit' }).format(toDate(d));

export const dateLabel = (d: Date | string, tz: string) =>
  fmt(tz, { month: 'short', day: 'numeric', year: 'numeric' }).format(toDate(d));

export const dateLabelLong = (d: Date | string, tz: string) =>
  fmt(tz, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(toDate(d));

export const dateTimeLabel = (d: Date | string, tz: string) =>
  `${dateLabel(d, tz)} · ${timeLabel(d, tz)}`;

export const monthLabel = (d: Date | string, tz: string) =>
  fmt(tz, { month: 'long', year: 'numeric' }).format(toDate(d));

export function relativeLabel(d: Date | string, tz: string, now = new Date()): string {
  const diffDays = Math.round(
    (Date.parse(`${dayKey(d, tz)}T00:00:00Z`) - Date.parse(`${dayKey(now, tz)}T00:00:00Z`)) / 86_400_000,
  );
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays > 1 && diffDays < 7) return `In ${diffDays} days`;
  if (diffDays < -1 && diffDays > -7) return `${Math.abs(diffDays)} days ago`;
  return dateLabel(d, tz);
}

/** Grid of 6x7 day keys covering the month that contains `anchor`, Sunday-first. */
export function monthGrid(anchor: Date, tz: string): string[] {
  const { year, month } = parts(anchor, tz);
  const first = new Date(Date.UTC(year, month - 1, 1));
  const start = new Date(first);
  start.setUTCDate(1 - first.getUTCDay());
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

export function weekGrid(anchor: Date, tz: string): string[] {
  const key = dayKey(anchor, tz);
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(d);
    x.setUTCDate(d.getUTCDate() + i);
    return x.toISOString().slice(0, 10);
  });
}

export const keyLabel = (key: string, opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }) =>
  new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', ...opts }).format(new Date(`${key}T12:00:00Z`));

export const keyDayNum = (key: string) => Number(key.slice(8, 10));

/** Build a UTC instant from the wall-clock date+time an officer typed in club tz. */
export function fromLocalInput(dateStr: string, timeStr: string, tz: string): Date {
  const naive = Date.parse(`${dateStr}T${timeStr}:00Z`);
  // Discover the offset that tz had at roughly this moment, then correct for it.
  const guess = new Date(naive);
  const seen = parts(guess, tz);
  const seenUtc = Date.UTC(seen.year, seen.month - 1, seen.day, seen.hour, seen.minute);
  return new Date(naive - (seenUtc - naive));
}

/** Inverse of fromLocalInput — fills <input type="date"> / <input type="time"> values. */
export function toLocalInput(d: Date | string, tz: string): { date: string; time: string } {
  const p = parts(d, tz);
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${p.year}-${pad(p.month)}-${pad(p.day)}`,
    time: `${pad(p.hour)}:${pad(p.minute)}`,
  };
}
