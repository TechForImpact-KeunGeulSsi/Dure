# DURE Human-Approved Ontology Action Implementation Plan

## 1. Goal

Implement the first kinetic ontology vertical slice:

```text
PendingMaterialReview
-> ReviewMaterial action proposal
-> owner_admin human decision
-> permission and current-state revalidation
-> review_status pending -> reviewed
-> durable execution audit
-> PendingMaterialReview signal resolution
```

This slice proves that DURE can connect ontology, agent-style recommendation, and accountable human operation without giving an LLM direct database mutation authority.

## 2. Current Baseline

The repository already provides the semantic and deterministic half of this flow:

- Supabase is the operational source of truth.
- `src/services/admin-copilot.ts` loads owner-scoped operational data.
- `src/services/admin-copilot-logic.ts` emits deterministic `pending_material_review` tasks with material and course evidence.
- `src/services/materials.ts` exposes `updateMaterialReviewStatus` and enforces current membership and material scope.
- `src/lib/validators/material.ts` restricts review state to `pending | reviewed`.
- The database resets review state to `pending` when review-relevant material data changes.
- `activity_logs` provides a recent-activity feed, but it is fire-and-forget and is not a durable action decision ledger.

The current Admin Copilot is read-only. No proposal persistence, human decision lifecycle, stale-state protection, idempotent execution, or durable before/after audit exists yet.

## 3. Fixed Product Decisions

### 3.1 Source of truth

- Existing typed Supabase tables remain authoritative.
- Do not migrate operational objects into generic node/edge or entity-attribute-value tables.
- Do not add Neo4j, RDF, embeddings, or a vector database for this slice.

### 3.2 Material state

`Material.review_status` remains binary:

```text
pending | reviewed
```

Meaning:

- `pending`: operational approval has not been completed for the current content, file, and visibility scope.
- `reviewed`: an authorized operator checked the current material and considers it usable for the course.

Proposal rejection leaves the material `pending`. Do not add `rejected`, `changes_requested`, `reviewing`, or workflow-history values to `material_review_status`.

### 3.3 Human authority

- Every `ReviewMaterial` execution requires explicit human approval.
- The first slice is available only to active `owner_admin` members because Admin Copilot v1 is owner-only.
- Existing group-admin manual review capability remains unchanged outside the Copilot flow.
- Future delegation is action-specific and policy-specific. There is no agent-wide execution permission.

### 3.4 Agent boundary

- The existing deterministic Admin Copilot task is the recommendation source.
- No AI provider is required for this slice.
- An LLM, if added later, may phrase or explain permission-filtered proposal data only.
- An LLM cannot create arbitrary SQL, call an admin client, approve its own proposal, or execute a mutation directly.

## 4. Domain Contract

### 4.1 Ontology function

```text
Function: DetectPendingMaterialReview
Target: Material

true when:
- upload_status = uploaded
- review_status = pending
- material belongs to the current workspace
- current actor can access the Admin Copilot briefing
```

The existing `pending_material_review` task remains the read-side representation of this function result.

### 4.2 Action type

```text
ActionType: ReviewMaterial
Version: 1
Target: Material
Approval mode: always_required
Transition: pending -> reviewed
```

Required proposal inputs:

- workspace id;
- material id;
- material `updated_at` observed at proposal time;
- action type and version;
- deterministic source fingerprint;
- evidence snapshot from the Admin Copilot task;
- proposed target state `reviewed`.

### 4.3 Preconditions at execution time

- Current user is authenticated.
- Current user has an active membership in the workspace.
- Current member role is `owner_admin`.
- Proposal belongs to the workspace.
- Proposal is still `pending`.
- Target type and action type match `Material` and `ReviewMaterial`.
- Material still belongs to the workspace.
- Material still has `upload_status = uploaded`.
- Material still has `review_status = pending`.
- Material `updated_at` still matches the proposal target version.
- No successful execution already exists for the proposal or idempotency key.

The proposal evidence is explanatory data, not authorization. Permission and object state are always reloaded before mutation.

## 5. Persistence Design

Add one migration for a generic but bounded ontology action ledger. Keep the schema small enough for the first action while preserving a reusable proposal/execution boundary.

### 5.1 `ontology_action_proposals`

Required columns:

```text
id uuid primary key
workspace_id uuid not null
source_signal_type text not null
source_fingerprint text not null
action_type text not null
action_version integer not null
target_type text not null
target_id uuid not null
target_version timestamptz not null
parameters jsonb not null
evidence jsonb not null
status ontology_action_proposal_status not null
proposed_by_kind text not null
decided_by_member_id uuid null
decided_at timestamptz null
decision_note text null
created_at timestamptz not null
updated_at timestamptz not null
```

Initial constrained values:

```text
source_signal_type = pending_material_review
action_type = review_material
target_type = material
proposed_by_kind = deterministic_rule
status = pending | approved | rejected | expired
```

Constraints and indexes:

