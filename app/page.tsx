import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { computeClubStandings, rulesFor } from '@/lib/standings';
import { Landing } from '@/components/landing/landing';

export const metadata = {
  title: 'La Casa Peruana',
  description: 'Ayni — asistencia y participación para La Casa Peruana.',
};

/**
 * The public face of the house. Numbers are real: they come from whichever club
 * this deployment serves, so the landing page is never stale marketing copy.
 */
export default async function Home() {
  const user = await getCurrentUser();

  const club =
    (await prisma.club.findUnique({ where: { slug: 'la-casa-peruana' } })) ??
    (await prisma.club.findFirst({ orderBy: { createdAt: 'asc' } }));

  let stats = { members: 0, events: 0, attendance: 0 };
  if (club) {
    const semester = await prisma.semester.findFirst({ where: { clubId: club.id, isActive: true } });
    const rules = await rulesFor(club.id, semester?.id ?? null);
    const standings = await computeClubStandings(club.id, semester?.id ?? null, rules);
    const roster = standings.filter((s) => s.standing.status !== 'removed');
    const totals = roster.reduce(
      (a, s) => ({
        attended: a.attended + s.standing.attended,
        eligible: a.eligible + (s.standing.countedEvents - s.standing.excused),
      }),
      { attended: 0, eligible: 0 },
    );
    stats = {
      members: roster.length,
      events: await prisma.event.count({
        where: { clubId: club.id, ...(semester ? { semesterId: semester.id } : {}) },
      }),
      attendance: totals.eligible ? Math.round((totals.attended / totals.eligible) * 100) : 0,
    };
  }

  // Signed-in members drop straight into their own club.
  let entryHref = '/login';
  if (user) {
    const membership = await prisma.membership.findFirst({
      where: { userId: user.id },
      include: { club: { select: { slug: true } } },
      orderBy: { joinedOn: 'asc' },
    });
    entryHref = membership ? `/c/${membership.club.slug}` : '/clubs';
  }

  return <Landing signedIn={Boolean(user)} entryHref={entryHref} stats={stats} />;
}
