# DURE Operational Ontology Contract

이 문서는 Operational Ontology v1의 공통 구현 계약이다. 새 Admin Copilot task는 이 문서에서 객체, 링크, 상태 필터, 역할 범위, 원본 데이터 경로를 선택해 재사용한다. Supabase가 쓰기 source of truth이며, 이 계약은 관계형 데이터를 해석하는 permission-scoped read model이다.

DB row 전체는 외부 출력 계약이 아니다. 아래 source mapping은 서버가 의미를 해석하기 위한 내부 경로이고, 사용자나 모델에 전달하는 값은 service에서 권한을 확인한 projection으로 다시 제한한다. `AdminCopilotEvidence`는 추천 근거이지 권한 증명이나 mutation 권한이 아니다.

## 1. 객체 계약

| 객체 | 의미 | Identity | Tenant key | 원본 table | 상태 축 | Canonical service owner |
| --- | --- | --- | --- | --- | --- | --- |
| `Workspace` | 최상위 운영 공간 | `workspaces.id` | `workspaces.id` | `workspaces` | 별도 상태 없음 | `src/services/workspaces.ts` |
| `WorkspaceMember` | 인증 사용자와 워크스페이스 역할의 연결 | `workspace_members.id` | `workspace_members.workspace_id` | `workspace_members` | `status`, `role` | `src/services/access.ts`, `src/services/workspace-members.ts`, `src/services/invites.ts` |
| `Group` | 운영 단위이자 group-admin 권한 범위 | `groups.id` | `groups.workspace_id` | `groups` | `status`, `deleted_at` | `src/services/groups.ts` |
| `Participant` | 로그인하지 않는 수업 참여 대상 데이터 | `participants.id` | `participants.workspace_id` | `participants` | `status`, `deleted_at` | `src/services/participants.ts` |
| `Course` | 기간, 담당 강사, 그룹, 회차를 가진 교육 과정 | `courses.id` | `courses.workspace_id` | `courses` | `status`, `public_visibility` | `src/services/courses.ts`, `src/services/access.ts` |
| `CourseSession` | 특정 일시의 수업 회차 | `course_sessions.id` | `course_sessions.workspace_id` | `course_sessions` | `visibility_status`, `rollup_status`, `progress_status` | `src/services/course-sessions.ts`, `src/services/attendance.ts` |
| `Material` | 수업 자료 메타데이터와 Storage 참조 | `materials.id` | `materials.workspace_id` | `materials` | `upload_status`, `review_status`, `visibility_scope` | `src/services/materials.ts` |
| `AttendanceRecord` | 회차별 참여자 출석과 특이사항 | `attendance_records.id`; `(session_id, participant_id)` unique | `attendance_records.workspace_id` | `attendance_records` | `status` | `src/services/attendance.ts` |
| `ClassMemo` | 회차별 수업 진행 메모 | `class_memos.id`; `session_id` unique | `class_memos.workspace_id` | `class_memos` | 별도 상태 없음 | `src/services/class-memos.ts`, `src/services/attendance.ts` |
| `CourseFeedback` | 공개 화면에서 제출되어 운영자가 검토하는 의견 | `course_feedbacks.id` | `course_feedbacks.workspace_id` | `course_feedbacks` | `status`, `category` | `src/services/course-feedbacks.ts` |
| `ActivityLog` | 권한 필터된 최근 활동 event | `activity_logs.id` | `activity_logs.workspace_id` | `activity_logs` | 자유 형식 `event_type` | `src/services/activity.ts` |

`course_groups`, `participant_groups`, `workspace_member_groups`, `course_participants`, `course_participant_groups`는 v1 객체가 아니라 링크를 실현하는 junction/source table이다. `course_participants`는 수업 참여의 유일한 source가 아니며 명시 제외와 participant FK 보호를 담당한다. `course_participant_groups.group_name_snapshot`은 과거 배정 그룹 표시를 보존하는 legacy snapshot이다.

## 2. 속성·상태와 source table·column 매핑

