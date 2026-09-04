import Link from 'next/link';
import { requireClub } from '@/lib/club-context';
import { prisma } from '@/lib/db';
import { memberStanding } from '@/lib/standings';
import { dateLabel, dateTimeLabel, relativeLabel } from '@/lib/dates';
import { warningMessage, type AttendanceStatus } from '@/lib/rules';
import { ExcuseRequestForm } from '@/components/excuse-form';
import { AttendanceBadge, EmptyState, EventTypeBadge, Meter, PageHeader, StatCard, StatusBadge } from '@/components/ui';

export const metadata = { title: 'My attendance — La Casa Peruana' };

/** The general-member view: read-only, their record only. */
export default async function MyAttendancePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireClub(slug);
  const tz = ctx.club.timezone;

  const row = await memberStanding(ctx.club.id, ctx.membership.id, ctx.semester?.id ?? null, ctx.rules);
  if (!row) return <EmptyState title="No membership record found." />;

  const upcoming = await prisma.event.findMany({
    where: {
      clubId: ctx.club.id,
      startsAt: { gte: new Date() },
      status: { not: 'cancelled' },
      invitees: { some: { membershipId: ctx.membership.id } },
    },
    orderBy: { startsAt: 'asc' },
    take: 5,
    include: {
      excuses: { where: { membershipId: ctx.membership.id }, select: { status: true, reason: true } },
    },
  });

  const { standing } = row;
  // Future events are on the schedule, not in the history.
  const history = row.history.filter((h) => h.startsAt <= new Date());
  const max = ctx.rules.maxAbsencePoints;
  const warning = warningMessage(standing, ctx.rules);

  return (
    <>
      <PageHeader
        eyebrow="Mi asistencia"
        title="My attendance"
        subtitle={`${ctx.club.name}${ctx.semester ? ` · ${ctx.semester.name}` : ''}`}
      >
        <Link href={`/c/${slug}/checkin`} className="btn-secondary btn-sm">Check in with a code</Link>
        <StatusBadge status={standing.status} />
      </PageHeader>

      {warning ? (
        <div
          className={`card card-pad mb-6 ${
            standing.status === 'removal_required' ? 'border-[#d9a49e] bg-[#f9e3e1]/40' : 'border-[#e3c37a] bg-[#fbf0d7]/40'
          }`}
        >
          <p className="text-sm text-ink-900">{warning}</p>
          <p className="mt-1 text-xs text-ink-500">
            If you think a record is wrong, contact an E-board member — they can correct it on the event.
          </p>
        </div>
      ) : null}

      <div className="stagger mb-6 grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Absences"
          value={`${standing.absencePoints} / ${max}`}
          tone={standing.status === 'removal_required' ? 'danger' : standing.absencePoints >= max - 1 ? 'risk' : 'good'}
          hint={`${standing.remaining} remaining`}
        />
        <StatCard
          label="Attendance"
          value={standing.attendancePct === null ? '—' : `${Math.round(standing.attendancePct * 100)}%`}
        />
        <StatCard label="Attended" value={standing.present + standing.late} hint={`${standing.late} late`} />
        <StatCard label="Excused" value={standing.excused} />
      </div>

      <div className="card card-pad mb-6">
        <Meter
          value={standing.absencePoints}
          max={max}
          tone={standing.status === 'removal_required' ? 'bg-[#9b2c22]' : standing.absencePoints >= max - 1 ? 'bg-[#c96f3c]' : 'bg-[#3f6b4f]'}
        />
        <ul className="mt-3 space-y-1">
          {standing.reasons.map((r) => <li key={r} className="text-sm text-ink-700">· {r}</li>)}
        </ul>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-sm font-semibold text-ink-900">Upcoming events</h2>
          {upcoming.length === 0 ? (
            <EmptyState title="Nothing scheduled" />
          ) : (
            <ul className="space-y-2">
              {upcoming.map((e) => {
                const excuse = e.excuses[0];
                return (
                  <li key={e.id} className="card card-pad">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-ink-900">{e.title}</p>
                        <p className="mt-0.5 text-xs text-ink-500">
                          {dateTimeLabel(e.startsAt, tz)}{e.location ? ` · ${e.location}` : ''}
                        </p>
                      </div>
                      <span className="text-xs font-medium text-brand">{relativeLabel(e.startsAt, tz)}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <EventTypeBadge type={e.type} />
                      {!e.attendanceRequired ? <span className="text-xs text-ink-400">optional</span> : null}
                    </div>
                    {excuse ? (
                      <p className="mt-2 text-xs text-[#4f4180]">
                        Excuse request {excuse.status}: {excuse.reason}
                      </p>
                    ) : e.attendanceRequired ? (
                      <ExcuseRequestForm slug={slug} eventId={e.id} />
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-ink-900">My history</h2>
          {history.length === 0 ? (
            <EmptyState title="No events yet" />
          ) : (
            <ul className="card divide-y divide-line">
              {history.map((h) => (
                <li key={h.eventId} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="w-20 shrink-0 text-xs text-ink-400">{dateLabel(h.startsAt, tz).replace(/, \d{4}$/, '')}</span>
                  <Link href={`/c/${slug}/events/${h.eventId}`} className="min-w-0 flex-1 truncate text-sm text-ink-900 hover:text-brand">
                    {h.title}
                  </Link>
                  <AttendanceBadge status={h.record as AttendanceStatus | null} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
