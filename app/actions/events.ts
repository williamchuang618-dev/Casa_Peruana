'use server';

import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireCapability } from '@/lib/club-context';
import { writeAudit } from '@/lib/audit';
import { syncMemberStatuses } from '@/lib/status-sync';
import { fromLocalInput } from '@/lib/dates';
import { EVENT_TYPES, type EventType } from '@/lib/rules';
import type { ActionState } from '@/lib/action-state';

const str = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();
const CODE = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const checkinCode = () => Array.from(randomBytes(6), (b) => CODE[b % CODE.length]).join('');

/**
 * Resolve who is expected at an event and freeze that list. Snapshotting is the
 * point: a member who joins next month must never turn up as absent for a
 * meeting that happened before they existed.
 */
async function resolveInvitees(
  clubId: string,
  scope: string,
  groupId: string | null,
  explicit: string[],
): Promise<Array<{ membershipId: string; source: string }>> {
  if (scope === 'specific') {
    return explicit.map((id) => ({ membershipId: id, source: 'specific' }));
  }
  if (scope === 'group' && groupId) {
    const links = await prisma.memberGroupMember.findMany({
      where: { groupId, membership: { clubId, status: { not: 'removed' } } },
      select: { membershipId: true },
    });
    return links.map((l) => ({ membershipId: l.membershipId, source: 'group' }));
  }
  const all = await prisma.membership.findMany({
    where: { clubId, status: { not: 'removed' } },
    select: { id: true },
  });
  return all.map((m) => ({ membershipId: m.id, source: 'all' }));
}

export async function createEvent(slug: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireCapability(slug, 'event:create');
  const tz = ctx.club.timezone;

  const title = str(fd, 'title');
  const date = str(fd, 'date');
  const startTime = str(fd, 'startTime') || '19:00';
  const endTime = str(fd, 'endTime') || '20:00';
  if (!title) return { error: 'Event name is required.' };
  if (!date) return { error: 'Date is required.' };

  const type = (EVENT_TYPES as readonly string[]).includes(str(fd, 'type'))
    ? (str(fd, 'type') as EventType)
    : 'general_meeting';

  const startsAt = fromLocalInput(date, startTime, tz);
  const endsAt = fromLocalInput(date, endTime, tz);
  if (endsAt <= startsAt) return { error: 'End time must be after the start time.' };

  const invitees = await resolveInvitees(
    ctx.club.id,
    str(fd, 'scope') || 'all',
    str(fd, 'groupId') || null,
    fd.getAll('memberIds').map(String),
  );
  if (invitees.length === 0) return { error: 'Select at least one expected member.' };

  // "Repeat weekly until <date>" expands into concrete rows so every occurrence
  // can be edited, cancelled or attended independently.
  const repeatUntil = str(fd, 'repeatUntil');
  const recurrenceGroupId = repeatUntil ? randomBytes(8).toString('hex') : null;
  const occurrences: Array<{ startsAt: Date; endsAt: Date }> = [{ startsAt, endsAt }];
  if (repeatUntil) {
    const limit = new Date(`${repeatUntil}T23:59:59Z`);
    let cursor = { startsAt, endsAt };
    for (let i = 0; i < 52; i += 1) {
      const next = {
        startsAt: new Date(cursor.startsAt.getTime() + 7 * 86_400_000),
        endsAt: new Date(cursor.endsAt.getTime() + 7 * 86_400_000),
      };
      if (next.startsAt > limit) break;
      occurrences.push(next);
      cursor = next;
    }
  }

  const base = {
    clubId: ctx.club.id,
    semesterId: ctx.semester?.id ?? null,
    title,
    type,
    description: str(fd, 'description') || null,
    location: str(fd, 'location') || null,
    attendanceRequired: fd.get('attendanceRequired') !== null,
    createdByMembershipId: ctx.membership.id,
    createdByName: ctx.membership.displayName,
    recurrenceGroupId,
  };

  let firstId = '';
  for (const occ of occurrences) {
    const created = await prisma.event.create({
      data: {
        ...base,
        startsAt: occ.startsAt,
        endsAt: occ.endsAt,
        checkinCode: checkinCode(),
        invitees: { create: invitees },
      },
    });
    if (!firstId) firstId = created.id;
  }

  await writeAudit({
    clubId: ctx.club.id,
    actorMembershipId: ctx.membership.id,
    actorName: ctx.membership.displayName,
    action: 'event.create',
    entityType: 'event',
    entityId: firstId,
    summary:
      occurrences.length > 1
        ? `Created "${title}" and ${occurrences.length - 1} weekly repeats · ${invitees.length} expected`
        : `Created "${title}" · ${invitees.length} expected`,
  });

  revalidatePath(`/c/${slug}`, 'layout');
  redirect(`/c/${slug}/events/${firstId}`);
}

