/**
 * Demo data. Builds the exact walkthrough from the product spec: weekly general
 * meetings, one member who has crossed the threshold, one at risk, one warned —
 * plus a second club where the same person is only a general member, which is
 * what proves the membership pivot works.
 *
 * Run: npm run seed
 */
import { PrismaClient } from '@prisma/client';
import { randomBytes, scrypt as _scrypt } from 'node:crypto';
import { promisify } from 'node:util';
import { DEFAULT_RULES } from '../lib/rules';

const prisma = new PrismaClient();
const scrypt = promisify(_scrypt) as (p: string, s: string, l: number) => Promise<Buffer>;

async function hash(password: string) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${(await scrypt(password, salt, 64)).toString('hex')}`;
}

const PASSWORD = 'demo12345';
const TZ = 'America/New_York';
/** 19:00 America/New_York = 23:00Z in September (EDT). */
const at = (iso: string, hourUtc = 23) => new Date(`${iso}T${String(hourUtc).padStart(2, '0')}:00:00Z`);

const ROSTER: Array<[string, string, string]> = [
  ['Camila Quispe', 'president@demo.club', 'owner'],
  ['Mateo Vargas', 'vp@demo.club', 'vice_president'],
  ['Valentina Ríos', 'secretary@demo.club', 'secretary'],
  ['Diego Salazar', 'treasurer@demo.club', 'treasurer'],
  ['Alejandro Huamán', 'alex@demo.club', 'member'],
  ['Sara Chávez', 'sara@demo.club', 'member'],
  ['Miguel Ledesma', 'miguel@demo.club', 'member'],
  ['Emilia García', 'emilia@demo.club', 'member'],
  ['Joaquín Salcedo', 'joaquin@demo.club', 'member'],
  ['Ayelén Condori', 'ayelen@demo.club', 'member'],
  ['Rodrigo Paredes', 'rodrigo@demo.club', 'member'],
  ['Fernanda Ocampo', 'fernanda@demo.club', 'member'],
  ['Nicolás Ttito', 'nicolas@demo.club', 'member'],
  ['Antonella Mendoza', 'antonella@demo.club', 'member'],
  ['Bruno Zevallos', 'bruno@demo.club', 'member'],
  ['Lucía Tapia', 'lucia@demo.club', 'member'],
  ['Sebastián Yupanqui', 'sebastian@demo.club', 'member'],
  ['Micaela Flores', 'micaela@demo.club', 'member'],
];

/** Deterministic so the demo tells the same story on every reseed. */
const SCRIPT: Record<string, Array<'present' | 'absent' | 'excused' | 'late'>> = {
  // [Reunión Aug 20, Taller Aug 25, Reunión Aug 27, Reunión Sep 3]
  'alex@demo.club':      ['absent', 'present', 'absent', 'absent'],
  'miguel@demo.club':    ['absent', 'present', 'present', 'absent'],
  'sara@demo.club':      ['present', 'present', 'absent', 'present'],
  'emilia@demo.club':    ['late', 'excused', 'present', 'late'],
  'joaquin@demo.club':   ['present', 'present', 'present', 'present'],
  'ayelen@demo.club':    ['present', 'present', 'present', 'excused'],
  'rodrigo@demo.club':   ['present', 'absent', 'present', 'present'],
  'fernanda@demo.club':  ['present', 'present', 'late', 'present'],
  'nicolas@demo.club':   ['excused', 'present', 'present', 'absent'],
  'antonella@demo.club': ['present', 'present', 'present', 'present'],
  'bruno@demo.club':     ['present', 'absent', 'present', 'absent'],
  'lucia@demo.club':     ['present', 'present', 'present', 'present'],
  'sebastian@demo.club': ['present', 'present', 'present', 'present'],
  'micaela@demo.club':   ['present', 'late', 'present', 'present'],
};

/** Directory copy so "Conócenos" has something to show on a fresh install. */
const PROFILES: Record<string, { pronouns?: string; major?: string; gradYear?: string; hometown?: string; bio?: string }> = {
  'president@demo.club': {
    pronouns: 'she/her', major: 'International Relations', gradYear: '2027', hometown: 'Lima, Perú',
    bio: 'Started the house in her sophomore year after failing to find a single peña within walking distance. Runs the general meetings and makes the causa for every social.',
  },
  'vp@demo.club': {
    pronouns: 'he/him', major: 'Economics', gradYear: '2027', hometown: 'Trujillo, Perú',
    bio: 'Handles partnerships with the other Latin American student groups on campus. Will argue that Trujillo marinera is the only marinera.',
  },
  'secretary@demo.club': {
    pronouns: 'she/her', major: 'Public Health', gradYear: '2028', hometown: 'Paterson, NJ',
    bio: 'Keeps the roster and takes attendance. Grew up in a Peruvian household in New Jersey and joined to reconnect with the language.',
  },
  'treasurer@demo.club': {
    pronouns: 'he/him', major: 'Finance', gradYear: '2026', hometown: 'Cusco, Perú',
    bio: 'Manages the budget and the fundraiser. Has hiked to Machu Picchu four times and will show you the photos unprompted.',
  },
  'alex@demo.club': {
    pronouns: 'he/him', major: 'Computer Science', gradYear: '2029', hometown: 'Arequipa, Perú',
    bio: 'First year, still figuring out the schedule.',
  },
  'sara@demo.club': {
    pronouns: 'she/her', major: 'Biology', gradYear: '2028', hometown: 'Miami, FL',
    bio: 'Pre-med. Comes for the food, stays for the dancing.',
  },
  'emilia@demo.club': {
    pronouns: 'she/her', major: 'Art History', gradYear: '2027', hometown: 'Iquitos, Perú',
    bio: 'Designs the posters for every event.',
  },
  'miguel@demo.club': {
    pronouns: 'he/him', major: 'Mechanical Engineering', gradYear: '2026', hometown: 'Callao, Perú',
    bio: 'Plays cajón at the peñas.',
  },
};

const CODE = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const code = () => Array.from(randomBytes(6), (b) => CODE[b % CODE.length]).join('');

async function main() {
  console.log('Resetting demo data…');
  // Ownership is the ONLY thing that decides what gets deleted here.
  //
  // This used to also match a list of slugs, which was dangerous: a real club
  // can occupy one of those slugs, and seeding would then destroy real members
  // and their attendance history. This seed only ever creates clubs owned by
  // @demo.club accounts, so that is the whole condition — and a club belonging
  // to a real person can never be caught by it.
  const doomed = await prisma.club.findMany({
    where: { owner: { email: { endsWith: '@demo.club' } } },
    select: { name: true, slug: true },
  });
  const real = await prisma.club.count({
    where: { NOT: { owner: { email: { endsWith: '@demo.club' } } } },
  });
  console.log(`  removing ${doomed.length} demo club(s): ${doomed.map((c) => c.slug).join(', ') || 'none'}`);
  if (real > 0) console.log(`  leaving ${real} real club(s) untouched`);

  await prisma.club.deleteMany({ where: { owner: { email: { endsWith: '@demo.club' } } } });
  await prisma.user.deleteMany({ where: { email: { endsWith: '@demo.club' } } });

  const passwordHash = await hash(PASSWORD);
  const users = new Map<string, string>();
  for (const [name, email] of ROSTER) {
    const u = await prisma.user.create({ data: { name, email, passwordHash } });
    users.set(email, u.id);
  }

  const club = await prisma.club.create({
    data: {
      slug: 'la-casa-peruana',
      name: 'La Casa Peruana',
      university: 'Boston University',
      logoEmoji: '🇵🇪',
      timezone: TZ,
      joinCode: code(),
      ownerUserId: users.get('president@demo.club')!,
      rules: { create: { ...DEFAULT_RULES, semesterId: null } },
      semesters: {
        create: {
          name: 'Fall 2026',
          startsOn: new Date('2026-08-15T00:00:00Z'),
          endsOn: new Date('2026-12-20T23:59:59Z'),
          isActive: true,
        },
      },
    },
    include: { semesters: true },
  });
  const semester = club.semesters[0];

  const memberships = new Map<string, string>();
  for (const [displayName, email, role] of ROSTER) {
    const m = await prisma.membership.create({
      data: {
        clubId: club.id, userId: users.get(email)!, displayName, email, role,
        joinedOn: new Date('2026-08-18T16:00:00Z'),
        ...(PROFILES[email] ?? {}),
      },
    });
    memberships.set(email, m.id);
  }

  await prisma.memberGroup.create({
    data: {
      clubId: club.id,
      name: 'Junta Directiva',
      members: {
        create: ['president@demo.club', 'vp@demo.club', 'secretary@demo.club', 'treasurer@demo.club']
          .map((e) => ({ membershipId: memberships.get(e)! })),
      },
    },
  });

  const allInvitees = [...memberships.values()].map((membershipId) => ({ membershipId, source: 'all' }));
  const secretaryId = memberships.get('secretary@demo.club')!;

  const past = [
    { title: 'Reunión General', type: 'general_meeting', date: '2026-08-20', location: 'Student Center Room 204' },
    { title: 'Taller de Marinera', type: 'workshop', date: '2026-08-25', location: 'Dance Studio B' },
    { title: 'Reunión General', type: 'general_meeting', date: '2026-08-27', location: 'Student Center Room 204' },
    { title: 'Reunión General', type: 'general_meeting', date: '2026-09-03', location: 'Student Center Room 204' },
  ];

  for (const [index, spec] of past.entries()) {
    const event = await prisma.event.create({
      data: {
        clubId: club.id, semesterId: semester.id, title: spec.title, type: spec.type,
        location: spec.location, attendanceRequired: true, status: 'completed',
        startsAt: at(spec.date), endsAt: at(spec.date, 24),
        attendanceTakenAt: at(spec.date, 24), checkinCode: code(),
        createdByMembershipId: secretaryId, createdByName: 'Valentina Ríos',
        invitees: { create: allInvitees },
      },
    });

    for (const [email, membershipId] of memberships) {
      const status = SCRIPT[email]?.[index] ?? 'present';
      await prisma.attendanceRecord.create({
        data: {
          eventId: event.id, membershipId, status,
          recordedByMembershipId: secretaryId, recordedByName: 'Valentina Ríos',
          recordedAt: at(spec.date, 24),
        },
      });
    }
  }

  const upcoming = [
    { title: 'Reunión General', type: 'general_meeting', date: '2026-09-10', location: 'Student Center Room 204', required: true },
    { title: 'Peña Peruana', type: 'social', date: '2026-09-12', location: 'BU Beach', required: false },
    { title: 'Junta Directiva', type: 'eboard_meeting', date: '2026-09-15', location: 'Library Study Room 4', required: true },
    { title: 'Reunión General', type: 'general_meeting', date: '2026-09-17', location: 'Student Center Room 204', required: true },
    { title: 'Cena Benéfica', type: 'fundraiser', date: '2026-09-24', location: 'GSU Ballroom', required: true },
  ];

  for (const spec of upcoming) {
    const isEboard = spec.type === 'eboard_meeting';
    await prisma.event.create({
      data: {
        clubId: club.id, semesterId: semester.id, title: spec.title, type: spec.type,
        location: spec.location, attendanceRequired: spec.required, status: 'scheduled',
        startsAt: at(spec.date, isEboard ? 22 : 23), endsAt: at(spec.date, isEboard ? 23 : 24),
        checkinCode: code(), createdByMembershipId: secretaryId, createdByName: 'Valentina Ríos',
        invitees: {
          create: isEboard
            ? ['president@demo.club', 'vp@demo.club', 'secretary@demo.club', 'treasurer@demo.club']
                .map((e) => ({ membershipId: memberships.get(e)!, source: 'group' }))
            : allInvitees,
        },
      },
    });
  }

  // A pending excuse, so the approval queue has something in it.
  const nextMeeting = await prisma.event.findFirst({
    where: { clubId: club.id, status: 'scheduled', title: 'Reunión General' },
    orderBy: { startsAt: 'asc' },
  });
  if (nextMeeting) {
    await prisma.excuseRequest.create({
      data: {
        eventId: nextMeeting.id,
        membershipId: memberships.get('miguel@demo.club')!,
        reason: 'Midterm exam scheduled at the same time — I can send the professor’s notice.',
      },
    });
  }


  await prisma.auditLog.createMany({
    data: [
      { clubId: club.id, actorName: 'Camila Quispe', action: 'club.create', entityType: 'club', entityId: club.id, summary: 'Fundó La Casa Peruana', createdAt: new Date('2026-08-16T14:02:00Z') },
      { clubId: club.id, actorName: 'Valentina Ríos', action: 'member.import', entityType: 'membership', summary: 'Importó 17 miembros del padrón de primavera', createdAt: new Date('2026-08-18T18:20:00Z') },
    ],
  });

  const { syncMemberStatuses } = await import('../lib/status-sync');
  const { rulesFor } = await import('../lib/standings');
  await syncMemberStatuses(club.id, semester.id, await rulesFor(club.id, semester.id), 'System');

  console.log(`\n✓ Seeded ${ROSTER.length} members, ${past.length + upcoming.length} events in ${club.name}`);
  console.log(`\n  Sign in at http://localhost:3000/login`);
  console.log(`  President  president@demo.club  / ${PASSWORD}`);
  console.log(`  Secretary  secretary@demo.club  / ${PASSWORD}`);
  console.log(`  Member     alex@demo.club       / ${PASSWORD}   (3/3 absences)\n`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
