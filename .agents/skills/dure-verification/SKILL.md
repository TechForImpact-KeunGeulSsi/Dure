---
name: dure-verification
description: Verify DURE local integration, fixtures, migrations, and releases with separate code, database, browser, Storage, and deployment evidence.
---

# DURE Integration and Release Verification

Choose checks from the changed surface and AGENTS.md's verification rules. Consult `package.json` and CI for executable commands; ordinary docs-only changes need path/command validation and diff checks, not the full product suite.

## Local integration

- `supabase start` requires Docker. Apply new migrations to the intended local target before integration checks. Full `supabase db reset` erases local data; use it only when that reset is authorized.
- Developer fixture: `npm run seed:developer-qa:local -- --reset` seeds and verifies; use `npm run verify:developer-qa:local` for an existing baseline or after browser checks. `--verify-only` does not populate/reset missing fixtures. See `docs/developer-qa.md` for mutation scope and baseline restoration. Its role checks query Supabase directly, not Next.js services; participant denial and cross-workspace checks require additional cases.
- Dashboard demo: `npm run seed:mapo-dashboard:local -- --reset` seeds and verifies a separate synthetic workspace; `npm run verify:mapo-dashboard:local` checks an existing baseline.
- Start the app with `npm run dev:local` against the same instance. Check changed roles and denied group/course/second-workspace cases with real local sessions; verify DB/Storage postconditions separately from rendered UI.
- Non-local seed commands can write remotely. Confirm the target and existing authorization before executing a mutation; do not request it again when the current request already covers that scope.

## Release evidence

Identify the source SHA, Vercel deployment target/result, applied Supabase migrations, relevant authenticated browser flow, and persisted postconditions separately. CI runs tests/typecheck/lint/build with placeholders and cannot supply those runtime layers. Deployment, migration, external sends, and production mutations require authorization covering the actual action.

Report commands/actions and observed results. A failed required check is FAIL; unavailable evidence is UNVERIFIED with the reason. Do not repeat passing checks or broaden testing without a relevant change, failure, or unresolved concern.