export async function updateEvent(slug: string, eventId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireCapability(slug, 'event:edit');
  const tz = ctx.club.timezone;

  const existing = await prisma.event.findFirst({ where: { id: eventId, clubId: ctx.club.id } });
  if (!existing) return { error: 'Event not found.' };

  const date = str(fd, 'date');
  const startsAt = fromLocalInput(date, str(fd, 'startTime') || '19:00', tz);
  const endsAt = fromLocalInput(date, str(fd, 'endTime') || '20:00', tz);
  if (endsAt <= startsAt) return { error: 'End time must be after the start time.' };

  const updated = await prisma.event.update({
    where: { id: eventId },
    data: {
      title: str(fd, 'title') || existing.title,
      type: str(fd, 'type') || existing.type,
      description: str(fd, 'description') || null,
      location: str(fd, 'location') || null,
      attendanceRequired: fd.get('attendanceRequired') !== null,
      startsAt,
      endsAt,
    },
  });

  await writeAudit({
    clubId: ctx.club.id, actorMembershipId: ctx.membership.id, actorName: ctx.membership.displayName,
    action: 'event.update', entityType: 'event', entityId: eventId,
    summary: `Edited "${updated.title}"`,
    before: { title: existing.title, startsAt: existing.startsAt, attendanceRequired: existing.attendanceRequired },
    after: { title: updated.title, startsAt: updated.startsAt, attendanceRequired: updated.attendanceRequired },
  });

  // Toggling attendanceRequired changes who owes what, so re-derive.
  await syncMemberStatuses(ctx.club.id, ctx.semester?.id ?? null, ctx.rules, ctx.membership.displayName);
  revalidatePath(`/c/${slug}`, 'layout');
  return { ok: true, message: 'Event updated.' };
}

export async function setEventStatus(slug: string, eventId: string, status: 'scheduled' | 'completed' | 'cancelled'): Promise<void> {
  const ctx = await requireCapability(slug, 'event:edit');
  const existing = await prisma.event.findFirst({ where: { id: eventId, clubId: ctx.club.id } });
  if (!existing) throw new Error('Event not found.');

  await prisma.event.update({
    where: { id: eventId },
    data: {
      status,
      // Reopening or cancelling withdraws the event from every standing until
      // an officer completes it again.
      attendanceTakenAt: status === 'completed' ? existing.attendanceTakenAt : null,
    },
  });

  await writeAudit({
    clubId: ctx.club.id, actorMembershipId: ctx.membership.id, actorName: ctx.membership.displayName,
    action: `event.${status}`, entityType: 'event', entityId: eventId,
    summary: `Marked "${existing.title}" ${status}`,
    before: { status: existing.status }, after: { status },
  });

  await syncMemberStatuses(ctx.club.id, ctx.semester?.id ?? null, ctx.rules, ctx.membership.displayName);
  revalidatePath(`/c/${slug}`, 'layout');
}

export async function deleteEvent(slug: string, eventId: string): Promise<void> {
  const ctx = await requireCapability(slug, 'event:delete');
  const existing = await prisma.event.findFirst({ where: { id: eventId, clubId: ctx.club.id } });
  if (!existing) throw new Error('Event not found.');

  await prisma.event.delete({ where: { id: eventId } });
  await writeAudit({
    clubId: ctx.club.id, actorMembershipId: ctx.membership.id, actorName: ctx.membership.displayName,
    action: 'event.delete', entityType: 'event', entityId: eventId,
    summary: `Deleted "${existing.title}"`, before: { title: existing.title, startsAt: existing.startsAt },
  });

  await syncMemberStatuses(ctx.club.id, ctx.semester?.id ?? null, ctx.rules, ctx.membership.displayName);
  revalidatePath(`/c/${slug}`, 'layout');
  redirect(`/c/${slug}/events`);
}
