#!/usr/bin/env node
/**
 * Flip this project from local SQLite to Postgres.
 *
 * Two things have to change and neither is guesswork:
 *   1. the datasource provider, plus a `directUrl` — Prisma runs migrations
 *      over a direct connection while the app itself talks to the pooler
 *   2. the existing migration history, which is SQLite SQL and will not replay
 *      against Postgres. It gets moved aside, not deleted.
 *
 * Run: node scripts/use-postgres.mjs
 */
import { readFileSync, writeFileSync, existsSync, renameSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const schemaPath = join(root, 'prisma', 'schema.prisma');
const schema = readFileSync(schemaPath, 'utf8');

// Look inside the datasource block only. A naive substring search also matches
// the explanatory comment at the top of the schema, which says the word
// "postgresql" without anything being configured.
const block = schema.match(/datasource db \{[\s\S]*?\n\}/);
if (!block) {
  console.error('Could not find the datasource block in prisma/schema.prisma. Aborting.');
  process.exit(1);
}
if (block[0].includes('postgresql')) {
  console.log('Already on Postgres — nothing to change.');
  process.exit(0);
}

const next = schema.replace(
  /datasource db \{[\s\S]*?\n\}/,
  `datasource db {
  provider  = "postgresql"
  // Pooled connection for the running app (Supabase: port 6543).
  url       = env("DATABASE_URL")
  // Direct connection for migrations, which cannot run through a pooler
  // (Supabase: port 5432).
  directUrl = env("DIRECT_URL")
}`,
);

writeFileSync(schemaPath, next);
console.log('✓ prisma/schema.prisma now targets postgresql (with directUrl)');

const migrations = join(root, 'prisma', 'migrations');
if (existsSync(migrations)) {
  const parked = join(root, 'prisma', 'migrations.sqlite.bak');
  renameSync(migrations, parked);
  console.log('✓ SQLite migration history moved to prisma/migrations.sqlite.bak');
}

console.log(`
Next:
  1. Put DATABASE_URL and DIRECT_URL in .env (see DEPLOY.md)
  2. npx prisma migrate dev --name init     # writes a fresh Postgres migration
  3. npm run seed                           # optional demo data
  4. npm run dev                            # confirm it works against Postgres
`);
