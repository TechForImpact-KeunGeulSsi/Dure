# DURE Admin Copilot MVP Implementation Plan

## Goal

Build a read-only representative-operator Admin Copilot that summarizes DURE workspace operations and recommends unresolved administrative tasks with evidence and related screen links.

## Current Implementation Status

The deterministic MVP is implemented without an AI provider dependency.

- `src/services/admin-copilot.ts` performs owner-admin authorization and permission-scoped read aggregation.
- `src/services/admin-copilot-logic.ts` calculates the briefing window, four task signals, evidence, counts, and priority order.
- `src/components/admin-copilot/` renders the dashboard briefing and evidence-backed task rows.
- Workspace home loads the briefing only for `owner_admin`.
- `scripts/admin-copilot-logic.test.mjs` covers permissions, time windows, signal generation, attendance eligibility, and completion eligibility.
- LLM phrasing remains intentionally deferred until an AI API provider and key are configured.

## Architecture

Supabase remains the source of truth. A new service-layer query computes deterministic administrative signals, normalizes them into graph-shaped task context, and exposes them to a dashboard card UI. LLM usage, if added later, is limited to phrasing over permission-filtered service output.

## Tech Stack

- Next.js 15 App Router
- React 19
- TypeScript
- Supabase
- Existing `src/services/` pattern
- Existing `ApiResult` conventions
- Zod if input validation grows

## Source Documents

- `AGENTS.md`
- `docs/context.md`
- `docs/architecture.md`
- `docs/api-spec.md`
- `docs/admin-copilot-prd.md`
- `docs/ontology.md`

## MVP Decisions

- User: representative operator only (`owner_admin`).
- Scope: operational briefing + unresolved administrative task recommendations.
- Read-only: no mutations in v1.
- Time window: previous 7 days plus today and next 7 days.
- Included signals:
  - Pending material review.
  - Attendance-risk participants.
  - New course feedback.
  - Course completion candidates.
- Excluded from v1:
  - Settlement tasks.
  - Group-admin or instructor copilot.
  - Separate graph DB.
  - LLM-generated SQL.
  - Action execution.

## Likely File Changes

Create:

- `src/services/admin-copilot.ts`
- `src/services/admin-copilot.test.ts`
- `src/components/admin-copilot/admin-copilot-briefing.tsx`
- `src/components/admin-copilot/admin-copilot-task-card.tsx`

Modify:

- `src/app/workspaces/[workspaceId]/(dashboard)/home/page.tsx`

Avoid unless necessary:

- `supabase/migrations/`
- Existing mutation services

## Implementation Tasks

### Task 1. Inspect Existing Home and Service Patterns

Objective: understand exact imports, DTO style, auth helpers, and page composition before coding.

Read:

- `src/app/workspaces/[workspaceId]/(dashboard)/home/page.tsx`
- `src/services/access.ts`
- `src/services/materials.ts`
- `src/services/course-feedbacks.ts`
- `src/services/attendance.ts`
- `src/services/course-sessions.ts`
- `src/lib/api/*`

Checklist:

- Find current `loadCurrentMembership` or equivalent helper.
- Find current `ApiResult` import path.
- Find dashboard home loading and error handling pattern.
- Confirm href patterns for materials, attendance, feedback, and course screens.

### Task 2. Define Admin Copilot Types

Objective: add stable TypeScript types for the briefing service.

File:

- `src/services/admin-copilot.ts`

Required exported types:

- `AdminCopilotTaskType`
- `AdminCopilotTaskPriority`
- `AdminCopilotEvidenceEntityType`
- `AdminCopilotEvidence`
- `AdminCopilotTask`
- `AdminCopilotBriefing`

Service shape should align with `docs/admin-copilot-prd.md`.

Verification:

```bash
npm run typecheck
```

### Task 3. Add Permission-Gated Service Skeleton

Objective: create `getAdminCopilotBriefing` that validates authenticated owner-admin access and returns an empty deterministic structure.

Files:

- `src/services/admin-copilot.ts`
- `src/services/admin-copilot.test.ts`

Behavior:

- Input: `{ workspaceId: string; referenceDate?: string }`.
- Require authenticated active membership.
- Require `role === 'owner_admin'`.
- Return `ROLE_FORBIDDEN` for active non-owner members.
- Return existing auth/workspace errors for unauthenticated or inactive members.
- Return empty summary/tasks initially.

Verification:

- Add tests for owner access and non-owner rejection.
- Run the specific test file.
- Run `npm run typecheck`.

### Task 4. Implement Briefing Window Calculation

Objective: calculate previous 7 days, today, and next 7 days using workspace timezone conventions.

Behavior:

- Default reference is current time.
- Optional `referenceDate` supports deterministic tests.
- `recentFrom = today - 7 days`.
- `upcomingUntil = today + 7 days`.
- Use workspace timezone when available; default remains `Asia/Seoul`.

Verification:

