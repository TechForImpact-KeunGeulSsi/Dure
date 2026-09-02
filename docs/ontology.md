# DURE Operational Ontology

## Purpose

This document defines the lightweight ontology used by DURE Admin Copilot v1. It is not a full RDF/OWL ontology and it is not a second source of truth. It is a semantic contract that explains how DURE's relational data should be interpreted as operational entities, relationships, evidence, signals, and manual action recommendations.

Supabase remains the source of truth. Service-layer permission checks remain mandatory.

The canonical source-column mapping, bidirectional cardinality, relationship exceptions, role scope, and recommendation provenance are defined in [`ontology-contract.md`](./ontology-contract.md). New task implementations must reuse that contract instead of redefining joins locally.

## Design Principles

- Model operational meaning, not just table names.
- Keep v1 simple enough to implement over Supabase and existing services.
- Never expose unauthorized data to an LLM.
- Treat the graph as a permission-scoped read model derived from relational data.
- Keep administrative signals deterministic and testable.
- Separate read-only briefing signals from mutations. The `ReviewMaterial` action is the first exception and always requires an explicit human decision.
- Keep domain object states minimal. Proposal, decision, and execution lifecycle states belong to their own records rather than expanding a domain object's enum.
- Introduce execution authority per action type and policy, never as a blanket permission granted to an agent.

## Operational Layer Boundary

DURE's existing relational tables remain the authoritative operational state. The ontology adds two contracts over those tables:

- Semantic elements: object types, properties, links, derived properties, and permission-scoped projections.
- Kinetic elements: functions, action types, preconditions, human decisions, execution policies, and audit records.

The ontology does not replace typed tables with generic node/edge or entity-attribute-value storage. A graph database, RDF export, or cached graph projection may be introduced later as a read model, but none becomes a second write authority.

The intended control loop is:

```text
observe object state
-> run deterministic ontology function
-> produce evidence-backed action proposal
-> obtain required human decision
-> revalidate permission and current state
-> execute through the existing service layer
-> record decision and execution
-> recompute the signal
```

## Entity Types

### Workspace

Source table: `workspaces`

Meaning: Top-level tenant and operating space.

Primary relationships:

- `HAS_GROUP` -> `Group`
- `HAS_MEMBER` -> `WorkspaceMember`
- `HAS_COURSE` -> `Course`
- `HAS_PARTICIPANT` -> `Participant`

### WorkspaceMember

Source table: `workspace_members`

Meaning: Authenticated user membership in a workspace. Roles include `owner_admin`, `group_admin`, and `instructor`.

Primary relationships:

- `MEMBER_OF` -> `Workspace`
- `HAS_GROUP_SCOPE` -> `Group` through `workspace_member_groups`
- `TEACHES` -> `Course` when assigned as instructor

### Group

Source table: `groups`

Meaning: Operational unit and permission scope.

Primary relationships:

- `BELONGS_TO_WORKSPACE` -> `Workspace`
- `HAS_PARTICIPANT` -> `Participant` through `participant_groups`
- `HAS_COURSE` -> `Course` through `course_groups`
- `ACCESSIBLE_BY` -> `WorkspaceMember` through `workspace_member_groups`

### Participant

Source table: `participants`

Meaning: Non-login operational subject that attends courses.

Primary relationships:

- `BELONGS_TO_WORKSPACE` -> `Workspace`
- `BELONGS_TO_GROUP` -> `Group` through `participant_groups`
- `ATTENDS_COURSE` -> `Course` through current group-derived course participation and exclusions
- `HAS_ATTENDANCE_RECORD` -> `AttendanceRecord`

Important note:

Participants are not authenticated users and must not be treated as API actors.

### Course

Source table: `courses`

Meaning: Educational course/class with status, instructor assignment, groups, sessions, participants, materials, and feedback.

Primary relationships:

