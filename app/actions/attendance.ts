'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireCapability } from '@/lib/club-context';
import { writeAudit } from '@/lib/audit';
import { syncMemberStatuses } from '@/lib/status-sync';
import { ATTENDANCE_LABELS, ATTENDANCE_STATUSES, type AttendanceStatus } from '@/lib/rules';
import type { ActionState } from '@/lib/action-state';

const isStatus = (v: string): v is AttendanceStatus =>
  (ATTENDANCE_STATUSES as readonly string[]).includes(v);

/**
 * Save a whole roll call in one transaction.
 *
 * Clearing a member back to blank deletes their row rather than storing an
 * empty status — "not recorded" is the absence of a record, which is what keeps
 * an untaken meeting from silently costing everyone a strike.
 */
export async function saveAttendance(slug: string, eventId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireCapability(slug, 'attendance:take');

  const event = await prisma.event.findFirst({
    where: { id: eventId, clubId: ctx.club.id },
    include: {
      invitees: { select: { membershipId: true } },
      attendance: true,
    },
  });
  if (!event) return { error: 'Event not found.' };

  const invited = new Set(event.invitees.map((i) => i.membershipId));
  const existing = new Map(event.attendance.map((a) => [a.membershipId, a]));
  const changes: string[] = [];

  const creates: Array<{ membershipId: string; status: AttendanceStatus }> = [];
  const updates: Array<{ id: string; status: AttendanceStatus }> = [];
  const deletes: string[] = [];

  for (const membershipId of invited) {
    const raw = String(fd.get(`status:${membershipId}`) ?? '').trim();
    const prior = existing.get(membershipId);

    if (!raw) {
      if (prior) {
        deletes.push(prior.id);
        changes.push(`${membershipId}:${prior.status}→cleared`);
      }
      continue;
    }
    if (!isStatus(raw)) continue;

    if (!prior) {
      creates.push({ membershipId, status: raw });
      changes.push(`${membershipId}:→${raw}`);
    } else if (prior.status !== raw) {
      updates.push({ id: prior.id, status: raw });
      changes.push(`${membershipId}:${prior.status}→${raw}`);
    }
  }

  await prisma.$transaction([
    ...deletes.map((id) => prisma.attendanceRecord.delete({ where: { id } })),
    ...updates.map((u) =>
      prisma.attendanceRecord.update({
        where: { id: u.id },
        data: {
          status: u.status,
          recordedByMembershipId: ctx.membership.id,
          recordedByName: ctx.membership.displayName,
          recordedAt: new Date(),
          method: 'manual',
        },
      }),
    ),
    ...creates.map((c) =>
      prisma.attendanceRecord.create({
        data: {
          eventId,
          membershipId: c.membershipId,
          status: c.status,
          recordedByMembershipId: ctx.membership.id,
          recordedByName: ctx.membership.displayName,
          method: 'manual',
        },
      }),
    ),
    prisma.event.update({
      where: { id: eventId },
      data: { attendanceTakenAt: new Date(), status: 'completed' },
    }),
  ]);

  // One audit row per member changed — a roll call is exactly the thing people
  // later disagree about, so "who changed what, when" has to be recoverable.
  if (changes.length) {
    const names = await prisma.membership.findMany({
      where: { id: { in: changes.map((c) => c.split(':')[0]) } },
      select: { id: true, displayName: true },
    });
    const nameOf = new Map(names.map((n) => [n.id, n.displayName]));
    for (const change of changes) {
      const [id, transition] = change.split(':');
      const [from, to] = transition.split('→');
      const label = (s: string) =>
        s === 'cleared' || s === '' ? 'not recorded' : (ATTENDANCE_LABELS[s as AttendanceStatus] ?? s);
      await writeAudit({
        clubId: ctx.club.id,
        actorMembershipId: ctx.membership.id,
        actorName: ctx.membership.displayName,
        action: from ? 'attendance.change' : 'attendance.record',
        entityType: 'attendance',
        entityId: id,
        summary: from
          ? `Changed ${nameOf.get(id) ?? 'member'} from ${label(from)} to ${label(to)} for "${event.title}"`
          : `Marked ${nameOf.get(id) ?? 'member'} ${label(to)} for "${event.title}"`,
      });
    }
  }

  const { changed } = await syncMemberStatuses(
    ctx.club.id, ctx.semester?.id ?? null, ctx.rules, ctx.membership.displayName,
  );

  revalidatePath(`/c/${slug}`, 'layout');
  return {
    ok: true,
    message:
      changes.length === 0
        ? 'Attendance saved — nothing changed.'
        : `Saved ${changes.length} change${changes.length === 1 ? '' : 's'}` +
          (changed ? ` · ${changed} membership status${changed === 1 ? '' : 'es'} updated` : ''),
  };
}

