# DURE Repository Instructions

## Scope and sources

- DURE manages permission-scoped attendance and course operations. Supabase is the source of truth. Public catalog, feedback, settlement, Copilot, and ReviewMaterial app entry points are retired; retained migrations, rows, and Storage objects are not permission to restore or delete them.
- `src/app/` contains routes and Server Action consumers; `src/services/` contains business queries/actions and permission checks; `src/lib/` contains auth, Supabase clients, validators, and DTOs. `src/middleware.ts` refreshes cookies and is not the authorization boundary.
- `supabase/migrations/` is the intended schema/RLS/RPC/Storage contract. Current product contracts are [architecture](docs/architecture.md), [API](docs/api-spec.md), [ontology](docs/ontology-contract.md), [UI](docs/ui-system.md), and [context](docs/context.md). Use [STATUS](docs/STATUS.md) for current blockers and evidence; `docs/ontology.md` is historical.

## Non-obvious invariants

- Existing-workspace operations authorize authenticated user → active membership belonging to that user → role → group/course scope → target workspace/state. Bootstrap flows (workspace creation, discovery/join requests, invite acceptance) are exceptions. Caller-supplied role, member, and workspace IDs are not authorization; an admin client may establish membership, but does not replace service authorization or RLS.
- Group admins may view a course through an intersecting group; full-course mutation requires every linked group to be in scope. Instructors require direct course assignment. Preserve last-active-owner protection.
- Participant rosters derive from current course/group and participant/group links, explicit course exclusions, and deduplication; legacy snapshot links are not the primary roster. The active/inactive discrepancy remains recorded in `docs/STATUS.md`.
- Cumulative attendance uses assignment-date-aware, ended, included, non-cancelled sessions with a record: `present` and `partial` each count once, missing records are excluded, and exactly 50% is not low attendance. Daily charts use assigned participants as the denominator, including missing records.
- Materials are private `admin_only` resources, including authorized assigned instructors. Upload/replacement is a `FormData` Server Action using the admin Storage client after permission checks; downloads use authorized short-lived signed URLs; `/api/materials/upload-url` remains 410. The current uploader exception is a documented policy discrepancy, not an approved scope rule.
- `src/services/invites.ts:createInvite` is the single invitation entry point, including scoped group-admin invitations and Auth-admin link generation. `SUPABASE_SERVICE_ROLE_KEY` is server-only, must be a service-role JWT, and must not be treated as an RLS substitute.
- Use the domain terms `워크스페이스`, `그룹`, `수업`, `회차`, `참여자`, `멤버`, `강사`, `대표 운영자`, and `그룹 운영자`. Participants are operational records, not Auth users or API actors.
- Product UI copy follows `docs/ui-system.md`; agent/process/design commentary stays outside product screens.

## Codex workflow

- Follow the Issue → Planning → Implementation → Testing → Pull Request → Review → Merge process in [CONTRIBUTING.md](CONTRIBUTING.md). The user manages branches, commits, and pushes in GitHub Desktop; Codex implements, verifies, reviews, and prepares PR text.
- The user selects the model and reasoning effort in Codex. Do not set repository model/effort overrides, route tasks by model, or switch models automatically. Apply the same scope, domain invariants, and verification standards to every model.
- Start with the relevant working-tree diff, entry point, and nearest tests; read only the contract sections needed for the change. Reuse existing service, validator, DTO, and UI patterns. Expand the search when a dependency or unresolved question requires it.
- The main agent handles ordinary exploration, implementation, and verification directly. Keep simple changes direct; split larger changes into verifiable increments without mandatory planning artifacts.
- Use a subagent only for an independent large task with real parallel benefit and distinct context, when the gain exceeds the token/context cost. Do not create generic explorer/planner/reviewer/tester stages. The remaining `dure_boundary_reviewer` is only for a material authorization, tenant, RLS/RPC, Storage, or sensitive-data boundary review.
- Optional Skills: [boundary review](.agents/skills/dure-boundary-review/SKILL.md) for those boundaries and [integration/release verification](.agents/skills/dure-verification/SKILL.md) for DB, fixtures, browser, Storage, or release evidence. They are not mandatory phases for routine edits.
- Reuse evidence already gathered in this task. Prefer scoped `rg` searches and bounded output; exclude generated files and lockfiles unless relevant. Read STATUS history and instruction audits only for a relevant blocker or history question, not as startup context.
- Finish with the requested behavior implemented, relevant checks completed, and remaining evidence gaps stated. Keep the report to changes, checks, and material blockers. Update STATUS only when product scope, blockers, or verification evidence changes; do not create duplicate task logs.

### Before implementation

