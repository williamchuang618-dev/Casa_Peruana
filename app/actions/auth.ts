'use server';

import { randomBytes } from 'node:crypto';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { createSession, destroySession, getCurrentUser, hashPassword, verifyPassword } from '@/lib/auth';
import { DEFAULT_RULES } from '@/lib/rules';
import { writeAudit } from '@/lib/audit';
import { currentTerm } from '@/lib/terms';
import type { ActionState } from '@/lib/action-state';

const str = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'club';
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = base;
  for (let i = 2; await prisma.club.findUnique({ where: { slug } }); i += 1) slug = `${base}-${i}`;
  return slug;
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no look-alikes
function joinCode(): string {
  return Array.from(randomBytes(6), (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

export async function signup(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const name = str(fd, 'name');
  const email = str(fd, 'email').toLowerCase();
  const password = String(fd.get('password') ?? '');

  if (!name || !email || !password) return { error: 'All fields are required.' };
  if (password.length < 8) return { error: 'Password must be at least 8 characters.' };
  if (await prisma.user.findUnique({ where: { email } })) {
    return { error: 'An account with that email already exists.' };
  }

  const user = await prisma.user.create({
    data: { name, email, passwordHash: await hashPassword(password) },
  });

  // Claim any roster rows an E-board created for this email before signup.
  await prisma.membership.updateMany({
    where: { email, userId: null },
    data: { userId: user.id },
  });

  await createSession(user.id);
  redirect('/clubs');
}

export async function login(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const email = str(fd, 'email').toLowerCase();
  const password = String(fd.get('password') ?? '');

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { error: 'Incorrect email or password.' };
  }
  await createSession(user.id);
  redirect('/clubs');
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect('/login');
}

export async function createClub(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const name = str(fd, 'name');
  if (!name) return { error: 'Club name is required.' };

  const slug = await uniqueSlug(slugify(name));
  const term = currentTerm();

  const club = await prisma.club.create({
    data: {
      name,
      slug,
      university: str(fd, 'university') || null,
      logoEmoji: str(fd, 'logoEmoji') || '🎯',
      timezone: str(fd, 'timezone') || 'America/New_York',
      joinCode: joinCode(),
      ownerUserId: user.id,
      memberships: {
        create: { userId: user.id, displayName: user.name, email: user.email, role: 'owner' },
      },
      semesters: {
        create: { name: term.name, startsOn: term.startsOn, endsOn: term.endsOn, isActive: true },
      },
      rules: { create: { ...DEFAULT_RULES, semesterId: null } },
    },
  });

  await writeAudit({
    clubId: club.id, actorName: user.name, action: 'club.create',
    entityType: 'club', entityId: club.id, summary: `Created ${name}`,
  });

  redirect(`/c/${slug}`);
}

export async function joinClub(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const code = str(fd, 'joinCode').toUpperCase();
  const club = await prisma.club.findUnique({ where: { joinCode: code } });
  if (!club) return { error: 'No club found with that join code.' };

  const existing = await prisma.membership.findFirst({
    where: { clubId: club.id, OR: [{ userId: user.id }, { email: user.email }] },
  });

  if (existing) {
    if (!existing.userId) {
      await prisma.membership.update({ where: { id: existing.id }, data: { userId: user.id } });
    }
  } else {
    await prisma.membership.create({
      data: { clubId: club.id, userId: user.id, displayName: user.name, email: user.email, role: 'member' },
    });
  }

  revalidatePath('/clubs');
  redirect(`/c/${club.slug}`);
}
