import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
let last = -1;
setInterval(async () => {
  const rows = await p.session.findMany({ select: { user: { select: { email: true } } } });
  if (rows.length !== last) {
    last = rows.length;
    console.log(new Date().toISOString().slice(11,19), 'sessions:', rows.map(r => r.user.email).join(', ') || '(none)');
  }
}, 700);
setTimeout(() => { p.$disconnect(); process.exit(0); }, 60000);
