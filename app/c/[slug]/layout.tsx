import { requireClub } from '@/lib/club-context';
import { computeClubStandings } from '@/lib/standings';
import { Sidebar } from '@/components/sidebar';
import { statusRank } from '@/lib/rules';

export default async function ClubLayout({
  children, params,
}: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireClub(slug);

  const standings = await computeClubStandings(ctx.club.id, ctx.semester?.id ?? null, ctx.rules);
  const attention = standings.filter(
    (s) => statusRank(s.standing.status) >= statusRank('at_risk') && s.standing.status !== 'removed',
  ).length;

  return (
    <div className="flex min-h-full flex-col lg:flex-row">
      <Sidebar
        slug={slug}
        clubName={ctx.club.name}
        clubEmoji={ctx.club.logoEmoji}
        semesterName={ctx.semester?.name ?? null}
        userName={ctx.user.name}
        role={ctx.membership.role}
        attentionCount={attention}
      />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
