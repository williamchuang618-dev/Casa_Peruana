import { cache } from 'react';
import { redirect } from 'next/navigation';
import { prisma } from './db';
import { getCurrentUser, type SessionUser } from './auth';
import { rulesFor } from './standings';
import { can, type Capability } from './permissions';
import type { AttendanceRules } from './rules';

export interface ClubContext {
  user: SessionUser;
  club: { id: string; slug: string; name: string; logoEmoji: string; timezone: string; joinCode: string; university: string | null; ownerUserId: string };
  membership: { id: string; role: string; displayName: string; status: string };
  semester: { id: string; name: string; startsOn: Date; endsOn: Date } | null;
  rules: AttendanceRules;
}

/** Cached per request: the club shell, the dashboard and six cards share one lookup. */
export const getClubContext = cache(async (slug: string): Promise<ClubContext | null> => {
  const user = await getCurrentUser();
  if (!user) return null;

  const club = await prisma.club.findUnique({ where: { slug } });
  if (!club) return null;

  // Tenancy boundary: no membership row, no access to any of this club's data.
  const membership = await prisma.membership.findFirst({
    where: { clubId: club.id, userId: user.id },
  });
  if (!membership) return null;

  const semester = await prisma.semester.findFirst({
    where: { clubId: club.id, isActive: true },
  });
  const rules = await rulesFor(club.id, semester?.id ?? null);

  return {
    user,
    club: {
      id: club.id, slug: club.slug, name: club.name, logoEmoji: club.logoEmoji,
      timezone: club.timezone, joinCode: club.joinCode, university: club.university,
      ownerUserId: club.ownerUserId,
    },
    membership: {
      id: membership.id, role: membership.role,
      displayName: membership.displayName, status: membership.status,
    },
    semester: semester
      ? { id: semester.id, name: semester.name, startsOn: semester.startsOn, endsOn: semester.endsOn }
      : null,
    rules,
  };
});

export async function requireClub(slug: string): Promise<ClubContext> {
  const ctx = await getClubContext(slug);
  if (!ctx) {
    const user = await getCurrentUser();
    redirect(user ? '/clubs' : '/login');
  }
  return ctx;
}

/** For pages: bounce to the club home rather than showing a broken screen. */
export async function requireView(slug: string, capability: Capability): Promise<ClubContext> {
  const ctx = await requireClub(slug);
  if (!can(ctx.membership.role, capability)) redirect(`/c/${slug}/me`);
  return ctx;
}

/** For server actions: fail loudly, never silently no-op. */
export async function requireCapability(slug: string, capability: Capability): Promise<ClubContext> {
  const ctx = await getClubContext(slug);
  if (!ctx) throw new Error('Not a member of this club.');
  if (!can(ctx.membership.role, capability)) {
    throw new Error(`Your role (${ctx.membership.role}) cannot perform this action.`);
  }
  return ctx;
}
