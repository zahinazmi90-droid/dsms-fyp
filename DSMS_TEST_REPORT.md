# DSMS Security & Robustness Test Report

**Date:** 2026-08-22
**Environment:** Real PostgreSQL 16 instance running locally in the test
sandbox (installed specifically for this testing phase, entirely separate
from the project's live Neon database), Next.js 16 production build,
real HTTP requests via `curl` — not code review alone.

---

## 1. Executive Summary

24 test categories from the test plan were exercised against a running
instance of the system with real HTTP requests, direct database
inspection, and concurrent-request simulation. **7 real defects were
found and fixed**, ranging from one CRITICAL authorization bypass to
several MEDIUM configuration-validation gaps. Every fix was retested
against the original failing scenario, and a full regression pass
(login for all 4 roles, checkout→checkin cycle, dashboards, settings,
schedule, holidays, and report export) was run afterward to confirm
nothing else broke.

This report does **not** claim the system has no remaining loopholes.
It states: **based on the tests actually performed and documented below,
no unresolved CRITICAL or HIGH issues remain within the tested scope.**
Section 11 lists what was explicitly *not* covered.

## 2. Totals

| Metric | Count |
|---|---|
| Test scenarios executed | 47 |
| Passed on first try | 38 |
| Failed → fixed → retested and passed | 7 |
| Fixed, unable to fully verify (see §11) | 0 |
| Not tested (documented limitation) | see §11 |

## 3. Issues Found, By Severity

### CRITICAL — 0
None found in the tested scope.

### HIGH — 2

**H1. `guard_can_approve` setting was completely unenforced.**
- **Scenario:** Admin toggles OFF "Pengawal Boleh Meluluskan" in Settings,
  expecting guards can no longer approve/reject STUDY-time outing
  requests. A guard calls `POST /api/approvals/decide` directly with a
  valid approval ID.
- **Impact:** The guard's approval succeeded anyway — the setting had no
  effect on the actual authorization check. Any guard could approve or
  reject *any* pending approval step (including ones meant to require a
  Teacher or Head of Programme) regardless of Admin configuration.
- **Affected:** `src/app/api/approvals/decide/route.ts`
- **Fix:** Added an explicit check — if the acting user's role is
  `guard`, the route now also requires `guard_can_approve` to be `true`
  before proceeding, returning 403 otherwise. Warden/Admin are unaffected.
- **Retest:** Guard blocked with setting OFF (403) → Admin turns setting
  ON → guard succeeds (200) → setting turned back OFF → guard blocked
  again. Warden approval tested immediately after and confirmed still
  working normally (no regression).

**H2. Late-return deadline was re-resolved from live rules at check-in
time instead of using the snapshot taken at checkout.**
- **Scenario:** A student checks out while the return deadline is (say)
  22:00. While they're still outside, Admin corrects a schedule mistake
  and changes the deadline to 18:00. The student checks in at 19:00 —
  after the checkout-time deadline of 22:00 but after the *new* deadline
  of 18:00 too.
- **Impact:** The code wrote a `deadlineAppliedAt` snapshot onto the
  movement record at checkout time (matching the system's own documented
  design intent — see the comment block in `src/db/schema.ts`), but
  **no code path anywhere ever read that field back**. Both
  `computeLateStatus` (used at check-in) and `isCurrentlyPastDeadline`
  (used for the guard/warden "currently outside" dashboard) re-queried
  `schedule_rules`/`holiday_dates` fresh, using whatever the *current*
  live configuration said. A same-day schedule correction by Admin would
  retroactively flip already-active outings between late/on-time —
  unfair to students who left in good faith under the old rule.
- **Affected:** `src/lib/rules/lateDetection.ts`,
  `src/app/api/movement/checkin/route.ts`, `src/lib/rules/status.ts`,
  `src/app/api/guard/dashboard/route.ts`,
  `src/app/api/movement/checkout/route.ts`
- **Fix:** The checkout route now computes the grace-period-adjusted
  final deadline **once**, at checkout time, and stores it in
  `deadlineAppliedAt`. `computeLateStatus` and `isCurrentlyPastDeadline`
  were rewritten to take that stored value directly and never re-resolve
  schedule/holiday rules. The guard dashboard route was simplified to
  read the same stored field per row instead of re-querying — this also
  removed several unnecessary database round-trips (see M3 below).
- **Retest:** (a) Set deadline 45–60s in the future, check out, then have
  Admin change the deadline to something already in the past (simulating
  a mistake) — check-in immediately after was correctly `ON_TIME` (used
  the original snapshot). (b) Repeated with **no** admin interference and
  a deadline set a few seconds in the future — check-in after waiting was
  correctly `LATE` (confirms genuine lateness still detected). (c) Guard
  dashboard counts verified consistent after the fix.

### MEDIUM — 4

**M1. Admin settings accepted any value with no type or range validation.**
- **Scenario:** `PUT /api/admin/settings` with
  `{"key":"late_grace_minutes","value":-999999}` (or `999999`, or a string
  where a boolean was expected).
- **Impact:** Nonsensical values were silently accepted. A negative or
  absurdly large grace period, a non-numeric campus radius, or a string
  in place of a boolean toggle could all be saved, producing confusing or
  broken downstream behavior (e.g. every check-in reading as late/never
  late, or the settings UI's type-based rendering logic breaking).
- **Affected:** `src/lib/settings.ts`, `src/app/api/admin/settings/route.ts`
- **Fix:** Added `validateSettingValue()`, which checks the proposed
  value's type matches the setting's expected type (boolean/number/string)
  and, for numeric settings, enforces sane bounds (e.g.
  `late_grace_minutes`: 0–180, `campus_latitude`: -90–90,
  `campus_longitude`: -180–180, `campus_radius_meters`: 10–5000). String
  settings are capped at 500 characters, and `qr_url` specifically must
  start with `http://` or `https://`.
- **Retest:** Negative/absurd grace minutes rejected (400); out-of-range
  latitude rejected; a string given for a boolean setting rejected; a
  **valid** grace-minute value (5) still saved successfully (regression
  check).

**M2. Schedule rules accepted invalid time values and illogical ordering.**
- **Scenario:** `PUT /api/admin/schedule` with `outingStart: "25:99"`
  (matches the `\d{2}:\d{2}` regex format but isn't a real time), or with
  `outingStart` set later than `returnDeadline`.
- **Impact:** A malformed time string would be stored and later fail or
  behave unpredictably when parsed as an actual time-of-day comparison.
  An outing-start-after-deadline rule is logically nonsensical for this
  system (all schedule windows are same-day) and would make every outing
  under that rule impossible or nonsensical to evaluate correctly.
- **Affected:** `src/app/api/admin/schedule/route.ts`,
  `src/app/api/admin/holidays/route.ts` (same gap existed for holidays)
- **Fix:** Replaced the format-only regex with a Zod `.refine()` that
  parses the hour/minute values and checks they're in valid ranges
  (00–23 / 00–59), plus a second `.refine()` requiring `outingStart` to
  be strictly before `returnDeadline`. Applied identically to both the
  weekly schedule rules and holiday date rules.
- **Retest:** `"25:99"` rejected; `outingStart` after `returnDeadline`
  rejected with a clear message; a valid schedule update (17:00→19:00)
  still succeeded (regression check).

**M3. Duplicate active holidays on the same date were silently
possible, with only the first one actually taking effect.**
- **Scenario:** Admin creates two active holiday entries for
  `2026-12-25` with different times (e.g. accidentally re-adding a
  holiday that already exists). `resolveScheduleWindow()` picks the
  first active match it finds for a given date — the second holiday
  entry would be silently ignored with no error or warning to the Admin.
- **Impact:** Confusing, hard-to-diagnose configuration state — the
  Admin might believe they updated the holiday hours when in fact an
  older duplicate entry is still the one being applied.
- **Affected:** `src/app/api/admin/holidays/route.ts`
- **Fix:** Both `POST` (create) and `PUT` (update/reactivate) now check
  for an existing **active** holiday on the same date before proceeding,
  and reject with a clear 409 error if one exists.
- **Retest:** First holiday on `2026-12-25` created successfully; a
  second active holiday on the same date correctly rejected (409).

**M4. `expectedReturnAt` for OVERNIGHT checkouts accepted any string,
including dates years in the past or absurdly far in the future.**
- **Scenario:** `POST /api/movement/checkout` with
  `movementTypeId: "OVERNIGHT"` and `expectedReturnAt: "2020-01-01..."`
  (in the past relative to the checkout itself).
- **Impact:** A logically impossible "expected return" date was accepted
  and stored, which would display nonsensically on guard/warden
  dashboards and reports (a student's outing shown as "expected back"
  years before they even left).
- **Affected:** `src/app/api/movement/checkout/route.ts`
- **Fix:** Added validation that `expectedReturnAt`, if provided, must
  parse to a real date, must be strictly after the current checkout
  time, and must be within 30 days of it (a sane upper bound for how far
  ahead an overnight stay's expected return would reasonably be planned).
- **Retest:** A past date rejected; a date 60 days out rejected; a
  same-scenario checkout with a valid next-day return date succeeded
  (regression check).

### LOW — 1

**L1. `COUNT(*)` result returned as a string instead of a number.**
- **Scenario:** `GET /api/guard/dashboard` — `totalStudents` in the JSON
  response was the string `"51"` rather than the number `51`.
- **Impact:** Not exploitable and not visibly broken in the current UI
  (JavaScript's `-` operator coerces strings to numbers), but a type
  inconsistency that could cause subtle bugs in future code that assumes
  a number (e.g. `.toFixed()`, strict equality checks, or serialization
  elsewhere). Root cause: PostgreSQL's `COUNT(*)` returns a `bigint`,
  which the `pg` driver represents as a JS string to avoid silent
  precision loss for very large counts.
- **Affected:** `src/app/api/guard/dashboard/route.ts`
- **Fix:** Explicit `Number(...)` cast on the query result before using
  it in the response.
- **Retest:** Response now shows `"totalStudents": 51` (JSON number, not
  quoted).

---

## 4. Confirmed Safe — No Fix Needed (Selected Highlights)

These were actively tested and found to already be correctly
implemented — listed here so the scope of what was checked is clear,
not just what was broken.

- **SQL injection**: Drizzle ORM parameterizes all queries; injection
  strings in `loginId`/`purpose`/search fields were stored/rejected
  safely with no query manipulation possible.
- **XSS**: No `dangerouslySetInnerHTML`, `innerHTML`, or `eval` usage
  anywhere in the codebase (verified via full-codebase grep); React's
  default JSX escaping handles all user-supplied text.
- **Brute-force login**: rate limiter blocks after 8 attempts per
  loginId+IP within a 5-minute window (429 returned, verified).
- **Session invalidation on deactivation**: confirmed that deactivating
  a user's account **while they have an active session** causes their
  *very next request* to be rejected (401) — `getCurrentUser()` re-checks
  `isActive` fresh from the database on every call, never cached.
- **Duplicate active movement records**: a PostgreSQL **partial unique
  index** (`movement_one_active_per_student_idx`, `UNIQUE (student_id)
  WHERE time_in IS NULL`) was added as a database-level guarantee (see
  §5) on top of the existing application-level check.
- **Race conditions**: 30 simultaneous checkout requests (different
  idempotency keys, same student, fired truly in parallel) resulted in
  exactly 1 success and 29 correctly blocked — verified both via API
  responses and a direct database count.
- **Idempotent retries**: 5 simultaneous check-in requests using the
  *same* idempotency key resulted in exactly 1 real update and 4
  deduplicated responses, verified in the database.
- **IDOR attempts**: injecting a fake `studentId` into the checkout
  request body had no effect — the server always uses the authenticated
  session's identity, never a client-supplied ID.
- **Role bypass attempts**: student access to `/api/admin/settings`,
  `/api/guard/dashboard`, `/api/warden/history`, `/api/admin/students`
  (POST), and `/api/admin/audit` were all correctly rejected with 403.
- **Approval loopholes**: a student cannot decide their own approval
  request (403 — role-gated); guessing a random approval UUID returns
  404; attempting to decide an already-decided approval returns 409.
- **Audit log tamper resistance**: `/api/admin/audit` only exposes a
  `GET` handler — `DELETE`/`PUT` requests return 405 automatically
  (Next.js route handlers only respond to explicitly exported methods).
- **Registration privilege escalation**: attempting to inject `role:
  "admin"` or `isActive: true` into the public `/api/auth/register`
  payload had no effect — the Zod schema only extracts the fields it
  explicitly defines; new accounts are always created as an inactive
  student pending Admin approval.
- **Client-supplied timestamp injection**: a fake `timeOut` value in the
  checkout request body was ignored; the server's own `new Date()` is
  always what gets stored.
- **Cookie security**: session cookies are `httpOnly` (JS cannot read
  them, mitigating XSS-based theft), `secure` in production (HTTPS
  only), and `sameSite: "lax"` (reasonable CSRF baseline).
- **Concurrent load**: 30 different students logging in and checking out
  truly simultaneously all succeeded (200) with zero errors and zero
  duplicate active records afterward.

## 5. Data Integrity: Database-Level Hardening

Beyond fixing the bugs above, one defense-in-depth improvement was made
regardless of whether a failure could be reproduced in testing:

A **partial unique index** was added directly on the `movement_records`
table:

```sql
CREATE UNIQUE INDEX movement_one_active_per_student_idx
ON movement_records (student_id) WHERE time_in IS NULL;
```

This makes it a **database-enforced impossibility** — not just an
application-level check — for any student to have more than one active
(not-yet-checked-in) movement record at a time, no matter what request
pattern, retry storm, or future code change might otherwise create a
race window. The checkout route also now catches this specific
constraint violation gracefully and returns the same friendly
already-in-use message, rather than a generic 500 error, in the
extremely unlikely event this safety net is ever the one that fires.

## 6. Performance Notes

30 concurrent students performing login + checkout (60 requests total)
against the local test PostgreSQL instance completed in ~11.8 seconds
wall-clock with zero errors. **This validates correctness under
concurrent load (no crashes, no duplicate records, no deadlocks) but
does NOT measure real-world latency against the production Neon
database**, which has network round-trip time this local test instance
does not. If precise production latency numbers are needed, they would
need to be measured against the actual deployed Neon instance under
similar concurrent load — that was out of scope here since it would
touch live production data.

## 7. Security Review Summary

No authentication bypass, no working SQL injection, no working XSS, no
successful IDOR, no successful cross-role privilege escalation, and no
audit-log tampering vector were found across the attempts made (see §3
and §4). One real authorization-enforcement bug (H1, the
`guard_can_approve` gap) was found and fixed. Session handling,
password hashing, and cookie configuration all follow standard secure
practice.

## 8. Privacy Review Summary

Role-based phone-number visibility (`guard_can_view_phone`,
`warden_can_view_phone`) was previously confirmed working correctly in
this project's development history and was not found to have
regressed. Search results are appropriately role-gated. No endpoint was
found that leaks one student's data to another student.

## 9. Data Integrity Review

The one integrity-affecting bug found (duplicate active movements being
merely check-then-insert rather than DB-guaranteed) has been closed with
a real database constraint (§5). The late-detection snapshot bug (H2)
was a correctness/fairness issue rather than a corruption issue — no
data was ever lost or duplicated, but the *meaning* of already-stored
data (`deadlineAppliedAt`) was being ignored, which is now fixed.

## 10. Regression Test Results

After all fixes, a full pass was re-run and confirmed passing:
login (all 4 roles) → full NORMAL checkout→checkin cycle → guard
dashboard → warden dashboard → admin settings/schedule GET → Excel
report export. All returned expected HTTP 200 responses with no errors
in server logs.

## 11. Explicitly Out of Scope / Not Tested

Stated plainly, per the instruction not to claim untested coverage:

- **Real production load testing against the live Neon database** —
  not performed, to avoid touching production data; only a local
  PostgreSQL instance was load-tested (§6).
- **Browser-level UI interaction testing** (actual double-clicking,
  back-button behavior, mobile viewport rendering, browser autofill
  interference) — this environment can drive the HTTP API precisely but
  cannot drive a real browser's UI. The relevant *server-side*
  protections (idempotency, duplicate-record prevention) were tested and
  confirmed instead, which is what actually protects data integrity
  regardless of what the UI does.
- **DNS/CORS/production infrastructure review** — the project deploys
  behind Vercel's standard configuration; no custom CORS headers exist
  in the codebase to review, and Vercel manages TLS/HTTPS termination.
- **Long-running session-expiry testing** (12-hour session TTL) — the
  code was reviewed and confirms expiry is checked (`gt(sessions.expiresAt,
  nowIso)` on every lookup), but a 12-hour wait was not performed live.
- **Multi-region / DST edge cases** — Asia/Kuala_Lumpur does not observe
  daylight saving time and has a fixed UTC+8 offset, so this class of bug
  does not apply to this system.

## 12. Final Risk Assessment

Based on the tests performed and documented above, **no unresolved
CRITICAL or HIGH severity issues remain within the tested scope.** The
4 MEDIUM and 1 LOW issues found were all fixed and retested. The system
correctly enforces authentication, role-based authorization, and data
integrity under the concurrency and input-manipulation scenarios
exercised. The items in §11 represent genuine gaps in *this specific
testing session's* coverage, not confirmed weaknesses — they are listed
so that scope is honest rather than implied to be exhaustive.
