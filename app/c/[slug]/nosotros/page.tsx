import { requireClub } from '@/lib/club-context';
import { prisma } from '@/lib/db';
import { can, ROLE_LABELS, ROLES, type Role } from '@/lib/permissions';
import { ProfileDialog, type ProfileValues } from '@/components/profile-form';
import { Chakana, Greca } from '@/components/landing/scene';
import { Avatar, EmptyState, PageHeader } from '@/components/ui';

export const metadata = { title: 'Conócenos — La Casa Peruana' };

const rank = (role: string) => {
  const i = ROLES.indexOf(role as Role);
  return i === -1 ? ROLES.length : i;
};

const toValues = (m: {
  displayName: string; photo: string | null; pronouns: string | null; major: string | null;
  gradYear: string | null; hometown: string | null; bio: string | null;
}): ProfileValues => ({
  displayName: m.displayName,
  photo: m.photo,
  pronouns: m.pronouns ?? '',
  major: m.major ?? '',
  gradYear: m.gradYear ?? '',
  hometown: m.hometown ?? '',
  bio: m.bio ?? '',
});

/** The house, with faces on it. Officers first, then everyone else. */
export default async function NosotrosPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireClub(slug);

  const people = await prisma.membership.findMany({
    where: { clubId: ctx.club.id, status: { not: 'removed' } },
    orderBy: { displayName: 'asc' },
    select: {
      id: true, displayName: true, role: true, photo: true, pronouns: true,
      major: true, gradYear: true, hometown: true, bio: true,
    },
  });

  const board = people.filter((p) => p.role !== 'member').sort((a, b) => rank(a.role) - rank(b.role));
  const members = people.filter((p) => p.role === 'member');
  const me = people.find((p) => p.id === ctx.membership.id);
  const canEditOthers = can(ctx.membership.role, 'member:edit');

  const detail = (p: (typeof people)[number]) =>
    [p.gradYear ? `Class of ${p.gradYear}` : null, p.major, p.hometown].filter(Boolean).join(' · ');

  return (
    <>
      <PageHeader
        eyebrow="Conócenos · Get to know the house"
        title="Our people"
        subtitle={`${board.length} on the E-board · ${members.length} member${members.length === 1 ? '' : 's'}`}
      >
        {me ? (
          <ProfileDialog
            slug={slug}
            membershipId={me.id}
            values={toValues(me)}
            label="Edit my profile"
            className="btn-secondary btn-sm"
          />
        ) : null}
      </PageHeader>

      <section className="mb-10">
        <div className="mb-4 flex items-center gap-3">
          <Chakana className="h-4 w-4 fill-inti" />
          <h2 className="text-sm font-semibold text-ink-900">Junta Directiva</h2>
          <span className="micro text-ink-400">E-board</span>
          <Greca className="h-2 flex-1 text-inti/25" />
        </div>

        {board.length === 0 ? (
          <EmptyState title="No officers yet" body="Assign roles from a member's profile." />
        ) : (
          <ul className="stagger grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {board.map((p) => (
              <li key={p.id} className="card overflow-hidden">
                <div className="relative aspect-square w-full bg-gradient-to-br from-brand-soft to-inti-soft">
                  {p.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.photo} alt={p.displayName} className="h-full w-full object-cover" />
                  ) : (
                    <span className="absolute inset-0 grid place-items-center">
                      <span className="display text-5xl text-brand/50">
                        {p.displayName.split(/\s+/).slice(0, 2).map((x) => x[0]?.toUpperCase()).join('')}
                      </span>
                    </span>
                  )}
                </div>
                <div className="p-4">
                  <p className="micro text-[#8a6412]">{ROLE_LABELS[p.role as Role] ?? p.role}</p>
                  <h3 className="display mt-1 text-2xl leading-tight text-ink-900">{p.displayName}</h3>
                  {p.pronouns ? <p className="text-xs text-ink-400">{p.pronouns}</p> : null}
                  {detail(p) ? <p className="mt-1.5 text-xs text-ink-500">{detail(p)}</p> : null}
                  {p.bio ? <p className="mt-3 text-sm leading-relaxed text-ink-700">{p.bio}</p> : null}
                  {canEditOthers || p.id === ctx.membership.id ? (
                    <div className="mt-4">
                      <ProfileDialog
                        slug={slug}
                        membershipId={p.id}
                        values={toValues(p)}
                        label="Edit"
                        className="btn-ghost btn-sm px-0"
                      />
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="mb-4 flex items-center gap-3">
          <Chakana className="h-4 w-4 fill-piedra" />
          <h2 className="text-sm font-semibold text-ink-900">La Casa</h2>
          <span className="micro text-ink-400">Members</span>
          <Greca className="h-2 flex-1 text-piedra/20" />
        </div>

        {members.length === 0 ? (
          <EmptyState title="No members yet" body="Add them from the Members page." />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {members.map((p) => (
              <li key={p.id} className="card card-pad flex gap-3.5">
                <Avatar name={p.displayName} photo={p.photo} size="lg" />
                <div className="min-w-0 flex-1">
                  <h3 className="display truncate text-lg leading-tight text-ink-900">{p.displayName}</h3>
                  {p.pronouns ? <p className="text-xs text-ink-400">{p.pronouns}</p> : null}
                  {detail(p) ? <p className="mt-1 text-xs text-ink-500">{detail(p)}</p> : null}
                  {p.bio ? <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-ink-700">{p.bio}</p> : null}
                  {canEditOthers || p.id === ctx.membership.id ? (
                    <ProfileDialog
                      slug={slug}
                      membershipId={p.id}
                      values={toValues(p)}
                      label="Edit"
                      className="btn-ghost btn-sm mt-2 px-0"
                    />
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