- Test fixed reference date.
- Run specific tests and `npm run typecheck`.

### Task 5. Implement Pending Material Review Signal

Objective: add deterministic task detection for uploaded materials with pending review.

Query requirements:

- Workspace-scoped.
- `materials.upload_status = 'uploaded'`.
- `materials.review_status = 'pending'`.
- Include related course label and id.

Task output:

- Type: `pending_material_review`.
- Priority: `medium`.
- Related href: course materials page.
- Evidence: material + course.

Verification:

- Pending uploaded material creates task.
- Failed/uploading or reviewed material does not create task.

### Task 6. Implement New Feedback Signal

Objective: add deterministic task detection for new course feedback.

Query requirements:

- Workspace-scoped.
- `course_feedbacks.status = 'new'`.
- Include course id and course name snapshot.

Task output:

- Type: `new_course_feedback`.
- Priority: `low`.
- Related href: workspace feedback page.
- Evidence: feedback + course.

Verification:

- New feedback creates task.
- Reviewed feedback does not create task.

### Task 7. Implement Course Completion Candidate Signal

Objective: flag in-progress courses whose final eligible session ended in the past.

Eligibility:

- `courses.status = 'in_progress'`.
- Final eligible session has ended before reference time.
- Eligible final session:
  - `rollup_status = 'included'`
  - `visibility_status = 'visible'`
  - `progress_status = 'scheduled'`

Task output:

- Type: `course_completion_candidate`.
- Priority: `medium`.
- Related href: course home or edit page.
- Evidence: course + final eligible session.

Verification:

- In-progress course with elapsed final eligible session creates task.
- Planned/completed course does not create task.
- Hidden/excluded/cancelled sessions do not define final eligible session.

### Task 8. Implement Attendance-Risk Participant Signal

Objective: flag participants with at least 2 absences in the most recent 3 attendance records for an eligible course context.

Eligibility:

- Most recent 3 attendance records for participant/course.
- Count records tied to included, non-cancelled sessions.
- Require 3 records by default.
- Flag when at least 2 of 3 are `absent`.

Task output:

- Type: `attendance_risk_participant`.
- Priority: `high`.
- Related href: course participants or attendance page.
- Evidence: participant + course + three attendance records + sessions.

Verification:

- 2 absences in recent 3 creates task.
- 1 absence does not create task.
- Fewer than 3 records does not create task.
- Cancelled/excluded sessions are ignored.

### Task 9. Compose Summary Counts and Priority Sorting

Objective: aggregate signal counts and sort recommended tasks deterministically.

Priority order:

1. Attendance-risk participants.
2. Pending material reviews.
3. Course completion candidates.
4. New feedback.

Verification:

- Summary counts match tasks.
- Sorting order is deterministic.

### Task 10. Build Admin Copilot Briefing UI Components

Objective: render summary, task list, evidence, next actions, and read-only disclaimer.

Files:

- `src/components/admin-copilot/admin-copilot-briefing.tsx`
- `src/components/admin-copilot/admin-copilot-task-card.tsx`

UI requirements:

- Summary cards.
- Priority task list.
- Evidence section per task.
- Related screen link.
- Empty state.
- Error state.
- Read-only label: `읽기 전용 추천입니다. 처리는 각 관리 화면에서 직접 진행해 주세요.`

Verification:

```bash
npm run typecheck
npm run lint
```

### Task 11. Integrate Into Workspace Home

Objective: show Admin Copilot on the representative operator dashboard home.

File:

- `src/app/workspaces/[workspaceId]/(dashboard)/home/page.tsx`

Behavior:

- Call `getAdminCopilotBriefing` for owner admins.
- Render briefing component on success.
- Do not disrupt existing home behavior for other roles.
- Keep v1 owner-admin only.

Verification:

```bash
npm run typecheck
npm run lint
```

Manual check as owner admin.

### Task 12. Full Verification

Commands:

```bash
npm run lint
npm run typecheck
npm run build
```

Manual scenarios:

1. Owner admin with no tasks sees empty state.
2. Owner admin with each of four signal types sees tasks and counts.
3. Non-owner does not see v1 owner-admin copilot.
4. Related links navigate to expected management screens.
5. No mutation occurs from the copilot UI.

## Risks and Tradeoffs

- Attendance-risk detection may become query-heavy if implemented naively. Keep queries scoped and batch where possible.
- Existing service tests may not have factories for all domain rows. Reuse project patterns before adding custom setup helpers.
- UI placement in `/home` must not clutter the existing dashboard. Prefer compact cards and collapsible evidence.
- LLM phrasing should not be added before deterministic service output is reliable.

## Open Questions for Implementation

- Exact existing href convention for each related management page must be confirmed from current routes.
- Whether to expose a follow-up question input in the first code implementation or leave it as a UI placeholder should be decided after deterministic briefing lands.
- Whether displayed task lists need a cap should be decided based on realistic workspace data size.
