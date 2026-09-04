import { requireView } from '@/lib/club-context';
import { computeClubStandings } from '@/lib/standings';
import { can } from '@/lib/permissions';
import { dateLabel } from '@/lib/dates';
import { MembersTable, type MemberRow } from '@/components/members-table';
import { AddMemberPanel } from '@/components/member-forms';
import { PageHeader } from '@/components/ui';

export const metadata = { title: 'Members — La Casa Peruana' };

export default async function MembersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireView(slug, 'members:view_all');
  const standings = await computeClubStandings(ctx.club.id, ctx.semester?.id ?? null, ctx.rules);

  const rows: MemberRow[] = standings.map((s) => ({
    id: s.membershipId,
    displayName: s.displayName,
    email: s.email,
    role: s.role,
    status: s.standing.status,
    joinedOn: dateLabel(s.joinedOn, ctx.club.timezone),
    attended: s.standing.attended,
    missed: s.standing.absent,
    countedEvents: s.standing.countedEvents,
    attendancePct: s.standing.attendancePct,
    absencePoints: s.standing.absencePoints,
    hasAccount: s.hasAccount,
    photo: s.photo,
  }));

  return (
    <>
      <PageHeader
        eyebrow="Padrón de miembros"
        title="Members"
        subtitle={`${rows.length} on the roster${ctx.semester ? ` · attendance shown for ${ctx.semester.name}` : ''}`}
      />
      {can(ctx.membership.role, 'member:invite') ? (
        <div className="mb-6"><AddMemberPanel slug={slug} actorRole={ctx.membership.role} /></div>
      ) : null}
      <MembersTable slug={slug} rows={rows} maxAbsences={ctx.rules.maxAbsencePoints} />
    </>
  );
}
