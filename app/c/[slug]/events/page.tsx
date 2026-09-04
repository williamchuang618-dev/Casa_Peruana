import Link from 'next/link';
import { requireClub } from '@/lib/club-context';
import { prisma } from '@/lib/db';
import { pickerData } from '@/lib/queries';
import { can } from '@/lib/permissions';
import { dateLabel, dayKey, timeLabel } from '@/lib/dates';
import { CreateEventDialog } from '@/components/create-event-dialog';
import { EmptyState, EventTypeBadge, PageHeader } from '@/components/ui';

export const metadata = { title: 'Events — La Casa Peruana' };

export default async function EventsPage({
  params, searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ filter?: string }>;
}) {
  const { slug } = await params;
  const { filter = 'upcoming' } = await searchParams;
  const ctx = await requireClub(slug);
  const tz = ctx.club.timezone;
  const now = new Date();

  const where = {
    clubId: ctx.club.id,
    ...(filter === 'upcoming' ? { startsAt: { gte: now } } : {}),
    ...(filter === 'past' ? { startsAt: { lt: now } } : {}),
    ...(filter === 'needs_attendance'
      ? { startsAt: { lt: now }, attendanceTakenAt: null, status: { not: 'cancelled' } }
      : {}),
  };

  const [events, picker] = await Promise.all([
    prisma.event.findMany({
      where,
      orderBy: { startsAt: filter === 'past' ? 'desc' : 'asc' },
      include: { _count: { select: { invitees: true } }, attendance: { select: { status: true } } },
    }),
    pickerData(ctx.club.id),
  ]);

  const TABS = [
    ['upcoming', 'Upcoming'],
    ['past', 'Past'],
    ['needs_attendance', 'Needs attendance'],
    ['all', 'All'],
  ] as const;

  return (
    <>
      <PageHeader eyebrow="Eventos de la casa" title="Events" subtitle={`${events.length} event${events.length === 1 ? '' : 's'}`}>
        {can(ctx.membership.role, 'event:create') ? (
          <CreateEventDialog
            slug={slug}
            today={dayKey(now, tz)}
            members={picker.members}
            groups={picker.groups}
          />
        ) : null}
      </PageHeader>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {TABS.map(([value, label]) => (
          <Link
            key={value}
            href={`/c/${slug}/events?filter=${value}`}
            className={`btn btn-sm ring-1 ${
              filter === value ? 'bg-brand text-white ring-brand' : 'bg-surface text-ink-700 ring-line hover:bg-line-soft'
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      {events.length === 0 ? (
        <EmptyState title="No events here" body="Create one to start tracking attendance." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-3xl">
            <thead className="border-b border-line bg-canvas">
              <tr>
                <th className="th">Event</th>
                <th className="th">Type</th>
                <th className="th">When</th>
                <th className="th text-right">Expected</th>
                <th className="th text-right">Present</th>
                <th className="th text-right">Rate</th>
                <th className="th">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {events.map((e) => {
                const present = e.attendance.filter((a) => a.status === 'present' || a.status === 'late').length;
                const excused = e.attendance.filter((a) => a.status === 'excused').length;
                const eligible = e._count.invitees - excused;
                const pct = e.attendanceTakenAt && eligible > 0 ? Math.round((present / eligible) * 100) : null;
                return (
                  <tr key={e.id} className="hover:bg-line-soft">
                    <td className="td">
                      <Link href={`/c/${slug}/events/${e.id}`} className="font-medium text-ink-900 hover:text-brand">
                        {e.title}
                      </Link>
                      {e.location ? <div className="text-xs text-ink-400">{e.location}</div> : null}
                    </td>
                    <td className="td"><EventTypeBadge type={e.type} /></td>
                    <td className="td whitespace-nowrap">
                      {dateLabel(e.startsAt, tz)}
                      <span className="ml-1 text-xs text-ink-400">{timeLabel(e.startsAt, tz)}</span>
                    </td>
                    <td className="td text-right tabular-nums">{e._count.invitees}</td>
                    <td className="td text-right tabular-nums">{e.attendanceTakenAt ? present : '—'}</td>
                    <td className="td text-right tabular-nums">{pct === null ? '—' : `${pct}%`}</td>
                    <td className="td">
                      {e.status === 'cancelled' ? (
                        <span className="badge bg-[#f9e3e1] text-[#78201a] ring-1 ring-[#8d2820]/20">Cancelled</span>
                      ) : !e.attendanceTakenAt && e.startsAt < now ? (
                        <span className="badge bg-[#fbf0d7] text-[#8a6412] ring-1 ring-[#a97d1c]/15">Not taken</span>
                      ) : e.attendanceTakenAt ? (
                        <span className="badge bg-[#eaf1ea] text-[#2f5540] ring-1 ring-[#355c42]/15">Recorded</span>
                      ) : (
                        <span className="badge bg-[#eeeae1] text-[#5d554a] ring-1 ring-[#6f6659]/15">Scheduled</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
