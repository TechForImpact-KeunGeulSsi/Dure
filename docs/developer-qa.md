# Developer QA Fixture

## Purpose

The developer QA fixture provides one resettable local workspace for steady-state product smoke testing before deployment. It is separate from `seed:darori`, which remains the Darori Google Form user-test seed. Remote staging remains an optional later step, not the default development loop.

This fixture does not prove that every server action or browser flow works. Direct service-role inserts prepare a known state; the manual smoke checklist exercises the running application. Browser steps remain required for authenticated server-action paths.

## Scope

The `smoke` profile creates:

- One fixed workspace in `Asia/Seoul`.
- Three active login roles: `owner_admin`, `group_admin`, and `instructor`.
- Active and inactive groups, scoped group-admin access, active/inactive/multi-group participants, and one explicit course exclusion.
- Planned, in-progress, completed, and legacy public/hidden course visibility examples, plus single-group and multi-group courses.
- Past and upcoming sessions plus cancelled, hidden, excluded-rollup, and special-session examples.
- General schedules, downloadable material, attendance, class memos, activity logs, and legacy feedback/settlement rows and receipt objects retained for migration checks.
- Attendance, participant, role-scope, and legacy-data-retention scenarios for the current operational dashboard.

Invite delivery/acceptance, signup callbacks, join requests, empty-state profiles, and upload-policy failures are intentionally outside this profile.

## Local-first workflow

Local mode reads its API URL and Auth keys directly from `supabase status`. It uses a fixed local-only workspace ID and password, so no QA environment variables are required.

Prerequisites:

```bash
open -a Docker
supabase start
```

Reset the local QA workspace and immediately run the verifier:

```bash
npm run seed:developer-qa:local -- --reset
```

Verify without resetting:

```bash
npm run verify:developer-qa:local
```

Local login credentials:

```text
owner: dure.qa.owner@test.local
group admin: dure.qa.group@test.local
instructor: dure.qa.instructor@test.local
password: dure-local-qa-password
```

These credentials are intentionally local-only and must not be reused after deployment.

Run the app against local Supabase without rewriting `.env.local`:

```bash
npm run dev:local
```

This command reads the local URL and keys from `supabase status` and injects them only into the Next.js development process.

For a reproducible investigation, override the Seoul reference date:

```bash
npm run seed:developer-qa:local -- --reset --reference-date 2026-07-26
```

Normally omit `--reference-date` so the fixture remains aligned with the current dashboard date.

## Mapo center dashboard demo

The `mapo-dashboard` profile is a separate local-only workspace for explaining the attendance dashboard with synthetic Mapo Disability Family Support Center data. It does not modify the existing `DURE Developer QA` workspace.

It creates three in-progress classes (`생활체육교실`, `미술활동`, `음악교실`), 18 sessions, 12 fictional participants, and attendance patterns for present, partial attendance, absent, and missing records. The data includes low attendance at `2/6`, exact `50%` cases that remain normal, and a participant history with `출석/유효회차`.

Build and verify the local demo workspace:

```bash
npm run seed:mapo-dashboard:local -- --reset
```

Verify without resetting:

```bash
npm run verify:mapo-dashboard:local
```

The demo uses the same local password as the developer QA fixture. Its accounts are:

```text
owner: mapo.demo.owner@test.local
operator: mapo.demo.operator@test.local
fitness instructor: mapo.demo.fitness@test.local
art instructor: mapo.demo.art@test.local
music instructor: mapo.demo.music@test.local
password: dure-local-qa-password
```

The demo seed is intentionally local-only, uses a fixed workspace ID, and resets only that workspace. No real participant identity or production data is included.

## Optional remote workflow

Only configure these for a dedicated remote QA/staging project. Do not commit their values.

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
DURE_QA_ALLOWED_PROJECT_REFS
DURE_QA_WORKSPACE_ID
DURE_QA_PASSWORD
```

Optional overrides:

```text
DURE_QA_OWNER_EMAIL
DURE_QA_GROUP_ADMIN_EMAIL
DURE_QA_INSTRUCTOR_EMAIL
DURE_QA_APP_URL
```

Rules:

- `DURE_QA_ALLOWED_PROJECT_REFS` is a comma-separated remote allowlist. For `https://abc.supabase.co`, the ref is `abc`.
- `DURE_QA_WORKSPACE_ID` must be a dedicated UUID that is never assigned to a real workspace.
- `DURE_QA_PASSWORD` must have at least 12 characters and is never printed by the script.
- `SUPABASE_SERVICE_ROLE_KEY` must be a `service_role` JWT.
- The existing workspace, when present, must match the configured ID, the exact name `DURE Developer QA`, and the configured owner Auth user.