- `BELONGS_TO_WORKSPACE` -> `Workspace`
- `BELONGS_TO_GROUP` -> `Group` through `course_groups`
- `TAUGHT_BY` -> `WorkspaceMember`
- `HAS_SESSION` -> `CourseSession`
- `HAS_MATERIAL` -> `Material`
- `HAS_FEEDBACK` -> `CourseFeedback`
- `HAS_PARTICIPANT` -> `Participant` through group-derived participation and exclusions

### CourseSession

Source table: `course_sessions`

Meaning: Dated occurrence of a course.

Primary relationships:

- `SESSION_OF` -> `Course`
- `HAS_ATTENDANCE_RECORD` -> `AttendanceRecord`
- `HAS_CLASS_MEMO` -> `ClassMemo`

Relevant status fields:

- `visibility_status`
- `rollup_status`
- `progress_status`

### Material

Source table: `materials`

Meaning: Course material metadata and storage reference.

Primary relationships:

- `MATERIAL_OF` -> `Course`
- `UPLOADED_BY` -> `WorkspaceMember`

Relevant status fields:

- `upload_status`
- `review_status`
- `visibility_scope`

### AttendanceRecord

Source table: `attendance_records`

Meaning: Participant attendance status and note for a course session.

Primary relationships:

- `RECORD_OF_SESSION` -> `CourseSession`
- `RECORD_OF_PARTICIPANT` -> `Participant`
- `UPDATED_BY` -> `WorkspaceMember`

Relevant status values:

- `present`
- `partial`
- `absent`

### ClassMemo

Source table: `class_memos`

Meaning: Instructor or operator memo about a course session.

Primary relationships:

- `MEMO_OF_SESSION` -> `CourseSession`
- `WRITTEN_BY` -> `WorkspaceMember`

### CourseFeedback

Source table: `course_feedbacks`

Meaning: Public course feedback submitted for operator review.

Primary relationships:

- `FEEDBACK_FOR` -> `Course`
- `BELONGS_TO_WORKSPACE` -> `Workspace`

Relevant status values:

- `new`
- `reviewed`

### ActivityLog

Source table: `activity_logs`

Meaning: Recent activity event for operator awareness.

Primary relationships:

- `EVENT_IN_WORKSPACE` -> `Workspace`
- Optional relation to target domain entity through metadata.

## Relationship Vocabulary

| Relationship | From | To | Meaning |
| --- | --- | --- | --- |
| `HAS_GROUP` | Workspace | Group | Workspace contains group |
| `HAS_MEMBER` | Workspace | WorkspaceMember | Workspace contains member |
| `HAS_COURSE` | Workspace | Course | Workspace contains course |
| `HAS_PARTICIPANT` | Workspace / Group / Course | Participant | Operational participant scope |
| `BELONGS_TO_WORKSPACE` | Domain entity | Workspace | Tenant boundary |
| `BELONGS_TO_GROUP` | Participant / Course | Group | Group membership or course group scope |
| `HAS_GROUP_SCOPE` | WorkspaceMember | Group | Group-admin accessible group |
| `TAUGHT_BY` | Course | WorkspaceMember | Assigned instructor |
| `HAS_SESSION` | Course | CourseSession | Course occurrence |
| `HAS_MATERIAL` | Course | Material | Course material |
| `HAS_FEEDBACK` | Course | CourseFeedback | Public feedback |
| `HAS_ATTENDANCE_RECORD` | CourseSession / Participant | AttendanceRecord | Attendance evidence |
| `HAS_CLASS_MEMO` | CourseSession | ClassMemo | Session memo |
| `ACCESSIBLE_BY` | Group / Course | WorkspaceMember | Permission-derived access |

## Permission Ontology

### Owner Admin

Role: `owner_admin`

Semantic access:

- Can inspect all workspace operational data.
- Can manage workspace members, groups, courses, participants, materials, settlements, and feedback according to service actions.
- Admin Copilot v1 is restricted to this role.

### Group Admin

Role: `group_admin`

Semantic access:

- Can inspect and manage only assigned group scope.
- Not included in Admin Copilot v1.
- Future group-admin copilot must build a group-scoped graph before retrieval.

### Instructor

Role: `instructor`

