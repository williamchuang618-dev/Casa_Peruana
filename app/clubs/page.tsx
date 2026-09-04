import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { logout } from '@/app/actions/auth';
import { prisma } from '@/lib/db';
import { CreateClubForm, JoinClubForm } from '@/components/club-forms';
import { ROLE_LABELS, type Role } from '@/lib/permissions';
import { StatusBadge } from '@/components/ui';

export const metadata = { title: 'Your clubs — La Casa Peruana' };

export default async function ClubsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  // One person, many clubs, a different role in each — this list is the proof.
  const memberships = await prisma.membership.findMany({
    where: { userId: user.id },
    include: { club: { select: { slug: true, name: true, logoEmoji: true, university: true } } },
    orderBy: { joinedOn: 'asc' },
  });

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="display text-3xl font-normal tracking-tight">Your clubs</h1>
          <p className="mt-1 text-sm text-ink-500">Signed in as {user.name} · {user.email}</p>
        </div>
        <form action={logout}><button className="btn-ghost btn-sm">Sign out</button></form>
      </header>

      {memberships.length > 0 ? (
        <ul className="mb-10 space-y-2">
          {memberships.map((m) => (
            <li key={m.id}>
              <Link
                href={`/c/${m.club.slug}`}
                className="card flex items-center gap-3 px-4 py-3.5 transition-colors hover:border-brand/40"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-soft text-lg" aria-hidden>
                  {m.club.logoEmoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink-900">{m.club.name}</span>
                  <span className="block truncate text-xs text-ink-400">
                    {ROLE_LABELS[m.role as Role] ?? m.role}
                    {m.club.university ? ` · ${m.club.university}` : ''}
                  </span>
                </span>
                <StatusBadge status={m.status} />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="card card-pad mb-10 text-center text-sm text-ink-500">
          You are not in any clubs yet. Create one below, or join with a code.
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <section className="card card-pad">
          <h2 className="mb-4 text-sm font-semibold text-ink-900">Start a new club</h2>
          <CreateClubForm />
        </section>
        <section className="card card-pad h-fit">
          <h2 className="mb-4 text-sm font-semibold text-ink-900">Join an existing club</h2>
          <JoinClubForm />
        </section>
      </div>
    </main>
  );
}
