'use client';

import { useActionState, useMemo, useState } from 'react';
import { activateSemester, createGroup, deleteGroup, startSemester, updateClub, updateRules } from '@/app/actions/settings';
import { computeStanding, STATUS_LABELS, type AttendanceRules, type AttendanceStatus, type StandingEntry } from '@/lib/rules';
import { MEMBER_STATUS_STYLE } from '@/lib/theme';
import { Alert, Field, SubmitButton } from './form-bits';

const TIMEZONES = [
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Phoenix', 'America/Anchorage', 'Pacific/Honolulu', 'Europe/London', 'Europe/Madrid',
];

export function ClubProfileForm({
  slug, values,
}: { slug: string; values: { name: string; university: string; logoEmoji: string; timezone: string } }) {
  const [state, action] = useActionState(updateClub.bind(null, slug), null);
  return (
    <form action={action} className="space-y-4">
      <div className="flex gap-3">
        <div className="w-20">
          <Field label="Icon">
            <input className="input text-center text-lg" name="logoEmoji" defaultValue={values.logoEmoji} maxLength={2} />
          </Field>
        </div>
        <div className="flex-1">
          <Field label="Club name"><input className="input" name="name" defaultValue={values.name} required /></Field>
        </div>
      </div>
      <Field label="University"><input className="input" name="university" defaultValue={values.university} /></Field>
      <Field label="Time zone" hint="All event times in this club are entered and shown in this zone.">
        <select className="input" name="timezone" defaultValue={values.timezone}>
          {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz.replace('_', ' ')}</option>)}
        </select>
      </Field>
      <Alert state={state} />
      <SubmitButton className="btn-secondary" pendingLabel="Saving…">Save profile</SubmitButton>
    </form>
  );
}

/**
 * The rules form previews its own consequences. Because the engine is pure, the
 * same function the server uses can run here as you type — so an officer sees
 * exactly which absence count triggers which status before saving.
 */
export function RulesForm({
  slug, rules, semesterName,
}: { slug: string; rules: AttendanceRules; semesterName: string | null }) {
  const [state, action] = useActionState(updateRules.bind(null, slug), null);
  const [draft, setDraft] = useState({
    maxAbsencePoints: rules.maxAbsencePoints,
    warnAtPoints: rules.warnAtPoints,
    pointsLate: rules.pointsLate,
    pointsExcused: rules.pointsExcused,
    pointsAbsent: rules.pointsAbsent,
    minAttendancePct: Math.round(rules.minAttendancePct * 100),
    excusedCap: rules.excusedCap,
  });

  const preview = useMemo(() => {
    const live: AttendanceRules = {
      ...rules,
      maxAbsencePoints: draft.maxAbsencePoints,
      warnAtPoints: draft.warnAtPoints,
      pointsLate: draft.pointsLate,
      pointsExcused: draft.pointsExcused,
      pointsAbsent: draft.pointsAbsent,
      minAttendancePct: draft.minAttendancePct / 100,
      excusedCap: draft.excusedCap,
    };
    const entry = (record: AttendanceStatus): StandingEntry => ({
      eventId: Math.random().toString(36), eventStatus: 'completed',
      attendanceRequired: true, attendanceTakenAt: new Date(), record,
    });
    const steps = Math.max(4, Math.ceil(draft.maxAbsencePoints) + 1);
    return Array.from({ length: steps }, (_, absences) =>
      ({ absences, status: computeStanding(Array.from({ length: absences }, () => entry('absent')), live).status }));
  }, [draft, rules]);

  const num = (key: keyof typeof draft) => ({
    value: String(draft[key] ?? ''),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setDraft((d) => ({ ...d, [key]: e.target.value === '' ? 0 : Number(e.target.value) })),
  });

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="scope" value="club" />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Maximum absences before review" hint="The removal threshold.">
          <input className="input" type="number" name="maxAbsencePoints" min={0.5} step={0.5} required {...num('maxAbsencePoints')} />
        </Field>
        <Field label="Show a warning starting at" hint="0 disables the early warning.">
          <input className="input" type="number" name="warnAtPoints" min={0} step={0.5} required {...num('warnAtPoints')} />
        </Field>
      </div>

      <fieldset className="rounded-lg border border-line p-4">
        <legend className="px-1 text-xs font-medium text-ink-700">Each mark is worth</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Late counts as">
            <input className="input" type="number" name="pointsLate" min={0} step={0.25} {...num('pointsLate')} />
          </Field>
          <Field label="Excused counts as">
            <input className="input" type="number" name="pointsExcused" min={0} step={0.25} {...num('pointsExcused')} />
          </Field>
          <Field label="Absent counts as">
            <input className="input" type="number" name="pointsAbsent" min={0} step={0.25} {...num('pointsAbsent')} />
          </Field>
        </div>
        <input type="hidden" name="pointsPresent" value={rules.pointsPresent} />
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Minimum attendance %" hint="0 turns this rule off. Excused events are excluded.">
          <input className="input" type="number" name="minAttendancePct" min={0} max={100} step={5} {...num('minAttendancePct')} />
        </Field>
        <Field label="Excused absence cap" hint="Blank = unlimited. Excuses beyond this count as absences.">
          <input
            className="input"
            type="number"
            name="excusedCap"
            min={0}
            value={draft.excusedCap ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, excusedCap: e.target.value === '' ? null : Number(e.target.value) }))}
          />
        </Field>
      </div>

      <div className="rounded-lg bg-canvas p-4">
        <p className="mb-2 text-xs font-medium text-ink-700">With these rules, a member becomes:</p>
        <div className="flex flex-wrap gap-2">
          {preview.map((p) => (
            <span key={p.absences} className={`badge ${MEMBER_STATUS_STYLE[p.status]}`}>
              {p.absences} absence{p.absences === 1 ? '' : 's'} → {STATUS_LABELS[p.status]}
            </span>
          ))}
        </div>
        <p className="mt-2 text-xs text-ink-400">
          Saving recalculates every member in {semesterName ?? 'the club'} immediately — nobody keeps a stale badge.
        </p>
      </div>

      <Alert state={state} />
      <SubmitButton pendingLabel="Recalculating…">Save rules</SubmitButton>
    </form>
  );
}

