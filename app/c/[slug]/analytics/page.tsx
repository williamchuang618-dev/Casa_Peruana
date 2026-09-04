import Link from 'next/link';
import { requireView } from '@/lib/club-context';
import { prisma } from '@/lib/db';
import { computeClubStandings } from '@/lib/standings';
import { dateLabel } from '@/lib/dates';
import { EVENT_TYPE_LABELS, type EventType } from '@/lib/rules';
import { eventStyle } from '@/lib/theme';
import { EmptyState, PageHeader, StatCard } from '@/components/ui';

export const metadata = { title: 'Analytics — La Casa Peruana' };

export default async function AnalyticsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireView(slug, 'analytics:view');
  const tz = ctx.club.timezone;

  const [standings, events] = await Promise.all([
    computeClubStandings(ctx.club.id, ctx.semester?.id ?? null, ctx.rules),
    prisma.event.findMany({
      where: {
        clubId: ctx.club.id,
        ...(ctx.semester ? { semesterId: ctx.semester.id } : {}),
        status: 'completed',
        attendanceTakenAt: { not: null },
      },
      orderBy: { startsAt: 'asc' },
      include: { _count: { select: { invitees: true } }, attendance: { select: { status: true } } },
    }),
  ]);

  const roster = standings.filter((s) => s.standing.status !== 'removed');

  const perEvent = events.map((e) => {
    const present = e.attendance.filter((a) => a.status === 'present' || a.status === 'late').length;
    const excused = e.attendance.filter((a) => a.status === 'excused').length;
    const eligible = Math.max(1, e._count.invitees - excused);
    return {
      id: e.id,
      title: e.title,
      type: e.type,
      date: e.startsAt,
      present,
      expected: e._count.invitees,
      rate: present / eligible,
    };
  });

  const overall = perEvent.length
    ? perEvent.reduce((a, e) => a + e.rate, 0) / perEvent.length
    : null;
  const avgHeads = perEvent.length
    ? Math.round(perEvent.reduce((a, e) => a + e.present, 0) / perEvent.length)
    : 0;

  const mostActive = [...roster]
    .filter((s) => s.standing.countedEvents > 0)
    .sort((a, b) =>
      b.standing.attended - a.standing.attended ||
      (b.standing.attendancePct ?? 0) - (a.standing.attendancePct ?? 0))
    .slice(0, 6);

  const mostAbsent = [...roster]
    .filter((s) => s.standing.absencePoints > 0)
    .sort((a, b) => b.standing.absencePoints - a.standing.absencePoints)
    .slice(0, 6);

  const byType = new Map<string, { count: number; rate: number }>();
  for (const e of perEvent) {
    const cur = byType.get(e.type) ?? { count: 0, rate: 0 };
    byType.set(e.type, { count: cur.count + 1, rate: cur.rate + e.rate });
  }

  return (
    <>
      <PageHeader
        eyebrow="Análisis"
        title="Analytics"
        subtitle={ctx.semester ? `${ctx.semester.name} · ${events.length} recorded events` : 'All time'}
      />

      <div className="stagger mb-6 grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Club attendance rate"
          value={overall === null ? '—' : `${Math.round(overall * 100)}%`}
          hint="Average across recorded events"
        />
        <StatCard label="Average attendance" value={avgHeads} hint="Members present per event" />
        <StatCard label="Events held" value={events.length} hint="Attendance recorded" />
        <StatCard
          label="Members at risk"
          value={roster.filter((s) => s.standing.absencePoints >= ctx.rules.maxAbsencePoints - 1).length}
          tone="risk"
          hint={`${ctx.rules.maxAbsencePoints - 1}+ absences`}
        />
      </div>

      {perEvent.length === 0 ? (
        <EmptyState title="Nothing to chart yet" body="Record attendance for at least one event." />
      ) : (
        <section className="card card-pad mb-6">
          <h2 className="mb-1 text-sm font-semibold text-ink-900">Attendance trend</h2>
          <p className="mb-5 text-xs text-ink-500">Share of expected members present at each recorded event.</p>
          <div className="flex items-end justify-start gap-3 overflow-x-auto pb-1" style={{ height: 180 }}>
            {perEvent.map((e) => (
              <Link
                key={e.id}
                href={`/c/${slug}/events/${e.id}`}
                className="group flex min-w-14 max-w-24 flex-1 flex-col items-center justify-end gap-1.5"
                title={`${e.title} · ${Math.round(e.rate * 100)}%`}
              >
                <span className="text-xs font-medium tabular-nums text-ink-700">{Math.round(e.rate * 100)}%</span>
                <span
                  className={`w-full rounded-t-md transition-opacity group-hover:opacity-80 ${eventStyle(e.type).dot}`}
                  style={{ height: `${Math.max(4, e.rate * 120)}px` }}
                />
                <span className="w-full truncate text-center text-[10px] text-ink-400">
                  {dateLabel(e.date, tz).replace(/, \d{4}$/, '')}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <section>
          <h2 className="mb-3 text-sm font-semibold text-ink-900">Most active members</h2>
          <ol className="card divide-y divide-line">
            {mostActive.map((s, i) => (
              <li key={s.membershipId} className="flex items-center gap-3 px-4 py-2.5">
                <span className="w-4 text-xs tabular-nums text-ink-400">{i + 1}</span>
                <Link href={`/c/${slug}/members/${s.membershipId}`} className="min-w-0 flex-1 truncate text-sm font-medium text-ink-900 hover:text-brand">
                  {s.displayName}
                </Link>
                <span className="text-xs tabular-nums text-ink-500">
                  {s.standing.attended}/{s.standing.countedEvents}
                </span>
              </li>
            ))}
            {mostActive.length === 0 ? <li className="px-4 py-6 text-center text-sm text-ink-400">No data yet.</li> : null}
          </ol>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-ink-900">Most absences</h2>
          <ol className="card divide-y divide-line">
            {mostAbsent.map((s, i) => (
              <li key={s.membershipId} className="flex items-center gap-3 px-4 py-2.5">
                <span className="w-4 text-xs tabular-nums text-ink-400">{i + 1}</span>
                <Link href={`/c/${slug}/members/${s.membershipId}`} className="min-w-0 flex-1 truncate text-sm font-medium text-ink-900 hover:text-brand">
                  {s.displayName}
                </Link>
                <span className={`text-xs tabular-nums ${s.standing.absencePoints >= ctx.rules.maxAbsencePoints ? 'font-semibold text-[#8d2820]' : 'text-ink-500'}`}>
                  {s.standing.absencePoints} / {ctx.rules.maxAbsencePoints}
                </span>
              </li>
            ))}
            {mostAbsent.length === 0 ? <li className="px-4 py-6 text-center text-sm text-ink-400">Nobody has an absence.</li> : null}
          </ol>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-ink-900">By event type</h2>
          <ul className="card divide-y divide-line">
            {[...byType.entries()].map(([type, v]) => (
              <li key={type} className="flex items-center gap-3 px-4 py-2.5">
                <span className={`h-2 w-2 rounded-full ${eventStyle(type).dot}`} aria-hidden />
                <span className="min-w-0 flex-1 truncate text-sm text-ink-900">
                  {EVENT_TYPE_LABELS[type as EventType] ?? 'Other'}
                </span>
                <span className="text-xs text-ink-400">{v.count}×</span>
                <span className="text-xs font-medium tabular-nums text-ink-700">
                  {Math.round((v.rate / v.count) * 100)}%
                </span>
              </li>
            ))}
            {byType.size === 0 ? <li className="px-4 py-6 text-center text-sm text-ink-400">No data yet.</li> : null}
          </ul>
        </section>
      </div>
    </>
  );
}
