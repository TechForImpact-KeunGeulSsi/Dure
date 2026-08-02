# Developer QA Fixture

## Purpose

The developer QA fixture provides one resettable local workspace for steady-state product smoke testing and Admin Copilot validation before deployment. It is separate from `seed:darori`, which remains the Darori Google Form user-test seed. Remote staging remains an optional later step, not the default development loop.

This fixture does not prove that every server action or browser flow works. Direct service-role inserts prepare a known state; the manual smoke checklist exercises the running application.

## Scope

The `smoke` profile creates:

- One fixed workspace in `Asia/Seoul`.
- Three active login roles: `owner_admin`, `group_admin`, and `instructor`.
- Active and inactive groups, scoped group-admin access, active/inactive/multi-group participants, and one explicit course exclusion.
- Planned, in-progress, completed, public, hidden, single-group, and multi-group courses.
- Past and upcoming sessions plus cancelled, hidden, excluded-rollup, and special-session examples.
- General schedules, downloadable material and receipt fixtures, attendance, class memos, feedback, settlements, and activity logs.
- Exactly one input scenario for each Admin Copilot v1 task: pending material review, attendance risk, new feedback, and completion candidate.

Invite delivery/acceptance, signup callbacks, join requests, empty-state profiles, upload-policy failures, and browser E2E are intentionally outside this profile.

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

Normally omit `--reference-date` so the fixture remains aligned with the current Admin Copilot window.

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

## Safety and failure behavior

Before reset, the script verifies the target (`local` automatically or an explicit remote allowlist), service-role JWT, required schema projections, Storage bucket, and existing workspace identity. The reset mode must be explicit.

Database reset and Storage cleanup are not one transaction. A network or insert failure can leave a partial QA workspace. The command exits non-zero and never prints a success result in that state. After correcting the reported problem, rerun the same reset command; deterministic IDs and prefix cleanup make recovery repeatable.

The verifier checks:

- All three credentials can sign in.
- Membership roles and statuses match.
- Group-admin and instructor course scopes match the fixture contract.
- Core table counts match.
- Expected Storage paths exist.
- Live DB projections produce exactly one task in each Admin Copilot category through the deterministic briefing logic.

The verifier does not create a Next.js cookie session, render pages, click evidence links, or exercise mutation server actions.

## Manual smoke checklist

Reset immediately before the session. For local work, record the reference date and branch; after deployment, also record the deployed URL.

### Owner admin

- Sign in and open the fixed QA workspace.
- Confirm home course cards and recent activity are populated.
- Confirm calendar shows course sessions and general schedules.
- Confirm member, group, participant, and course management pages load expected data.
- Confirm public/hidden, active/inactive, and multi-group examples are distinguishable.
- Open materials and download both the internal fixture and the public fixture where allowed.
- Open feedback and settlements; confirm new/reviewed and pending/paid examples.
- Confirm Admin Copilot shows exactly one task for each v1 category.
- Open every task evidence control and confirm it targets the correct existing management page.
- Perform one reversible create/edit operation through the UI to exercise a real owner server action.

### Group admin

- Sign in and confirm only the Alpha-scoped courses are visible.
- Confirm Beta-only and Gamma-only courses and participants are not exposed.
- Confirm the multi-group course is visible under the current at-least-one-accessible-group read policy.
- Perform one allowed scoped edit.
- Confirm Admin Copilot is unavailable to this role.

### Instructor

- Sign in and confirm only the three assigned courses are visible.
- Save attendance for an assigned session.
- Save or edit a class memo.
- Exercise one material operation and one settlement operation through the UI.
- Confirm unassigned courses are inaccessible.
- Confirm Admin Copilot is unavailable to this role.

### Public surface

- Sign out and confirm public courses appear while the hidden course does not.
- Open a public course and download its public material.
- Submit a feedback item and confirm it appears for the owner.

### Restore

All manual mutations intentionally cause fixture drift. Finish by running:

```bash
npm run seed:developer-qa:local -- --reset
```

Then confirm `npm run verify:developer-qa:local` passes.
