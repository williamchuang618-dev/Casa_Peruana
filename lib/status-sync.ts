import { prisma } from './db';
import { computeClubStandings } from './standings';
import { warningMessage, STATUS_LABELS, type AttendanceRules, type MemberStatus } from './rules';

/**
 * Re-derives every member's status from raw attendance and writes the result
 * back onto `membership.status`.
 *
 * That column is a *cache* for sorting and filtering, never the source of
 * truth — with one exception: `removed`, which only a human sets and only a
 * human clears. Call this after anything that can change a standing:
 * attendance edits, event completion or cancellation, rule changes, roster
 * changes.
 */
export async function syncMemberStatuses(
  clubId: string,
  semesterId: string | null,
  rules: AttendanceRules,
  actorName = 'System',
): Promise<{ changed: number }> {
  const standings = await computeClubStandings(clubId, semesterId, rules);
  let changed = 0;

  for (const row of standings) {
    if (row.storedStatus === 'removed') continue; // sticky until an officer reinstates
    const next = row.standing.status as MemberStatus;
    if (next === row.storedStatus) continue;

    await prisma.$transaction([
      prisma.membership.update({ where: { id: row.membershipId }, data: { status: next } }),
      prisma.membershipStatusLog.create({
        data: {
          membershipId: row.membershipId,
          fromStatus: row.storedStatus,
          toStatus: next,
          reason: row.standing.reasons[0] ?? null,
          actorName,
        },
      }),
    ]);
    changed += 1;

    // Queue, do not send. An email worker can drain this table later without a
    // schema change; nothing in the MVP transmits anything.
    const message = warningMessage(row.standing, rules);
    if (message && (next === 'warning' || next === 'at_risk' || next === 'removal_required')) {
      await prisma.notification.create({
        data: {
          clubId,
          membershipId: row.membershipId,
          type: next === 'removal_required' ? 'removal_threshold' : 'absence_warning',
          payload: JSON.stringify({
            to: row.email,
            subject: `${STATUS_LABELS[next]} — club attendance`,
            body: `Hi ${row.displayName.split(' ')[0]},\n\n${message}`,
          }),
        },
      });
    }
  }

  return { changed };
}
