# DSMS — Digital Student Movement Management System

A web-based system replacing the manual student outing/return logbook with
QR-initiated access, authenticated self-service check-out/check-in, automatic
server timestamps, configurable college SOP rules, and role-based dashboards
for guards, wardens, and admins.

Built as a Final Year Project baseline from an actual guard interview
(10/08/2026, KKTM Kuantan) — see "Baseline SOP" below for the exact rules
encoded as the initial configuration.

---

## 1. Features

- **Authentication**: matric number + password login, bcrypt password hashing,
  server-side sessions (HttpOnly cookies), login rate limiting, change
  password, logout. No plaintext passwords anywhere.
- **QR access**: admin-generated QR that opens **only** the login page — never
  auto-marks a student in/out. Flow is always Scan → Login → Dashboard → choose
  KELUAR/MASUK.
- **KELUAR (check-out)**: choose movement type (Normal / Study-time / Overnight
  / Emergency), fill only the fields that type requires (all configurable),
  server-generated timestamp, duplicate-checkout prevention, idempotency keys
  so double-taps / double-tabs never create two records.
- **MASUK (check-in)**: system auto-finds the student's active OUT record (no
  manual searching), server timestamp, automatic late-status calculation
  against the configured deadline, clear warning if late.
- **Live status engine**: IN_COLLEGE / OUTSIDE / LATE / OVERNIGHT /
  PENDING_APPROVAL is always **derived** from movement records — never a
  manually-edited flag.
- **Configurable SOP**: outing start / return deadline per day of week, late
  grace period, which movement types are enabled, which require approval,
  which fields are required, holiday overrides — all editable at
  `/admin/settings`, `/admin/schedule`, `/admin/holidays` with every change
  written to the audit log.
- **Approvals**: multi-step approval requests (e.g. Teacher + Head of
  Programme for study-time outings). A movement only becomes active once every
  required step is approved; any rejection blocks it.
- **Guard dashboard**: live counts (Total / In College / Outside / Late),
  "Currently Outside" table, auto-refreshing.
- **Guard/Warden search**: by name or matric number, with department/status
  context.
- **Warden dashboard**: same live counts + a pending-approvals review queue
  (approve/reject).
- **Reports**: filterable movement history (date range, matric number,
  department, semester, movement type, late-only), with Excel and PDF export.
- **Audit log**: every login, settings change, schedule change, student
  creation, approval decision, and report export is recorded with actor,
  target, timestamp, and IP.
- **Privacy / RBAC**: every route is authorized **server-side**
  (`requireRole`) — the frontend role is never trusted. Phone numbers are only
  returned to guard/warden when the corresponding privacy setting is enabled.
  Students can only ever see their own movement history.
- **Duplicate / double-submit protection**: unique idempotency keys + an
  "only one active OUT record per student" DB-level check stop double taps,
  page refreshes, and multi-tab submits from creating duplicate records.
- **Timezone correctness**: all business logic (deadlines, late detection,
  reports) computes in `Asia/Kuala_Lumpur`, never the browser's local time.

---

## 2. Tech stack (and why it differs from the original "preferred" list)

| Layer | Choice | Note |
|---|---|---|
| Frontend | Next.js 16 (App Router) + TypeScript | as specified |
| Styling | Tailwind CSS v4 | as specified |
| Backend | Next.js Route Handlers | as specified |
| **Database** | **PostgreSQL** (hosted, e.g. Neon or Supabase) | real/persistent |
| **ORM** | **Drizzle ORM**, not Prisma | see below |
| Auth | bcryptjs + server-side session table + HttpOnly cookies | as specified |
| QR | `qrcode` npm package | as specified |
| Reports | `exceljs` (Excel), `pdfkit` (PDF) | as specified |

**Why Drizzle instead of Prisma:** Prisma downloads a native query-engine
binary from `binaries.prisma.sh` at setup time. Drizzle is 100% TypeScript,
installs from npm like any other package, and needs no binary download —
while still expressing the same relational schema with foreign keys,
indexes, and type-safe queries.

