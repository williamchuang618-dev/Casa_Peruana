'use client';

import { useActionState } from 'react';
import { selfCheckIn } from '@/app/actions/attendance';
import { Alert, SubmitButton } from './form-bits';

export function CheckInForm({ slug }: { slug: string }) {
  const [state, action] = useActionState(selfCheckIn.bind(null, slug), null);
  return (
    <form action={action} className="space-y-3">
      <input
        className="input text-center font-mono text-xl uppercase tracking-[0.3em]"
        name="code"
        maxLength={6}
        required
        autoFocus
        placeholder="XXXXXX"
        aria-label="Event check-in code"
      />
      <Alert state={state} />
      <SubmitButton className="btn-primary w-full" pendingLabel="Checking in…">Check in</SubmitButton>
    </form>
  );
}
