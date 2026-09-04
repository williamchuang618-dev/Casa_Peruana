'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { updateProfile } from '@/app/actions/members';
import { Alert, Field, SubmitButton } from './form-bits';

export interface ProfileValues {
  displayName: string;
  photo: string | null;
  pronouns: string;
  major: string;
  gradYear: string;
  hometown: string;
  bio: string;
}

/**
 * Downsample in the browser before anything is sent. A phone photo is 4MB and
 * 4000px wide; the directory shows it at 200px. Cropping to a centred square
 * and re-encoding at 512px keeps the row small enough to live in the database
 * without a blob store.
 */
async function toSquareJpeg(file: File, size = 512, quality = 0.82): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const min = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.drawImage(
    bitmap,
    (bitmap.width - min) / 2, (bitmap.height - min) / 2, min, min,
    0, 0, size, size,
  );
  bitmap.close?.();
  return canvas.toDataURL('image/jpeg', quality);
}

export function ProfileDialog({
  slug, membershipId, values, label = 'Edit profile', className = 'btn-secondary btn-sm',
}: {
  slug: string;
  membershipId: string;
  values: ProfileValues;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className={className} onClick={() => setOpen(true)}>{label}</button>
      {open ? (
        <ProfileEditor slug={slug} membershipId={membershipId} values={values} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}

function ProfileEditor({
  slug, membershipId, values, onClose,
}: { slug: string; membershipId: string; values: ProfileValues; onClose: () => void }) {
  const [state, action] = useActionState(updateProfile.bind(null, slug, membershipId), null);
  const [photo, setPhoto] = useState<string | null>(values.photo);
  const [cleared, setCleared] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  useEffect(() => { if (state?.ok) onClose(); }, [state, onClose]);

  async function pick(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setProblem('Choose an image file.'); return; }
    setBusy(true);
    setProblem(null);
    try {
      setPhoto(await toSquareJpeg(file));
      setCleared(false);
    } catch {
      setProblem('That image could not be read. Try a JPEG or PNG.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-noche/50 p-4 backdrop-blur-[2px]">
      <div role="dialog" aria-modal="true" aria-label="Edit profile" className="card my-8 w-full max-w-lg shadow-xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="display text-xl">{values.displayName}</h2>
          <button className="btn-ghost btn-sm" onClick={onClose}>Close</button>
        </div>

        <form action={action} className="space-y-4 p-5">
          <Alert state={state} />
          {problem ? (
            <p role="alert" className="rounded-lg bg-[#f9e3e1] px-3 py-2 text-sm text-[#78201a]">{problem}</p>
          ) : null}

          <div className="flex items-center gap-4">
            <span className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-2xl bg-brand-soft">
              {photo && !cleared ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="display text-2xl text-brand">
                  {values.displayName.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('')}
                </span>
              )}
            </span>
            <div className="space-y-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => pick(e.target.files?.[0])}
              />
              <button type="button" className="btn-secondary btn-sm" disabled={busy} onClick={() => fileRef.current?.click()}>
                {busy ? 'Resizing…' : photo && !cleared ? 'Replace photo' : 'Upload photo'}
              </button>
              {photo && !cleared ? (
                <button
                  type="button"
                  className="btn-ghost btn-sm block"
                  onClick={() => { setCleared(true); setPhoto(null); }}
                >
                  Remove photo
                </button>
              ) : null}
              <p className="text-xs text-ink-400">Cropped to a square and shrunk to 512px in your browser.</p>
            </div>
          </div>

          {photo && !cleared ? <input type="hidden" name="photo" value={photo} /> : null}
          {cleared ? <input type="hidden" name="clearPhoto" value="1" /> : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Pronouns"><input className="input" name="pronouns" defaultValue={values.pronouns} placeholder="they/them" /></Field>
            <Field label="Class year"><input className="input" name="gradYear" defaultValue={values.gradYear} placeholder="2028" /></Field>
            <Field label="Major"><input className="input" name="major" defaultValue={values.major} placeholder="Biology" /></Field>
            <Field label="Hometown"><input className="input" name="hometown" defaultValue={values.hometown} placeholder="Arequipa, Perú" /></Field>
          </div>

          <Field label="About you" hint="A couple of sentences. 600 characters max.">
            <textarea className="input min-h-24 resize-y" name="bio" rows={3} maxLength={600} defaultValue={values.bio} />
          </Field>

          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <SubmitButton pendingLabel="Saving…">Save profile</SubmitButton>
          </div>
        </form>
      </div>
    </div>
  );
}
