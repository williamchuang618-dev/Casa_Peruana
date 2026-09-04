'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { createEvent } from '@/app/actions/events';
import { EVENT_TYPE_LABELS, EVENT_TYPES } from '@/lib/rules';
import { Alert, Field, SubmitButton } from './form-bits';

export interface PickerMember { id: string; displayName: string; email: string; role: string }
export interface PickerGroup { id: string; name: string; count: number }

export function CreateEventDialog({
  slug, members, groups, today, label = '+ Create Event', className = 'btn-primary',
  defaultDate,
}: {
  slug: string;
  members: PickerMember[];
  groups: PickerGroup[];
  today: string;
  label?: string;
  className?: string;
  defaultDate?: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(createEvent.bind(null, slug), null);
  const [scope, setScope] = useState<'all' | 'group' | 'specific'>('all');
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [repeat, setRepeat] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open]);

  const shown = members.filter((m) =>
    `${m.displayName} ${m.email}`.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <>
      <button className={className} onClick={() => setOpen(true)}>{label}</button>
      {!open ? null : (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-900/40 p-4 backdrop-blur-[2px]">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Create event"
            className="card my-8 w-full max-w-2xl shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h2 className="text-sm font-semibold text-ink-900">Create event</h2>
              <button ref={closeRef} className="btn-ghost btn-sm" onClick={() => setOpen(false)}>Close</button>
            </div>

            <form action={action} className="space-y-4 p-5">
              <Alert state={state} />

              <Field label="Event name">
                <input className="input" name="title" required autoFocus placeholder="General Meeting" />
              </Field>

              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Date">
                  <input className="input" type="date" name="date" required defaultValue={defaultDate ?? today} />
                </Field>
                <Field label="Start time">
                  <input className="input" type="time" name="startTime" defaultValue="19:00" required />
                </Field>
                <Field label="End time">
                  <input className="input" type="time" name="endTime" defaultValue="20:00" required />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Location">
                  <input className="input" name="location" placeholder="Student Center Room 204" />
                </Field>
                <Field label="Event type">
                  <select className="input" name="type" defaultValue="general_meeting">
                    {EVENT_TYPES.map((t) => (
                      <option key={t} value={t}>{EVENT_TYPE_LABELS[t]}</option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field label="Description / notes">
                <textarea className="input min-h-20 resize-y" name="description" rows={2} />
              </Field>

              <label className="flex items-start gap-2.5 rounded-lg bg-canvas px-3 py-2.5">
                <input type="checkbox" name="attendanceRequired" defaultChecked className="mt-0.5 accent-[var(--color-brand)]" />
                <span className="text-sm">
                  <span className="font-medium text-ink-900">Attendance is required</span>
                  <span className="mt-0.5 block text-xs text-ink-500">
                    Optional events still take attendance, but absences never count against anyone.
                  </span>
                </span>
              </label>

              <label className="flex items-center gap-2.5 rounded-lg bg-canvas px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={repeat}
                  onChange={(e) => setRepeat(e.target.checked)}
                  className="accent-[var(--color-brand)]"
                />
                <span className="text-sm font-medium text-ink-900">Repeat weekly until</span>
                <input
                  className="input ml-auto w-44"
                  type="date"
                  name={repeat ? 'repeatUntil' : 'repeatUntilDisabled'}
                  disabled={!repeat}
                />
              </label>

              <fieldset>
                <legend className="label">Expected to attend</legend>
                <div className="mb-2 flex flex-wrap gap-2">
                  {([
                    ['all', `All members (${members.length})`],
                    ['group', 'A group'],
                    ['specific', 'Specific members'],
                  ] as const).map(([value, text]) => (
                    <label
                      key={value}
                      className={`btn btn-sm cursor-pointer ring-1 ${
                        scope === value ? 'bg-brand text-white ring-brand' : 'bg-surface text-ink-700 ring-line hover:bg-line-soft'
                      }`}
                    >
                      <input
                        type="radio"
                        name="scope"
                        value={value}
                        checked={scope === value}
                        onChange={() => setScope(value)}
                        className="sr-only"
                      />
                      {text}
                    </label>
                  ))}
                </div>

                {scope === 'group' ? (
                  groups.length ? (
                    <select className="input" name="groupId" defaultValue={groups[0]?.id} required>
                      {groups.map((g) => (
                        <option key={g.id} value={g.id}>{g.name} ({g.count})</option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-xs text-ink-400">No groups yet — create one in Settings.</p>
                  )
                ) : null}

                {scope === 'specific' ? (
                  <div className="rounded-lg border border-line">
                    <input
                      className="w-full rounded-t-lg border-b border-line px-3 py-2 text-sm outline-none"
                      placeholder="Search members…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                    <div className="max-h-44 overflow-y-auto p-1">
                      {shown.map((m) => (
                        <label key={m.id} className="flex cursor-pointer items-center gap-2.5 rounded px-2 py-1.5 text-sm hover:bg-line-soft">
                          <input
                            type="checkbox"
                            name="memberIds"
                            value={m.id}
                            checked={picked.includes(m.id)}
                            onChange={(e) =>
                              setPicked((p) => (e.target.checked ? [...p, m.id] : p.filter((x) => x !== m.id)))
                            }
                            className="accent-[var(--color-brand)]"
                          />
                          <span className="flex-1 truncate">{m.displayName}</span>
                          <span className="truncate text-xs text-ink-400">{m.email}</span>
                        </label>
                      ))}
                      {shown.length === 0 ? <p className="px-2 py-3 text-xs text-ink-400">No matches.</p> : null}
                    </div>
                    <p className="border-t border-line px-3 py-1.5 text-xs text-ink-400">{picked.length} selected</p>
                  </div>
                ) : null}
              </fieldset>

              <div className="flex justify-end gap-2 border-t border-line pt-4">
                <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
                <SubmitButton pendingLabel="Creating…">Create event</SubmitButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