| 객체 | Semantic property | Source `table.column` | 타입 / nullable | 해석 규칙 |
| --- | --- | --- | --- | --- |
| `Workspace` | name | `workspaces.name` | text / not null | 워크스페이스 표시명 |
| `Workspace` | timezone | `workspaces.timezone` | text / not null | 날짜 기반 추천 계산의 IANA timezone |
| `WorkspaceMember` | authenticated user | `workspace_members.user_id` | uuid / nullable | `auth.users.id`; 초대/removed lifecycle에서 null 가능 |
| `WorkspaceMember` | display identity | `workspace_members.email`, `workspace_members.display_name` | citext / not null, text / nullable | 운영자 표시 정보 |
| `WorkspaceMember` | role | `workspace_members.role` | enum / not null | `owner_admin | group_admin | instructor` |
| `WorkspaceMember` | membership status | `workspace_members.status` | enum / not null | `active | invited | disabled | removed`; actor 판정은 `active`만 허용 |
| `Group` | name / description | `groups.name`, `groups.description` | text / not null, text / nullable | 운영 단위 표시 정보 |
| `Group` | lifecycle | `groups.status`, `groups.deleted_at` | enum / not null, timestamptz / nullable | `active | inactive`; `deleted_at`이 있으면 파생 참여 경로에서 제외 |
| `Participant` | name / memo | `participants.name`, `participants.memo` | text / not null, text / nullable | 운영 대상 정보; 인증 identity가 아님 |
| `Participant` | lifecycle | `participants.status`, `participants.deleted_at` | enum / not null, timestamptz / nullable | `active | inactive | deleted`; `deleted` 또는 `deleted_at`이면 수업 참여 projection에서 제외 |
| `Course` | name | `courses.name` | text / not null | 수업 표시명 |
| `Course` | lifecycle | `courses.status` | enum / not null | `planned | in_progress | completed` |
| `Course` | date range | `courses.starts_on`, `courses.ends_on` | date / nullable | 운영상 수업 기간; 완료 추천의 최종 회차 계산을 대신하지 않음 |
| `Course` | instructor | `courses.instructor_member_id` | uuid / nullable | `workspace_members.id`; 강사 미배정 가능 |
| `Course` | public visibility | `courses.public_visibility` | enum / not null | `public | hidden` |
| `CourseSession` | order / time | `course_sessions.session_no`, `course_sessions.date`, `course_sessions.starts_at`, `course_sessions.ends_at` | integer/date/time / not null | 수업 내 회차 번호와 로컬 일시 |
| `CourseSession` | type | `course_sessions.type` | enum / not null | `regular | makeup | special | practice` |
| `CourseSession` | visibility | `course_sessions.visibility_status` | enum / not null | `visible | hidden`; 캘린더/완료 추천 노출 축 |
| `CourseSession` | rollup | `course_sessions.rollup_status` | enum / not null | `included | excluded`; 출석 집계 포함 축 |
| `CourseSession` | progress | `course_sessions.progress_status` | enum / not null | `scheduled | cancelled`; 취소 회차는 정상 추천 근거에서 제외 |
| `Material` | title / description | `materials.title`, `materials.description` | text / not null, text / nullable | 자료 표시 정보 |
| `Material` | file reference | `materials.storage_path`, `materials.original_filename`, `materials.mime_type`, `materials.size_bytes` | nullable | Storage object 참조와 파일 메타데이터 |
| `Material` | uploader | `materials.uploaded_by` | uuid / nullable | `workspace_members.id`; 멤버 삭제 시 null 가능 |
| `Material` | upload lifecycle | `materials.upload_status` | enum / not null | `uploading | uploaded | failed` |
| `Material` | review state | `materials.review_status` | enum / not null | `pending | reviewed`; 제안 거절은 새 Material 상태가 아니며 `pending` 유지 |
| `Material` | visibility | `materials.visibility_scope` | enum / not null | 최종 schema는 `public | admin_only` |
| `AttendanceRecord` | attendance state | `attendance_records.status` | enum / not null | `present | partial | absent` |
| `AttendanceRecord` | note / updater | `attendance_records.note`, `attendance_records.updated_by`, `attendance_records.updated_at` | text/uuid nullable, timestamptz not null | 관찰 내용과 마지막 수정 provenance |
| `AttendanceRecord` | participant snapshot | `attendance_records.participant_name_snapshot` | text / not null | 과거 표시용 snapshot; 현재 참여자 identity/join에 사용하지 않음 |
| `ClassMemo` | content / writer | `class_memos.content`, `class_memos.updated_by`, `class_memos.updated_at` | text not null, uuid nullable, timestamptz not null | 회차당 하나의 현재 메모 |
| `CourseFeedback` | content | `course_feedbacks.message`, `course_feedbacks.author_name`, `course_feedbacks.author_phone` | message not null, author fields nullable | 공개 제출 내용; 개인정보는 권한 projection 밖으로 자동 전달하지 않음 |
| `CourseFeedback` | category / review | `course_feedbacks.category`, `course_feedbacks.status` | enum / not null | category `suggestion | praise | other`; status `new | reviewed` |
| `CourseFeedback` | course snapshot | `course_feedbacks.course_name_snapshot` | text / not null | 수업 삭제/표시 fallback이며 canonical join은 `course_id` |
| `ActivityLog` | actor / event | `activity_logs.actor_member_id`, `activity_logs.event_type` | uuid nullable, text not null | actor가 삭제되면 null 가능; event type은 고정 enum이 아님 |
| `ActivityLog` | target | `activity_logs.target_type`, `activity_logs.target_id`, `activity_logs.metadata` | text not null, uuid nullable, jsonb not null | polymorphic optional reference; FK가 아니므로 target 존재/권한을 service가 검증 |

