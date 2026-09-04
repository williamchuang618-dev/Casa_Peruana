# La Casa Peruana

Attendance and participation for La Casa Peruana. The E-board creates events,
takes attendance, and the system does the rest: absence counts, warning
thresholds, membership status, and an audit trail of who changed what.

The public face is a scroll-driven landing page built around *ayni* — the Andean
law of reciprocity — which is also the honest description of what club
attendance is. Underneath, the app is still multi-tenant: one deployment can
serve many houses, and a person can hold a different role in each.

```
Create event  →  Take attendance  →  Member participation updates itself
```

## Run it

```bash
npm install
npx prisma migrate dev     # creates prisma/dev.db
npm run seed               # demo club with 18 members and 9 events
npm run dev
```

Then sign in at http://localhost:3000/login:

| Account | Who | What it shows |
|---|---|---|
| `president@demo.club` | Camila Quispe, Owner | Everything, including confirming removals |
| `secretary@demo.club` | Valentina Ríos, Secretary | Create events, take attendance — no removals or settings |
| `treasurer@demo.club` | Diego Salazar, Treasurer | Read-only officer view |
| `alex@demo.club` | Alejandro Huamán, Member | Own record only; sits at 3/3 absences |

Password for all of them: `demo12345`.

`npm test` runs the rules engine suite (`node:test`, no test-runner dependency).

## Stack

Next.js 16 (App Router, server actions) · React 19 · TypeScript · Tailwind v4 ·
Prisma · SQLite in dev.

Auth is a self-contained cookie session: scrypt password hashing, session tokens
stored as SHA-256 hashes so a database leak is not a set of live logins. No
auth vendor, nothing to configure.

### Moving to Postgres / Supabase

The schema deliberately avoids DB enums, native JSON columns and vendor
extensions, so the port is:

1. `provider = "postgresql"` in `prisma/schema.prisma`
2. `DATABASE_URL` → your Postgres connection string
3. `npx prisma migrate dev --name init`

Nothing in `lib/` or `app/` changes. If you move to Supabase Auth later, only
`lib/auth.ts` and the two auth pages are affected — every other file reads the
user through `getCurrentUser()`.

## Design

The landing page follows the art-direction language of the Kryntix "Pear" site —
one saturated brand colour in full-bleed panels alternating with full-bleed
imagery, large old-style serif display type, tiny letterspaced corner labels, a
hairline drafting grid, and scroll-driven cuts between sections. What changed is
the source material: neoclassical marble became the Andes.

- **Scenery is drawn, not photographed.** `components/landing/scene.tsx` is
  original SVG — sky gradient, Inti, three mountain ranges, the andenes, mist,
  a condor — on separate layers so each drifts at its own rate while you scroll.
  No licensed image, and a photograph could not parallax like that.
- **The wall is real masonry.** The stone courses are irregular polygons with
  jittered vertices, not a brick bond, because Inca walls are cut polygonal and
  fitted without mortar. Corner jitter comes from a deterministic hash of the
  block index, never `Math.random`, so the server and the client draw the
  identical wall and hydration stays quiet.
- **Palette** is adobe terracotta (`--color-brand`), Inca gold (`--color-inti`),
  terrace green, Titicaca blue, cochineal red, granite, on warm parchment.
  Every status colour in the app is drawn from it, so nothing reads as a
  leftover from a UI kit.
- **Type** is Cormorant Garamond for display and Inter for interface. The serif
  is opted into with `.display` rather than applied to every `h1`/`h2` — at 14px
  it turns to mush, so dashboard section headings stay in Inter.
- **Motion** is IntersectionObserver reveals, one rAF-throttled scroll listener
  driving every parallax layer, counters that count up on entry, and a gold
  cursor ring on fine pointers. All of it collapses under
  `prefers-reduced-motion`.

**The theme carries past the login screen.** The signed-in app is not a plain
dashboard wearing a warm palette — it shares the landing's vocabulary, tuned
down to working density:

- **Every page opens on the ridge.** `PageHeader` renders a dark band with the
  Andes silhouette, the drafting grid, a letterspaced Spanish label, the title
  in Cormorant, and a greca course along the bottom edge. Dashboard, Members,
  Calendar, Events, Settings, a member's profile — all of them.
- **The sidebar is stone.** Near-black ground, chakana in gold, bilingual nav
  labels, and a gold rule marking the current page the way a course line marks
  a wall.
- **Absences are andenes.** The progress meter is no longer a bar: it is a row
  of terraces stepping up the slope, one step per allowed absence, filling from
  the bottom. "2 of 3" is a shape you read rather than a length you measure.
- **Stat cards** carry a gold hairline and set their numbers in the display
  serif; empty states carry the chakana.
- **Motion** is a single rise on mount, staggered across a row of cards — not
  scroll observers. A table that re-animates every time it scrolls into view is
  a table you fight.

What did *not* follow it in: full-bleed panels, 7rem type, and the cursor ring.
Those belong to the front door. Inside, the type is small, the rows are dense,
and the theme lives in the chrome around the data rather than on top of it.

**Voice.** The landing page speaks Spanish and Quechua because that is the
club's voice. The app interface stays in English — it is a working tool at a US
university, and the roles, statuses and table headers are read at a glance
rather than savoured. Translating it is a small job if the club wants it.

## Conócenos — the directory

`/c/<club>/nosotros` is the house with faces on it: the Junta Directiva in large
cards, then everyone else. Members edit their own entry (photo, pronouns, class
year, major, hometown, a short bio); officers with `member:edit` can fix
anyone's. Photos flow through to the roster table, the roll-call list and the
dashboard.

