'use client';

import { useActionState } from 'react';
import { login, signup } from '@/app/actions/auth';
import { Alert, Field, SubmitButton } from './form-bits';

export function LoginForm() {
  const [state, action] = useActionState(login, null);
  return (
    <form action={action} className="space-y-4">
      <Alert state={state} />
      <Field label="Email">
        <input className="input" name="email" type="email" autoComplete="email" required autoFocus />
      </Field>
      <Field label="Password">
        <input className="input" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <SubmitButton className="btn-primary w-full" pendingLabel="Signing in…">Sign in</SubmitButton>
    </form>
  );
}

export function SignupForm() {
  const [state, action] = useActionState(signup, null);
  return (
    <form action={action} className="space-y-4">
      <Alert state={state} />
      <Field label="Full name">
        <input className="input" name="name" required autoFocus placeholder="Jordan Rivera" />
      </Field>
      <Field label="Email" hint="Use the email your club has on file so your roster entry links up automatically.">
        <input className="input" name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Password">
        <input className="input" name="password" type="password" autoComplete="new-password" required minLength={8} />
      </Field>
      <SubmitButton className="btn-primary w-full" pendingLabel="Creating account…">Create account</SubmitButton>
    </form>
  );
}
