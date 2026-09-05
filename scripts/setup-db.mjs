#!/usr/bin/env node
/**
 * Writes .env from whatever Supabase put on your clipboard.
 *
 * You click "copy" on the Prisma snippet in the Supabase Connect panel, run
 * this, and type your database password when asked. The password is never
 * echoed to the screen, never printed back, and never leaves this machine.
 *
 * Run: npm run setup:db
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { join } from 'node:path';

const OUT = process.env.SETUP_DB_OUT ?? join(process.cwd(), '.env');

function clipboard() {
  try {
    return execFileSync('pbpaste', { encoding: 'utf8' });
  } catch {
    return '';
  }
}

function askHidden(question) {
  return new Promise((resolve) => {
    process.stdout.write(question);
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    // Mute the echo so the password never appears on screen or in scrollback.
    rl._writeToOutput = () => {};
    rl.question('', (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer.trim());
    });
  });
}

const PLACEHOLDERS = /\[YOUR-PASSWORD\]|\[YOUR_PASSWORD\]|YOURPASSWORD|\[password\]/i;

function grab(text, key) {
  const m = text.match(new RegExp(`${key}\\s*=\\s*["']?(postgres(?:ql)?://[^"'\\s]+)["']?`, 'i'));
  return m ? m[1] : null;
}

const clip = clipboard();
let dbUrl = grab(clip, 'DATABASE_URL');
let directUrl = grab(clip, 'DIRECT_URL');

if (!dbUrl) {
  console.error(`
Nothing usable on the clipboard.

In Supabase: Connect (top bar) -> ORM -> Prisma, then click the copy icon on
the code block under "Configure ORM". Then run this again.
`);
  process.exit(1);
}

// Supabase only labels one of them DIRECT_URL; if it is missing, the direct
// connection is the same string on 5432 without the pooler flag.
if (!directUrl) {
  directUrl = dbUrl.replace(':6543', ':5432').replace(/[?&]pgbouncer=true/, '');
  console.log('· No DIRECT_URL on the clipboard — derived it from DATABASE_URL (port 5432).');
}

if (PLACEHOLDERS.test(dbUrl) || PLACEHOLDERS.test(directUrl)) {
  console.log('\nFound both connection strings. They still contain the password placeholder.\n');
  const pw = await askHidden('Supabase database password (typing is hidden): ');
  if (!pw) {
    console.error('No password entered. Nothing written.');
    process.exit(1);
  }
  // Passwords routinely contain @ : / # ? — all of which break a URL unless encoded.
  const safe = encodeURIComponent(pw);
  dbUrl = dbUrl.replace(PLACEHOLDERS, safe);
  directUrl = directUrl.replace(PLACEHOLDERS, safe);
} else {
  console.log('\nFound both connection strings, password already filled in.');
}

if (existsSync(OUT)) copyFileSync(OUT, `${OUT}.backup`);

writeFileSync(OUT, `# Written by scripts/setup-db.mjs. Gitignored — stays on this machine.
# Pooled connection, used by the running app.
DATABASE_URL="${dbUrl}"
# Direct connection, used only for migrations (a pooler cannot run them).
DIRECT_URL="${directUrl}"
`);

const host = dbUrl.match(/@([^:/]+)/)?.[1] ?? 'unknown host';
console.log(`
✓ Wrote ${OUT}
  host      ${host}
  app       port ${dbUrl.match(/:(\d+)\//)?.[1] ?? '?'} (pooled)
  migrations port ${directUrl.match(/:(\d+)\//)?.[1] ?? '?'} (direct)
${existsSync(`${OUT}.backup`) ? '  previous .env saved as .env.backup\n' : ''}
Now tell Claude it is done.
`);