**Photos live in the database as data URLs, on purpose.** The browser crops to a
centred square and re-encodes at 512px before anything is sent — a 1 MB phone
photo lands at roughly 12 KB — and the server re-checks the MIME prefix and caps
the size, because a client that resizes is a convenience, never a guarantee. For
a few dozen people that is far less machinery than a blob store, and it stays
correct. If a club ever grows past a few hundred photos, move the column to
object storage and keep everything else.

The directory sits **behind the login**, not on the landing page. Publishing
students' photos and hometowns to the open web is the club's decision to make,
not a default to inherit — say the word and it becomes a public section.

## Resetting a term

Settings → **Reset**, president-or-owner only, each action typed-to-confirm and
written to the audit log. Three separate buttons rather than one ambiguous
"reset", because these destroy different things:

| Action | Destroys | Keeps |
|---|---|---|
| **Reset E-board roles** | every officer role → General Member | everyone, all attendance, ownership |
| **Reset this semester's attendance** | every mark this semester; events reopen to Scheduled | members, events, roles |
| **Clear the roster** | every member and their whole attendance history | you, the club owner, the events |

Clearing the roster asks you to type the club name, not just "RESET", and always
keeps the owner and the person doing it so nobody can lock themselves out of
their own club.

## How the attendance logic works

The rule everything hangs off: **member standing is derived, never stored.**

`lib/rules/index.ts` is a pure, dependency-free module. It takes a member's
attendance rows plus the club's current rules and returns their standing. It
does not import Prisma, React or anything else, which is why the settings page
can run the *same function* in the browser to preview a rule change before you
save it.

```
points(mark)     present 0 · late 0 · excused 0 · absent 1     (all configurable)

an event counts  ⟺  status = completed
                 ∧  attendance was required
                 ∧  attendance was actually taken
                 ∧  the member was on the frozen invitee list

absence points   = Σ points over counted events
                   (a missing record is "not recorded", worth 0 — never an absence)
attendance %     = (present + late) / (counted − excused)

status:  points ≥ max        → Removal Required   (flag only; a human confirms)
         points ≥ max − 1    → At Risk
         points ≥ warn_at    → Warning
         % below the minimum → At Risk            (independent axis, raises only)
         otherwise           → Active
```

Consequences that fall out of deriving rather than counting:

- Changing "max absences" from 3 to 4 **un-flags** affected members on save, with
  a status-log entry explaining the change. No migration, no stale badges.
- Cancelling a meeting, or never taking attendance, cannot manufacture absences.
- A member who joins in October is never retroactively absent for September,
  because `event_invitees` freezes the expected roster at event creation.
- `removed` is the one status a human owns. The engine never sets or clears it.

`lib/status-sync.ts` writes the derived status back onto `membership.status`
after every mutation that can change it. That column is a **cache for sorting
and filtering** — if it ever disagrees with the engine, the engine is right.

## Layout

```
app/
  page.tsx       the landing page — ayni, the wall, the three laws
  (auth)         login · signup · club picker
  c/[slug]/      dashboard · calendar · members · attendance · events
                 analytics · settings · me · checkin
  actions/       server actions — the only place that writes
lib/
  rules/         the attendance engine + tests   ← pure, no I/O
  permissions.ts capability matrix (never check a role inline)
  standings.ts   engine ⇄ database
  status-sync.ts recompute + persist + queue warnings
  club-context.ts per-request tenancy + capability guards
  audit.ts       who changed what
components/
  landing/       the scene SVG, parallax, reveals, counters, cursor
  ...            calendar (month/week/agenda), roll call, tables, forms
```

Every query is scoped by `clubId`, and `getClubContext()` refuses a club the
signed-in user has no membership row for — that is the tenancy boundary.

## Roles

Roles map to capabilities in one table (`lib/permissions.ts`). Adding a custom
club role means adding a row, not grepping for `role === 'president'`.

| | Owner | President | VP | Secretary | Treasurer | Member |
|---|---|---|---|---|---|---|
| Create / edit events | ✓ | ✓ | ✓ | ✓ | | |
| Take / edit attendance | ✓ | ✓ | ✓ | ✓ | | |
| Invite / edit members | ✓ | ✓ | ✓ | | | |
| Confirm removal | ✓ | ✓ | | | | |
| Club settings & rules | ✓ | ✓ | ✓ | | | |
| Manage roles | ✓ | ✓ | | | | |
| View members & analytics | ✓ | ✓ | ✓ | ✓ | ✓ | |
| View own record | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

## What is built

Club creation and join codes · roster management including paste-a-spreadsheet
import · members who exist before they have accounts (claimed by email on
signup) · E-board roles and capabilities · month / week / agenda calendar ·
event creation with weekly repeats and per-group or per-member invitee scoping ·
roll call with bulk actions · self check-in by event code · excuse requests and
approval · automatic absence counting · configurable thresholds with live
preview · two-step removal with reinstatement · member profiles and full
attendance history · cross-event attendance grid · dashboard, analytics and
audit log · semesters with rule snapshots.

## What is queued, not done

- **Notifications.** `syncMemberStatuses` writes rows to the `notifications`
  table with a rendered subject and body. Nothing sends them — drain that table
  from a worker and email works without a schema change.
- **Officer handoff.** Ownership transfer has no UI yet; `clubs.ownerUserId` is
  the field to move.
- **Guest attendance** at open events, and per-member-type rules, are schema
  work that has not been started.
