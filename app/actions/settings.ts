'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireCapability } from '@/lib/club-context';
import { writeAudit } from '@/lib/audit';
import { syncMemberStatuses } from '@/lib/status-sync';
import { rulesFor } from '@/lib/standings';
import type { ActionState } from '@/lib/action-state';

const str = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();
const num = (fd: FormData, k: string, fallback: number) => {
  const v = Number(fd.get(k));
  return Number.isFinite(v) && v >= 0 ? v : fallback;
};

export async function updateClub(slug: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireCapability(slug, 'club:settings');
  await prisma.club.update({
    where: { id: ctx.club.id },
    data: {
      name: str(fd, 'name') || ctx.club.name,
      university: str(fd, 'university') || null,
      logoEmoji: str(fd, 'logoEmoji') || ctx.club.logoEmoji,
      timezone: str(fd, 'timezone') || ctx.club.timezone,
    },
  });
  await writeAudit({
    clubId: ctx.club.id, actorMembershipId: ctx.membership.id, actorName: ctx.membership.displayName,
    action: 'club.update', entityType: 'club', entityId: ctx.club.id, summary: 'Updated club profile',
  });
  revalidatePath(`/c/${slug}`, 'layout');
  return { ok: true, message: 'Club profile saved.' };
}

/**
 * Editing rules re-derives every member in the club immediately. That is the
 * whole reason standings are computed rather than counted: relaxing the limit
 * from 3 to 4 un-flags people in the same request, with a status-log entry
 * explaining why their badge changed.
 */
export async function updateRules(slug: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireCapability(slug, 'club:settings');
  const scope = str(fd, 'scope'); // 'club' | 'semester'
  const semesterId = scope === 'semester' ? ctx.semester?.id ?? null : null;

  const before = await rulesFor(ctx.club.id, semesterId);
  const maxAbsencePoints = Math.max(0.5, num(fd, 'maxAbsencePoints', before.maxAbsencePoints));
  const excusedCapRaw = str(fd, 'excusedCap');

  const data = {
    maxAbsencePoints,
    warnAtPoints: Math.min(num(fd, 'warnAtPoints', before.warnAtPoints), maxAbsencePoints),
    pointsPresent: num(fd, 'pointsPresent', before.pointsPresent),
    pointsLate: num(fd, 'pointsLate', before.pointsLate),
    pointsExcused: num(fd, 'pointsExcused', before.pointsExcused),
    pointsAbsent: num(fd, 'pointsAbsent', before.pointsAbsent),
    minAttendancePct: Math.min(1, Math.max(0, num(fd, 'minAttendancePct', before.minAttendancePct * 100) / 100)),
    excusedCap: excusedCapRaw === '' ? null : Math.max(0, Math.round(Number(excusedCapRaw) || 0)),
  };

  // `semesterId` is nullable, and NULLs never collide in a unique index, so an
  // upsert on (clubId, semesterId) would keep inserting duplicate club defaults.
  const existingRule = await prisma.attendanceRule.findFirst({
    where: { clubId: ctx.club.id, semesterId },
  });
  if (existingRule) {
    await prisma.attendanceRule.update({ where: { id: existingRule.id }, data });
  } else {
    await prisma.attendanceRule.create({ data: { clubId: ctx.club.id, semesterId, ...data } });
  }

  const after = await rulesFor(ctx.club.id, ctx.semester?.id ?? null);
  const { changed } = await syncMemberStatuses(
    ctx.club.id, ctx.semester?.id ?? null, after, ctx.membership.displayName,
  );

  await writeAudit({
    clubId: ctx.club.id, actorMembershipId: ctx.membership.id, actorName: ctx.membership.displayName,
    action: 'rules.update', entityType: 'rules', entityId: semesterId ?? ctx.club.id,
    summary: `Updated attendance rules${scope === 'semester' ? ` for ${ctx.semester?.name}` : ''}` +
      (changed ? ` · ${changed} member status(es) recalculated` : ''),
    before, after: data,
  });

  revalidatePath(`/c/${slug}`, 'layout');
  return {
    ok: true,
    message: `Rules saved.${changed ? ` ${changed} member status${changed === 1 ? '' : 'es'} recalculated.` : ''}`,
  };
}

