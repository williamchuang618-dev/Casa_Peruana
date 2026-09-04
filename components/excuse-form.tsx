'use client';

import { useActionState, useState } from 'react';
import { requestExcuse } from '@/app/actions/attendance';
import { Alert, SubmitButton } from './form-bits';

export function ExcuseRequestForm({ slug, eventId }: { slug: string; eventId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(requestExcuse.bind(null, slug, eventId), null);

  if (!open) {
    return (
      <button className="btn-ghost btn-sm mt-2 px-0" onClick={() => setOpen(true)}>
        Request to be excused
      </button>
    );
  }

  return (
    <form action={action} className="mt-3 space-y-2">
      <textarea
        className="input min-h-16 text-sm"
        name="reason"
        rows={2}
        required
        placeholder="Why can't you make it? An officer reviews this."
      />
      <Alert state={state} />
      <div className="flex gap-2">
        <SubmitButton className="btn-secondary btn-sm" pendingLabel="Sending…">Submit request</SubmitButton>
        <button type="button" className="btn-ghost btn-sm" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}
