'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireCapability } from '@/lib/club-context';
import { writeAudit } from '@/lib/audit';
import { syncMemberStatuses } from '@/lib/status-sync';
import { ROLES, ROLE_LABELS, assignableRoles, type Role } from '@/lib/permissions';
import type { ActionState } from '@/lib/action-state';

const str = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();

/**
 * Add someone to the roster before they have an account. `userId` stays null
 * until they sign up with this email, at which point signup claims the row —
 * so an E-board can build a full roster on day one.
 */
export async function addMember(slug: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireCapability(slug, 'member:invite');

  const displayName = str(fd, 'displayName');
  const email = str(fd, 'email').toLowerCase();
  const role = (ROLES as readonly string[]).includes(str(fd, 'role')) ? (str(fd, 'role') as Role) : 'member';
  if (!displayName || !email) return { error: 'Name and email are required.' };
  if (role === 'owner') return { error: 'Ownership is transferred, not assigned.' };

  const clash = await prisma.membership.findFirst({ where: { clubId: ctx.club.id, email } });
  if (clash) return { error: `${email} is already on the roster.` };

  const user = await prisma.user.findUnique({ where: { email } });
  const created = await prisma.membership.create({
    data: { clubId: ctx.club.id, displayName, email, role, userId: user?.id ?? null },
  });

  await writeAudit({
    clubId: ctx.club.id, actorMembershipId: ctx.membership.id, actorName: ctx.membership.displayName,
    action: 'member.add', entityType: 'membership', entityId: created.id,
    summary: `Added ${displayName} (${ROLE_LABELS[role]})`,
  });

  revalidatePath(`/c/${slug}`, 'layout');
  return { ok: true, message: `${displayName} added to the roster.` };
}

/** Paste-a-spreadsheet import: "Name, email" or "Name, email, role" per line. */
export async function importMembers(slug: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireCapability(slug, 'member:invite');
  const raw = String(fd.get('csv') ?? '').trim();
  if (!raw) return { error: 'Paste at least one row.' };

  const existing = new Set(
    (await prisma.membership.findMany({ where: { clubId: ctx.club.id }, select: { email: true } }))
      .map((m) => m.email),
  );

  let added = 0;
  const skipped: string[] = [];

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const cells = trimmed.split(/\s*[,\t]\s*/);
    if (/^(name|full ?name)$/i.test(cells[0] ?? '')) continue; // header row

    const displayName = cells[0]?.trim();
    const email = cells[1]?.trim().toLowerCase();
    const roleCell = cells[2]?.trim().toLowerCase().replace(/\s+/g, '_');
    if (!displayName || !email || !email.includes('@')) {
      skipped.push(trimmed.slice(0, 40));
      continue;
    }
    if (existing.has(email)) {
      skipped.push(`${email} (already on roster)`);
      continue;
    }

    const role = (ROLES as readonly string[]).includes(roleCell ?? '') && roleCell !== 'owner'
      ? (roleCell as Role)
      : 'member';
    const user = await prisma.user.findUnique({ where: { email } });
    await prisma.membership.create({
      data: { clubId: ctx.club.id, displayName, email, role, userId: user?.id ?? null },
    });
    existing.add(email);
    added += 1;
  }

  await writeAudit({
    clubId: ctx.club.id, actorMembershipId: ctx.membership.id, actorName: ctx.membership.displayName,
    action: 'member.import', entityType: 'membership',
    summary: `Imported ${added} member(s)${skipped.length ? `, skipped ${skipped.length}` : ''}`,
  });

  revalidatePath(`/c/${slug}`, 'layout');
  return {
    ok: true,
    message: `Imported ${added} member${added === 1 ? '' : 's'}.` +
      (skipped.length ? ` Skipped ${skipped.length}: ${skipped.slice(0, 3).join('; ')}${skipped.length > 3 ? '…' : ''}` : ''),
  };
}