1. Read the related Issue's background, requirements, acceptance criteria, and out-of-scope items. If no Issue is available, use the explicit user request as provisional scope, report the missing Issue, and prepare an Issue draft before PR preparation; never invent an Issue number or create one remotely without authorization.
2. Inspect the relevant working-tree diff, code, nearest tests, current design contracts, applicable directory instructions, and related ADRs in `docs/decisions/`.
3. Present a concise implementation plan, affected files, and test plan in the conversation or Issue. A separate planning document is unnecessary for routine work.
4. Propose important architecture changes, alternatives, and consequences before implementing them, and wait for explicit user approval of that decision.

### During implementation

1. Focus on one primary Issue. Preserve unrelated user changes; propose a separate Issue for scope expansion.
2. Respect existing architecture, service authorization, validators, DTOs, and coding conventions.
3. Add or update meaningful tests for changed behavior and regression cases, proportional to risk; follow the verification rules below.
4. Update the existing source-of-truth documents in the same change when current behavior or API contracts change. Link them instead of duplicating specifications.
5. Record consequential decisions with an ADR; avoid ADRs for cosmetic edits, routine bug fixes, or ordinary implementation choices.

### Before PR and review

1. Review the diff, including new files, for unrelated changes, secrets, and accidental generated artifacts.
2. Map every acceptance criterion to implementation and verification evidence; identify unmet criteria.
3. Run relevant checks and record the actual command, environment, result, and verification gaps. Never report unrun tests as passed.
4. Verify code/document consistency, links, and the status of any required ADR approval.
5. Prepare all sections of the [PR template](.github/pull_request_template.md), including the related Issue, remaining risks, trade-offs, and unfinished work. Check a checkbox only when its claim has been verified; explain non-applicable items explicitly.
6. Review the current diff against the Issue and relevant contracts. Report actionable findings with file/line, impact, and validation needs; distinguish blockers from suggestions. Recheck changed areas after fixes and review the final pushed revision before merge.
7. A completed implementation or Codex review does not authorize remote publication or merge. The user decides whether to merge after required checks and review.

## Architecture decisions

- For consequential technology, deployment, data ownership/model, authorization, public API, or difficult-to-reverse dependency changes, propose an ADR using [the template](docs/decisions/template.md). Record Context, Decision, Alternatives, Trade-offs, and Consequences, plus status and links to the Issue and user approval.
- A proposal is not approval. Mark an ADR accepted only after explicit user approval; do not implement an important architecture change while that approval is pending.
- Keep approved ADRs as historical records. When an important decision changes, create a new ADR referencing and superseding the prior one rather than rewriting its original rationale. Update current architecture/API contracts separately to describe implemented behavior.
- Do not create unnecessary documents, mandatory plan files, duplicate task logs, or retroactive ADRs that imply approval without evidence.

## Git management

- Do not create commits, push, create/publish Issues or PRs, send external messages, deploy, or merge unless the user explicitly requests the specific action. A request to implement a feature does not authorize those actions.
- Never merge into `main` without explicit user approval. Do not change important architecture or perform destructive operations without approval.
- When a Git action is explicitly authorized, include only related verified changes, preserve other tasks' work, and report the action and verification results. Never publish secrets, credentials, local configuration, or unreviewed backlog.

## Commands

- Use Node.js 22.18+ and npm; CI uses Node 24 and `npm ci`.
- Development: `npm run dev` or `npm run dev:local`.
- Tests and checks: use the nearest focused script in `package.json`; available broad checks are `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`.
- Local Supabase and fixture procedures are in [setup](docs/setup.md) and [developer QA](docs/developer-qa.md). `supabase db reset` is destructive; do not use it as a routine prerequisite.

## Risk-proportional verification

- Docs, instructions, or config: validate referenced paths, commands, and links; run `git diff --check` and parse changed TOML/Skill metadata when applicable.
- Pure logic or application changes: run the nearest focused tests and typecheck when TypeScript or package resolution is affected; add lint/build only when the changed surface warrants it.
- For behavior changes, cover the changed success/failure case with a focused test when practical; for a bug fix, prefer a regression case that fails before the fix. Do not add tests that merely mirror implementation or test cosmetic edits. Repeat passing checks only after relevant changes or new evidence of a problem.
- Migrations, RLS/RPC, Storage, privileged actions, or role/scope changes: verify relevant allow/deny cases locally, including another workspace where applicable, and separate code evidence from DB/Storage/browser evidence.
- CI uses placeholder Supabase values. Tests, typecheck, lint, and build do not prove authenticated browser behavior, DB migration, Storage, deployment, or persistence; report those layers as unverified when not run.