Semantic access:

- Can inspect and operate directly assigned courses.
- Cannot inspect general schedule.
- Not included in Admin Copilot v1.

### Participant

Participants are data subjects, not system actors.

## Administrative Signals for Admin Copilot v1

### PendingMaterialReview

Target entity: `Material`

Condition:

- Material upload status is `uploaded`.
- Material review status is `pending`.

Evidence nodes:

- `Material`
- Related `Course`
- Optional uploader `WorkspaceMember`

Recommended manual action:

- Open the course materials page and review the material.

#### Material review state semantics

`Material.review_status` intentionally remains binary:

- `pending`: an authorized operator has not completed operational approval for the current material content, file, and visibility scope.
- `reviewed`: an authorized operator has checked the material content and visibility scope and considers the current version usable for the course.

The current database trigger resets the state to `pending` when review-relevant material data changes. Proposal rejection does not add a `rejected` or `changes_requested` material state. The material remains `pending`, while the human decision is recorded on the action proposal.

The three independent material state dimensions must not be conflated:

- Upload lifecycle: `uploading | uploaded | failed`.
- Review state: `pending | reviewed`.
- Visibility scope: `public | admin_only`.

### AttendanceRiskParticipant

Target entity: `Participant`

Condition:

- For a participant in a course, the most recent 3 attendance records across eligible included course sessions contain at least 2 `absent` statuses.

Eligible session default:

- Session rollup status is `included`.
- Cancelled sessions are excluded from normal risk evidence.

Evidence nodes:

- `Participant`
- Related `Course`
- Recent 3 `AttendanceRecord` nodes
- Their `CourseSession` nodes

Recommended manual action:

- Open the course participant/attendance context and follow up manually with the relevant instructor or participant management flow.

### NewCourseFeedback

Target entity: `CourseFeedback`

Condition:

- Feedback status is `new`.

Evidence nodes:

- `CourseFeedback`
- Related `Course`

Recommended manual action:

- Open the feedback page and review the submitted feedback.

### CourseCompletionCandidate

Target entity: `Course`

Condition:

- Course status is `in_progress`.
- The final eligible course session has already ended.

Eligible final session:

- `rollup_status = 'included'`
- `visibility_status = 'visible'`
- `progress_status = 'scheduled'`

Evidence nodes:

- `Course`
- Final eligible `CourseSession`

Recommended manual action:

- Open the course management screen and decide whether to mark the course as completed.

## Graph-Shaped Context Contract

`GraphContext` is a future permission-scoped LLM context contract, not a currently implemented runtime output. The current runtime output is `AdminCopilotTask` with `AdminCopilotEvidence`. A future LLM integration should avoid passing raw rows directly and may shape the already permission-filtered service projection as graph context.

Recommended structure:

```ts
type GraphContext = {
  focus: GraphNode;
  nodes: GraphNode[];
  edges: GraphEdge[];
  signals: AdministrativeSignal[];
  evidence: EvidenceItem[];
};

type GraphNode = {
  id: string;
  type:
    | 'workspace'
    | 'workspace_member'
    | 'group'
    | 'participant'
    | 'course'
    | 'course_session'
    | 'material'
    | 'attendance_record'
    | 'class_memo'
    | 'course_feedback'
    | 'activity_log';
  label: string;
  href?: string;
  metadata?: Record<string, unknown>;
};

type GraphEdge = {
  sourceId: string;
  targetId: string;
  type: string;
};

type AdministrativeSignal = {
  type:
    | 'PendingMaterialReview'
    | 'AttendanceRiskParticipant'
    | 'NewCourseFeedback'
    | 'CourseCompletionCandidate';
  targetNodeId: string;
  severity: 'high' | 'medium' | 'low';
  reason: string;
  evidenceNodeIds: string[];
  recommendedManualAction: string;
};

type EvidenceItem = {
  nodeId: string;
  reason: string;
  observedValue?: unknown;
};
```

## v1 Scope Boundary

Included:

