# DURE Operational Ontology

## Purpose

This document defines the lightweight ontology used by DURE Admin Copilot v1. It is not a full RDF/OWL ontology and it is not a second source of truth. It is a semantic contract that explains how DURE's relational data should be interpreted as operational entities, relationships, evidence, signals, and manual action recommendations.

Supabase remains the source of truth. Service-layer permission checks remain mandatory.

## Design Principles

- Model operational meaning, not just table names.
- Keep v1 simple enough to implement over Supabase and existing services.
- Never expose unauthorized data to an LLM.
- Treat the graph as a permission-scoped read model derived from relational data.
- Keep administrative signals deterministic and testable.
- Separate recommendations from mutations. v1 is read-only.

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

Admin Copilot services should avoid passing raw rows directly to an LLM. Instead, service output should be shaped as graph context.

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
- Graph-shaped context derived from relational data.

Excluded:

- Settlement request detection.
- Group-admin scoped graph.
- Instructor scoped graph.
- LLM-generated SQL.
- Mutations and autonomous actions.
- Separate graph database.
- Embedding-based retrieval.

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