/**
 * Starting a new semester freezes the outgoing one's rules onto it, so closed
 * terms never re-score themselves when the club edits its live policy later.
 */
export async function startSemester(slug: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireCapability(slug, 'club:settings');
  const name = str(fd, 'name');
  const startsOn = str(fd, 'startsOn');
  const endsOn = str(fd, 'endsOn');
  if (!name || !startsOn || !endsOn) return { error: 'Name, start date and end date are required.' };
  if (new Date(endsOn) <= new Date(startsOn)) return { error: 'End date must be after the start date.' };

  const clash = await prisma.semester.findFirst({ where: { clubId: ctx.club.id, name } });
  if (clash) return { error: `A semester called "${name}" already exists.` };

  if (ctx.semester) {
    const outgoing = await rulesFor(ctx.club.id, ctx.semester.id);
    await prisma.semester.update({
      where: { id: ctx.semester.id },
      data: { isActive: false, rulesSnapshot: JSON.stringify(outgoing) },
    });
  }

  const created = await prisma.semester.create({
    data: {
      clubId: ctx.club.id, name,
      startsOn: new Date(`${startsOn}T00:00:00Z`),
      endsOn: new Date(`${endsOn}T23:59:59Z`),
      isActive: true,
    },
  });

  await writeAudit({
    clubId: ctx.club.id, actorMembershipId: ctx.membership.id, actorName: ctx.membership.displayName,
    action: 'semester.start', entityType: 'semester', entityId: created.id,
    summary: `Started ${name}; absence counts reset for the new term`,
  });

  // Everyone starts the new term clean except members an officer already removed.
  await syncMemberStatuses(ctx.club.id, created.id, ctx.rules, ctx.membership.displayName);
  revalidatePath(`/c/${slug}`, 'layout');
  return { ok: true, message: `${name} is now the active semester.` };
}

export async function activateSemester(slug: string, semesterId: string): Promise<void> {
  const ctx = await requireCapability(slug, 'club:settings');
  const target = await prisma.semester.findFirst({ where: { id: semesterId, clubId: ctx.club.id } });
  if (!target) throw new Error('Semester not found.');

  await prisma.$transaction([
    prisma.semester.updateMany({ where: { clubId: ctx.club.id }, data: { isActive: false } }),
    prisma.semester.update({ where: { id: semesterId }, data: { isActive: true } }),
  ]);

  await writeAudit({
    clubId: ctx.club.id, actorMembershipId: ctx.membership.id, actorName: ctx.membership.displayName,
    action: 'semester.activate', entityType: 'semester', entityId: semesterId,
    summary: `Switched the active semester to ${target.name}`,
  });

  const rules = await rulesFor(ctx.club.id, semesterId);
  await syncMemberStatuses(ctx.club.id, semesterId, rules, ctx.membership.displayName);
  revalidatePath(`/c/${slug}`, 'layout');
}

export async function createGroup(slug: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireCapability(slug, 'club:settings');
  const name = str(fd, 'name');
  if (!name) return { error: 'Group name is required.' };
  if (await prisma.memberGroup.findFirst({ where: { clubId: ctx.club.id, name } })) {
    return { error: 'A group with that name already exists.' };
  }

  const memberIds = fd.getAll('memberIds').map(String);
  await prisma.memberGroup.create({
    data: {
      clubId: ctx.club.id, name,
      members: { create: memberIds.map((membershipId) => ({ membershipId })) },
    },
  });

  revalidatePath(`/c/${slug}`, 'layout');
  return { ok: true, message: `Group "${name}" created with ${memberIds.length} member(s).` };
}

export async function deleteGroup(slug: string, groupId: string): Promise<void> {
  const ctx = await requireCapability(slug, 'club:settings');
  await prisma.memberGroup.deleteMany({ where: { id: groupId, clubId: ctx.club.id } });
  revalidatePath(`/c/${slug}`, 'layout');
}

/* ── Resets ───────────────────────────────────────────────────────────────
   Three separate, separately-labelled actions rather than one "reset" that
   could mean any of them. All are president-or-owner only, all are logged, and
   none of them touch anything the label does not name.                      */