**Why PostgreSQL:** the system now runs as a real, persistent, always-on
deployment rather than a local SQLite file that only exists on one machine.
Section 5 below is a complete, click-by-click guide to getting a free
PostgreSQL database (Neon) and deploying the whole app to Vercel so it's
reachable from any phone/browser at a permanent URL — not just your own
computer's local network.

---

## 3. Baseline SOP encoded as initial configuration

All values below are **seeded defaults**, editable at `/admin/schedule`,
`/admin/holidays`, and `/admin/settings`. Nothing is hardcoded into the
business logic — `src/lib/rules/*` always reads from the database.

**Departments/programmes (real, from this college):**
- Diploma Kejuruteraan Pembuatan (Teknologi dan Proses) — DKP
- Diploma Kejuruteraan Pembuatan (Automasi Industri dan Robotik) — DKI
- Diploma Kejuruteraan Pembuatan (Rekabentuk Pembuatan) — DKN
- Diploma Kejuruteraan Pembuatan (Automotif) — DKA
- Diploma Kejuruteraan Kualiti (Quality Engineering) — DKQ

Editable at `/admin/settings` isn't wired for departments specifically (they
live in their own `departments` table) — add/edit/deactivate them by talking
to the database directly for now, or ask for an `/admin/departments` UI to
be added if you'll need to change this list often.

**Schedule:**

| Day | Outing starts | Return deadline |
|---|---|---|
| Mon–Thu | 17:00 | 19:00 |
| Fri | 17:00 | 22:00 |
| Sat–Sun | 07:30 | 22:00 |
| Holiday (default) | 07:30 | 22:00 |

- Late grace period: **0 minutes** (configurable at `/admin/settings` → LATE).
- Study-time outing requires approval from **Teacher** and **Head of
  Programme** (two independent approval steps).
- Overnight requires an outside address; approval is off by default but
  configurable.
- Emergency requires a reason and lets the student pick the relevant Fellow.
- Retention policy: `INDEFINITE` (configurable).

**Student self-registration:** students can create their own account at
`/register` (Matric Number, Full Name, Phone, Department, Semester,
Password). The account is created but **inactive** — it cannot log in until
an Admin approves it at `/admin/students`, under the "Menunggu Pengesahan"
(Pending Approval) section, which shows a Lulus (Approve) / Tolak (Reject)
button per pending registration. Rejecting permanently deletes that pending
account (nothing was ever attached to it yet, so this is safe).

---

## 4. Complete A–Z setup guide (real, always-on deployment)

