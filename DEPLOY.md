# Deploying to Vercel

The app is written for this move, but it cannot go up as-is: it writes to
SQLite at `prisma/dev.db`, and Vercel's serverless functions have **no
persistent writable filesystem**. It would build fine and then fail the first
time anyone signed in, and every deploy would wipe whatever did get written.

So the deploy is really two jobs: move the database to Postgres, then point
Vercel at the repo. Nothing in `lib/` or `app/` changes — that is why the schema
avoids DB enums, native JSON columns and raw SQL.

Budget about 20 minutes. Everything below is free-tier.

---

## 1. Create the database

Supabase is the path of least resistance (Vercel Postgres works identically —
skip to the connection strings if you prefer it).

1. Go to <https://supabase.com>, sign in with GitHub, **New project**
2. Name it `casa-peruana`, pick the region closest to campus, and **save the
   database password somewhere** — it is shown once and you need it twice below
3. Wait for the project to finish provisioning (~2 min)
4. **Project Settings → Database → Connection string**

You need **two** strings, and the difference matters:

| | Port | Used for | Why |
|---|---|---|---|
| **Transaction / pooled** | `6543` | the running app | serverless opens and drops connections constantly; the pooler absorbs that |
| **Session / direct** | `5432` | migrations only | schema changes cannot run through a pooler |

Copy both, substitute your password for `[YOUR-PASSWORD]`, and append
`?pgbouncer=true` to the pooled one.

---

## 2. Switch the project to Postgres

```bash
cd ~/club-attendance
node scripts/use-postgres.mjs
```

That rewrites the datasource block and parks the SQLite migration history in
`prisma/migrations.sqlite.bak` — SQLite's generated SQL will not replay against
Postgres, so a fresh migration has to be written. Nothing is deleted.

Then put both strings in `.env` (which is gitignored — it never leaves your
machine):

```bash
DATABASE_URL="postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres"
```

---

## 3. Create the schema in Postgres

```bash
npx prisma migrate dev --name init
```

This writes a brand-new `prisma/migrations/` folder containing Postgres SQL and
applies it to Supabase. You should see every table created.

Optional — demo data, so you can click around before the real roster exists:

```bash
npm run seed
```

Skip this if you are going straight to real members. The seed deletes any club
owned by an `@demo.club` account, so it is safe to run twice, but there is no
reason to put Camila Quispe in your production database.

---

## 4. Confirm it works before deploying

```bash
npm run dev
```

Open <http://localhost:5240>, sign in, take attendance on an event. You are now
running against production Postgres from your laptop — if it works here it will
work on Vercel, and debugging is far easier locally.

---

## 5. Commit and push

```bash
git add -A
git commit -m "Switch database to Postgres for deployment"
git push
```

---

## 6. Deploy

1. <https://vercel.com> → sign in with GitHub → **Add New → Project**
2. Import **williamchuang618-dev/Casa_Peruana**
3. Framework preset detects Next.js. Leave the build settings alone — the build
   command already runs `prisma generate`
4. Expand **Environment Variables** and add both, for all environments:
   - `DATABASE_URL` → the pooled string
   - `DIRECT_URL` → the direct string
5. **Deploy**

There is no `SESSION_SECRET` to set. Sessions are rows in the database, and the
cookie carries a random token whose SHA-256 hash is what gets stored.

Your link will be `https://casa-peruana.vercel.app` (Vercel will tell you the
exact one). Every `git push` to `main` redeploys automatically.

---

## 7. Set up the real club

On the live site: **Create one** → sign up → **Start a new club** → name it
La Casa Peruana. Then Members → **Paste a roster** and paste `Name, email` rows
straight from your spreadsheet. Give the join code to everyone else.

The first account you create owns the club, so make it yours.

---

## When you change the schema later

```bash
npx prisma migrate dev --name what_changed   # writes + applies the migration
git add -A && git commit -m "..." && git push
```

Migrations are applied from your machine, not during the Vercel build — one
less thing that can fail a deploy at 2am. If you would rather have them run
automatically, change the build script to:

```
"build": "prisma generate && prisma migrate deploy && next build"
```

---

## Things that will bite you

- **`prisma/dev.db` stays local.** It is gitignored and irrelevant once you are
  on Postgres. Your SQLite data does not migrate — recreate the club on the live
  site, or export and re-import the roster.
- **Free Supabase projects pause after ~1 week idle.** The first request after
  that is slow, or errors once and then recovers. Open the Supabase dashboard to
  wake it.
- **Member photos are base64 rows in Postgres**, roughly 12 KB each. Fine for a
  few hundred people; past that, move `Membership.photo` to object storage.
- **Restart `npm run dev` after any migration.** The dev server keeps the old
  generated Prisma Client in memory and will throw validation errors on new
  columns until it is restarted.
- **`npm run seed` is destructive** — it deletes clubs owned by `@demo.club`
  users. Never point it at production once real members exist.
