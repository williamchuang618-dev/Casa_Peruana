'use client';

import { useActionState, useState } from 'react';
import { clearRoster, resetAttendance, resetEboardRoles } from '@/app/actions/settings';
import { Alert, SubmitButton } from './form-bits';
import type { ActionState } from '@/lib/action-state';

/**
 * Three named resets rather than one ambiguous "reset" button. Each says
 * exactly what it destroys, each is typed-to-confirm, and none is reachable
 * without president-or-owner rights.
 */
export function ResetPanel({ slug, clubName }: { slug: string; clubName: string }) {
  return (
    <div className="space-y-3">
      <ResetCard
        title="Reset E-board roles"
        body="Every officer — VP, Secretary, Treasurer and any custom role — goes back to General Member. Nobody is removed, no attendance changes, and ownership stays with the owner. Use this at officer turnover, then reassign roles from each member's profile."
        confirmLabel="Type RESET to confirm"
        placeholder="RESET"
        cta="Reset roles"
        action={resetEboardRoles.bind(null, slug)}
      />

      <ResetCard
        title="Reset this semester's attendance"
        body="Deletes every mark recorded for this semester's events and sets those events back to Scheduled. Members and events stay. Because standings are computed rather than counted, everyone's absence count returns to zero the moment this runs."
        confirmLabel="Type RESET to confirm"
        placeholder="RESET"
        cta="Clear attendance"
        action={resetAttendance.bind(null, slug)}
      />

      <ResetCard
        title="Clear the roster"
        body="Removes every member and their entire attendance history, permanently. You and the club owner are kept so you cannot lock yourself out. Events survive, but their expected-attendee lists will be empty. This cannot be undone."
        confirmLabel={`Type the club name — ${clubName} — to confirm`}
        placeholder={clubName}
        cta="Clear roster"
        action={clearRoster.bind(null, slug)}
        danger
      />
    </div>
  );
}

function ResetCard({
  title, body, confirmLabel, placeholder, cta, action, danger = false,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  placeholder: string;
  cta: string;
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  danger?: boolean;
}) {
  const [state, run] = useActionState(action, null);
  const [open, setOpen] = useState(false);

  return (
    <div className={`rounded-xl border p-4 ${danger ? 'border-[#d9a49e] bg-[#f9e3e1]/35' : 'border-line bg-canvas'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-ink-900">{title}</h3>
          <p className="mt-1 text-xs leading-relaxed text-ink-500">{body}</p>
        </div>
        {!open ? (
          <button
            className={danger ? 'btn-danger btn-sm' : 'btn-secondary btn-sm'}
            onClick={() => setOpen(true)}
          >
            {cta}
          </button>
        ) : null}
      </div>

      {state?.ok || state?.error ? <div className="mt-3"><Alert state={state} /></div> : null}

      {open ? (
        <form action={run} className="mt-3 flex flex-wrap items-end gap-2 border-t border-line pt-3">
          <label className="min-w-56 flex-1">
            <span className="label">{confirmLabel}</span>
            <input className="input" name="confirm" placeholder={placeholder} required autoFocus autoComplete="off" />
          </label>
          <SubmitButton className={danger ? 'btn-danger' : 'btn-primary'} pendingLabel="Working…">{cta}</SubmitButton>
          <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
        </form>
      ) : null}
    </div>
  );
}
