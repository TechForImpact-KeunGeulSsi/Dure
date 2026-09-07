# DURE Repository Instructions

## Project Overview

DURE manages permission-scoped attendance and course operations. Supabase is the application backend; there is no application LLM provider. Public catalog, feedback, settlement, and Copilot/ReviewMaterial screens and services are retired, while historical migrations, rows, and Storage objects remain. Their presence is not authorization to restore features or delete retained data.

## Architecture

- `src/app/`: Next.js App Router pages, Server Actions consumers, and HTTP handlers. `src/middleware.ts` refreshes auth cookies; it is not the authorization boundary.
- `src/services/`: business queries/actions and permission checks. Pages use these services; shared auth, Supabase clients, Zod input schemas, and DTOs live in `src/lib/`.
- `supabase/migrations/`: ordered SQL schema, RLS, RPCs, triggers, and Storage policies. Migration files describe intended database state, not proof of remote application.
- Current contracts: [architecture](docs/architecture.md), [API](docs/api-spec.md), [ontology](docs/ontology-contract.md), [UI](docs/ui-system.md). Compare with current code/tests when they disagree. [STATUS](docs/STATUS.md) records scope, blockers, and dated evidence; update it when those change. `docs/ontology.md` is historical.
- Optional workflows: [research/scoping](.agents/skills/dure-repository-research/SKILL.md), [behavior changes](.agents/skills/dure-tdd-vertical-slice/SKILL.md), [boundary review](.agents/skills/dure-boundary-review/SKILL.md), [integration/release verification](.agents/skills/dure-verification/SKILL.md). Select by the changed surface; these are not mandatory phases for every edit.

## Codex Model Routing

- Use `gpt-6-astra` with `medium` only to plan genuinely large implementation scopes that span multiple product areas or architecture layers, especially when they include consequential authorization or data decisions. The `dure_large_planner` role owns this planning lane; hand implementation back to Luna.
- When a separate implementation plan adds value but the scope does not require Astra, use `dure_planner` with `gpt-5.6-sol` and `high`.
- Default implementation, routine investigation, review, and verification to `gpt-5.6-luna` with `xhigh`. Small, well-scoped changes may proceed without a separate planning agent.
- Under this routing, do not select Astra for routine implementation or at `high` or above. A user must explicitly revise this policy before either exception.

## Commands

Use npm with Node.js 22.18+ (native TypeScript stripping used by pure tests); CI uses Node 24 and `npm ci`.

```bash
npm ci
npm run dev                 # configured environment
npm run dev:local           # injects running local Supabase values into Next.js
npm test                    # executable .mjs tests, including pure TS module imports
npm run typecheck           # includes the type-only removeMember contract
npm run lint
npm run build
```

Focused test scripts are in `package.json`; local DB/fixture procedures are in [setup](docs/setup.md) and [developer QA](docs/developer-qa.md). `supabase start` requires Docker; `supabase db reset` destroys local data and is not a routine test prerequisite. Non-local seed scripts can write remotely.

Generated `.next/`, `next-env.d.ts`, and `*.tsbuildinfo` are ignored; change their source configuration instead. There is no configured database type-generation command.

## Non-obvious Constraints

- Existing-workspace operations check authenticated user → active membership belonging to that user → role → group/course scope → target workspace/state before privileged work. Membership lookup may itself require the server-only admin client; caller-supplied role/member/workspace IDs are not authorization. Workspace creation, discovery/join requests, and invite acceptance have distinct bootstrap checks; do not require membership before it can exist.
- Group admins can view a course through an intersecting group; full-course mutation requires all linked groups within their scope. Instructor course access requires direct assignment. Existing material-uploader access differs from this intended scope; see the unresolved authorization discrepancy in `docs/STATUS.md`. Preserve last-active-owner protection in services and the DB.
- `SUPABASE_SERVICE_ROLE_KEY` is server-only and must be a service-role JWT. RLS is a separate defense; admin paths still require service authorization.
- Course participation derives from current course/group and participant/group links, explicit course exclusions, and deduplication. Do not restore legacy snapshot links as the primary roster. The active/inactive participant discrepancy is recorded in `docs/STATUS.md`.
- Cumulative participant attendance uses assignment-date-aware, ended, included, non-cancelled sessions with a record. `present` and `partial` each count as one; missing records are excluded; exactly 50% is not low attendance. Daily session charts instead divide by assigned participants, including missing records. Preserve both contracts.
- Materials use private `admin_only` visibility, which includes authorized assigned instructors. Upload/replacement is a `FormData` server action with admin `storage.upload()` after permission checks; downloads use authorized short-lived signed URLs. `/api/materials/upload-url` stays 410.
- `src/services/invites.ts:createInvite` is the single invitation entry point, including scoped group-admin invitations and Auth-admin link generation.
- Product UI copy follows `docs/ui-system.md`: task, state, scope, validation, result, risk confirmation, and accessibility text. Agent/process/design commentary belongs outside product screens.

## Domain / Terminology

Use `워크스페이스`, `그룹`, `수업`, `회차`, `참여자`, `멤버`, `강사`, `대표 운영자`, and `그룹 운영자` as defined in [context](docs/context.md). Participants are operational records, never Auth users or API actors. Instructors are course-assigned; group admins are group-scoped.

## Verification

- Docs/instructions/config: validate referenced paths and commands and run `git diff --check`. Package/runner/CI changes also need relevant executable tests; typecheck when TS or package resolution is affected.
- Application/UI: focused behavior checks plus lint/build; authenticated browser checks for changed role/scope interactions.
- Migration/RLS/Storage/privileged actions: relevant contract tests and local Auth/DB/Storage allow/deny cases, including another workspace where applicable.
- CI uses placeholder Supabase values. Tests, typecheck, lint, and build do not prove DB migration, authenticated browser behavior, Storage, deployment, or persistence. Report missing evidence separately.
