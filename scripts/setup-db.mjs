#!/usr/bin/env node
/**
 * Writes .env from the Supabase Prisma snippet.
 *
 * The password is collected through a native macOS dialog rather than the
 * terminal: nothing is echoed, nothing lands in shell history, and there is no
 * prompt to mistake for a shell prompt. It is written straight to .env, which
 * is gitignored, and never printed back.
 *
 * Run: npm run setup:db
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT = process.env.SETUP_DB_OUT ?? join(process.cwd(), '.env');
const sh = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8' });

/** A macOS dialog. `hidden` masks the field, as for a password. */
function dialog(prompt, { hidden = false, defaultAnswer = '' } = {}) {
  const script =
    `display dialog ${JSON.stringify(prompt)} ` +
    `default answer ${JSON.stringify(defaultAnswer)} ` +
    `${hidden ? 'with hidden answer ' : ''}` +
    `with title "La Casa Peruana — database setup" buttons {"Cancel","OK"} default button "OK"`;
  try {
    const out = sh('osascript', ['-e', script]);
    const m = out.match(/text returned:([\s\S]*?)(?:, button returned:|$)/);
    return m ? m[1] : '';
  } catch {
    return null; // Cancel pressed
  }
}

const PLACEHOLDER = /\[YOUR-PASSWORD\]|\[YOUR_PASSWORD\]|YOURPASSWORD|\[password\]/gi;
const grab = (text, key) =>
  text.match(new RegExp(`${key}\\s*=\\s*["']?(postgres(?:ql)?://[^"'\\s]+)["']?`, 'i'))?.[1] ?? null;

let source = '';
try { source = sh('pbpaste', []); } catch { /* no clipboard */ }

let dbUrl = grab(source, 'DATABASE_URL');

if (!dbUrl) {
  console.log('Nothing usable on the clipboard — opening a window so you can paste it.');
  const pasted = dialog(
    'Paste the Supabase snippet here.\n\n' +
    'In Supabase:  Connect  ->  ORM  ->  Prisma\n' +
    'Copy the code block under "Configure ORM", then paste it below (Cmd+V).',
  );
  if (pasted === null) { console.log('\nCancelled. Nothing was written.\n'); process.exit(1); }
  source = pasted;
  dbUrl = grab(source, 'DATABASE_URL');
}

if (!dbUrl) {
  console.error('\nNo DATABASE_URL found in that text. Nothing was written.\n');
  process.exit(1);
}

// Supabase sometimes shows only one string; the direct connection is the same
// host on 5432 without the pooler flag.
let directUrl = grab(source, 'DIRECT_URL');
if (!directUrl) {
  directUrl = dbUrl.replace(':6543', ':5432').replace(/[?&]pgbouncer=true/, '');
  console.log('· No DIRECT_URL supplied — derived it from DATABASE_URL (port 5432).');
}

if (PLACEHOLDER.test(dbUrl) || PLACEHOLDER.test(directUrl)) {
  const pw = dialog('Supabase database password\n\n(the field is masked, and this is never shown again)', {
    hidden: true,
  });
  if (pw === null) { console.log('\nCancelled. Nothing was written.\n'); process.exit(1); }
  if (!pw) { console.error('\nNo password entered. Nothing was written.\n'); process.exit(1); }
  // Passwords routinely contain @ : / # ? — each breaks a URL unless encoded.
  const safe = encodeURIComponent(pw);
  dbUrl = dbUrl.replace(PLACEHOLDER, safe);
  directUrl = directUrl.replace(PLACEHOLDER, safe);
} else {
  console.log('· Password was already filled in.');
}

if (existsSync(OUT)) copyFileSync(OUT, `${OUT}.backup`);

writeFileSync(OUT, `# Written by scripts/setup-db.mjs. Gitignored — stays on this machine.
# Pooled connection, used by the running app.
DATABASE_URL="${dbUrl}"
# Direct connection, used only for migrations (a pooler cannot run them).
DIRECT_URL="${directUrl}"
`);

console.log(`
✓ Wrote ${OUT}
  host       ${dbUrl.match(/@([^:/]+)/)?.[1] ?? '?'}
  app        port ${dbUrl.match(/:(\d+)\//)?.[1] ?? '?'} (pooled)
  migrations port ${directUrl.match(/:(\d+)\//)?.[1] ?? '?'} (direct)

Now tell Claude it is done.
`);
