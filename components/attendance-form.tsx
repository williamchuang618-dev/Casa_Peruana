'use client';

import { useActionState, useMemo, useState } from 'react';
import { saveAttendance } from '@/app/actions/attendance';
import { ATTENDANCE_LABELS, ATTENDANCE_STATUSES, type AttendanceStatus } from '@/lib/rules';
import { ATTENDANCE_ACTIVE } from '@/lib/theme';
import { Alert, SubmitButton } from './form-bits';
import { Avatar, StatusBadge } from './ui';

export interface RollCallRow {
  membershipId: string;
  displayName: string;
  email: string;
  role: string;
  memberStatus: string;
  absencePoints: number;
  current: AttendanceStatus | null;
  pendingExcuse: string | null;
  photo: string | null;
}

export function AttendanceForm({
  slug, eventId, rows, maxAbsences, readOnly = false,
}: {
  slug: string;
  eventId: string;
  rows: RollCallRow[];
  maxAbsences: number;
  readOnly?: boolean;
}) {
  const [state, action] = useActionState(saveAttendance.bind(null, slug, eventId), null);
  const [marks, setMarks] = useState<Record<string, AttendanceStatus | ''>>(() =>
    Object.fromEntries(rows.map((r) => [r.membershipId, r.current ?? ''])),
  );
  const [query, setQuery] = useState('');

  const tally = useMemo(() => {
    const t: Record<string, number> = { present: 0, late: 0, excused: 0, absent: 0, blank: 0 };
    for (const r of rows) {
      const v = marks[r.membershipId];
      t[v || 'blank'] += 1;
    }
    return t;
  }, [marks, rows]);

  const shown = rows.filter((r) =>
    `${r.displayName} ${r.email}`.toLowerCase().includes(query.trim().toLowerCase()),
  );

  const setAll = (value: AttendanceStatus | '') =>
    setMarks(Object.fromEntries(rows.map((r) => [r.membershipId, value])));

  const fillBlanks = (value: AttendanceStatus) =>
    setMarks((m) => Object.fromEntries(rows.map((r) => [r.membershipId, m[r.membershipId] || value])));

  return (
    <form action={action} className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold text-ink-900">
            {readOnly ? 'Attendance' : 'Take attendance'}
          </h2>
          <span className="text-xs text-ink-400">{rows.length} expected</span>
        </div>
        {!readOnly ? (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn-secondary btn-sm" onClick={() => fillBlanks('present')}>
              Mark remaining present
            </button>
            <button type="button" className="btn-secondary btn-sm" onClick={() => setAll('present')}>
              All present
            </button>
            <button type="button" className="btn-ghost btn-sm" onClick={() => setAll('')}>
              Clear
            </button>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3 border-b border-line bg-canvas px-4 py-2.5 text-xs">
        <Tally label="Present" count={tally.present} tone="text-[#2f5540]" />
        <Tally label="Late" count={tally.late} tone="text-[#275a67]" />
        <Tally label="Excused" count={tally.excused} tone="text-[#4f4180]" />
        <Tally label="Absent" count={tally.absent} tone="text-[#78201a]" />
        <Tally label="Not recorded" count={tally.blank} tone="text-ink-400" />
        <input
          className="ml-auto w-48 rounded-lg border border-line bg-surface px-2.5 py-1 text-xs outline-none focus:border-brand"
          placeholder="Search members…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <ul className="divide-y divide-line">
        {shown.map((r) => (
          <li key={r.membershipId} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
            <Avatar name={r.displayName} photo={r.photo} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate text-sm font-medium text-ink-900">{r.displayName}</span>
                {r.memberStatus !== 'active' ? <StatusBadge status={r.memberStatus} /> : null}
                <span className="text-xs text-ink-400 tabular-nums">
                  {r.absencePoints} / {maxAbsences}
                </span>
              </div>
              {r.pendingExcuse ? (
                <p className="mt-0.5 truncate text-xs text-[#4f4180]">
                  Excuse requested: {r.pendingExcuse}
                </p>
              ) : null}
            </div>

            <input type="hidden" name={`status:${r.membershipId}`} value={marks[r.membershipId] ?? ''} />

            <div className="flex gap-1" role="group" aria-label={`Attendance for ${r.displayName}`}>
              {ATTENDANCE_STATUSES.map((s) => {
                const active = marks[r.membershipId] === s;
                return (
                  <button
                    key={s}
                    type="button"
                    disabled={readOnly}
                    aria-pressed={active}
                    onClick={() =>
                      setMarks((m) => ({ ...m, [r.membershipId]: m[r.membershipId] === s ? '' : s }))
                    }
                    className={`btn btn-sm ring-1 disabled:opacity-100 ${
                      active ? ATTENDANCE_ACTIVE[s] : 'bg-surface text-ink-500 ring-line hover:bg-line-soft'
                    }`}
                  >
                    {ATTENDANCE_LABELS[s]}
                  </button>
                );
              })}
            </div>
          </li>
        ))}
        {shown.length === 0 ? (
          <li className="px-4 py-8 text-center text-sm text-ink-400">No members match “{query}”.</li>
        ) : null}
      </ul>

      {!readOnly ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-canvas px-4 py-3">
          <div className="min-w-0 flex-1"><Alert state={state} /></div>
          <p className="text-xs text-ink-400">
            Leaving someone blank keeps them “not recorded” — it never counts as an absence.
          </p>
          <SubmitButton pendingLabel="Saving…">Save attendance</SubmitButton>
        </div>
      ) : null}
    </form>
  );
}

function Tally({ label, count, tone }: { label: string; count: number; tone: string }) {
  return (
    <span className={`font-medium ${tone}`}>
      <span className="tabular-nums">{count}</span> <span className="font-normal text-ink-500">{label}</span>
    </span>
  );
}
