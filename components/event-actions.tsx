'use client';

import { useActionState, useState } from 'react';
import { deleteEvent, setEventStatus, updateEvent } from '@/app/actions/events';
import { decideExcuse } from '@/app/actions/attendance';
import { EVENT_TYPE_LABELS, EVENT_TYPES } from '@/lib/rules';
import { Alert, Field, SubmitButton } from './form-bits';

export interface EventFormValues {
  title: string;
  type: string;
  description: string;
  location: string;
  date: string;
  startTime: string;
  endTime: string;
  attendanceRequired: boolean;
}

export function EventActions({
  slug, eventId, status, values, canEdit, canDelete,
}: {
  slug: string;
  eventId: string;
  status: string;
  values: EventFormValues;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  if (!canEdit) return null;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-secondary btn-sm" onClick={() => setEditing(true)}>Edit event</button>

        {status !== 'completed' ? (
          <form action={setEventStatus.bind(null, slug, eventId, 'completed')}>
            <SubmitButton className="btn-secondary btn-sm" pendingLabel="…">Mark completed</SubmitButton>
          </form>
        ) : (
          <form action={setEventStatus.bind(null, slug, eventId, 'scheduled')}>
            <SubmitButton className="btn-ghost btn-sm" pendingLabel="…">Reopen</SubmitButton>
          </form>
        )}

        {status !== 'cancelled' ? (
          <form action={setEventStatus.bind(null, slug, eventId, 'cancelled')}>
            <SubmitButton className="btn-ghost btn-sm" pendingLabel="…">Cancel event</SubmitButton>
          </form>
        ) : null}

        {canDelete ? (
          confirming ? (
            <form action={deleteEvent.bind(null, slug, eventId)} className="flex items-center gap-2">
              <span className="text-xs text-[#78201a]">Delete permanently?</span>
              <SubmitButton className="btn-danger btn-sm" pendingLabel="Deleting…">Yes, delete</SubmitButton>
              <button type="button" className="btn-ghost btn-sm" onClick={() => setConfirming(false)}>No</button>
            </form>
          ) : (
            <button className="btn-ghost btn-sm !text-[#e2938a] hover:!text-[#f6c3bc]" onClick={() => setConfirming(true)}>Delete</button>
          )
        ) : null}
      </div>

      {editing ? (
        <EditDialog slug={slug} eventId={eventId} values={values} onClose={() => setEditing(false)} />
      ) : null}
    </>
  );
}

function EditDialog({
  slug, eventId, values, onClose,
}: { slug: string; eventId: string; values: EventFormValues; onClose: () => void }) {
  const [state, action] = useActionState(updateEvent.bind(null, slug, eventId), null);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-900/40 p-4 backdrop-blur-[2px]">
      <div role="dialog" aria-modal="true" aria-label="Edit event" className="card my-8 w-full max-w-xl shadow-xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-sm font-semibold text-ink-900">Edit event</h2>
          <button className="btn-ghost btn-sm" onClick={onClose}>Close</button>
        </div>
        <form action={action} className="space-y-4 p-5">
          <Alert state={state} />
          <Field label="Event name">
            <input className="input" name="title" defaultValue={values.title} required />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Date">
              <input className="input" type="date" name="date" defaultValue={values.date} required />
            </Field>
            <Field label="Start time">
              <input className="input" type="time" name="startTime" defaultValue={values.startTime} required />
            </Field>
            <Field label="End time">
              <input className="input" type="time" name="endTime" defaultValue={values.endTime} required />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Location">
              <input className="input" name="location" defaultValue={values.location} />
            </Field>
            <Field label="Event type">
              <select className="input" name="type" defaultValue={values.type}>
                {EVENT_TYPES.map((t) => <option key={t} value={t}>{EVENT_TYPE_LABELS[t]}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Description / notes">
            <textarea className="input min-h-20 resize-y" name="description" defaultValue={values.description} rows={2} />
          </Field>
          <label className="flex items-center gap-2.5 rounded-lg bg-canvas px-3 py-2.5 text-sm">
            <input
              type="checkbox"
              name="attendanceRequired"
              defaultChecked={values.attendanceRequired}
              className="accent-[var(--color-brand)]"
            />
            <span className="font-medium text-ink-900">Attendance is required</span>
          </label>
          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>
          </div>
        </form>
      </div>
    </div>
  );
}

export function ExcuseDecision({ slug, requestId }: { slug: string; requestId: string }) {
  return (
    <div className="flex gap-1.5">
      <form action={decideExcuse.bind(null, slug, requestId, 'approved')}>
        <SubmitButton className="btn-secondary btn-sm" pendingLabel="…">Approve</SubmitButton>
      </form>
      <form action={decideExcuse.bind(null, slug, requestId, 'denied')}>
        <SubmitButton className="btn-ghost btn-sm" pendingLabel="…">Deny</SubmitButton>
      </form>
    </div>
  );
}
