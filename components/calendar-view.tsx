'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { dayKey, keyDayNum, keyLabel, monthGrid, parts, timeLabel, weekGrid } from '@/lib/dates';
import { EVENT_TYPE_LABELS, type EventType } from '@/lib/rules';
import { eventStyle } from '@/lib/theme';

export interface CalendarEvent {
  id: string;
  title: string;
  type: string;
  startsAt: string;
  endsAt: string;
  location: string | null;
  status: string;
  attendanceRequired: boolean;
  expected: number;
  present: number;
  recorded: boolean;
}

type View = 'month' | 'week' | 'agenda';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOUR_START = 8;
const HOUR_END = 23;

export function CalendarView({
  slug, tz, events, initialView = 'month', todayKey,
}: {
  slug: string;
  tz: string;
  events: CalendarEvent[];
  initialView?: View;
  todayKey: string;
}) {
  const [view, setView] = useState<View>(initialView);
  const [anchor, setAnchor] = useState(() => new Date(`${todayKey}T12:00:00Z`));
  const [chosen, setChosen] = useState(false);

  // Seven columns on a phone leaves ~50px per day, which cannot carry an event
  // title. Open on Agenda instead — unless the reader has already picked a view.
  useEffect(() => {
    if (chosen) return;
    if (window.innerWidth < 640) setView('agenda');
  }, [chosen]);

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const key = dayKey(e.startsAt, tz);
      const list = map.get(key);
      if (list) list.push(e);
      else map.set(key, [e]);
    }
    for (const list of map.values()) list.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    return map;
  }, [events, tz]);

  const step = (dir: -1 | 1) => {
    const next = new Date(anchor);
    if (view === 'month') next.setUTCMonth(next.getUTCMonth() + dir);
    else if (view === 'week') next.setUTCDate(next.getUTCDate() + dir * 7);
    else next.setUTCMonth(next.getUTCMonth() + dir);
    setAnchor(next);
  };

  const heading = view === 'week'
    ? (() => {
        const w = weekGrid(anchor, tz);
        return `${keyLabel(w[0])} – ${keyLabel(w[6], { month: 'short', day: 'numeric', year: 'numeric' })}`;
      })()
    : new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(anchor);

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div className="flex items-center gap-1">
          <button className="btn-ghost btn-sm" onClick={() => step(-1)} aria-label="Previous">←</button>
          <button className="btn-ghost btn-sm" onClick={() => step(1)} aria-label="Next">→</button>
          <button className="btn-secondary btn-sm ml-1" onClick={() => setAnchor(new Date(`${todayKey}T12:00:00Z`))}>
            Today
          </button>
          <h2 className="ml-3 text-sm font-semibold text-ink-900">{heading}</h2>
        </div>
        <div className="flex rounded-lg border border-line p-0.5" role="tablist">
          {(['month', 'week', 'agenda'] as const).map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              onClick={() => { setChosen(true); setView(v); }}
              className={`rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors ${
                view === v ? 'bg-brand text-white' : 'text-ink-500 hover:text-ink-900'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {view === 'month' ? <MonthView {...{ slug, tz, anchor, byDay, todayKey }} /> : null}
      {view === 'week' ? <WeekView {...{ slug, tz, anchor, byDay, todayKey }} /> : null}
      {view === 'agenda' ? <AgendaView {...{ slug, tz, events, todayKey }} /> : null}
    </div>
  );
}

interface GridProps {
  slug: string;
  tz: string;
  anchor: Date;
  byDay: Map<string, CalendarEvent[]>;
  todayKey: string;
}

function MonthView({ slug, tz, anchor, byDay, todayKey }: GridProps) {
  const days = monthGrid(anchor, tz);
  const month = anchor.getUTCMonth();

  return (
    <div>
      <div className="grid grid-cols-7 border-b border-line bg-canvas">
        {DAY_NAMES.map((d) => (
          <div key={d} className="px-2 py-2 text-center text-xs font-semibold text-ink-500">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((key, i) => {
          const inMonth = new Date(`${key}T12:00:00Z`).getUTCMonth() === month;
          const isToday = key === todayKey;
          const list = byDay.get(key) ?? [];
          return (
            <div
              key={key}
              className={`min-h-24 border-b border-r border-line p-1.5 ${i % 7 === 6 ? 'border-r-0' : ''} ${
                inMonth ? '' : 'bg-canvas/60'
              }`}
            >
              <div className="mb-1 flex justify-end">
                <span
                  className={`grid h-5 min-w-5 place-items-center rounded-full px-1 text-xs tabular-nums ${
                    isToday ? 'bg-brand font-semibold text-white' : inMonth ? 'text-ink-700' : 'text-ink-400'
                  }`}
                >
                  {keyDayNum(key)}
                </span>
              </div>
              <div className="flex flex-wrap gap-1 sm:block sm:space-y-1">
                {list.slice(0, 3).map((e) => <Chip key={e.id} slug={slug} tz={tz} event={e} />)}
                {list.length > 3 ? (
                  <p className="px-1 text-[11px] text-ink-400">+{list.length - 3}</p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekView({ slug, tz, anchor, byDay, todayKey }: GridProps) {
  const days = weekGrid(anchor, tz);
  const hours = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);
  const span = (HOUR_END - HOUR_START) * 60;

  return (
    <div className="overflow-x-auto">
      <div className="min-w-3xl">
        <div className="grid grid-cols-[3.5rem_repeat(7,1fr)] border-b border-line bg-canvas">
          <div />
          {days.map((key) => (
            <div key={key} className="px-2 py-2 text-center">
              <div className="text-xs font-semibold text-ink-500">{DAY_NAMES[new Date(`${key}T12:00:00Z`).getUTCDay()]}</div>
              <div className={`text-sm tabular-nums ${key === todayKey ? 'font-semibold text-brand' : 'text-ink-700'}`}>
                {keyDayNum(key)}
              </div>
            </div>
          ))}
        </div>

        <div className="relative grid grid-cols-[3.5rem_repeat(7,1fr)]">
          <div>
            {hours.map((h) => (
              <div key={h} className="h-12 border-b border-line-soft pr-2 text-right text-[11px] text-ink-400">
                {h % 12 === 0 ? 12 : h % 12}{h < 12 ? 'a' : 'p'}
              </div>
            ))}
          </div>
          {days.map((key) => (
            <div key={key} className="relative border-l border-line">
              {hours.map((h) => <div key={h} className="h-12 border-b border-line-soft" />)}
              {(byDay.get(key) ?? []).map((e) => {
                const s = parts(e.startsAt, tz);
                const en = parts(e.endsAt, tz);
                const top = ((s.hour * 60 + s.minute - HOUR_START * 60) / span) * 100;
                const height = Math.max(4, ((en.hour * 60 + en.minute - (s.hour * 60 + s.minute)) / span) * 100);
                if (top < 0 || top > 100) return null;
                return (
                  <Link
                    key={e.id}
                    href={`/c/${slug}/events/${e.id}`}
                    style={{ top: `${top}%`, height: `${height}%` }}
                    className={`absolute inset-x-1 overflow-hidden rounded-md px-1.5 py-1 text-[11px] leading-tight ${eventStyle(e.type).chip} ${
                      e.status === 'cancelled' ? 'line-through opacity-50' : ''
                    }`}
                  >
                    <span className="block truncate font-medium">{e.title}</span>
                    <span className="block truncate opacity-70">{timeLabel(e.startsAt, tz)}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AgendaView({
  slug, tz, events, todayKey,
}: { slug: string; tz: string; events: CalendarEvent[]; todayKey: string }) {
  const grouped = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of [...events].sort((a, b) => a.startsAt.localeCompare(b.startsAt))) {
      const key = dayKey(e.startsAt, tz);
      (map.get(key) ?? map.set(key, []).get(key)!).push(e);
    }
    return [...map.entries()];
  }, [events, tz]);

  if (grouped.length === 0) {
    return <p className="px-5 py-14 text-center text-sm text-ink-500">No events yet.</p>;
  }

  return (
    <ul className="divide-y divide-line">
      {grouped.map(([key, list]) => (
        <li key={key} className="flex gap-4 px-4 py-3">
          <div className="w-24 shrink-0 pt-0.5">
            <div className={`text-xs font-semibold ${key === todayKey ? 'text-brand' : 'text-ink-500'}`}>
              {key === todayKey ? 'Today' : keyLabel(key, { weekday: 'short' })}
            </div>
            <div className="text-sm text-ink-700">{keyLabel(key)}</div>
          </div>
          <ul className="min-w-0 flex-1 space-y-1.5">
            {list.map((e) => (
              <li key={e.id}>
                <Link
                  href={`/c/${slug}/events/${e.id}`}
                  className="flex flex-wrap items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-line-soft"
                >
                  <span className={`h-2 w-2 shrink-0 rounded-full ${eventStyle(e.type).dot}`} aria-hidden />
                  <span className={`text-sm font-medium text-ink-900 ${e.status === 'cancelled' ? 'line-through opacity-50' : ''}`}>
                    {e.title}
                  </span>
                  <span className="text-xs text-ink-400">{timeLabel(e.startsAt, tz)}</span>
                  {e.location ? <span className="text-xs text-ink-400">· {e.location}</span> : null}
                  <span className="ml-auto text-xs text-ink-400">
                    {e.recorded ? `${e.present}/${e.expected} present` : `${e.expected} expected`}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}

function Chip({ slug, tz, event }: { slug: string; tz: string; event: CalendarEvent }) {
  const label = `${event.title} · ${timeLabel(event.startsAt, tz)}${event.location ? ` · ${event.location}` : ''}`;
  const cancelled = event.status === 'cancelled';
  return (
    <Link href={`/c/${slug}/events/${event.id}`} title={label} aria-label={label}>
      {/* Phone: a dot, because 50px of column cannot hold a title honestly. */}
      <span
        className={`block h-1.5 w-1.5 rounded-full sm:hidden ${eventStyle(event.type).dot} ${
          cancelled ? 'opacity-40' : ''
        }`}
      />
      <span
        className={`hidden truncate rounded px-1.5 py-0.5 text-[11px] font-medium sm:block ${
          eventStyle(event.type).chip
        } ${cancelled ? 'line-through opacity-50' : ''}`}
      >
        {timeLabel(event.startsAt, tz).replace(':00', '')} {event.title}
      </span>
    </Link>
  );
}

export function TypeLegend() {
  return (
    <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5">
      {(Object.keys(EVENT_TYPE_LABELS) as EventType[]).map((t) => (
        <span key={t} className="flex items-center gap-1.5 text-xs text-ink-500">
          <span className={`h-2 w-2 rounded-full ${eventStyle(t).dot}`} aria-hidden />
          {EVENT_TYPE_LABELS[t]}
        </span>
      ))}
    </div>
  );
}
