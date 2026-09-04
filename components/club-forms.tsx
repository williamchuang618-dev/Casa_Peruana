'use client';

import { useActionState, useState } from 'react';
import { createClub, joinClub } from '@/app/actions/auth';
import { Alert, Field, SubmitButton } from './form-bits';

const TIMEZONES = [
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Phoenix', 'America/Anchorage', 'Pacific/Honolulu', 'Europe/London', 'Europe/Madrid',
];

export function CreateClubForm() {
  const [state, action] = useActionState(createClub, null);
  const [emoji, setEmoji] = useState('🎯');

  return (
    <form action={action} className="space-y-4">
      <Alert state={state} />
      <div className="flex gap-3">
        <div className="w-20">
          <Field label="Icon">
            <input
              className="input text-center text-lg"
              name="logoEmoji"
              value={emoji}
              onChange={(e) => setEmoji(e.target.value.slice(0, 2))}
              maxLength={2}
            />
          </Field>
        </div>
        <div className="flex-1">
          <Field label="Club name">
            <input className="input" name="name" required placeholder="Finance Club" />
          </Field>
        </div>
      </div>
      <Field label="University" hint="Optional.">
        <input className="input" name="university" placeholder="Boston University" />
      </Field>
      <Field label="Time zone" hint="Every event time in this club is shown in this zone.">
        <select className="input" name="timezone" defaultValue="America/New_York">
          {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz.replace('_', ' ')}</option>)}
        </select>
      </Field>
      <SubmitButton className="btn-primary w-full" pendingLabel="Creating…">Create club</SubmitButton>
    </form>
  );
}

export function JoinClubForm() {
  const [state, action] = useActionState(joinClub, null);
  return (
    <form action={action} className="space-y-4">
      <Alert state={state} />
      <Field label="Join code" hint="Ask an E-board member for your club's code.">
        <input
          className="input font-mono uppercase tracking-widest"
          name="joinCode"
          maxLength={6}
          required
          placeholder="AB3XK9"
        />
      </Field>
      <SubmitButton className="btn-secondary w-full" pendingLabel="Joining…">Join a club</SubmitButton>
    </form>
  );
}
