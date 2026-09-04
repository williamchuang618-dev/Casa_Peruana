import { prisma } from './db';
import {
  computeStanding,
  eventCounts,
  pointsFor,
  DEFAULT_RULES,
  type AttendanceRules,
  type AttendanceStatus,
  type MemberStatus,
  type Standing,
  type EventStatus,
} from './rules';

export interface HistoryEntry {
  eventId: string;
  title: string;
  type: string;
  startsAt: Date;
  eventStatus: EventStatus;
  attendanceRequired: boolean;
  attendanceTakenAt: Date | null;
  record: AttendanceStatus | null;
  counted: boolean;
  points: number;
}

export interface MemberStanding {
  membershipId: string;
  displayName: string;
  email: string;
  role: string;
  storedStatus: MemberStatus;
  joinedOn: Date;
  photo: string | null;
  hasAccount: boolean;
  standing: Standing;
  history: HistoryEntry[];
}

/**
 * Per-semester rules win over the club default; the club default wins over the
 * built-in policy. Nothing is copied into member rows, so editing a rule
 * re-derives every standing in the club on the next page load.
 */
export async function rulesFor(clubId: string, semesterId: string | null): Promise<AttendanceRules> {
  const rows = await prisma.attendanceRule.findMany({
    where: { clubId, OR: [{ semesterId }, { semesterId: null }] },
  });
  const row = rows.find((r) => r.semesterId === semesterId) ?? rows.find((r) => r.semesterId === null);
  if (!row) return DEFAULT_RULES;
  return {
    maxAbsencePoints: row.maxAbsencePoints,
    warnAtPoints: row.warnAtPoints,
    pointsPresent: row.pointsPresent,
    pointsLate: row.pointsLate,
    pointsExcused: row.pointsExcused,
    pointsAbsent: row.pointsAbsent,
    minAttendancePct: row.minAttendancePct,
    excusedCap: row.excusedCap,
  };
}

export async function computeClubStandings(
  clubId: string,
  semesterId: string | null,
  rules: AttendanceRules,
  opts: { membershipId?: string } = {},
): Promise<MemberStanding[]> {
  const [memberships, events] = await Promise.all([
    prisma.membership.findMany({
      where: { clubId, ...(opts.membershipId ? { id: opts.membershipId } : {}) },
      orderBy: { displayName: 'asc' },
    }),
    prisma.event.findMany({
      where: { clubId, ...(semesterId ? { semesterId } : {}) },
      orderBy: { startsAt: 'asc' },
      select: {
        id: true, title: true, type: true, startsAt: true, status: true,
        attendanceRequired: true, attendanceTakenAt: true,
        invitees: { select: { membershipId: true } },
        attendance: { select: { membershipId: true, status: true } },
      },
    }),
  ]);

  const byMember = new Map<string, HistoryEntry[]>();
  for (const m of memberships) byMember.set(m.id, []);

  for (const ev of events) {
    const records = new Map(ev.attendance.map((a) => [a.membershipId, a.status as AttendanceStatus]));
    const counted = eventCounts({
      eventStatus: ev.status as EventStatus,
      attendanceRequired: ev.attendanceRequired,
      attendanceTakenAt: ev.attendanceTakenAt,
    });
    for (const inv of ev.invitees) {
      const bucket = byMember.get(inv.membershipId);
      if (!bucket) continue;
      const record = records.get(inv.membershipId) ?? null;
      bucket.push({
        eventId: ev.id,
        title: ev.title,
        type: ev.type,
        startsAt: ev.startsAt,
        eventStatus: ev.status as EventStatus,
        attendanceRequired: ev.attendanceRequired,
        attendanceTakenAt: ev.attendanceTakenAt,
        record,
        counted,
        points: counted && record ? pointsFor(record, rules) : 0,
      });
    }
  }

  return memberships.map((m) => {
    const history = byMember.get(m.id) ?? [];
    return {
      membershipId: m.id,
      displayName: m.displayName,
      email: m.email,
      role: m.role,
      storedStatus: m.status as MemberStatus,
      joinedOn: m.joinedOn,
      photo: m.photo,
      hasAccount: m.userId != null,
      standing: computeStanding(history, rules, { currentStatus: m.status as MemberStatus }),
      history: history.slice().sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime()),
    };
  });
}

export async function memberStanding(
  clubId: string,
  membershipId: string,
  semesterId: string | null,
  rules: AttendanceRules,
): Promise<MemberStanding | null> {
  const [row] = await computeClubStandings(clubId, semesterId, rules, { membershipId });
  return row ?? null;
}
