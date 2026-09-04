import Link from 'next/link';
import { requireClub } from '@/lib/club-context';
import { prisma } from '@/lib/db';
import { computeClubStandings } from '@/lib/standings';
import { statusRank, warningMessage } from '@/lib/rules';
import { can } from '@/lib/permissions';
import { dateTimeLabel, relativeLabel } from '@/lib/dates';
import { CreateEventDialog } from '@/components/create-event-dialog';
import { AttendanceBadge, Avatar, EmptyState, EventTypeBadge, Meter, PageHeader, StatCard, StatusBadge } from '@/components/ui';
import { redirect } from 'next/navigation';

export default async function DashboardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireClub(slug);
  if (!can(ctx.membership.role, 'members:view_all')) redirect(`/c/${slug}/me`);

  const tz = ctx.club.timezone;
  const now = new Date();
  const semesterId = ctx.semester?.id ?? null;

  const [standings, upcoming, needsAttendance, recent, groups] = await Promise.all([
    computeClubStandings(ctx.club.id, semesterId, ctx.rules),
    prisma.event.findMany({
      where: { clubId: ctx.club.id, startsAt: { gte: now }, status: { not: 'cancelled' } },
      orderBy: { startsAt: 'asc' },
      take: 5,
      include: { _count: { select: { invitees: true } } },
    }),
    prisma.event.findMany({
      where: {
        clubId: ctx.club.id,
        startsAt: { lt: now },
        status: { not: 'cancelled' },
        attendanceTakenAt: null,
        ...(semesterId ? { semesterId } : {}),
      },
      orderBy: { startsAt: 'desc' },
      take: 4,
    }),
    prisma.auditLog.findMany({
      where: { clubId: ctx.club.id },
      orderBy: { createdAt: 'desc' },
      take: 6,
    }),
    prisma.memberGroup.findMany({
      where: { clubId: ctx.club.id },
      select: { id: true, name: true, _count: { select: { members: true } } },
    }),
  ]);

  const activeRoster = standings.filter((s) => s.standing.status !== 'removed');
  const bucket = (lo: number, hi: number) =>
    activeRoster.filter((s) => s.standing.absencePoints >= lo && s.standing.absencePoints < hi).length;

  const max = ctx.rules.maxAbsencePoints;
  const attention = activeRoster
    .filter((s) => statusRank(s.standing.status) >= statusRank('at_risk'))
    .sort((a, b) => b.standing.absencePoints - a.standing.absencePoints);

  const canTake = can(ctx.membership.role, 'attendance:take');

  return (
    <>
      <PageHeader
        eyebrow="La casa · Panel"
        title="Dashboard"
        subtitle={`${ctx.club.name}${ctx.semester ? ` · ${ctx.semester.name}` : ''} · ${max} absences allowed`}
      >
        {can(ctx.membership.role, 'event:create') ? (
          <CreateEventDialog
            slug={slug}
            today={new Date().toISOString().slice(0, 10)}
            members={activeRoster.map((s) => ({
              id: s.membershipId, displayName: s.displayName, email: s.email, role: s.role,
            }))}
            groups={groups.map((g) => ({ id: g.id, name: g.name, count: g._count.members }))}
          />
        ) : null}
      </PageHeader>

      <div className="stagger mb-6 grid gap-4 grid-cols-2 lg:grid-cols-5">
        <StatCard label="Active members" value={activeRoster.filter((s) => s.standing.status !== 'removal_required').length} hint={`${standings.length} on roster`} href={`/c/${slug}/members`} />
        <StatCard label="Upcoming events" value={upcoming.length} hint={upcoming[0] ? relativeLabel(upcoming[0].startsAt, tz) : 'None scheduled'} href={`/c/${slug}/calendar`} />
        <StatCard label={`1 of ${max} absences`} value={bucket(1, 2)} tone="warning" />
        <StatCard label={`2 of ${max} absences`} value={bucket(2, 3)} tone="risk" />
        <StatCard label="Reached threshold" value={activeRoster.filter((s) => s.standing.status === 'removal_required').length} tone="danger" hint="Needs a decision" />
      </div>

      {needsAttendance.length > 0 && canTake ? (
        <section className="card mb-6 border-[#e3c37a]/60 bg-[#fbf0d7]/40">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-ink-900">Attendance not taken</h2>
              <p className="mt-0.5 text-xs text-ink-500">
                These events already happened. Nobody is marked absent until attendance is recorded.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {needsAttendance.map((e) => (
                <Link key={e.id} href={`/c/${slug}/events/${e.id}`} className="btn-secondary btn-sm">
                  {e.title} · {relativeLabel(e.startsAt, tz)}
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-ink-900">
            Members requiring attention
            {attention.length > 0 ? <span className="ml-2 text-xs font-normal text-ink-400">{attention.length}</span> : null}
          </h2>
          {attention.length === 0 ? (
            <EmptyState title="Everyone is in good standing" body="Members appear here once they are one absence away from the limit." />
          ) : (
            <ul className="card divide-y divide-line">
              {attention.map((s) => (
                <li key={s.membershipId}>
                  <Link href={`/c/${slug}/members/${s.membershipId}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-line-soft">
                    <Avatar name={s.displayName} photo={s.photo} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-ink-900">{s.displayName}</span>
                        <StatusBadge status={s.standing.status} />
                      </div>
                      <p className="mt-1 truncate text-xs text-ink-500">
                        {warningMessage(s.standing, ctx.rules) ?? s.standing.reasons[0]}
                      </p>
                      <div className="mt-1.5 max-w-40">
                        <Meter
                          value={s.standing.absencePoints}
                          max={max}
                          tone={s.standing.status === 'removal_required' ? 'bg-[#9b2c22]' : 'bg-[#c96f3c]'}
                        />
                      </div>
                    </div>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-ink-700">
                      {s.standing.absencePoints} / {max}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <h2 className="mt-8 mb-3 text-sm font-semibold text-ink-900">Recent activity</h2>
          {recent.length === 0 ? (
            <EmptyState title="No activity yet" />
          ) : (
            <ul className="card divide-y divide-line">
              {recent.map((a) => (
                <li key={a.id} className="flex items-start gap-3 px-4 py-2.5">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ink-400" aria-hidden />
                  <p className="min-w-0 flex-1 text-sm text-ink-700">
                    <span className="font-medium text-ink-900">{a.actorName}</span>{' '}
                    <span className="text-ink-500">{a.summary.replace(/^\w/, (c) => c.toLowerCase())}</span>
                  </p>
                  <time className="shrink-0 text-xs text-ink-400" dateTime={a.createdAt.toISOString()}>
                    {dateTimeLabel(a.createdAt, tz)}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-ink-900">Upcoming</h2>
          {upcoming.length === 0 ? (
            <EmptyState title="Nothing scheduled" body="Create an event to get started." />
          ) : (
            <ul className="space-y-2">
              {upcoming.map((e) => (
                <li key={e.id}>
                  <Link href={`/c/${slug}/events/${e.id}`} className="card block px-4 py-3 transition-colors hover:border-brand/40">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-medium text-ink-900">{e.title}</span>
                      <span className="shrink-0 text-xs font-medium text-brand">{relativeLabel(e.startsAt, tz)}</span>
                    </div>
                    <p className="mt-1 text-xs text-ink-500">{dateTimeLabel(e.startsAt, tz)}{e.location ? ` · ${e.location}` : ''}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <EventTypeBadge type={e.type} />
                      <span className="text-xs text-ink-400">{e._count.invitees} expected</span>
                      {!e.attendanceRequired ? <span className="text-xs text-ink-400">· optional</span> : null}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <h2 className="mt-8 mb-3 text-sm font-semibold text-ink-900">This semester</h2>
          <div className="card card-pad space-y-3">
            <SummaryRow label="Roster" value={`${standings.length} members`} />
            <SummaryRow label="Events held" value={String(standings[0]?.history.filter((h) => h.counted).length ?? 0)} />
            <SummaryRow
              label="Club attendance rate"
              value={(() => {
                const totals = activeRoster.reduce(
                  (acc, s) => ({ a: acc.a + s.standing.attended, c: acc.c + (s.standing.countedEvents - s.standing.excused) }),
                  { a: 0, c: 0 },
                );
                return totals.c ? `${Math.round((totals.a / totals.c) * 100)}%` : '—';
              })()}
            />
            <div className="border-t border-line pt-3">
              <p className="text-xs text-ink-400">Join code</p>
              <p className="mt-1 font-mono text-lg tracking-widest text-ink-900">{ctx.club.joinCode}</p>
              <p className="mt-1 text-xs text-ink-400">Members enter this to join the club.</p>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-sm text-ink-500">{label}</span>
      <span className="text-sm font-semibold tabular-nums text-ink-900">{value}</span>
    </div>
  );
}