## 3. 링크 계약과 cardinality

Cardinality는 `from 관점`과 `to 관점`을 함께 적는다. `0..*`는 row 부재가 허용됨을, `1..*`는 의미상 하나 이상을 뜻한다.

| Link | From → To | Source / junction | From 관점 | To 관점 | Canonical join path |
| --- | --- | --- | --- | --- | --- |
| `HAS_GROUP` / `BELONGS_TO_WORKSPACE` | `Workspace` → `Group` | `groups.workspace_id` | `0..*` Groups | 정확히 `1` Workspace | `workspaces.id = groups.workspace_id` |
| `HAS_MEMBER` / `MEMBER_OF` | `Workspace` → `WorkspaceMember` | `workspace_members.workspace_id` | DB cardinality `0..*` Members; 제품 불변식은 active owner `1..*` | 정확히 `1` Workspace | `workspaces.id = workspace_members.workspace_id` |
| `HAS_COURSE` / `BELONGS_TO_WORKSPACE` | `Workspace` → `Course` | `courses.workspace_id` | `0..*` Courses | 정확히 `1` Workspace | `workspaces.id = courses.workspace_id` |
| `HAS_PARTICIPANT` / `BELONGS_TO_WORKSPACE` | `Workspace` → `Participant` | `participants.workspace_id` | `0..*` Participants | 정확히 `1` Workspace | `workspaces.id = participants.workspace_id` |
| `HAS_GROUP_SCOPE` / `ACCESSIBLE_BY` | `WorkspaceMember` ↔ `Group` | `workspace_member_groups` | Member당 `0..*` Groups | Group당 `0..*` Members | `workspace_members.id = workspace_member_groups.member_id -> group_id = groups.id`, 같은 `workspace_id` composite FK |
| `HAS_PARTICIPANT` / `BELONGS_TO_GROUP` | `Group` ↔ `Participant` | `participant_groups` | Group당 `0..*` Participants | Participant당 `0..*` Groups | `groups.id = participant_groups.group_id -> participant_id = participants.id`, `status='active'` |
| `HAS_COURSE` / `BELONGS_TO_GROUP` | `Group` ↔ `Course` | `course_groups` | Group당 `0..*` Courses | Course당 `0..*` Groups (제품 흐름은 하나 이상 기대) | `groups.id = course_groups.group_id -> course_id = courses.id` |
| `TAUGHT_BY` / `TEACHES` | `Course` → `WorkspaceMember` | `courses.instructor_member_id` | `0..1` Instructor | Member당 `0..*` Courses | `courses.instructor_member_id = workspace_members.id`; null 허용 |
| `HAS_PARTICIPANT` / `ATTENDS_COURSE` | `Course` ↔ `Participant` | 파생 링크 | Course당 `0..*` Participants | Participant당 `0..*` Courses | `courses -> course_groups -> participant_groups(status='active') -> participants`, 삭제 제외 후 `course_participants.status='excluded'` 제거 |
| `HAS_SESSION` / `SESSION_OF` | `Course` → `CourseSession` | `course_sessions.course_id` | `0..*` Sessions | 정확히 `1` Course | `courses.id = course_sessions.course_id` |
| `HAS_MATERIAL` / `MATERIAL_OF` | `Course` → `Material` | `materials.course_id` | `0..*` Materials | 정확히 `1` Course | `courses.id = materials.course_id` |
| `UPLOADED_BY` | `Material` → `WorkspaceMember` | `materials.uploaded_by` | `0..1` Member | Member당 `0..*` Materials | `materials.uploaded_by = workspace_members.id`; null 허용 |
| `HAS_FEEDBACK` / `FEEDBACK_FOR` | `Course` → `CourseFeedback` | `course_feedbacks.course_id` | `0..*` Feedback | 정확히 `1` Course | `courses.id = course_feedbacks.course_id` |
| `BELONGS_TO_WORKSPACE` | `CourseFeedback` → `Workspace` | `course_feedbacks.workspace_id` | 정확히 `1` Workspace | Workspace당 `0..*` Feedback | `course_feedbacks.workspace_id = workspaces.id` |
| `HAS_ATTENDANCE_RECORD` / `RECORD_OF_SESSION` | `CourseSession` → `AttendanceRecord` | `attendance_records.session_id` | `0..*` Records | 정확히 `1` Session | `course_sessions.id = attendance_records.session_id` |
| `HAS_ATTENDANCE_RECORD` / `RECORD_OF_PARTICIPANT` | `Participant` → `AttendanceRecord` | `attendance_records.participant_id` | `0..*` Records | 정확히 `1` Participant | `participants.id = attendance_records.participant_id` |
| `UPDATED_BY` | `AttendanceRecord` → `WorkspaceMember` | `attendance_records.updated_by` | `0..1` Member | Member당 `0..*` Records | `attendance_records.updated_by = workspace_members.id` |
| `HAS_CLASS_MEMO` / `MEMO_OF_SESSION` | `CourseSession` → `ClassMemo` | `class_memos.session_id` unique | `0..1` Memo | 정확히 `1` Session | `course_sessions.id = class_memos.session_id` |
| `WRITTEN_BY` | `ClassMemo` → `WorkspaceMember` | `class_memos.updated_by` | `0..1` Member | Member당 `0..*` Memos | `class_memos.updated_by = workspace_members.id` |
| `EVENT_IN_WORKSPACE` | `ActivityLog` → `Workspace` | `activity_logs.workspace_id` | 정확히 `1` Workspace | Workspace당 `0..*` Events | `activity_logs.workspace_id = workspaces.id` |
| `ACTED_BY` | `ActivityLog` → `WorkspaceMember` | `activity_logs.actor_member_id` | `0..1` Member | Member당 `0..*` Events | `activity_logs.actor_member_id = workspace_members.id` |
| `EVENT_TARGET` | `ActivityLog` → domain entity | `target_type`, `target_id`, `metadata` | `0..1` target | target당 `0..*` Events | service가 `target_type`별 table과 권한을 해석; DB FK 없음 |

