import { requireView } from '@/lib/club-context';
import { prisma } from '@/lib/db';
import { can, ROLE_CAPABILITIES, ROLE_LABELS, ROLES, CAPABILITIES } from '@/lib/permissions';
import { dateLabel, dateTimeLabel } from '@/lib/dates';
import { ClubProfileForm, GroupPanel, RulesForm, SemesterPanel } from '@/components/settings-forms';
import { ResetPanel } from '@/components/reset-panel';
import { PageHeader } from '@/components/ui';

export const metadata = { title: 'Settings — La Casa Peruana' };

export default async function SettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireView(slug, 'club:settings');
  const tz = ctx.club.timezone;

  const [semesters, groups, members, audit, club] = await Promise.all([
    prisma.semester.findMany({
      where: { clubId: ctx.club.id },
      orderBy: { startsOn: 'desc' },
      include: { _count: { select: { events: true } } },
    }),
    prisma.memberGroup.findMany({
      where: { clubId: ctx.club.id },
      orderBy: { name: 'asc' },
      include: { _count: { select: { members: true } } },
    }),
    prisma.membership.findMany({
      where: { clubId: ctx.club.id, status: { not: 'removed' } },
      orderBy: { displayName: 'asc' },
      select: { id: true, displayName: true },
    }),
    can(ctx.membership.role, 'audit:view')
      ? prisma.auditLog.findMany({ where: { clubId: ctx.club.id }, orderBy: { createdAt: 'desc' }, take: 40 })
      : Promise.resolve([]),
    prisma.club.findUnique({ where: { id: ctx.club.id }, select: { university: true } }),
  ]);

  return (
    <>
      <PageHeader eyebrow="Ajustes de la casa" title="Settings" subtitle={ctx.club.name} />

      <div className="space-y-6">
        <Section title="Attendance rules" description="These drive every status badge in the club.">
          <RulesForm slug={slug} rules={ctx.rules} semesterName={ctx.semester?.name ?? null} />
        </Section>

        <Section title="Semesters" description="Attendance is scoped to a semester; history stays available.">
          <SemesterPanel
            slug={slug}
            activeId={ctx.semester?.id ?? null}
            semesters={semesters.map((s) => ({
              id: s.id, name: s.name,
              startsOn: dateLabel(s.startsOn, tz), endsOn: dateLabel(s.endsOn, tz),
              events: s._count.events,
            }))}
          />
        </Section>

        <Section title="Club profile">
          <ClubProfileForm
            slug={slug}
            values={{
              name: ctx.club.name,
              university: club?.university ?? '',
              logoEmoji: ctx.club.logoEmoji,
              timezone: ctx.club.timezone,
            }}
          />
          <div className="mt-5 rounded-lg bg-canvas p-4">
            <p className="text-xs text-ink-500">Join code — members enter this to join the club</p>
            <p className="mt-1 font-mono text-xl tracking-widest text-ink-900">{ctx.club.joinCode}</p>
          </div>
        </Section>

        <Section title="Member groups" description="Invite a committee or cohort to an event in one click.">
          <GroupPanel
            slug={slug}
            groups={groups.map((g) => ({ id: g.id, name: g.name, count: g._count.members }))}
            members={members}
          />
        </Section>

        <Section title="Roles and permissions" description="Roles are assigned on the member's profile.">
          <div className="overflow-x-auto">
            <table className="w-full min-w-3xl text-sm">
              <thead>
                <tr>
                  <th className="th">Capability</th>
                  {ROLES.map((r) => <th key={r} className="th text-center">{ROLE_LABELS[r].split(' ')[0]}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {CAPABILITIES.map((cap) => (
                  <tr key={cap}>
                    <td className="td font-mono text-xs text-ink-500">{cap}</td>
                    {ROLES.map((r) => (
                      <td key={r} className="td text-center">
                        {ROLE_CAPABILITIES[r].includes(cap)
                          ? <span className="text-[#355c42]">✓</span>
                          : <span className="text-ink-400">·</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {can(ctx.membership.role, 'club:manage_roles') ? (
          <Section
            title="Reset"
            description="Start a term over. Every one of these is logged in the audit history below."
          >
            <ResetPanel slug={slug} clubName={ctx.club.name} />
          </Section>
        ) : null}

        {can(ctx.membership.role, 'audit:view') ? (
          <Section
            title="Audit history"
            description="Attendance decides membership, so every change is recorded."
          >
            <ul className="divide-y divide-line">
              {audit.map((a) => (
                <li key={a.id} className="flex flex-wrap items-baseline gap-x-2 py-2">
                  <span className="text-sm font-medium text-ink-900">{a.actorName}</span>
                  <span className="min-w-0 flex-1 text-sm text-ink-600">{a.summary}</span>
                  <time className="text-xs text-ink-400" dateTime={a.createdAt.toISOString()}>
                    {dateTimeLabel(a.createdAt, tz)}
                  </time>
                </li>
              ))}
              {audit.length === 0 ? <li className="py-4 text-sm text-ink-400">Nothing logged yet.</li> : null}
            </ul>
          </Section>
        ) : null}
      </div>
    </>
  );
}

function Section({
  title, description, children,
}: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="card card-pad">
      <h2 className="text-sm font-semibold text-ink-900">{title}</h2>
      {description ? <p className="mt-0.5 mb-4 text-xs text-ink-500">{description}</p> : <div className="mb-4" />}
      {children}
    </section>
  );
}