/** Demote every officer to General Member. Ownership is untouched. */
export async function resetEboardRoles(slug: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireCapability(slug, 'club:manage_roles');
  if (str(fd, 'confirm') !== 'RESET') return { error: 'Type RESET to confirm.' };

  const officers = await prisma.membership.findMany({
    where: { clubId: ctx.club.id, role: { notIn: ['member', 'owner'] } },
    select: { id: true, displayName: true, role: true },
  });
  if (officers.length === 0) return { ok: true, message: 'There were no officer roles to reset.' };

  await prisma.membership.updateMany({
    where: { clubId: ctx.club.id, role: { notIn: ['member', 'owner'] } },
    data: { role: 'member' },
  });

  await writeAudit({
    clubId: ctx.club.id, actorMembershipId: ctx.membership.id, actorName: ctx.membership.displayName,
    action: 'eboard.reset', entityType: 'membership',
    summary: `Reset ${officers.length} E-board role(s) to General Member`,
    before: officers.map((o) => ({ name: o.displayName, role: o.role })),
  });

  revalidatePath(`/c/${slug}`, 'layout');
  return { ok: true, message: `${officers.length} officer role(s) reset to General Member.` };
}

/**
 * Empty the roster. Keeps the club owner and whoever is doing this, so nobody
 * can lock themselves out of their own club.
 */
export async function clearRoster(slug: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireCapability(slug, 'club:manage_roles');
  if (str(fd, 'confirm').trim() !== ctx.club.name) {
    return { error: `Type the club name exactly — ${ctx.club.name} — to confirm.` };
  }

  const owner = await prisma.membership.findFirst({
    where: { clubId: ctx.club.id, userId: ctx.club.ownerUserId },
    select: { id: true },
  });
  const keep = [ctx.membership.id, owner?.id].filter(Boolean) as string[];

  const doomed = await prisma.membership.count({
    where: { clubId: ctx.club.id, id: { notIn: keep } },
  });
  // Attendance, invitations, excuses and status logs cascade from membership.
  await prisma.membership.deleteMany({ where: { clubId: ctx.club.id, id: { notIn: keep } } });

  await writeAudit({
    clubId: ctx.club.id, actorMembershipId: ctx.membership.id, actorName: ctx.membership.displayName,
    action: 'roster.clear', entityType: 'membership',
    summary: `Cleared the roster — removed ${doomed} member(s) and their attendance history`,
  });

  revalidatePath(`/c/${slug}`, 'layout');
  return { ok: true, message: `Removed ${doomed} member(s). You and the club owner were kept.` };
}

/**
 * Wipe this semester's marks and reopen its events. Members stay; every
 * standing recomputes to zero because standings are derived, not stored.
 */
export async function resetAttendance(slug: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireCapability(slug, 'club:manage_roles');
  if (str(fd, 'confirm') !== 'RESET') return { error: 'Type RESET to confirm.' };

  const events = await prisma.event.findMany({
    where: { clubId: ctx.club.id, ...(ctx.semester ? { semesterId: ctx.semester.id } : {}) },
    select: { id: true },
  });
  const ids = events.map((e) => e.id);

  const { count } = await prisma.attendanceRecord.deleteMany({ where: { eventId: { in: ids } } });
  await prisma.event.updateMany({
    where: { id: { in: ids } },
    data: { attendanceTakenAt: null, status: 'scheduled' },
  });
  // Nobody stays flagged on records that no longer exist.
  await prisma.membership.updateMany({
    where: { clubId: ctx.club.id, status: { not: 'removed' } },
    data: { status: 'active' },
  });

  await writeAudit({
    clubId: ctx.club.id, actorMembershipId: ctx.membership.id, actorName: ctx.membership.displayName,
    action: 'attendance.reset', entityType: 'event',
    summary: `Cleared ${count} attendance record(s) across ${ids.length} event(s)` +
      (ctx.semester ? ` in ${ctx.semester.name}` : ''),
  });

  await syncMemberStatuses(ctx.club.id, ctx.semester?.id ?? null, ctx.rules, ctx.membership.displayName);
  revalidatePath(`/c/${slug}`, 'layout');
  return { ok: true, message: `Cleared ${count} record(s). Every event is back to Scheduled.` };
}