`ACCESSIBLE_BY` for Course는 저장 링크가 아니라 위 링크와 역할에서 계산한다: owner는 workspace 전체, group admin은 `workspace_member_groups -> course_groups` 교집합, instructor는 `courses.instructor_member_id` 일치다.

## 4. 관계 예외 규칙

| 예외 | 고정 규칙 | 적용 위치 |
| --- | --- | --- |
| Tenant isolation | 모든 canonical join은 동일 `workspace_id` 안에서만 수행한다. composite FK가 있는 junction은 해당 제약을 따른다. | migrations, 모든 service query |
| Active actor membership | 인증 사용자 actor는 `workspace_members.user_id = auth.uid()`와 `status='active'`를 모두 만족해야 한다. | `src/services/access.ts#loadCurrentMembership` |
| Last active owner | FK 자체의 Workspace→Member cardinality는 `0..*`지만, workspace 생성 시 active `owner_admin`을 만들고 마지막 active owner의 변경·삭제를 trigger가 막아 제품 불변식 `1..*`를 유지한다. | `create_workspace`, `prevent_last_owner_change` migration functions |
| Soft delete | `groups.deleted_at IS NULL`; `participants.deleted_at IS NULL`이고 `participants.status <> 'deleted'`인 row만 현재 수업 참여 projection에 포함한다. `participants.status='inactive'`는 현재 구현상 유지되며 제외 조건이 아니다. | projection/attendance/course participant services |
| Group-derived participation | 수업 참여자는 `course_groups -> participant_groups(status='active') -> participants`에서 파생한다. `course_participants.status='active'` row가 없어도 포함된다. | `src/services/admin-copilot-participant-projection.ts` |
| Explicit exclusion | 같은 `(course_id, participant_id)`의 `course_participants.status='excluded'`는 group-derived 참여를 제거한다. | projection/attendance services |
| Deduplication | 여러 수업 그룹을 통해 같은 참여자가 도달되어도 `(course_id, participant_id)`당 한 번만 포함한다. | projection Map key |
| Legacy snapshot | `attendance_records.participant_name_snapshot`, `course_feedbacks.course_name_snapshot`, `course_participant_groups.group_name_snapshot`은 과거 표시/fallback이다. 현재 identity나 관계 join은 UUID FK를 사용한다. | attendance, feedback, course participant group rows |
| Nullable member relation | instructor/uploader/updater/actor FK는 멤버 삭제 시 null일 수 있다. 객체 자체의 유효성을 null member에 의존시키지 않는다. | `courses`, `materials`, records, logs |
| Optional activity target | `ActivityLog.target_id`는 nullable이고 polymorphic FK가 아니다. metadata만 보고 실제 target 접근을 허용하지 않는다. | `src/services/activity.ts` |
| Session eligibility | 출석 위험은 `rollup_status='included'`이고 `progress_status <> 'cancelled'`; 완료 후보는 추가로 `visibility_status='visible'`, `progress_status='scheduled'`다. | Admin Copilot logic |

