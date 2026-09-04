/**
 * The attendance engine.
 *
 * Deliberately pure and dependency-free: no Prisma, no React, no I/O. Member
 * standing is *derived* on every read from raw attendance rows plus the club's
 * current rules — it is never stored as a counter. That is what makes
 * "change max absences from 3 to 4" recompute the whole club correctly instead
 * of leaving stale statuses behind, and it makes the logic unit-testable
 * without a database.
 */

export const ATTENDANCE_STATUSES = ['present', 'late', 'excused', 'absent'] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const MEMBER_STATUSES = [
  'active',
  'warning',
  'at_risk',
  'removal_required',
  'removed',
] as const;
export type MemberStatus = (typeof MEMBER_STATUSES)[number];

export const EVENT_TYPES = [
  'general_meeting',
  'eboard_meeting',
  'workshop',
  'social',
  'volunteer',
  'fundraiser',
  'other',
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export type EventStatus = 'scheduled' | 'completed' | 'cancelled';

export interface AttendanceRules {
  maxAbsencePoints: number;
  warnAtPoints: number;
  pointsPresent: number;
  pointsLate: number;
  pointsExcused: number;
  pointsAbsent: number;
  /** 0 disables the percentage axis. 0.75 = "must attend 75% of eligible events". */
  minAttendancePct: number;
  /** Excuses beyond this many are charged at the absent rate. null = unlimited. */
  excusedCap: number | null;
}

export const DEFAULT_RULES: AttendanceRules = {
  maxAbsencePoints: 3,
  warnAtPoints: 1,
  pointsPresent: 0,
  pointsLate: 0,
  pointsExcused: 0,
  pointsAbsent: 1,
  minAttendancePct: 0,
  excusedCap: null,
};

/** One event a member was invited to, with whatever was recorded for them. */
export interface StandingEntry {
  eventId: string;
  eventStatus: EventStatus;
  attendanceRequired: boolean;
  /** null when nobody ever took attendance for this event. */
  attendanceTakenAt: Date | string | null;
  /** null = no record exists = "not recorded", which is NOT an absence. */
  record: AttendanceStatus | null;
}

export interface Standing {
  absencePoints: number;
  present: number;
  late: number;
  excused: number;
  absent: number;
  notRecorded: number;
  /** Events that actually count: completed + attendance-required + attendance taken. */
  countedEvents: number;
  /** present + late */
  attended: number;
  /** null when there is nothing to divide by. */
  attendancePct: number | null;
  /** Absence points left before the removal threshold; 0 once reached. */
  remaining: number;
  status: MemberStatus;
  reasons: string[];
}

/**
 * An event only counts against a member when all three are true. Cancelling a
 * meeting, or never taking attendance, must never manufacture absences.
 */
export function eventCounts(entry: {
  eventStatus: EventStatus;
  attendanceRequired: boolean;
  attendanceTakenAt: Date | string | null;
}): boolean {
  return (
    entry.eventStatus === 'completed' &&
    entry.attendanceRequired &&
    entry.attendanceTakenAt != null
  );
}

export function pointsFor(status: AttendanceStatus, rules: AttendanceRules): number {
  switch (status) {
    case 'present':
      return rules.pointsPresent;
    case 'late':
      return rules.pointsLate;
    case 'excused':
      return rules.pointsExcused;
    case 'absent':
      return rules.pointsAbsent;
  }
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function computeStanding(
  entries: StandingEntry[],
  rules: AttendanceRules = DEFAULT_RULES,
  options: { currentStatus?: MemberStatus } = {},
): Standing {
  let points = 0;
  let present = 0;
  let late = 0;
  let excused = 0;
  let absent = 0;
  let notRecorded = 0;
  let counted = 0;

  for (const entry of entries) {
    if (!eventCounts(entry)) continue;
    counted += 1;

    if (entry.record == null) {
      notRecorded += 1;
      continue;
    }

    points += pointsFor(entry.record, rules);
    if (entry.record === 'present') present += 1;
    else if (entry.record === 'late') late += 1;
    else if (entry.record === 'excused') excused += 1;
    else absent += 1;
  }

  const reasons: string[] = [];

  // Excuses past the cap are charged at the absent rate.
  if (rules.excusedCap != null && excused > rules.excusedCap) {
    const excess = excused - rules.excusedCap;
    points += excess * rules.pointsAbsent;
    reasons.push(
      `${excess} excused absence${excess === 1 ? '' : 's'} over the cap of ${rules.excusedCap} counted as absences`,
    );
  }

  points = round2(points);
  const attended = present + late;
  // Excused absences are excluded from the percentage denominator — they are
  // approved non-attendance, so they should not drag the rate down.
  const eligible = counted - excused;
  const attendancePct = eligible > 0 ? round2(attended / eligible) : null;

  const status = deriveStatus(points, attendancePct, rules, options.currentStatus, reasons);

  return {
    absencePoints: points,
    present,
    late,
    excused,
    absent,
    notRecorded,
    countedEvents: counted,
    attended,
    attendancePct,
    remaining: Math.max(0, round2(rules.maxAbsencePoints - points)),
    status,
    reasons,
  };
}

function deriveStatus(
  points: number,
  attendancePct: number | null,
  rules: AttendanceRules,
  currentStatus: MemberStatus | undefined,
  reasons: string[],
): MemberStatus {
  // "Removed" is only ever set by a human and is sticky until a human undoes it.
  if (currentStatus === 'removed') {
    reasons.push('Removed from active membership by an officer');
    return 'removed';
  }

  let status: MemberStatus = 'active';

  if (points >= rules.maxAbsencePoints) {
    reasons.unshift(
      `Removal threshold reached — ${fmt(points)} of ${fmt(rules.maxAbsencePoints)} allowed absences`,
    );
    status = 'removal_required';
  } else if (points >= rules.maxAbsencePoints - 1) {
    reasons.unshift(
      `At risk — ${fmt(points)} of ${fmt(rules.maxAbsencePoints)} allowed absences, one more triggers review`,
    );
    status = 'at_risk';
  } else if (points >= rules.warnAtPoints && rules.warnAtPoints > 0) {
    reasons.unshift(
      `${fmt(points)} of ${fmt(rules.maxAbsencePoints)} allowed absences recorded`,
    );
    status = 'warning';
  }

  // The percentage requirement is an independent axis: it can raise the
  // severity but never lower it.
  if (
    rules.minAttendancePct > 0 &&
    attendancePct != null &&
    attendancePct < rules.minAttendancePct
  ) {
    reasons.push(
      `Attendance ${Math.round(attendancePct * 100)}% is below the ${Math.round(
        rules.minAttendancePct * 100,
      )}% minimum`,
    );
    if (statusRank(status) < statusRank('at_risk')) status = 'at_risk';
  }

  if (status === 'active' && reasons.length === 0) {
    reasons.push('In good standing');
  }
  return status;
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export function statusRank(status: MemberStatus): number {
  return MEMBER_STATUSES.indexOf(status);
}

/** Section 8 of the spec: the human-readable warning shown in-app and queued for email. */
export function warningMessage(standing: Standing, rules: AttendanceRules): string | null {
  if (standing.status === 'removal_required') {
    return `Removal threshold reached: ${fmt(standing.absencePoints)} of ${fmt(
      rules.maxAbsencePoints,
    )} allowed absences. Membership status requires review by an officer.`;
  }
  if (standing.status === 'at_risk') {
    return `Warning: this member has ${fmt(standing.absencePoints)} of ${fmt(
      rules.maxAbsencePoints,
    )} allowed absences. One more absence reaches the removal threshold.`;
  }
  if (standing.status === 'warning') {
    return `${fmt(standing.absencePoints)} of ${fmt(rules.maxAbsencePoints)} absences recorded.`;
  }
  return null;
}

export const STATUS_LABELS: Record<MemberStatus, string> = {
  active: 'Active',
  warning: 'Warning',
  at_risk: 'At Risk',
  removal_required: 'Removal Required',
  removed: 'Removed',
};

export const ATTENDANCE_LABELS: Record<AttendanceStatus, string> = {
  present: 'Present',
  late: 'Late',
  excused: 'Excused',
  absent: 'Absent',
};

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  general_meeting: 'General Meeting',
  eboard_meeting: 'E-board Meeting',
  workshop: 'Workshop',
  social: 'Social',
  volunteer: 'Volunteer Event',
  fundraiser: 'Fundraiser',
  other: 'Other',
};