- Composite workspace foreign keys where available.
- `action_version > 0`.
- Unique `source_fingerprint` within a workspace.
- Partial uniqueness preventing more than one `pending` proposal for the same action, target, and target version.
- Decision fields required for `approved` and `rejected` where applicable.
- RLS enabled.
- Owner-only read access for the first slice.
- Writes occur through permission-checked server services and transactional database functions, not the browser client.

The source fingerprint should be deterministic from:

```text
workspace id + action type + target id + target updated_at + action version
```

A rejected proposal is not recreated for the same unchanged material version. A material change produces a new target version and therefore may produce a new proposal.

### 5.2 `ontology_action_executions`

Required columns:

```text
id uuid primary key
workspace_id uuid not null
proposal_id uuid not null
actor_member_id uuid not null
idempotency_key text not null
status ontology_action_execution_status not null
before_state jsonb not null
after_state jsonb null
error_code text null
error_message text null
executed_at timestamptz not null
```

Initial statuses:

```text
succeeded | failed
```

Constraints and indexes:

- Foreign key to `ontology_action_proposals`.
- Unique successful execution per proposal.
- Unique idempotency key within a workspace.
- Failure fields required only for failed execution.
- RLS enabled with owner-only read access for the first slice.

Do not use `activity_logs` as this ledger. A successful ontology action may additionally emit a normal recent-activity event after the durable execution is recorded.

## 6. Transaction and Concurrency Boundary

Approval, stale-state validation, material mutation, proposal decision, and execution audit must behave as one business transaction.

Use a narrowly scoped PostgreSQL RPC for the atomic section, called only from a server service after authentication and membership validation. The RPC must:

1. Lock the proposal row.
2. Reject non-pending or replayed proposals.
3. Lock and reload the material row.
4. Compare workspace, upload state, review state, and target version.
5. Mark a stale proposal `expired` without changing the material.
6. On valid approval, record the human decision.
7. Change only the target material to `reviewed`.
8. Insert one durable successful execution with before/after state.
9. Return a structured result.

The RPC is a transaction mechanism, not an Agent tool. The public application entry point remains the permission-checked service action.

Rejection uses a separate narrow operation that conditionally changes a `pending` proposal to `rejected` and records the deciding member and optional note without mutating the material.

## 7. Planned Service Contracts

Recommended file:

```text
src/services/ontology-actions.ts
```

Planned public contracts:

```ts
type EnsureReviewMaterialProposalInput = {
  workspaceId: string;
  materialId: string;
  targetUpdatedAt: string;
};

type DecideReviewMaterialProposalInput = {
  workspaceId: string;
  proposalId: string;
  decision: "approve" | "reject";
  note?: string | null;
};

ensureReviewMaterialProposal(
  input: EnsureReviewMaterialProposalInput,
): Promise<ApiResult<ReviewMaterialProposal>>;

decideReviewMaterialProposal(
  input: DecideReviewMaterialProposalInput,
): Promise<ApiResult<ReviewMaterialDecisionResult>>;
```

Behavior:

- Both actions require an authenticated active `owner_admin`.
- `ensureReviewMaterialProposal` reloads the material and regenerates the deterministic signal evidence; it does not trust a client-provided evidence payload.
- Repeated ensure calls for the same fingerprint return the existing proposal.
- Approval calls the transactional execution RPC.
- Rejection records only the proposal decision.
- A stale proposal returns `CONFLICT` with safe metadata for UI refresh.
- A replayed successful proposal returns the existing result or a stable conflict; it never mutates twice.

Add dedicated Zod schemas under `src/lib/validators/` for proposal creation and decision inputs. Do not reuse a client-provided role, member id, evidence object, target type, or action type.

## 8. Admin Copilot Integration

Extend the current `pending_material_review` task without changing the other three task types.

Recommended read model addition:

```ts
type AdminCopilotTaskAction = {
  actionType: "review_material";
  approvalMode: "always_required";
  targetId: string;
  targetUpdatedAt: string;
  proposalId?: string;
  proposalStatus?: "pending" | "approved" | "rejected" | "expired";
};
```

The service must include `materials.updated_at` in the task action context. It may batch-load matching proposals for current task fingerprints. Do not create or mutate proposals during ordinary briefing reads.

Proposal persistence begins only when the owner opens the approval flow or explicitly requests the proposed action. This preserves the existing query/action boundary and prevents dashboard reads from generating writes.

## 9. Human Approval UI

Keep the current visual language and add the smallest approval surface to the pending-material task.

Required flow:

1. Owner opens a pending-material task.
2. UI shows the material, related course, upload/review state, visibility scope, and evidence reason.
3. UI provides the existing authorized download path so the owner can inspect the actual file.
4. Owner selects `확인됨으로 변경` or `제안 거절`.
5. Approval copy states that the owner considers the current material usable for the course.
6. Rejection accepts an optional note and explains that the material remains `pending`.
7. After a decision, the UI refreshes the briefing.
8. Successful approval removes the resolved pending-material task.
9. Stale conflict asks the owner to refresh and review the current version.

Do not add a general chat interface, arbitrary action parameter editor, bulk approval, or automatic approval control in this slice.

## 10. Implementation Tasks

### Task 1. Add migration and generated types

