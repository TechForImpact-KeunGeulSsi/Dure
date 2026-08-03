import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function read(relativePath) {
  return readFile(new URL(relativePath, root), "utf8");
}

function assertIncludesAll(source, expected, label) {
  for (const value of expected) {
    assert.ok(source.includes(value), `${label} is missing ${value}`);
  }
}

test("ontology contract covers the v1 objects, links, states, and tasks", async () => {
  const contract = await read("docs/ontology-contract.md");

  assertIncludesAll(
    contract,
    [
      "`Workspace`",
      "`WorkspaceMember`",
      "`Group`",
      "`Participant`",
      "`Course`",
      "`CourseSession`",
      "`Material`",
      "`AttendanceRecord`",
      "`ClassMemo`",
      "`CourseFeedback`",
      "`ActivityLog`",
    ],
    "object contract",
  );
  assertIncludesAll(
    contract,
    [
      "`HAS_GROUP`",
      "`HAS_MEMBER`",
      "`HAS_GROUP_SCOPE`",
      "`BELONGS_TO_GROUP`",
      "`TAUGHT_BY`",
      "`HAS_SESSION`",
      "`HAS_MATERIAL`",
      "`HAS_FEEDBACK`",
      "`HAS_ATTENDANCE_RECORD`",
      "`HAS_CLASS_MEMO`",
      "`EVENT_IN_WORKSPACE`",
    ],
    "link contract",
  );
  assertIncludesAll(
    contract,
    [
      "planned | in_progress | completed",
      "visible | hidden",
      "included | excluded",
      "scheduled | cancelled",
      "uploading | uploaded | failed",
      "pending | reviewed",
      "present | partial | absent",
      "new | reviewed",
      "owner_admin",
      "group_admin",
      "instructor",
      "Participant data subject",
      "pending_material_review",
      "attendance_risk_participant",
      "new_course_feedback",
      "course_completion_candidate",
      "DB cardinality `0..*` Members; 제품 불변식은 active owner `1..*`",
      "`course_participant_groups.group_name_snapshot`",
      "`participants.status='inactive'`는 현재 구현상 유지",
      "`src/services/class-memos.ts`, `src/services/attendance.ts`",
    ],
    "state, access, and task contract",
  );
});

test("contract source tables and columns exist in migrations", async () => {
  const initial = await read("supabase/migrations/20260512163305_initial_schema.sql");
  const feedback = await read("supabase/migrations/20260518090000_course_feedbacks.sql");
  const visibility = await read("supabase/migrations/20260517100000_material_visibility_v2.sql");
  const migrations = `${initial}\n${feedback}\n${visibility}`;

  assertIncludesAll(
    migrations,
    [
      "create table public.workspaces",
      "create table public.workspace_members",
      "create table public.groups",
      "create table public.workspace_member_groups",
      "create table public.participants",
      "create table public.participant_groups",
      "create table public.courses",
      "create table public.course_groups",
      "create table public.course_participants",
      "create table public.course_sessions",
      "create table public.materials",
      "create table public.attendance_records",
      "create table public.class_memos",
      "create table public.course_feedbacks",
      "create table public.activity_logs",
      "instructor_member_id",
      "visibility_status",
      "rollup_status",
      "progress_status",
      "upload_status",
      "review_status",
      "participant_name_snapshot",
      "course_name_snapshot",
      "actor_member_id",
      "target_type",
      "target_id",
      "'public', 'admin_only'",
      "create function public.create_workspace",
      "create function public.prevent_last_owner_change",
    ],
    "migration contract",
  );
});

test("current access and Admin Copilot code retain the contracted paths", async () => {
  const [access, service, logic, projection] = await Promise.all([
    read("src/services/access.ts"),
    read("src/services/admin-copilot.ts"),
    read("src/services/admin-copilot-logic.ts"),
    read("src/services/admin-copilot-participant-projection.ts"),
  ]);

  assertIncludesAll(
    access,
    ['.from("workspace_members")', '.eq("user_id", user.id)', '.eq("status", "active")'],
    "active membership gate",
  );
  assertIncludesAll(
    service,
    [
      '.from("course_groups")',
      '.from("participant_groups")',
      '.from("participants")',
      '.from("course_participants")',
      '.from("course_sessions")',
      '.from("materials")',
      '.eq("upload_status", "uploaded")',
      '.eq("review_status", "pending")',
      '.from("course_feedbacks")',
      '.eq("status", "new")',
      '.from("attendance_records")',
    ],
    "Admin Copilot source path",
  );
  assertIncludesAll(
    projection,
    ['row.status === "excluded"', 'row.status !== "active"', 'participant.status !== "deleted"'],
    "participant projection exceptions",
  );
  assertIncludesAll(
    logic,
    [
      'role === "owner_admin"',
      '"pending_material_review"',
      '"attendance_risk_participant"',
      '"new_course_feedback"',
      '"course_completion_candidate"',
      'session.rollup_status === "included"',
      'session.visibility_status === "visible"',
      'session.progress_status === "scheduled"',
      'record.status === "absent"',
    ],
    "Admin Copilot deterministic rules",
  );
});