export async function updateMember(slug: string, membershipId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireCapability(slug, 'member:edit');
  const existing = await prisma.membership.findFirst({ where: { id: membershipId, clubId: ctx.club.id } });
  if (!existing) return { error: 'Member not found.' };

  const nextRole = str(fd, 'role');
  const data: Record<string, unknown> = {
    displayName: str(fd, 'displayName') || existing.displayName,
    notes: str(fd, 'notes') || null,
  };

  if (nextRole && nextRole !== existing.role) {
    if (!assignableRoles(ctx.membership.role).includes(nextRole as Role)) {
      return { error: 'You do not have permission to assign that role.' };
    }
    if (existing.role === 'owner') return { error: "The owner's role cannot be changed here." };
    data.role = nextRole;
  }

  const updated = await prisma.membership.update({ where: { id: membershipId }, data });

  await writeAudit({
    clubId: ctx.club.id, actorMembershipId: ctx.membership.id, actorName: ctx.membership.displayName,
    action: 'member.update', entityType: 'membership', entityId: membershipId,
    summary: existing.role !== updated.role
      ? `Changed ${updated.displayName}'s role from ${ROLE_LABELS[existing.role as Role] ?? existing.role} to ${ROLE_LABELS[updated.role as Role] ?? updated.role}`
      : `Updated ${updated.displayName}'s profile`,
    before: { role: existing.role, displayName: existing.displayName },
    after: { role: updated.role, displayName: updated.displayName },
  });

  revalidatePath(`/c/${slug}`, 'layout');
  return { ok: true, message: 'Member updated.' };
}

/**
 * The deliberate two-step. Reaching the threshold only ever *flags* a member;
 * a human with the capability has to confirm, and the record is kept so the
 * decision can be reviewed or reversed.
 */
export async function confirmRemoval(slug: string, membershipId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireCapability(slug, 'member:confirm_removal');
  const member = await prisma.membership.findFirst({ where: { id: membershipId, clubId: ctx.club.id } });
  if (!member) return { error: 'Member not found.' };
  if (member.role === 'owner') return { error: 'The club owner cannot be removed.' };
  if (member.status === 'removed') return { error: 'This member is already removed.' };

  const reason = str(fd, 'reason') || 'Reached the absence threshold';

  await prisma.$transaction([
    prisma.membership.update({
      where: { id: membershipId },
      data: { status: 'removed', removedAt: new Date() },
    }),
    prisma.membershipStatusLog.create({
      data: {
        membershipId, fromStatus: member.status, toStatus: 'removed',
        reason, actorName: ctx.membership.displayName,
      },
    }),
  ]);

  await writeAudit({
    clubId: ctx.club.id, actorMembershipId: ctx.membership.id, actorName: ctx.membership.displayName,
    action: 'member.remove', entityType: 'membership', entityId: membershipId,
    summary: `Removed ${member.displayName} from active membership — ${reason}`,
    before: { status: member.status }, after: { status: 'removed', reason },
  });

  revalidatePath(`/c/${slug}`, 'layout');
  return { ok: true, message: `${member.displayName} moved to Removed.` };
}

/** Appeals happen. Reinstating hands the member back to the rules engine. */
export async function reinstateMember(slug: string, membershipId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireCapability(slug, 'member:confirm_removal');
  const member = await prisma.membership.findFirst({ where: { id: membershipId, clubId: ctx.club.id } });
  if (!member) return { error: 'Member not found.' };

  await prisma.$transaction([
    prisma.membership.update({
      where: { id: membershipId },
      data: { status: 'active', removedAt: null },
    }),
    prisma.membershipStatusLog.create({
      data: {
        membershipId, fromStatus: member.status, toStatus: 'active',
        reason: str(fd, 'reason') || 'Reinstated by an officer',
        actorName: ctx.membership.displayName,
      },
    }),
  ]);

  await writeAudit({
    clubId: ctx.club.id, actorMembershipId: ctx.membership.id, actorName: ctx.membership.displayName,
    action: 'member.reinstate', entityType: 'membership', entityId: membershipId,
    summary: `Reinstated ${member.displayName}`,
  });

  // Recompute immediately: if their absences still exceed the limit they will
  // be flagged again on the spot rather than quietly slipping back to Active.
  await syncMemberStatuses(ctx.club.id, ctx.semester?.id ?? null, ctx.rules, ctx.membership.displayName);
  revalidatePath(`/c/${slug}`, 'layout');
  return { ok: true, message: `${member.displayName} reinstated.` };
}

