---
name: dure-verification
description: Verify DURE local integration, fixtures, migrations, and releases with separate code, database, browser, Storage, and deployment evidence.
---

# DURE Integration and Release Verification

Choose checks from the changed surface and `AGENTS.md`; consult `package.json` and CI for executable commands. Docs-only changes need path/command validation and `git diff --check`, not the full product suite.

## Local integration

- `supabase start` requires Docker. Apply migrations to the intended local target before integration checks. `supabase db reset` erases local data and is not routine.
- Developer QA: `npm run seed:developer-qa:local -- --reset` seeds and verifies; `npm run verify:developer-qa:local` checks an existing baseline. See `docs/developer-qa.md` for mutation scope. These fixture checks do not prove Next.js services, participant-role denial, or cross-workspace denial.
- Dashboard demo: `npm run seed:mapo-dashboard:local -- --reset` seeds a separate synthetic workspace; `npm run verify:mapo-dashboard:local` checks an existing baseline.
- Use `npm run dev:local` against the same instance for changed authenticated flows. Check affected roles and denied scopes with local sessions, then verify DB/Storage postconditions separately from rendered UI. Non-local seed commands may write remotely.

## Release evidence

Identify source SHA, deployment target/result, applied migrations, authenticated browser flow, and persisted postconditions separately. CI tests/typecheck/lint/build use placeholders and cannot supply those runtime layers.

Report commands/actions and observed results. A failed required check is FAIL; unavailable evidence is UNVERIFIED with the reason. Do not repeat passing checks or broaden testing without a relevant change, failure, or unresolved concern.