Remote preflight:

```bash
npm run seed:developer-qa -- --dry-run
```

Remote reset and verification:

```bash
npm run seed:developer-qa -- --reset
```

Remote verification only:

```bash
npm run verify:developer-qa
```

## Contract tests

Run fixture contract tests without contacting Supabase:

```bash
npm run test:developer-qa
```

## Attendance dashboard local verification

Apply the current migration set to the local database before the first run. `supabase db reset` is local-only and resets the local database.

```bash
supabase start
supabase db reset
npm run verify:developer-qa:local
```

The verifier resets the fixed QA workspace and checks the following current operational state with all three local Auth accounts:

- owner, group-admin, and instructor membership roles are valid;
- each role sees only its permitted courses and participant scope;
- the dashboard fixture includes past, current, upcoming, cancelled, and excluded sessions;
- attendance records and legacy data-retention rows are present in the expected workspace.

The command intentionally leaves the completed fixture in the local workspace. Restore the baseline after browser checks with:

```bash
npm run seed:developer-qa:local -- --reset
```

### Authenticated browser checklist

Run the app against the same local Supabase instance:

```bash
npm run dev:local
```

Use the local accounts and password in the Local-first workflow. With a fresh fixture, verify:

1. Owner opens the workspace home and sees the horizontal class filter, date control, summary metrics, and daily attendance graph.
2. Selecting one or more classes updates the graph without opening a filter drawer.
3. Selecting a graph row opens participant attendance rates with `출석/유효회차`; a participant opens session history and the attendance book link.
4. Group admin and instructor see only their permitted course scope and do not see any Copilot surface.
5. Confirm the dashboard contains no attendance-trend graph and no SMS action.

After the browser checklist, run `npm run verify:developer-qa:local` for the restored baseline, or reset first if the browser session intentionally changed data.

## Safety and failure behavior

Before reset, the script verifies the target (`local` automatically or an explicit remote allowlist), service-role JWT, required schema projections, Storage bucket, and existing workspace identity. The reset mode must be explicit.

Database reset and Storage cleanup are not one transaction. A network or insert failure can leave a partial QA workspace. The command exits non-zero and never prints a success result in that state. After correcting the reported problem, rerun the same reset command; deterministic IDs and prefix cleanup make recovery repeatable.

The verifier checks:

- All three credentials can sign in.
- Membership roles and statuses match.
- Group-admin and instructor course scopes match the fixture contract.
- Core table counts match.
- Expected Storage paths exist.
  - Live DB counts, role scopes, attendance records, and retained legacy rows match the fixture contract.

The verifier does not create a Next.js cookie session, render pages, click evidence links, or exercise mutation server actions.

## Manual smoke checklist

Reset immediately before the session. For local work, record the reference date and branch; after deployment, also record the deployed URL.

### Owner admin

- Sign in and open the fixed QA workspace.
- Confirm home course cards and recent activity are populated.
- Confirm calendar shows course sessions and general schedules.
- Confirm member, group, participant, and course management pages load expected data.
- Confirm legacy public/hidden course visibility values remain only as retained data; active operations use workspace-scoped access.
- Open materials and download the internal fixture where allowed.
- Confirm legacy feedback/settlement rows and receipt objects remain retained but have no active screen or action.
  - Confirm the dashboard shows horizontal class filters, summary counts, and the selected-date attendance graph.
- Open every task evidence control and confirm it targets the correct existing management page.
- Perform one reversible create/edit operation through the UI to exercise a real owner server action.

### Group admin

- Sign in and confirm only the Alpha-scoped courses are visible.
- Confirm Beta-only and Gamma-only courses and participants are not exposed.
- Confirm the multi-group course is visible under the current at-least-one-accessible-group read policy.
- Perform one allowed scoped edit.
  - Confirm the dashboard shows only the group-scoped classes for this role.

### Instructor

- Sign in and confirm only the three assigned courses are visible.
- Save attendance for an assigned session.
- Save or edit a class memo.
- Exercise one material operation through the UI.
- Confirm unassigned courses are inaccessible.
  - Confirm the dashboard shows only the instructor's assigned classes for this role.

### Retired public surface

- Sign out and confirm `/` shows the operations-focused landing without a course catalog.
- Confirm the retired public course route returns 404 and no public material download or feedback submission is available.

### Restore

All manual mutations intentionally cause fixture drift. Finish by running:

```bash
npm run seed:developer-qa:local -- --reset
```

Then confirm `npm run verify:developer-qa:local` passes.
