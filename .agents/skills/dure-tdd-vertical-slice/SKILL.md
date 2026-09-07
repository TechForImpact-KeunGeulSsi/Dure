---
name: dure-tdd-vertical-slice
description: Implement DURE behavior changes using its Node tests, service contracts, and local Supabase verification patterns.
---

# DURE Behavior Changes

- Pure logic and source contracts use Node `node:test`/assert in `.test.mjs`; `npm test` runs the configured globs. Direct TypeScript imports need explicit `.ts` paths and Node 22.18+. Type-only contracts such as `workspace-members.remove-member.test.ts` belong to typecheck, not runtime execution.
- For a behavior defect, reproduce it with the nearest focused test, then implement and rerun. If a pure test cannot exercise the failure, use the relevant local DB or browser observation and explain what remains unverified. Text/style-only edits do not need artificial RED/GREEN tests.
- Follow the existing page/service/validator/DTO boundary. For privileged mutations, cover affected role/group/course denials and another workspace; source inspection alone does not prove RLS or Storage behavior.
- Fixture procedures and reset scope live in [developer QA](../../../docs/developer-qa.md); preserve its seed/verify distinction. A fixture reset and `supabase db reset` have different destructive scopes and require authorization covering the actual operation.

Use independent review for complex or sensitive changes when it adds confidence. Report the focused evidence and material deviations; use dure-verification for integration/release procedures.