/** Bulk helper behind the "Mark all present" button — the fast path for roll call. */
export async function markAllPresent(slug: string, eventId: string): Promise<void> {
  const ctx = await requireCapability(slug, 'attendance:take');
  const event = await prisma.event.findFirst({
    where: { id: eventId, clubId: ctx.club.id },
    include: { invitees: { select: { membershipId: true } }, attendance: { select: { membershipId: true } } },
  });
  if (!event) throw new Error('Event not found.');

  const already = new Set(event.attendance.map((a) => a.membershipId));
  const missing = event.invitees.filter((i) => !already.has(i.membershipId));

  await prisma.$transaction([
    ...missing.map((i) =>
      prisma.attendanceRecord.create({
        data: {
          eventId,
          membershipId: i.membershipId,
          status: 'present',
          recordedByMembershipId: ctx.membership.id,
          recordedByName: ctx.membership.displayName,
        },
      }),
    ),
    prisma.event.update({
      where: { id: eventId },
      data: { attendanceTakenAt: new Date(), status: 'completed' },
    }),
  ]);

  await writeAudit({
    clubId: ctx.club.id, actorMembershipId: ctx.membership.id, actorName: ctx.membership.displayName,
    action: 'attendance.bulk_present', entityType: 'event', entityId: eventId,
    summary: `Marked ${missing.length} unrecorded member(s) present for "${event.title}"`,
  });

  await syncMemberStatuses(ctx.club.id, ctx.semester?.id ?? null, ctx.rules, ctx.membership.displayName);
  revalidatePath(`/c/${slug}`, 'layout');
}

export async function decideExcuse(slug: string, requestId: string, decision: 'approved' | 'denied'): Promise<void> {
  const ctx = await requireCapability(slug, 'excuse:decide');
  const request = await prisma.excuseRequest.findFirst({
    where: { id: requestId, event: { clubId: ctx.club.id } },
    include: { membership: { select: { displayName: true } }, event: { select: { title: true, id: true } } },
  });
  if (!request) throw new Error('Request not found.');

  await prisma.excuseRequest.update({
    where: { id: requestId },
    data: {
      status: decision,
      decidedByMembershipId: ctx.membership.id,
      decidedByName: ctx.membership.displayName,
      decidedAt: new Date(),
    },
  });

  // Approving an excuse rewrites the attendance row it refers to.
  if (decision === 'approved') {
    await prisma.attendanceRecord.upsert({
      where: { eventId_membershipId: { eventId: request.eventId, membershipId: request.membershipId } },
      create: {
        eventId: request.eventId, membershipId: request.membershipId, status: 'excused',
        recordedByMembershipId: ctx.membership.id, recordedByName: ctx.membership.displayName,
      },
      update: {
        status: 'excused',
        recordedByMembershipId: ctx.membership.id, recordedByName: ctx.membership.displayName,
        recordedAt: new Date(),
      },
    });
  }

  await writeAudit({
    clubId: ctx.club.id, actorMembershipId: ctx.membership.id, actorName: ctx.membership.displayName,
    action: `excuse.${decision}`, entityType: 'excuse', entityId: requestId,
    summary: `${decision === 'approved' ? 'Approved' : 'Denied'} ${request.membership.displayName}'s excuse for "${request.event.title}"`,
  });

  await syncMemberStatuses(ctx.club.id, ctx.semester?.id ?? null, ctx.rules, ctx.membership.displayName);
  revalidatePath(`/c/${slug}`, 'layout');
}

