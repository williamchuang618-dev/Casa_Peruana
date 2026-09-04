import Link from 'next/link';
import { requireView } from '@/lib/club-context';
import { prisma } from '@/lib/db';
import { computeClubStandings } from '@/lib/standings';
import { dateLabel, relativeLabel } from '@/lib/dates';
import { ATTENDANCE_LABELS, type AttendanceStatus } from '@/lib/rules';
import { ATTENDANCE_STYLE } from '@/lib/theme';
import { EmptyState, PageHeader } from '@/components/ui';

export const metadata = { title: 'Attendance — La Casa Peruana' };

/**
 * The cross-event grid: every counted event as a column, every member as a row.
 * This is the view an E-board actually argues over, so it shows the raw marks
 * rather than a derived summary.
 */
export default async function AttendanceGridPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireView(slug, 'attendance:take');
  const tz = ctx.club.timezone;
  const now = new Date();

  const [standings, events, untaken] = await Promise.all([
    computeClubStandings(ctx.club.id, ctx.semester?.id ?? null, ctx.rules),
    prisma.event.findMany({
      where: {
        clubId: ctx.club.id,
        ...(ctx.semester ? { semesterId: ctx.semester.id } : {}),
        status: 'completed',
        attendanceTakenAt: { not: null },
      },
      orderBy: { startsAt: 'asc' },
      select: { id: true, title: true, startsAt: true, attendanceRequired: true },
    }),
    prisma.event.findMany({
      where: {
        clubId: ctx.club.id,
        startsAt: { lt: now },
        attendanceTakenAt: null,
        status: { not: 'cancelled' },
        ...(ctx.semester ? { semesterId: ctx.semester.id } : {}),
      },
      orderBy: { startsAt: 'desc' },
      select: { id: true, title: true, startsAt: true },
    }),
  ]);

  const roster = standings.filter((s) => s.standing.status !== 'removed');
  const recordFor = new Map(
    roster.map((s) => [s.membershipId, new Map(s.history.map((h) => [h.eventId, h.record]))]),
  );

  return (
    <>
      <PageHeader
        eyebrow="Registro de asistencia"
        title="Attendance"
        subtitle={`${events.length} recorded event${events.length === 1 ? '' : 's'}${ctx.semester ? ` · ${ctx.semester.name}` : ''}`}
      />

      {untaken.length > 0 ? (
        <section className="card mb-6 border-[#e3c37a]/60 bg-[#fbf0d7]/40 px-4 py-3">
          <h2 className="text-sm font-semibold text-ink-900">Waiting on you</h2>
          <p className="mt-0.5 mb-2 text-xs text-ink-500">
            These events have passed without attendance. Until you record it, nobody is marked absent.
          </p>
          <div className="flex flex-wrap gap-2">
            {untaken.map((e) => (
              <Link key={e.id} href={`/c/${slug}/events/${e.id}`} className="btn-secondary btn-sm">
                {e.title} · {relativeLabel(e.startsAt, tz)}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {events.length === 0 ? (
        <EmptyState title="No attendance recorded yet" body="Take attendance on a past event and it appears here." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-line bg-canvas">
              <tr>
                <th className="th sticky left-0 z-10 bg-canvas">Member</th>
                {events.map((e) => (
                  <th key={e.id} className="th whitespace-nowrap text-center">
                    <Link href={`/c/${slug}/events/${e.id}`} className="hover:text-brand">
                      <span className="block normal-case">{dateLabel(e.startsAt, tz).replace(/, \d{4}$/, '')}</span>
                      <span className="block max-w-24 truncate text-[10px] font-normal normal-case text-ink-400">
                        {e.title}
                      </span>
                    </Link>
                  </th>
                ))}
                <th className="th text-right">Absences</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {roster.map((s) => (
                <tr key={s.membershipId} className="hover:bg-line-soft">
                  <td className="td sticky left-0 z-10 whitespace-nowrap bg-surface">
                    <Link href={`/c/${slug}/members/${s.membershipId}`} className="font-medium text-ink-900 hover:text-brand">
                      {s.displayName}
                    </Link>
                  </td>
                  {events.map((e) => {
                    const record = recordFor.get(s.membershipId)?.get(e.id) ?? null;
                    return (
                      <td key={e.id} className="px-2 py-2 text-center">
                        {record ? (
                          <span
                            title={ATTENDANCE_LABELS[record as AttendanceStatus]}
                            className={`badge justify-center px-1.5 ${ATTENDANCE_STYLE[record as AttendanceStatus]}`}
                          >
                            {ATTENDANCE_LABELS[record as AttendanceStatus][0]}
                          </span>
                        ) : (
                          <span className="text-xs text-ink-400" title="Not recorded">·</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="td text-right tabular-nums font-medium">
                    <span className={s.standing.absencePoints >= ctx.rules.maxAbsencePoints ? 'text-[#8d2820]' : ''}>
                      {s.standing.absencePoints} / {ctx.rules.maxAbsencePoints}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-3 text-xs text-ink-500">
        {(['present', 'late', 'excused', 'absent'] as AttendanceStatus[]).map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className={`badge px-1.5 ${ATTENDANCE_STYLE[s]}`}>{ATTENDANCE_LABELS[s][0]}</span>
            {ATTENDANCE_LABELS[s]}
          </span>
        ))}
        <span className="flex items-center gap-1.5"><span className="text-ink-400">·</span> Not recorded</span>
      </div>
    </>
  );
}
