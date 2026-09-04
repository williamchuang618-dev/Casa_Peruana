import { prisma } from './db';
import type { CalendarEvent } from '@/components/calendar-view';

/** Events shaped for the calendar, with the present/expected counts it shows. */
export async function calendarEvents(clubId: string, semesterId?: string | null): Promise<CalendarEvent[]> {
  const events = await prisma.event.findMany({
    where: { clubId, ...(semesterId ? { semesterId } : {}) },
    orderBy: { startsAt: 'asc' },
    select: {
      id: true, title: true, type: true, startsAt: true, endsAt: true, location: true,
      status: true, attendanceRequired: true, attendanceTakenAt: true,
      _count: { select: { invitees: true } },
      attendance: { select: { status: true } },
    },
  });

  return events.map((e) => ({
    id: e.id,
    title: e.title,
    type: e.type,
    startsAt: e.startsAt.toISOString(),
    endsAt: e.endsAt.toISOString(),
    location: e.location,
    status: e.status,
    attendanceRequired: e.attendanceRequired,
    expected: e._count.invitees,
    present: e.attendance.filter((a) => a.status === 'present' || a.status === 'late').length,
    recorded: e.attendanceTakenAt != null,
  }));
}

/** Roster and groups for the "expected to attend" picker. */
export async function pickerData(clubId: string) {
  const [members, groups] = await Promise.all([
    prisma.membership.findMany({
      where: { clubId, status: { not: 'removed' } },
      orderBy: { displayName: 'asc' },
      select: { id: true, displayName: true, email: true, role: true },
    }),
    prisma.memberGroup.findMany({
      where: { clubId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, _count: { select: { members: true } } },
    }),
  ]);
  return {
    members,
    groups: groups.map((g) => ({ id: g.id, name: g.name, count: g._count.members })),
  };
}