/** Member-facing: ask an officer to excuse an upcoming absence. */
export async function requestExcuse(slug: string, eventId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const { getClubContext } = await import('@/lib/club-context');
  const ctx = await getClubContext(slug);
  if (!ctx) return { error: 'Not a member of this club.' };

  const reason = String(fd.get('reason') ?? '').trim();
  if (!reason) return { error: 'Please give a reason.' };

  const invited = await prisma.eventInvitee.findFirst({
    where: { eventId, membershipId: ctx.membership.id, event: { clubId: ctx.club.id } },
  });
  if (!invited) return { error: 'You are not on the expected list for this event.' };

  await prisma.excuseRequest.upsert({
    where: { eventId_membershipId: { eventId, membershipId: ctx.membership.id } },
    create: { eventId, membershipId: ctx.membership.id, reason },
    update: { reason, status: 'pending', decidedAt: null, decidedByMembershipId: null, decidedByName: null },
  });

  revalidatePath(`/c/${slug}`, 'layout');
  return { ok: true, message: 'Excuse request submitted for review.' };
}

/**
 * Self check-in. The fastest roll call is the one an officer does not have to
 * run: members enter the event's code and mark themselves, an officer reviews
 * the result on the event page. Records are tagged `self_checkin` so a
 * disputed mark can always be traced back to who entered it.
 */
export async function selfCheckIn(slug: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const { getClubContext } = await import('@/lib/club-context');
  const ctx = await getClubContext(slug);
  if (!ctx) return { error: 'Not a member of this club.' };

  const code = String(fd.get('code') ?? '').trim().toUpperCase();
  if (!code) return { error: 'Enter the code your E-board gave you.' };

  const event = await prisma.event.findFirst({
    where: { clubId: ctx.club.id, checkinCode: code, status: { not: 'cancelled' } },
    orderBy: { startsAt: 'desc' },
    include: { invitees: { where: { membershipId: ctx.membership.id }, select: { id: true } } },
  });
  if (!event) return { error: 'That code does not match any event in this club.' };
  if (event.invitees.length === 0) return { error: 'You are not on the expected list for that event.' };

  // A code is only good around its own event, so last month's code cannot be
  // reused to backfill attendance.
  const now = new Date();
  const opens = new Date(event.startsAt.getTime() - 60 * 60_000);
  const closes = new Date(event.endsAt.getTime() + 60 * 60_000);
  if (now < opens) return { error: `Check-in for "${event.title}" is not open yet.` };
  if (now > closes) return { error: `Check-in for "${event.title}" has closed. Ask an officer to record it.` };

  const status: AttendanceStatus = now.getTime() > event.startsAt.getTime() + 10 * 60_000 ? 'late' : 'present';

  await prisma.attendanceRecord.upsert({
    where: { eventId_membershipId: { eventId: event.id, membershipId: ctx.membership.id } },
    create: {
      eventId: event.id, membershipId: ctx.membership.id, status,
      method: 'self_checkin', recordedByMembershipId: ctx.membership.id,
      recordedByName: ctx.membership.displayName,
    },
    update: { status, method: 'self_checkin', recordedAt: new Date() },
  });

  await writeAudit({
    clubId: ctx.club.id, actorMembershipId: ctx.membership.id, actorName: ctx.membership.displayName,
    action: 'attendance.self_checkin', entityType: 'attendance', entityId: event.id,
    summary: `${ctx.membership.displayName} checked in ${ATTENDANCE_LABELS[status].toLowerCase()} for "${event.title}"`,
  });

  revalidatePath(`/c/${slug}`, 'layout');
  return {
    ok: true,
    message: `Checked in to "${event.title}" as ${ATTENDANCE_LABELS[status]}. An officer confirms the final record.`,
  };
}
