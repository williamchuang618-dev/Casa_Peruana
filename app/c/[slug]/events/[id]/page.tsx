import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireClub } from '@/lib/club-context';
import { prisma } from '@/lib/db';
import { computeClubStandings } from '@/lib/standings';
import { can } from '@/lib/permissions';
import { dateLabelLong, timeLabel, toLocalInput } from '@/lib/dates';
import { EVENT_TYPE_LABELS, type AttendanceStatus, type EventType } from '@/lib/rules';
import { AttendanceForm, type RollCallRow } from '@/components/attendance-form';
import { EventActions, ExcuseDecision } from '@/components/event-actions';
import { AttendanceBadge, Avatar, EventTypeBadge, PageHeader, StatCard } from '@/components/ui';

export default async function EventPage({
  params,
}: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const ctx = await requireClub(slug);
  const tz = ctx.club.timezone;

  const event = await prisma.event.findFirst({
    where: { id, clubId: ctx.club.id },
    include: {
      invitees: {
        include: {
          membership: { select: { id: true, displayName: true, email: true, role: true, status: true, photo: true } },
        },
      },
      attendance: true,
      excuses: {
        include: { membership: { select: { id: true, displayName: true } } },
        orderBy: { createdAt: 'desc' },
      },
    },
  });
  if (!event) notFound();

  const standings = await computeClubStandings(ctx.club.id, ctx.semester?.id ?? null, ctx.rules);
  const pointsByMember = new Map(standings.map((s) => [s.membershipId, s.standing.absencePoints]));
  const records = new Map(event.attendance.map((a) => [a.membershipId, a.status as AttendanceStatus]));

  const rows: RollCallRow[] = event.invitees
    .map((i) => ({
      membershipId: i.membership.id,
      displayName: i.membership.displayName,
      email: i.membership.email,
      role: i.membership.role,
      memberStatus: i.membership.status,
      absencePoints: pointsByMember.get(i.membership.id) ?? 0,
      photo: i.membership.photo,
      current: records.get(i.membership.id) ?? null,
      pendingExcuse:
        event.excuses.find((e) => e.membershipId === i.membership.id && e.status === 'pending')?.reason ?? null,
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

  const count = (s: AttendanceStatus) => event.attendance.filter((a) => a.status === s).length;
  const present = count('present');
  const late = count('late');
  const excused = count('excused');
  const absent = count('absent');
  const eligible = event.invitees.length - excused;
  const pct = eligible > 0 && event.attendanceTakenAt ? Math.round(((present + late) / eligible) * 100) : null;

  const canTake = can(ctx.membership.role, 'attendance:take');
  const local = toLocalInput(event.startsAt, tz);
  const localEnd = toLocalInput(event.endsAt, tz);
  const pendingExcuses = event.excuses.filter((e) => e.status === 'pending');

  return (
    <>
      <Link href={`/c/${slug}/events`} className="mb-4 inline-block text-sm text-ink-500 hover:text-brand">
        ← All events
      </Link>

      <PageHeader
        eyebrow="Evento"
        title={event.title}
        subtitle={`${dateLabelLong(event.startsAt, tz)} · ${timeLabel(event.startsAt, tz)}–${timeLabel(event.endsAt, tz)}${
          event.location ? ` · ${event.location}` : ''
        }`}
      >
        <EventActions
          slug={slug}
          eventId={event.id}
          status={event.status}
          canEdit={can(ctx.membership.role, 'event:edit')}
          canDelete={can(ctx.membership.role, 'event:delete')}
          values={{
            title: event.title,
            type: event.type,
            description: event.description ?? '',
            location: event.location ?? '',
            date: local.date,
            startTime: local.time,
            endTime: localEnd.time,
            attendanceRequired: event.attendanceRequired,
          }}
        />
      </PageHeader>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <EventTypeBadge type={event.type} />
        {event.status === 'cancelled' ? (
          <span className="badge bg-[#f9e3e1] text-[#78201a] ring-1 ring-[#8d2820]/20">Cancelled — no absences counted</span>
        ) : event.status === 'completed' ? (
          <span className="badge bg-[#eaf1ea] text-[#2f5540] ring-1 ring-[#355c42]/15">Completed</span>
        ) : (
          <span className="badge bg-[#eeeae1] text-[#5d554a] ring-1 ring-[#6f6659]/15">Scheduled</span>
        )}
        {!event.attendanceRequired ? (
          <span className="badge bg-[#eeeae1] text-[#5d554a] ring-1 ring-[#6f6659]/15">Attendance optional</span>
        ) : null}
        {!event.attendanceTakenAt ? (
          <span className="badge bg-[#fbf0d7] text-[#8a6412] ring-1 ring-[#a97d1c]/15">Attendance not taken</span>
        ) : null}
        {event.checkinCode && canTake ? (
          <span className="badge bg-brand-soft text-brand">Check-in code {event.checkinCode}</span>
        ) : null}
      </div>

      {event.description ? (
        <p className="card card-pad mb-6 text-sm text-ink-700">{event.description}</p>
      ) : null}

      <div className="stagger mb-6 grid gap-4 grid-cols-2 lg:grid-cols-5">
        <StatCard label="Expected" value={event.invitees.length} />
        <StatCard label="Present" value={present + late} tone="good" hint={late ? `${late} late` : undefined} />
        <StatCard label="Absent" value={absent} tone={absent ? 'danger' : 'default'} />
        <StatCard label="Excused" value={excused} />
        <StatCard label="Attendance" value={pct === null ? '—' : `${pct}%`} hint={pct === null ? 'Not taken yet' : undefined} />
      </div>

      {pendingExcuses.length > 0 && can(ctx.membership.role, 'excuse:decide') ? (
        <section className="card mb-6 border-[#b9afd6]/60">
          <h2 className="border-b border-line px-4 py-3 text-sm font-semibold text-ink-900">
            Excuse requests <span className="ml-1 text-xs font-normal text-ink-400">{pendingExcuses.length}</span>
          </h2>
          <ul className="divide-y divide-line">
            {pendingExcuses.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <Avatar name={e.membership.displayName} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink-900">{e.membership.displayName}</p>
                  <p className="text-xs text-ink-500">{e.reason}</p>
                </div>
                <ExcuseDecision slug={slug} requestId={e.id} />
              </li>
            ))}
          </ul>
          <p className="border-t border-line px-4 py-2 text-xs text-ink-400">
            Approving writes an Excused record for this event, which does not count against the member.
          </p>
        </section>
      ) : null}

      {canTake ? (
        <AttendanceForm
          slug={slug}
          eventId={event.id}
          rows={rows}
          maxAbsences={ctx.rules.maxAbsencePoints}
          readOnly={event.status === 'cancelled'}
        />
      ) : (
        <section className="card overflow-hidden">
          <h2 className="border-b border-line px-4 py-3 text-sm font-semibold text-ink-900">Attendance</h2>
          <ul className="divide-y divide-line">
            {rows.map((r) => (
              <li key={r.membershipId} className="flex items-center gap-3 px-4 py-2.5">
                <Avatar name={r.displayName} photo={r.photo} size="sm" />
                <span className="flex-1 truncate text-sm text-ink-900">{r.displayName}</span>
                <AttendanceBadge status={r.current} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { id } = await params;
  const event = await prisma.event.findUnique({ where: { id }, select: { title: true, type: true } });
  return {
    title: event ? `${event.title} — ${EVENT_TYPE_LABELS[event.type as EventType] ?? 'Event'}` : 'Event',
  };
}