## 5. 역할별 접근 범위

UI에서 버튼을 숨기는 것은 보조 수단이다. 실제 경계는 `인증 -> active membership -> role/scope -> object ownership/current state`를 service에서 재검증한 뒤 query/action을 실행하는 순서다. admin client로 RLS를 우회하는 서비스도 이 순서를 먼저 완료해야 한다.

| Actor | Object read scope | Action scope | Service 재검증 경계 | Admin Copilot v1 |
| --- | --- | --- | --- | --- |
| `owner_admin` | 해당 Workspace의 모든 v1 운영 객체 | 멤버·그룹·수업·참여자·자료·출석·메모·피드백을 각 action 계약에 따라 관리 | `loadCurrentMembership`, role 확인, target `workspace_id`, action validator/current state | 허용; 네 task 전체를 workspace scope로 계산 |
| `group_admin` | `workspace_member_groups`에 배정된 그룹 및 그 그룹과 하나 이상 연결된 수업/참여자/기록 | 접근 그룹 범위의 운영 action. 수업 전체 변경처럼 full-course scope가 필요한 action은 모든 연결 그룹 조건을 별도 확인 | active membership + `accessible_group_ids` + target/course group 교집합 또는 full-course check | 금지 (`ROLE_FORBIDDEN`) |
| `instructor` | `courses.instructor_member_id = current member id`인 직접 배정 수업과 그 자료·회차·출석·메모 | 담당 수업의 자료/출석/메모 action; 자료 review 상태 변경과 일반 일정 관리 불가 | active membership + instructor assignment + target의 course 연결; admin client 전에 `canAccessCourse` | 금지 (`ROLE_FORBIDDEN`) |
| Participant data subject | 시스템 actor가 아니며 로그인/운영 화면 read scope 없음 | action 권한 없음 | API actor로 해석하지 않음; 공개 피드백 작성자는 별도 public input contract | 해당 없음 |

