import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireView } from '@/lib/club-context';
import { prisma } from '@/lib/db';
import { memberStanding } from '@/lib/standings';
import { can } from '@/lib/permissions';
import { ROLE_LABELS, type Role } from '@/lib/permissions';
import { dateLabel, dateTimeLabel } from '@/lib/dates';
import { EVENT_TYPE_LABELS, warningMessage, type AttendanceStatus, type EventType } from '@/lib/rules';
import { EditMemberForm, RemovalPanel } from '@/components/member-forms';
import { AttendanceBadge, EmptyState, Meter, PageHeader, StatCard, StatusBadge } from '@/components/ui';

export default async function MemberProfilePage({
  params,
}: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const ctx = await requireView(slug, 'members:view_all');
  const tz = ctx.club.timezone;

  const row = await memberStanding(ctx.club.id, id, ctx.semester?.id ?? null, ctx.rules);
  if (!row) notFound();

  const [member, statusLog] = await Promise.all([
    prisma.membership.findUnique({ where: { id }, select: { notes: true, removedAt: true } }),
    prisma.membershipStatusLog.findMany({
      where: { membershipId: id },
      orderBy: { createdAt: 'desc' },
      take: 12,
    }),
  ]);

  const { standing } = row;
  const history = row.history.filter((h) => h.startsAt <= new Date());
  const max = ctx.rules.maxAbsencePoints;
  const flagged = standing.status === 'removal_required';
  const canDecide = can(ctx.membership.role, 'member:confirm_removal');

  return (
    <>
      <Link href={`/c/${slug}/members`} className="mb-4 inline-block text-sm text-ink-500 hover:text-brand">
        ← All members
      </Link>

      <PageHeader
        eyebrow={`${ROLE_LABELS[row.role as Role] ?? row.role} · miembro desde ${dateLabel(row.joinedOn, tz)}`}
        title={row.displayName}
        subtitle={`${row.email}${row.hasAccount ? '' : ' · has not signed up yet'}`}
      >
        <StatusBadge status={standing.status} />
      </PageHeader>

      <div className="stagger mb-6 grid gap-4 grid-cols-2 lg:grid-cols-5">
        <StatCard
          label="Absences"
          value={`${standing.absencePoints} / ${max}`}
          tone={flagged ? 'danger' : standing.absencePoints >= max - 1 ? 'risk' : 'default'}
          hint={flagged ? 'Threshold reached' : `${standing.remaining} remaining`}
        />
        <StatCard
          label="Attendance"
          value={standing.attendancePct === null ? '—' : `${Math.round(standing.attendancePct * 100)}%`}
          hint={`${standing.countedEvents} counted event${standing.countedEvents === 1 ? '' : 's'}`}
        />
        <StatCard label="Attended" value={standing.present} hint={`${standing.late} late`} tone="good" />
        <StatCard label="Excused" value={standing.excused} />
        <StatCard label="Missed" value={standing.absent} tone={standing.absent ? 'danger' : 'default'} />
      </div>

      <div className="card card-pad mb-6">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold text-ink-900">Standing</h2>
          <span className="text-xs text-ink-400 tabular-nums">{standing.absencePoints} of {max} absence points</span>
        </div>
        <Meter
          value={standing.absencePoints}
          max={max}
          tone={flagged ? 'bg-[#9b2c22]' : standing.absencePoints >= max - 1 ? 'bg-[#c96f3c]' : 'bg-[#3f6b4f]'}
        />
        <ul className="mt-3 space-y-1">
          {standing.reasons.map((r) => (
            <li key={r} className="text-sm text-ink-700">· {r}</li>
          ))}
        </ul>
        <p className="mt-3 border-t border-line pt-3 text-xs text-ink-400">
          Computed live from {standing.countedEvents} counted event{standing.countedEvents === 1 ? '' : 's'} under the
          club&apos;s current rules — absent {ctx.rules.pointsAbsent}, late {ctx.rules.pointsLate}, excused{' '}
          {ctx.rules.pointsExcused}. Change the rules in Settings and this recalculates instantly.
        </p>
      </div>

      {(flagged || standing.status === 'removed') && canDecide ? (
        <div className="mb-6">
          <RemovalPanel
            slug={slug}
            membershipId={id}
            memberName={row.displayName.split(' ')[0]}
            isRemoved={standing.status === 'removed'}
            absenceSummary={warningMessage(standing, ctx.rules) ?? ''}
          />
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-ink-900">Attendance history</h2>
          {history.length === 0 ? (
            <EmptyState title="No events yet" body="This member has not been invited to any events this semester." />
          ) : (
            <div className="card overflow-x-auto">
              <table className="w-full min-w-2xl">
                <thead className="border-b border-line bg-canvas">
                  <tr>
                    <th className="th">Date</th>
                    <th className="th">Event</th>
                    <th className="th">Type</th>
                    <th className="th">Result</th>
                    <th className="th text-right">Points</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {history.map((h) => (
                    <tr key={h.eventId} className="hover:bg-line-soft">
                      <td className="td whitespace-nowrap text-ink-500">{dateLabel(h.startsAt, tz)}</td>
                      <td className="td">
                        <Link href={`/c/${slug}/events/${h.eventId}`} className="font-medium text-ink-900 hover:text-brand">
                          {h.title}
                        </Link>
                        {!h.counted ? (
                          <span className="ml-2 text-xs text-ink-400">
                            {h.eventStatus === 'cancelled'
                              ? 'cancelled'
                              : !h.attendanceRequired
                                ? 'optional'
                                : h.attendanceTakenAt == null
                                  ? 'attendance not taken'
                                  : 'not counted'}
                          </span>
                        ) : null}
                      </td>
                      <td className="td text-ink-500">
                        {EVENT_TYPE_LABELS[h.type as EventType] ?? 'Other'}
                      </td>
                      <td className="td"><AttendanceBadge status={h.record as AttendanceStatus | null} /></td>
                      <td className="td text-right tabular-nums">
                        {h.counted ? (h.points > 0 ? `+${h.points}` : '0') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="space-y-6">
          {can(ctx.membership.role, 'member:edit') ? (
            <div className="card card-pad">
              <h2 className="mb-3 text-sm font-semibold text-ink-900">Edit</h2>
              <EditMemberForm
                slug={slug}
                membershipId={id}
                actorRole={ctx.membership.role}
                values={{ displayName: row.displayName, role: row.role, notes: member?.notes ?? '' }}
              />
            </div>
          ) : null}

          <div>
            <h2 className="mb-3 text-sm font-semibold text-ink-900">Status history</h2>
            {statusLog.length === 0 ? (
              <p className="card card-pad text-sm text-ink-400">No status changes recorded.</p>
            ) : (
              <ul className="card divide-y divide-line">
                {statusLog.map((l) => (
                  <li key={l.id} className="px-4 py-2.5">
                    <div className="flex items-center gap-2 text-xs">
                      <StatusBadge status={l.fromStatus} />
                      <span className="text-ink-400">→</span>
                      <StatusBadge status={l.toStatus} />
                    </div>
                    {l.reason ? <p className="mt-1 text-xs text-ink-500">{l.reason}</p> : null}
                    <p className="mt-0.5 text-xs text-ink-400">
                      {l.actorName ?? 'System'} · {dateTimeLabel(l.createdAt, tz)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
