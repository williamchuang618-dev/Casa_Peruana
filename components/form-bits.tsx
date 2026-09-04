'use client';

import { useFormStatus } from 'react-dom';
import type { ActionState } from '@/lib/action-state';

export function SubmitButton({
  children, className = 'btn-primary', pendingLabel,
}: { children: React.ReactNode; className?: string; pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} aria-busy={pending}>
      {pending ? (pendingLabel ?? 'Saving…') : children}
    </button>
  );
}

export function Alert({ state }: { state: ActionState }) {
  if (!state) return null;
  if (state.error) {
    return (
      <p role="alert" className="rounded-lg bg-[#f9e3e1] px-3 py-2 text-sm text-[#78201a] ring-1 ring-[#8d2820]/15">
        {state.error}
      </p>
    );
  }
  if (state.message) {
    return (
      <p role="status" className="rounded-lg bg-[#eaf1ea] px-3 py-2 text-sm text-[#2f5540] ring-1 ring-[#355c42]/15">
        {state.message}
      </p>
    );
  }
  return null;
}

export function Field({
  label, hint, children,
}: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-ink-400">{hint}</span> : null}
    </label>
  );
}