RLS는 방어 계층이지만 서비스 계약을 대체하지 않는다. 특히 `attendance_records`, `class_memos`, `materials`, `workspace_members` 등 admin client 사용 경로는 service permission check가 실제 authorization boundary다.

## 6. 추천 근거와 원본 데이터 경로

모든 경로의 공통 선행 gate는 `requireUser -> loadCurrentMembership(workspace_id, user_id=auth.uid(), status='active') -> role='owner_admin'`이다. 그 뒤에만 workspace-filtered admin query를 실행한다.

| Task identifier | 대상 / deterministic condition | Source table·column | Canonical join / 원본 데이터 경로 | Evidence entity | Related screen |
| --- | --- | --- | --- | --- | --- |
| `pending_material_review` | `Material`; `upload_status='uploaded' AND review_status='pending'` | `materials.id, workspace_id, course_id, title, upload_status, review_status, created_at, updated_at`; `courses.id, name` | `materials.course_id -> courses.id`; query에서 두 상태를 선필터 후 pure logic이 task/evidence 생성 | `material`, `course`; reason과 `uploadStatus/reviewStatus` metadata | `/workspaces/{workspaceId}/courses/{courseId}/materials` |
| `attendance_risk_participant` | `Participant` in Course; 최근 3개 유효 기록이 모두 존재하고 그중 `absent` 2개 이상 | `course_groups.course_id,group_id`; `groups.deleted_at`; `participant_groups.participant_id,group_id,status`; `participants.id,status,deleted_at`; `course_participants.course_id,participant_id,status`; `course_sessions.id,course_id,date,starts_at,rollup_status,progress_status`; `attendance_records.id,session_id,participant_id,participant_name_snapshot,status,updated_at` | group-derived projection을 만든 뒤 exclusion/dedupe -> eligible session ids -> attendance records -> `(course_id, participant_id)`별 회차 시작 내림차순 최근 3개 | `participant`, `course`, 최근 3개 `attendance_record` (각 metadata에 `sessionId`, `status`) | `/workspaces/{workspaceId}/courses/{courseId}/participants` |
| `new_course_feedback` | `CourseFeedback`; `status='new'` | `course_feedbacks.id,workspace_id,course_id,course_name_snapshot,category,message,status,created_at`; `courses.id,name` | `course_feedbacks.course_id -> courses.id`; course row 부재 시 name snapshot은 표시 fallback | `course_feedback`, `course`; status/category metadata | `/workspaces/{workspaceId}/feedback` |
| `course_completion_candidate` | `Course.status='in_progress'`; 포함·표시·정상 회차 중 마지막 종료 시각이 workspace timezone 기준 현재보다 과거 | `courses.id,name,status`; `course_sessions.id,course_id,session_no,date,starts_at,ends_at,visibility_status,rollup_status,progress_status`; `workspaces.timezone` | `courses.id -> course_sessions.course_id`; `included + visible + scheduled` 필터 후 `date + ends_at` 최대 회차 선택 | `course`, final `course_session`; course status 및 final time metadata | `/workspaces/{workspaceId}/manage/courses/{courseId}/edit` |

현재 런타임 projection은 `AdminCopilotTask`와 `AdminCopilotEvidence`다. `GraphContext`는 미래의 permission-scoped LLM context 계약이며 현재 service 출력이나 구현 완료 항목으로 간주하지 않는다.

## 7. 새 task 계약 재사용 절차

1. 객체 계약에서 task target과 identity/tenant key를 선택한다.
2. 속성표에서 deterministic condition에 필요한 canonical source column과 상태 축을 선택한다.
3. 링크표의 canonical join만 사용하고 예외 규칙을 함께 적용한다.
4. 역할표에서 actor gate와 object scope를 정한다. evidence를 authorization으로 재사용하지 않는다.
5. provenance 표와 같은 형식으로 source query, pure rule, evidence entity, related screen을 기록한다.
6. permission-filtered projection만 task builder에 전달하고 기존 계약 검증과 Admin Copilot test를 실행한다.

범위 밖 객체나 새로운 링크 해석이 필요하면 기존 표에 암묵적으로 끼워 넣지 말고 ontology contract 변경으로 먼저 검토한다.
