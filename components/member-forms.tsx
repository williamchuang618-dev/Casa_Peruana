'use client';

import { useActionState, useState } from 'react';
import { addMember, confirmRemoval, importMembers, reinstateMember, updateMember } from '@/app/actions/members';
import { assignableRoles, ROLE_LABELS } from '@/lib/permissions';
import { Alert, Field, SubmitButton } from './form-bits';

export function AddMemberPanel({ slug, actorRole }: { slug: string; actorRole: string }) {
  const [tab, setTab] = useState<'one' | 'import'>('one');
  const [addState, addAction] = useActionState(addMember.bind(null, slug), null);
  const [importState, importAction] = useActionState(importMembers.bind(null, slug), null);
  const roles = assignableRoles(actorRole);

  return (
    <section className="card card-pad">
      <div className="mb-4 flex gap-1.5">
        {(['one', 'import'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`btn btn-sm ring-1 ${tab === t ? 'bg-brand text-white ring-brand' : 'bg-surface text-ink-700 ring-line hover:bg-line-soft'}`}
          >
            {t === 'one' ? 'Add one member' : 'Paste a roster'}
          </button>
        ))}
      </div>

      {tab === 'one' ? (
        <form action={addAction} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
          <Field label="Full name"><input className="input" name="displayName" required /></Field>
          <Field label="Email"><input className="input" name="email" type="email" required /></Field>
          <Field label="Role">
            <select className="input" name="role" defaultValue="member">
              {roles.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </Field>
          <SubmitButton pendingLabel="Adding…">Add</SubmitButton>
          <div className="sm:col-span-4"><Alert state={addState} /></div>
        </form>
      ) : (
        <form action={importAction} className="space-y-3">
          <Field
            label="Paste rows from a spreadsheet"
            hint="One per line: Name, email — an optional third column sets the role. Existing emails are skipped."
          >
            <textarea
              className="input min-h-32 font-mono text-xs"
              name="csv"
              placeholder={'Sarah Chen, sarah@bu.edu\nMichael Lee, michael@bu.edu, secretary'}
            />
          </Field>
          <Alert state={importState} />
          <SubmitButton pendingLabel="Importing…">Import members</SubmitButton>
        </form>
      )}
    </section>
  );
}

export function EditMemberForm({
  slug, membershipId, actorRole, values,
}: {
  slug: string;
  membershipId: string;
  actorRole: string;
  values: { displayName: string; role: string; notes: string };
}) {
  const [state, action] = useActionState(updateMember.bind(null, slug, membershipId), null);
  const roles = assignableRoles(actorRole);

  return (
    <form action={action} className="space-y-3">
      <Field label="Name"><input className="input" name="displayName" defaultValue={values.displayName} /></Field>
      {roles.length > 0 ? (
        <Field label="Role">
          <select className="input" name="role" defaultValue={values.role}>
            {values.role === 'owner' ? <option value="owner">Owner</option> : null}
            {roles.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
        </Field>
      ) : null}
      <Field label="Notes" hint="Only officers can see this.">
        <textarea className="input min-h-16" name="notes" defaultValue={values.notes} rows={2} />
      </Field>
      <Alert state={state} />
      <SubmitButton className="btn-secondary" pendingLabel="Saving…">Save member</SubmitButton>
    </form>
  );
}

export function RemovalPanel({
  slug, membershipId, memberName, isRemoved, absenceSummary,
}: {
  slug: string;
  membershipId: string;
  memberName: string;
  isRemoved: boolean;
  absenceSummary: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [removeState, removeAction] = useActionState(confirmRemoval.bind(null, slug, membershipId), null);
  const [backState, backAction] = useActionState(reinstateMember.bind(null, slug, membershipId), null);

  if (isRemoved) {
    return (
      <div className="card card-pad border-[#cfc6b6]">
        <h2 className="text-sm font-semibold text-ink-900">Removed from active membership</h2>
        <p className="mt-1 text-sm text-ink-500">
          Their attendance history is kept. Reinstating hands them back to the rules engine — if their
          absences still exceed the limit, they will be flagged again immediately.
        </p>
        <form action={backAction} className="mt-3 space-y-2">
          <input className="input" name="reason" placeholder="Reason for reinstating (optional)" />
          <Alert state={backState} />
          <SubmitButton className="btn-secondary" pendingLabel="Reinstating…">Reinstate {memberName}</SubmitButton>
        </form>
      </div>
    );
  }

  return (
    <div className="card card-pad border-[#d9a49e]/70 bg-[#f9e3e1]/30">
      <h2 className="text-sm font-semibold text-ink-900">Removal required</h2>
      <p className="mt-1 text-sm text-ink-700">{absenceSummary}</p>
      <p className="mt-2 text-xs text-ink-500">
        Nothing has been removed automatically. Review the attendance history below first — if a record was
        entered by mistake, fix it on the event and this flag clears itself.
      </p>
      {confirming ? (
        <form action={removeAction} className="mt-3 space-y-2">
          <input className="input" name="reason" placeholder="Reason (recorded in the audit log)" />
          <Alert state={removeState} />
          <div className="flex gap-2">
            <SubmitButton className="btn-danger" pendingLabel="Removing…">Confirm removal</SubmitButton>
            <button type="button" className="btn-secondary" onClick={() => setConfirming(false)}>Cancel</button>
          </div>
        </form>
      ) : (
        <button className="btn-danger btn-sm mt-3" onClick={() => setConfirming(true)}>
          Confirm removal of {memberName}
        </button>
      )}
    </div>
  );
}