export function SemesterPanel({
  slug, semesters, activeId,
}: {
  slug: string;
  semesters: Array<{ id: string; name: string; startsOn: string; endsOn: string; events: number }>;
  activeId: string | null;
}) {
  const [state, action] = useActionState(startSemester.bind(null, slug), null);
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-4">
      <ul className="divide-y divide-line">
        {semesters.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center gap-3 py-2.5">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-ink-900">{s.name}</span>
                {s.id === activeId ? (
                  <span className="badge bg-[#eaf1ea] text-[#2f5540] ring-1 ring-[#355c42]/15">Active</span>
                ) : null}
              </div>
              <p className="text-xs text-ink-400">{s.startsOn} – {s.endsOn} · {s.events} events</p>
            </div>
            {s.id !== activeId ? (
              <form action={activateSemester.bind(null, slug, s.id)}>
                <SubmitButton className="btn-secondary btn-sm" pendingLabel="…">Make active</SubmitButton>
              </form>
            ) : null}
          </li>
        ))}
      </ul>

      {open ? (
        <form action={action} className="space-y-3 rounded-lg border border-line p-4">
          <p className="text-xs text-ink-500">
            Starting a new semester freezes the current one&apos;s rules onto it and gives everyone a clean
            absence count. Past semesters stay readable.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Name"><input className="input" name="name" placeholder="Spring 2027" required /></Field>
            <Field label="Starts"><input className="input" type="date" name="startsOn" required /></Field>
            <Field label="Ends"><input className="input" type="date" name="endsOn" required /></Field>
          </div>
          <Alert state={state} />
          <div className="flex gap-2">
            <SubmitButton pendingLabel="Starting…">Start semester</SubmitButton>
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </form>
      ) : (
        <button className="btn-secondary btn-sm" onClick={() => setOpen(true)}>+ Start a new semester</button>
      )}
    </div>
  );
}

export function GroupPanel({
  slug, groups, members,
}: {
  slug: string;
  groups: Array<{ id: string; name: string; count: number }>;
  members: Array<{ id: string; displayName: string }>;
}) {
  const [state, action] = useActionState(createGroup.bind(null, slug), null);
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-4">
      {groups.length ? (
        <ul className="divide-y divide-line">
          {groups.map((g) => (
            <li key={g.id} className="flex items-center gap-3 py-2.5">
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink-900">{g.name}</span>
              <span className="text-xs text-ink-400">{g.count} members</span>
              <form action={deleteGroup.bind(null, slug, g.id)}>
                <SubmitButton className="btn-ghost btn-sm text-[#8d2820]" pendingLabel="…">Delete</SubmitButton>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-400">No groups yet. Groups let you invite a committee to an event in one click.</p>
      )}

      {open ? (
        <form action={action} className="space-y-3 rounded-lg border border-line p-4">
          <Field label="Group name"><input className="input" name="name" placeholder="E-board" required /></Field>
          <div className="max-h-48 overflow-y-auto rounded-lg border border-line p-1">
            {members.map((m) => (
              <label key={m.id} className="flex cursor-pointer items-center gap-2.5 rounded px-2 py-1.5 text-sm hover:bg-line-soft">
                <input type="checkbox" name="memberIds" value={m.id} className="accent-[var(--color-brand)]" />
                {m.displayName}
              </label>
            ))}
          </div>
          <Alert state={state} />
          <div className="flex gap-2">
            <SubmitButton pendingLabel="Creating…">Create group</SubmitButton>
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </form>
      ) : (
        <button className="btn-secondary btn-sm" onClick={() => setOpen(true)}>+ New group</button>
      )}
    </div>
  );
}