- Owner-admin operational briefing.
- Pending material review detection.
- Attendance-risk participant detection.
- New feedback detection.
- Course completion candidate detection.
- Current `AdminCopilotTask` / `AdminCopilotEvidence` projection derived from relational data.
- Human-approved `ReviewMaterial` proposal, decision, and execution audit for pending materials.
- Current material-version fingerprinting, stale-state protection, and idempotent execution.

Excluded:

- Settlement request detection.
- Group-admin scoped graph.
- Instructor scoped graph.
- LLM-generated SQL.
- Autonomous actions, automatic approval, and agent-directed execution.
- Separate graph database.
- Embedding-based retrieval.
- Runtime `GraphContext` output.

## Future Ontology Extensions

Possible future signal types:

- `SettlementDelay`
- `ClassMemoMissing`
- `RepeatedPartialAttendance`
- `InactiveGroupWithActiveCourse`
- `MaterialUploadFailed`
- `InviteStale`
- `FeedbackCluster`

Possible future graph infrastructure:

- Cached graph projection table.
- Neo4j export.
- RDF/OWL vocabulary.
- Embedding index for documents and class memo text.
- Recommendation audit trail.

## Implemented Vertical Slice: Human-Approved ReviewMaterial

This section defines the first implemented kinetic ontology slice. The ordinary Admin Copilot briefing remains read-only, while `ReviewMaterial` can mutate a material only through the bounded proposal, human decision, revalidation, and execution path described below.

### Action type

```text
ActionType: ReviewMaterial
Target: Material
Transition: review_status pending -> reviewed
Initial approval mode: always_required
Initial actor scope: active owner_admin
```

The `ontology-actions.ts` service and narrow service-role RPCs are the mutation boundary. They orchestrate proposal, decision, stale-state protection, execution, and audit; they must not introduce a direct LLM-to-database mutation path.

### Preconditions

- The actor has an active membership in the target workspace.
- The actor is `owner_admin` for the initial Admin Copilot slice.
- The material belongs to the target workspace.
- `upload_status = 'uploaded'`.
- `review_status = 'pending'`.
- The proposal still refers to the current material version.

Permission and preconditions are recalculated when the human approves. Evidence captured when the proposal was created is not sufficient authorization for execution.

### Human decision

- `approved`: attempt the state transition after revalidation.
- `rejected`: keep the material `pending` and record the decision reason.

Human approval is mandatory for every execution in the first slice. A future delegation policy may promote an individual low-risk, reversible action type to conditional automatic execution only after measured operational evidence. Agent-wide execution authority is not allowed.

### Proposal and execution lifecycle

Domain state, proposal state, and execution state remain separate:

```text
Material.review_status: pending | reviewed
ActionProposal.status: pending | approved | rejected | expired
ActionExecution.status: succeeded | failed
```

A proposal must carry a deterministic source fingerprint based on the action type, target object, and target version. Replaying the same approved proposal must not execute the mutation twice. If the material changes after proposal creation, approval returns a conflict and the stale proposal becomes non-executable.

### Required audit evidence

- Workspace, target type, and target id.
- Action type and action contract version.
- Signal reason and evidence snapshot.
- Material version or `updated_at` observed at proposal time.
- Human decision, member id, timestamp, and optional note.
- State immediately before execution.
- State after execution, or a structured failure.
- Idempotency key and execution timestamp.

`activity_logs` remains the recent-activity feed. It is fire-and-forget and does not replace the durable proposal and execution audit records.

### Acceptance criteria

- No material mutation occurs without an explicit human approval.
- Approval rechecks owner membership, workspace ownership of the target, upload state, review state, and target version.
- A stale or replayed proposal cannot produce a second mutation.
- Rejection leaves `Material.review_status = 'pending'`.
- Successful execution changes only the intended material to `reviewed`.
- The proposal, human decision, execution result, and before/after state can be reconstructed.
- The corresponding `PendingMaterialReview` signal disappears after successful execution and briefing recomputation.
- Existing manual material management and group-admin permissions remain unchanged outside this owner-admin Admin Copilot slice.