- Add proposal and execution status enums.
- Add the two ledger tables, constraints, indexes, triggers, and RLS.
- Add narrow transactional RPCs for approval execution and rejection.
- Regenerate or update Supabase TypeScript types using the repository's existing convention.

Verification:

- Local Supabase reset succeeds.
- Owner can read own workspace ledger rows.
- Non-owner and cross-workspace reads are denied.
- Constraints reject unsupported action/target combinations and invalid decision fields.

### Task 2. Add pure action contract helpers

- Define `ReviewMaterial` action constants and version.
- Build deterministic source fingerprints.
- Build proposal evidence from the existing task/material projection.
- Validate transition and stale-state inputs without database access where practical.

Verification:

- Same object version produces the same fingerprint.
- Changed `updated_at` produces a new fingerprint.
- Unsupported state combinations do not produce an executable proposal.

### Task 3. Add proposal service

- Implement `ensureReviewMaterialProposal`.
- Reuse owner membership checks.
- Reload current material and course evidence server-side.
- Return an existing proposal for the same fingerprint.

Verification:

- Owner can create one pending proposal.
- Duplicate ensure is idempotent.
- Reviewed, failed-upload, missing, or cross-workspace material is rejected.
- Group admin and instructor are rejected in the Copilot action path.

### Task 4. Add human decision and execution service

- Implement approval and rejection.
- Call the transactional RPC for the atomic mutation path.
- Map stale and replay outcomes to stable `ApiResult` errors or results.
- Revalidate paths after a successful decision.

Verification:

- Approval changes only `pending -> reviewed`.
- Rejection leaves the material pending.
- Modified material expires the old proposal.
- Concurrent or repeated approval cannot execute twice.
- Before/after state and deciding member are durable.

### Task 5. Extend Admin Copilot task context

- Include material target version and bounded action metadata.
- Batch-load matching proposals without introducing per-task queries.
- Preserve deterministic sorting and the other task categories.

Verification:

- Existing Admin Copilot tests continue to pass.
- Pending-material tasks expose only the `review_material` action.
- Other task types remain read-only.

### Task 6. Add approval UI

- Add an owner-only action affordance to pending-material tasks.
- Show evidence and file inspection path before approval.
- Add approve, reject, loading, stale, replay, failure, and success states.
- Refresh the briefing after a decision.

Verification:

- No mutation occurs by opening the dialog.
- Explicit approval is required.
- Rejection visibly keeps the task unresolved.
- Successful approval removes the task after refresh.

### Task 7. Add end-to-end local verification

Extend the developer QA fixture with one deterministic material-review proposal scenario.

Verify:

1. Pending uploaded material appears in Admin Copilot.
2. Opening the action flow persists at most one proposal for that version.
3. Rejection records the decision and preserves `pending`.
4. Material change invalidates the old proposal.
5. Fresh proposal approval records one execution and changes the material to `reviewed`.
6. Repeating approval does not create a second execution.
7. The pending-material signal disappears.
8. Group admin and instructor cannot use the Copilot approval action.
9. Existing manual group-admin review behavior still works outside the Copilot path.

## 11. Verification Commands

Run the focused tests first, then the repository gates:

```bash
npm run test:admin-copilot
npm run test:developer-qa
npm run typecheck
npm run lint
npm run build
```

Also run a local Supabase reset and the developer QA verifier because migration, RLS, RPC, and transactional behavior cannot be proven by pure TypeScript tests alone.

## 12. Acceptance Criteria

The vertical slice is complete only when:

- An owner sees a deterministic pending-material recommendation with evidence.
- No proposal is persisted during an ordinary briefing read.
- The owner can inspect the current material before deciding.
- Approval and rejection are explicit human decisions.
- Approval revalidates membership, workspace, upload state, review state, and target version.
- Successful approval produces exactly one material transition and one durable successful execution.
- Rejection produces no material transition.
- Stale and replayed proposals cannot mutate data.
- Decision and execution history can be reconstructed without relying on `activity_logs`.
- Successful execution removes the corresponding signal after recomputation.
- Existing material status enums and non-Copilot material workflows remain unchanged.
- Focused tests, local database verification, typecheck, lint, and production build pass.

## 13. Non-Goals

- No LLM provider integration.
- No natural-language follow-up questions.
- No automatic approval or delegated execution.
- No bulk approval.
- No action types for attendance, feedback, course completion, or settlement.
- No new material review states.
- No graph database or RDF runtime.
- No replacement of existing service-layer permission checks or Supabase RLS.

## 14. Later Delegation Gate

Do not implement this gate in the first slice. Preserve the contract so a future action type can move from `always_required` to policy-based execution only when all of the following are demonstrated:

- deterministic preconditions;
- bounded blast radius;
- reversibility or safe compensation;
- stable human approval and override evidence;
- stale-state and replay protection;
- complete durable audit;
- explicit owner-controlled policy activation.

`ReviewMaterial` may remain human-approved indefinitely because it represents a semantic judgment about content suitability. DURE should delegate only actions whose operational evidence supports delegation, not actions selected merely because an Agent expresses high confidence.