export async function deleteMember(slug: string, membershipId: string): Promise<void> {
  const ctx = await requireCapability(slug, 'member:confirm_removal');
  const member = await prisma.membership.findFirst({ where: { id: membershipId, clubId: ctx.club.id } });
  if (!member) throw new Error('Member not found.');
  if (member.role === 'owner') throw new Error('The club owner cannot be deleted.');

  await prisma.membership.delete({ where: { id: membershipId } });
  await writeAudit({
    clubId: ctx.club.id, actorMembershipId: ctx.membership.id, actorName: ctx.membership.displayName,
    action: 'member.delete', entityType: 'membership', entityId: membershipId,
    summary: `Permanently deleted ${member.displayName} and their attendance history`,
    before: { displayName: member.displayName, email: member.email, role: member.role },
  });

  revalidatePath(`/c/${slug}`, 'layout');
  redirect(`/c/${slug}/members`);
}

const MAX_PHOTO_CHARS = 420_000; // ~300KB of binary once base64 is decoded
const PHOTO_PREFIX = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

/**
 * "Conócenos" profile. A member edits their own; officers with member:edit can
 * fix anyone's. The photo arrives already downsampled to a 512px square by the
 * browser — this only re-checks the shape and the ceiling, because a client
 * that resizes is a convenience, never a guarantee.
 */
export async function updateProfile(
  slug: string, membershipId: string, _prev: ActionState, fd: FormData,
): Promise<ActionState> {
  const { getClubContext } = await import('@/lib/club-context');
  const { can } = await import('@/lib/permissions');
  const ctx = await getClubContext(slug);
  if (!ctx) return { error: 'Not a member of this club.' };

  const isSelf = membershipId === ctx.membership.id;
  if (!isSelf && !can(ctx.membership.role, 'member:edit')) {
    return { error: 'You can only edit your own profile.' };
  }

  const target = await prisma.membership.findFirst({ where: { id: membershipId, clubId: ctx.club.id } });
  if (!target) return { error: 'Member not found.' };

  const photo = String(fd.get('photo') ?? '');
  const clearPhoto = fd.get('clearPhoto') !== null;
  let nextPhoto: string | null | undefined;

  if (clearPhoto) {
    nextPhoto = null;
  } else if (photo) {
    if (photo.length > MAX_PHOTO_CHARS) {
      return { error: 'That image is too large even after resizing. Try a smaller one.' };
    }
    if (!PHOTO_PREFIX.test(photo)) return { error: 'That file is not a supported image.' };
    nextPhoto = photo;
  }

  await prisma.membership.update({
    where: { id: membershipId },
    data: {
      pronouns: str(fd, 'pronouns') || null,
      major: str(fd, 'major') || null,
      gradYear: str(fd, 'gradYear') || null,
      hometown: str(fd, 'hometown') || null,
      bio: str(fd, 'bio').slice(0, 600) || null,
      ...(nextPhoto === undefined ? {} : { photo: nextPhoto }),
    },
  });

  await writeAudit({
    clubId: ctx.club.id, actorMembershipId: ctx.membership.id, actorName: ctx.membership.displayName,
    action: 'member.profile', entityType: 'membership', entityId: membershipId,
    summary: isSelf
      ? `${ctx.membership.displayName} updated their profile`
      : `Updated ${target.displayName}'s profile`,
  });

  revalidatePath(`/c/${slug}`, 'layout');
  return { ok: true, message: 'Profile saved.' };
}
