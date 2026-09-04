import { requireClub } from '@/lib/club-context';
import { calendarEvents, pickerData } from '@/lib/queries';
import { can } from '@/lib/permissions';
import { dayKey } from '@/lib/dates';
import { CalendarView, TypeLegend } from '@/components/calendar-view';
import { CreateEventDialog } from '@/components/create-event-dialog';
import { PageHeader } from '@/components/ui';

export default async function CalendarPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireClub(slug);
  const [events, picker] = await Promise.all([
    calendarEvents(ctx.club.id),
    pickerData(ctx.club.id),
  ]);
  const todayKey = dayKey(new Date(), ctx.club.timezone);

  return (
    <>
      <PageHeader
        eyebrow="Calendario"
        title="Calendar"
        subtitle={`All club activity${ctx.semester ? ` · ${ctx.semester.name}` : ''} · times shown in ${ctx.club.timezone.replace('_', ' ')}`}
      >
        {can(ctx.membership.role, 'event:create') ? (
          <CreateEventDialog slug={slug} today={todayKey} members={picker.members} groups={picker.groups} />
        ) : null}
      </PageHeader>

      <CalendarView slug={slug} tz={ctx.club.timezone} events={events} todayKey={todayKey} />
      <TypeLegend />
    </>
  );
}