**If you're updating from an earlier version of this project** (i.e. you
already have a live Neon database from before): this version adds a new
database-level constraint (a partial unique index preventing duplicate
active movement records — see §13 changelog). Run `npm run db:push`
(or `npm run db:reset` if you're fine wiping data back to seed defaults)
against your **existing** `DATABASE_URL` to apply it. This is a one-time
step; skipping it means the new safety net simply won't be active in your
database yet, though the application-level protection still works either
way.


This section takes you from nothing to a live system reachable at a
permanent URL from any phone, on any network — the way a real college
system needs to work. Total time: about 20–30 minutes, all free.

### Step A — Create a free PostgreSQL database (Neon)

1. Go to **https://neon.tech** → click **Sign up** → sign up with GitHub or
   Google (fastest).
2. After signing in, click **Create a project**. Give it any name, e.g.
   `dsms`. Leave the region as default (or pick one near Malaysia, e.g.
   Singapore, if offered).
3. Once the project is created, Neon shows a **connection string** — it
   looks like:
   ```
   postgresql://neondb_owner:AbCd1234@ep-cool-name-12345.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   ```
   Click the copy icon next to it. **Keep this tab open** — you'll need this
   string twice (once for your computer, once for Vercel).

### Step B — Point your local project at that database

1. In VS Code, open `.env` (in the `dsms` folder).
2. Set `DATABASE_URL` to the connection string you copied:
   ```
   DATABASE_URL=postgresql://neondb_owner:AbCd1234@ep-cool-name-12345.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   ```
3. Save the file.

### Step C — Push the schema and seed data into Neon

In the VS Code terminal, inside the `dsms` folder:
```bash
npm install
npm run db:reset
```
This creates all the tables in your Neon database and fills them with the
test accounts and demo students. You should see `Database reset complete.`
at the end. **This step is safe to run again any time** — it clears old
data first, so it never fails with a "duplicate" error.

### Step D — Test it locally against the real database

```bash
npm run dev
```
Open `http://localhost:3000`, log in with the test accounts (see §8) —
everything now reads/writes to your real Neon database instead of a local
file. Confirm this works before moving to deployment.

### Step E — Put the code on GitHub

1. Go to **https://github.com** → sign up/log in → click **New repository**.
   Name it e.g. `dsms`. Leave it **Private** if you don't want it public.
   Don't initialize with a README (you already have one).
2. Back in VS Code, open the terminal in the `dsms` folder and run:
   ```bash
   git init
   git add .
   git commit -m "Initial DSMS commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/dsms.git
   git push -u origin main
   ```
   (Replace `YOUR_USERNAME` with your actual GitHub username. If prompted to
   log in, follow VS Code's sign-in flow.)
3. **Important:** `.env` is already excluded via `.gitignore`, so your
   database password does **not** get uploaded to GitHub. Never commit it.

### Step F — Deploy to Vercel

1. Go to **https://vercel.com** → **Sign up** → choose **Continue with
   GitHub** (this lets Vercel see your repos).
2. Click **Add New...** → **Project**.
3. Find your `dsms` repo in the list → click **Import**.
4. Before clicking Deploy, expand **Environment Variables** and add:
   - Name: `DATABASE_URL`
   - Value: the same Neon connection string from Step A
5. Click **Deploy**. Wait 1–3 minutes.
6. Vercel gives you a permanent URL like `https://dsms-yourname.vercel.app`
   — this works from **any phone, any network, anywhere**, right now.

### Step G — Point the QR code at your live URL

1. Visit your Vercel URL → log in as admin (`admin@example.local` /
   `Staff@123`).
2. Go to **Tetapan** (Settings) → find **QR** category → set
   **"URL Sistem untuk QR"** to your Vercel URL, e.g.
   `https://dsms-yourname.vercel.app` → **Simpan**.
3. Go to **QR** page (`/admin/qr`) → the QR code now points to your live
   system. Anyone can scan it from any phone, on any network, and it will
   actually work — this is the real, non-demo setup.

### From now on, whenever you change the code:

```bash
git add .
git commit -m "describe your change"
git push
```
Vercel automatically redeploys within a minute or two — no manual redeploy
needed.

---

## 5. Local development commands (once DATABASE_URL is set)

```bash
npm run dev        # http://localhost:3000, hot reload, uses your Neon DB
npm run build      # production build (also type-checks)
npm run start      # run the production build locally
npm run lint        # ESLint
npm run db:reset   # wipe + reseed the database (safe to re-run anytime)
```

## 6. Changing test account passwords safely

If you change a password while testing and lose track of it, just run
`npm run db:reset` (locally) — it wipes and reseeds the database back to the
documented defaults in §8. Note: running this against your live Neon
database will also reset the **live** site's data, since local and
production point at the same database in this setup. If you want separate
local/testing data from your live/demo data, create a second Neon project
(Neon's free tier allows multiple projects) and use a different
`DATABASE_URL` locally vs. in Vercel.

## 7. Custom domain (optional)

If you own a domain (or want a nicer name than `*.vercel.app`), in your
Vercel project go to **Settings → Domains** and follow the instructions to
connect it. Not required — the free `.vercel.app` URL works perfectly for
an FYP demonstration.

## 8. Test accounts (seed data, not real people)

| Role | Login ID | Password |
|---|---|---|
| Student | `12345` | `Student@123` |
| Guard | `guard@example.local` | `Staff@123` |
| Warden | `warden@example.local` | `Staff@123` |
| Admin | `admin@example.local` | `Staff@123` |
| Lecturer (DKP) | `pensyarah1.dkp@example.local` | `Staff@123` |
| Head of Programme (DKP) | `hop.dkp@example.local` | `Staff@123` |

Every department (DKP/DKI/DKN/DKA/DKQ) gets its own HOP
(`hop.<code>@example.local`) and 2 lecturers
(`pensyarah1.<code>@example.local`, `pensyarah2.<code>@example.local`), all
password `Staff@123` — e.g. `pensyarah1.dki@example.local` for DKI.

Plus 50 additional demo student accounts (matric numbers `2425950`–`2425999`,
same password `Student@123`) for realistic dashboard/report/backtest volume —
51 students total. `12345` is seeded as **MUHAMMAD ZAHIN BIN MOHD AZMI**;
all other 50 use synthetic Malay names for demo purposes only.

**If you ever change a test account's password while testing** and want to
get back to these documented defaults, just run `npm run db:reset` — it
wipes and reseeds everything from scratch.

## 9. Role permissions matrix

| Capability | Student | Guard | Warden | Admin |
|---|:---:|:---:|:---:|:---:|
| KELUAR / MASUK (own account) | Yes | – | – | – |
| View own movement history | Yes | – | – | – |
| View own profile / change password | Yes | Yes | Yes | Yes |
| Guard dashboard (live counts, outside list) | – | Yes | Yes | Yes |
| Search students | – | Yes | Yes | Yes |
| View student phone number | – | if `guard_can_view_phone` | if `warden_can_view_phone` | Yes |
| Approve/reject approval requests | – | if `guard_can_approve` | Yes | Yes |
| View/filter/export movement reports | – | – | Yes | Yes |
| Generate QR code | – | Yes | – | Yes |
| Create/manage students | – | – | view only | Yes |
| Edit schedule rules / holidays | – | – | view only | Yes |
| Edit system settings | – | – | – | Yes |
| View audit log | – | – | – | Yes |

Every one of these is enforced **server-side** in the API route (`requireRole`
in `src/lib/auth/session.ts`) — UI hiding is a courtesy, not the security
boundary.

## 10. Configuration settings reference

All settings live in the `system_settings` table and are editable at
`/admin/settings`, grouped as: GENERAL, OUTING, APPROVAL, LATE, PRIVACY,
REPORTS, QR, SYSTEM. Each has a machine key, a Malay label, a description, and
its current value — see `src/lib/settings.ts` (`SETTINGS_DEFAULTS`) for the
full list and defaults.

Schedule (per-day outing start / return deadline) and Holidays are managed as
their own tables (`schedule_rules`, `holiday_dates`) with dedicated admin UIs
at `/admin/schedule` and `/admin/holidays`, since they're structured
per-day/per-date data rather than flat key-value settings.

## 11. Architecture notes

- **Source of truth for status**: `src/lib/rules/status.ts` computes a
  student's current status from `movement_records` on every read. There is no
  stored "current status" column to drift out of sync.
- **Schedule resolution**: `src/lib/rules/schedule.ts` resolves, for any given
  instant, the applicable outing/return window — checking `holiday_dates`
  first (by calendar date in Asia/Kuala_Lumpur), falling back to
  `schedule_rules` (by day of week). Both are DB-driven, not hardcoded.
- **Late detection**: `src/lib/rules/lateDetection.ts` applies the resolved
  deadline plus the configurable grace period. The deadline that applied *at
  check-out time* is snapshotted onto the movement record
  (`deadline_applied_at`) so a later SOP change doesn't retroactively alter
  historical late statuses.
- **Idempotency & duplicate prevention**: every checkout/checkin call carries
  a client-generated `idempotencyKey`. A unique DB index on that column means
  retried requests return the original result instead of creating a new row.
  Independently, checkout is blocked outright while an active (no `time_in`)
  record already exists for that student.
- **Audit log**: `src/lib/audit.ts` is called from every state-changing route
  (login/logout, checkout/checkin, approvals, settings/schedule/holiday
  changes, student creation, report exports).

## 12. Testing checklist (matches the FYP evaluation plan)

All items below were manually verified against the running production build
via scripted `curl` requests during development:

1. Verified — Student login (correct credentials)
2. Verified — Wrong password returns 401 with a generic error (no user
   enumeration)
3. Verified — Student KELUAR (Normal) → status becomes OUTSIDE
4. Verified — Duplicate KELUAR while active → 409, blocked
5. Verified — Student MASUK → status becomes IN_COLLEGE, ON_TIME
6. Verified — Duplicate MASUK with no active record → 409, blocked
7. Verified — Late return: admin changed the deadline live, the very next
   check-in was correctly flagged LATE with a clear warning shown
8. Verified — Overnight: rejected without an address, accepted with one,
   status correctly becomes OVERNIGHT
9. Implemented, needs a UI click-through — Emergency flow
   (`movementTypeId: "EMERGENCY"` with reason + fellow selection)
10. Verified — Approval workflow: Study-time outing generates TEACHER +
    HEAD_OF_PROGRAMME steps; the record stays PENDING until *both* approve;
    check-in is blocked until fully approved
11. Verified — Guard/Warden search by matric number
12. Verified — Dashboard counts reflect live DB state (26 seeded students)
13. Verified — Privacy: toggling `guard_can_view_phone` off immediately hid
    phone numbers from guard search results
14. Verified — Guard-only routes: student request to `/api/guard/dashboard`
    correctly returned 403
15. Verified — Warden permissions: approvals visible/actionable only to
    warden/admin
16. Verified — Admin settings: a schedule change took effect on the very
    next check-in, no code change or restart needed
17. Verified — Report export: Excel (`.xlsx`, confirmed valid via `file`
    command) and PDF (confirmed valid PDF 1.3 document) both produce real,
    openable files
18. Verified — QR access: the generated QR encodes only the `/login` URL;
    confirmed it never auto-marks anyone in/out
19. Implemented — Internet/offline error handling: the client shows
    "Sambungan tidak tersedia. Rekod TIDAK disimpan." on a fetch failure
    rather than a false success message. Full offline sync is intentionally
    **not** implemented, per the spec's own instruction not to fake untested
    offline sync.
20. Implemented, needs a manual pass — Mobile responsiveness: layouts use
    mobile-first Tailwind (stacked cards below the `md:` breakpoint,
    thumb-reachable primary actions). Verify on an actual phone before your
    demo — a text-only build environment can confirm HTTP/build correctness
    but not rendered visual layout.

## 13b. Academic Approval Workflow (Lecturer / Head of Programme / FCM)

Added on top of the existing DSMS system, reusing the existing
`approval_requests` table and movement/checkout infrastructure rather than
building a parallel system.

**New roles**: `lecturer`, `head_of_programme` (alongside the existing
student/guard/warden/admin). Created by Admin at `/admin/staff`.

**Minimal timetable**: no class-timetable system existed before this
feature — only the daily outing-window schedule. A deliberately small
`class_sessions` table (department + semester + day-of-week + start/end
time + lecturer) was added, just enough to answer "is this student in a
class right now, and who teaches it?" Manage it at `/admin/staff`.

**Routing logic for STUDY checkouts** (`src/lib/rules/academicApproval.ts`):
- After 22:00 or before 07:00 → routed to **Warden** only (after-hours).
- Weekend/configured holiday → **no academic approval** needed at all.
- Weekday, matches a scheduled class → **Lecturer and HOP notified at the
  same time**, both get an approval step.
- Weekday, no matching class → **HOP only**.

**Decision matrix — HOP always wins** (`src/app/api/approvals/decide/route.ts`):
HOP's decision is the final word regardless of what the Lecturer decided or
whether they've decided yet. Implemented as: if a HOP step exists, the
movement's final `approvalStatus` is APPROVED/REJECTED the moment HOP
decides, and stays PENDING for as long as HOP hasn't — the Lecturer's own
decision never changes this outcome, before or after HOP acts. Concurrent
Lecturer/HOP decisions are made safe with a database transaction that locks
every approval step for a movement (`SELECT ... FOR UPDATE`) before
computing the final result, so two near-simultaneous decisions can't race
into an inconsistent state.

**Authorization**: each Lecturer/HOP approval step is assigned to one
specific person (`approval_requests.assignedToUserId`) — a Lecturer from a
different programme gets a 403 even if they guess/see the approval ID; only
the exact assigned person (or Admin, as an override) may decide it. Verified
directly: a DKI lecturer attempting to decide a DKP student's approval was
blocked, while the correct DKP lecturer succeeded.

**New status: REJECTED**. Previously, a rejected movement fell through the
status logic and misleadingly showed the student as ordinary "OUTSIDE".
Fixed with an explicit `REJECTED` student status, a clear on-screen message
directing the student to contact Warden, and a new
`/api/warden/force-checkin` endpoint Warden/Admin use to administratively
close a rejected record (visible as a "Tutup Rekod (Ditolak)" button in
Guard/Warden search results) — otherwise the student would be permanently
stuck with no self-service way back to IN_COLLEGE.

**Notifications — two-layer architecture** (`src/lib/notifications/`):
every notification is written to the `notifications` table first (this is
what the in-app bell reads, and it's what "the business event happened"
actually means) — an FCM push is attempted second, best-effort, and can
never affect the first step. If FCM fails or isn't configured, the
notification still exists and is visible in-app; only the push-to-device
part is skipped.

**QR / shareable request link**: `/outing/request/[requestId]` always
reads current server-side status — nothing is encoded in the URL itself, so
the same link naturally shows PENDING → APPROVED/REJECTED as it happens.
Access is authorization-checked (owner, assigned decider, or
warden/admin) — knowing the ID alone isn't enough.

### Firebase / FCM setup (required for real push notifications)

The system runs correctly without this — the in-app notification bell and
history work purely off the database. Without Firebase configured, pushes
are silently skipped with a clear warning logged (both server and browser
console); nothing breaks.

To enable real push notifications:

1. Go to **console.firebase.google.com** → Create a project.
2. In the project, go to **Project Settings → General → Your apps** → click
   the Web icon (`</>`) → register a web app → copy the config values shown
   (`apiKey`, `authDomain`, `projectId`, `storageBucket`,
   `messagingSenderId`, `appId`) into the matching `NEXT_PUBLIC_FIREBASE_*`
   variables in `.env`.
3. Go to **Project Settings → Cloud Messaging** → under "Web configuration",
   generate a **Web Push certificate (VAPID key)** → copy it into
   `NEXT_PUBLIC_FIREBASE_VAPID_KEY`.
4. Go to **Project Settings → Service Accounts** → **Generate new private
   key** → downloads a JSON file. Copy `project_id` → `FIREBASE_PROJECT_ID`,
   `client_email` → `FIREBASE_CLIENT_EMAIL`, and `private_key` →
   `FIREBASE_PRIVATE_KEY` (replace literal newlines in the key with `\n`).
   **Never commit this file or these values to git.**
5. Open `public/firebase-messaging-sw.js` and replace the six
   `REPLACE_WITH_...` placeholder strings with the same public config
   values from step 2 (this file can't read `.env` — it's a plain script
   loaded directly by the browser, outside the Next.js build).
6. Push notifications require **HTTPS** — they will not work on plain
   `http://localhost`. Vercel serves HTTPS automatically once deployed;
   for local testing, browsers generally treat `localhost` as a secure
   context exception, so `npm run dev` should still work for local testing.
7. Add the same server-side `FIREBASE_PROJECT_ID` /
   `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` (and the six
   `NEXT_PUBLIC_FIREBASE_*` + `NEXT_PUBLIC_FIREBASE_VAPID_KEY`) as
   Environment Variables in your Vercel project settings before deploying.

**What was and wasn't tested for this feature**: the full business logic
(routing, HOP-overrides-Lecturer matrix, authorization, concurrency safety,
REJECTED status handling) was tested end-to-end against a real PostgreSQL
database with real HTTP requests. The actual FCM push delivery could not be
tested in this environment since no real Firebase project/credentials were
available — the database notification layer, which is the authoritative
half of the two-layer design, was fully verified instead. Test this
yourself once you've completed the Firebase setup above, on a real HTTPS
deployment.

**Seed data scale note**: the target scale mentioned (≈15 lecturers/programme,
≈200 students/programme, ≈1,000 students total) is intentionally NOT fully
seeded — `scripts/seed.ts` creates 1 HOP + 2 lecturers per department (10
staff total across 5 departments) and a small set of class sessions, enough
to exercise every routing path (class-time, no-class, after-hours,
cross-programme isolation) without seeding a thousand synthetic accounts.
Add more via `/admin/staff` and `/admin/students` as needed for load testing.

## 13. Changelog — bug fixes from user testing

- **Security & robustness testing pass.** A dedicated adversarial testing
  phase was run against a real PostgreSQL instance with actual HTTP
  requests (not just code review): authentication bypass attempts, IDOR,
  race conditions, concurrent-load testing, input validation, and
  configuration-loophole hunting. **7 real defects were found and fixed**,
  including one HIGH-severity authorization gap (`guard_can_approve`
  setting was not actually enforced) and one HIGH-severity data-fairness
  bug (late-return deadlines were being re-resolved from live schedule
  rules instead of the checkout-time snapshot, so an Admin correcting the
  schedule while students were already outside could retroactively flip
  their late/on-time status). A PostgreSQL partial unique index was also
  added as a database-level guarantee against duplicate active movement
  records, on top of the existing application-level check. Full details,
  severity classifications, and retest results: see
  `DSMS_TEST_REPORT.md` and `DSMS_TEST_MATRIX.csv` in the project root.

- **New: GPS-based campus location verification (optional, off by default).**
  Admin can require students to be physically near campus (verified via
  their browser's GPS, not IP address) before KELUAR/MASUK succeeds.
  Configurable at `/admin/settings` → "Lokasi Kampus (GPS)":
  `location_verification_enabled` (toggle), `campus_latitude` /
  `campus_longitude` (the campus's exact coordinates), and
  `campus_radius_meters` (how far from that point is still considered "on
  campus"). **Read this carefully before turning it on:**
  - IP address was deliberately **not** used for this. The original field
    interview established there's no WiFi at the guard post and students
    check out over their own mobile data — mobile-data IP addresses don't
    reliably map to physical location, so an IP-based restriction would
    lock out legitimate students while being easy for a determined person
    to bypass (VPN). GPS, read directly from the phone's location hardware,
    is the mechanism that actually matches how this system is used.
  - The placeholder `campus_latitude`/`campus_longitude` values are an
    **approximate estimate** from the college's public address (Km 8, Jalan
    Gambang) — they have **not** been verified against the exact building.
    Before enabling this feature: open Google Maps, find the actual campus
    building, right-click (or long-press on mobile) the exact spot, and
    copy the decimal coordinates shown — then paste those into the two
    settings fields. Enabling location verification with unverified
    coordinates will lock out real students.
  - **Honest limitation:** this proves the *device* is near campus. It does
    not and cannot prove the person holding it is the account owner — if a
    student hands their phone to a friend while both are genuinely on
    campus, GPS verification will still pass. No client-side signal can
    fully solve that; it's a trust/process problem, best handled alongside
    guard/warden spot checks (e.g. asking to see the student's face), not
    purely a software one. The system does now log the device's browser/
    user-agent string alongside IP address on every KELUAR/MASUK in the
    audit log, so Guard/Warden can review patterns (e.g. the same account
    checking in from wildly different devices in a short time) after the
    fact — as a detection aid, not an automatic block.

- **New: Student self-registration with Admin approval.** Added `/register`
  (public form: matric number, full name, phone, department, semester,
  password), a new `/api/auth/register` endpoint, and an approve/reject
  workflow in `/admin/students`. Self-registered accounts are created
  inactive and cannot log in until an Admin approves them. Departments were
  also updated from placeholder names to the college's real five
  programmes (DKP/DKI/DKN/DKA/DKQ).

- **Fixed: Warden's "Laporan" (Reports) nav link disappeared and reappeared
  depending on which page they were on.** Navigation links were hardcoded
  separately in three different layout files, and one of them (the layout
  shared with Guard, used when Warden clicks "Carian") was missing the
  Laporan link. Fixed by creating a single shared `src/lib/nav.ts` that
  every layout now imports from — this class of bug (nav lists drifting out
  of sync) is now structurally impossible since there's only one array per
  role.
- **Fixed: Students were asked to confirm their phone number during KELUAR
  with no way to see or change it.** The checkout screen had a checkbox
  saying "I confirm my phone number is current" but never showed the actual
  number, and there was nowhere in the app to update it. Added: (1) the
  student's phone number is now shown in their `/student/profile` page with
  a "Kemaskini" (Update) button to change it themselves, and (2) the KELUAR
  confirmation screen now displays the actual number next to the checkbox,
  with a direct link to go update it if it's wrong.
- **Performance: removed an N+1 query pattern on the guard dashboard.** For
  every student currently outside, the server was independently re-querying
  the holiday and schedule-rule tables to determine if they were late — even
  though students who checked out on the same day all need the exact same
  answer. It also ran two separate database queries for the same table where
  one would do. Both fixed: the schedule window is now resolved once per
  distinct checkout date and reused, and the two queries were merged into
  one. This meaningfully reduces database round-trips on every dashboard
  load/refresh, which matters most against a hosted database like Neon where
  each round-trip has real network latency (see §14 for more on this).

- **Fixed: `npm run db:reset` silently did nothing on Windows.** The script
  used `rm -f ... && npm run db:push && npm run db:seed`. npm runs scripts
  through `cmd.exe` on Windows by default (even inside a PowerShell terminal
  window), and `rm` doesn't exist there — the command failed immediately and,
  because of `&&`, the push/seed steps never ran. This meant the database was
  never actually reset, which could leave a stale password in place after
  earlier testing and make later "wrong password" errors look like a bug in
  the change-password feature when the real issue was the reset never
  happening. Replaced with `scripts/reset-db.ts`, a plain Node script using
  `fs.unlinkSync` + `execSync`, which works identically on Windows, macOS,
  and Linux.
- **Fixed: Warden could not reach `/guard/search`.** The `/guard` route group
  layout only allowed `guard` and `admin` roles, so clicking "Carian" as a
  warden redirected to the login page even though the underlying API already
  correctly allowed warden access. Fixed by adding `warden` to the layout's
  `requireRole(...)` call.
- **Fixed: Guard, Warden, and Admin had no way to change their password.**
  Only the student role had a profile/change-password page. Added a shared
  `/profile` page (and a reusable `ChangePasswordForm` component, also now
  used by the student profile page) plus a "Profil" nav link on every staff
  role's top bar.
- **Fixed: `npm run db:reset` said "DATABASE_URL is not set" even when
  `.env` had the correct value.** Next.js automatically loads `.env` for
  `npm run dev` / `build` / `start`, but standalone scripts run via
  `npx tsx scripts/...` do **not** get this automatic loading — so
  `scripts/seed.ts` and `scripts/reset-db.ts` were reading an empty
  `process.env.DATABASE_URL` regardless of what `.env` contained. Fixed by
  explicitly loading `dotenv/config` at the top of both scripts (and as a
  safety net in `src/db/client.ts` itself).
- **Verified, not a bug:** Excel/PDF report export was tested end-to-end
  (with and without filters) and produces valid, openable files both times.
  If you hit a specific report problem, please describe exactly what you did
  and what happened so it can be reproduced precisely.

## 14. Known limitations / honest scope notes

- **No offline sync.** Per the spec's own instruction ("do NOT pretend that
  full offline synchronization exists unless you actually implement and test
  it"), the system fails loudly and safely when the network is down rather
  than silently queueing actions.
- **In-memory rate limiter.** Fine for a single Vercel instance; if traffic
  grows enough that Vercel scales to multiple instances, replace with a
  shared store (e.g. Redis / Vercel KV) so the limit is enforced globally.
- **PostgreSQL migration was written carefully but not run against a live
  Postgres server during development** (no network path to one in the build
  sandbox). The schema was migrated field-by-field from the working SQLite
  version with the exact same string-based timestamp semantics preserved
  (see the comment block at the top of `src/db/schema.ts` for why), and
  `npm run build` type-checks cleanly against it — but you should run through
  the full testing checklist in §12 yourself once deployed to Neon/Vercel,
  the same way you would for any new deployment.
- **Local dev and the live Vercel deployment share the same Neon database**
  by default in this setup (both use the same `DATABASE_URL`). If you want
  a separate database for local experimentation vs. what your lecturers see
  live, create a second free Neon project and use its connection string
  locally instead.
- **Reports currently export the filtered history table** with a summary
  header; they don't yet include charts/graphs. Easy to extend in
  `src/lib/report.ts` and the two export routes if your lecturers want
  visualizations.
