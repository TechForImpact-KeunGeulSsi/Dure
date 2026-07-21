import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAdminCopilotBriefing,
  buildBriefingWindow,
  getAdminCopilotRoleError,
} from "../src/services/admin-copilot-logic.ts";

const WORKSPACE_ID = "workspace-1";

test("owner_admin만 Admin Copilot을 사용할 수 있다", () => {
  assert.equal(getAdminCopilotRoleError("owner_admin"), null);
  assert.equal(getAdminCopilotRoleError("group_admin"), "ROLE_FORBIDDEN");
  assert.equal(getAdminCopilotRoleError("instructor"), "ROLE_FORBIDDEN");
});

test("워크스페이스 시간대 기준으로 최근 7일과 앞으로 7일을 계산한다", () => {
  assert.deepEqual(
    buildBriefingWindow("2026-07-17T12:30:45+09:00", "Asia/Seoul"),
    {
      timezone: "Asia/Seoul",
      recentFrom: "2026-07-10",
      today: "2026-07-17",
      upcomingUntil: "2026-07-24",
      referenceLocalDateTime: "2026-07-17T12:30:45",
    },
  );
});

test("네 가지 업무 신호를 만들고 결정론적 우선순위로 정렬한다", () => {
  const briefing = buildAdminCopilotBriefing({
    workspaceId: WORKSPACE_ID,
    timezone: "Asia/Seoul",
    referenceDate: "2026-07-17T12:00:00+09:00",
    courses: [
      { id: "course-active", name: "운영 수업", status: "in_progress" },
      { id: "course-attendance", name: "출석 수업", status: "completed" },
      { id: "course-future", name: "예정 수업", status: "planned" },
    ],
    sessions: [
      session("session-final", "course-active", "2026-07-16", "11:00:00"),
      session("session-a1", "course-attendance", "2026-07-15", "10:00:00"),
      session("session-a2", "course-attendance", "2026-07-16", "10:00:00"),
      session("session-a3", "course-attendance", "2026-07-17", "10:00:00"),
      session("session-future", "course-future", "2026-07-20", "10:00:00"),
    ],
    materials: [
      {
        id: "material-1",
        course_id: "course-active",
        title: "1회차 자료",
        created_at: "2026-07-10T00:00:00Z",
        updated_at: "2026-07-10T00:00:00Z",
      },
    ],
    feedbacks: [
      {
        id: "feedback-1",
        course_id: "course-active",
        course_name_snapshot: "운영 수업",
        category: "suggestion",
        message: "수업 진행 방식에 대한 새로운 의견입니다.",
        created_at: "2026-07-11T00:00:00Z",
      },
    ],
    attendanceRecords: [
      attendance("attendance-1", "session-a1", "absent"),
      attendance("attendance-2", "session-a2", "present"),
      attendance("attendance-3", "session-a3", "absent"),
    ],
    activeParticipantCourses: [
      { course_id: "course-attendance", participant_id: "participant-1" },
    ],
  });

  assert.deepEqual(
    briefing.tasks.map((task) => task.type),
    [
      "attendance_risk_participant",
      "pending_material_review",
      "course_completion_candidate",
      "new_course_feedback",
    ],
  );
  assert.equal(briefing.summary.attendanceRiskParticipantCount, 1);
  assert.equal(briefing.summary.pendingMaterialCount, 1);
  assert.equal(briefing.summary.completionCandidateCount, 1);
  assert.equal(briefing.summary.newFeedbackCount, 1);
  assert.equal(briefing.summary.upcomingSessionCount, 2);
  assert.equal(briefing.summary.recentSessionCount, 3);
  assert.ok(briefing.tasks.every((task) => task.evidence.length > 0));
  assert.ok(briefing.tasks.every((task) => task.relatedHref.startsWith("/workspaces/")));
});

test("출석 기록이 3개 미만이거나 휴강 회차이면 위험 신호를 만들지 않는다", () => {
  const briefing = buildAdminCopilotBriefing({
    workspaceId: WORKSPACE_ID,
    timezone: "Asia/Seoul",
    referenceDate: "2026-07-17T12:00:00+09:00",
    courses: [{ id: "course-1", name: "출석 수업", status: "completed" }],
    sessions: [
      session("session-1", "course-1", "2026-07-14", "10:00:00"),
      session("session-2", "course-1", "2026-07-15", "10:00:00"),
      {
        ...session("session-cancelled", "course-1", "2026-07-16", "10:00:00"),
        progress_status: "cancelled",
      },
    ],
    materials: [],
    feedbacks: [],
    attendanceRecords: [
      attendance("attendance-1", "session-1", "absent"),
      attendance("attendance-2", "session-2", "absent"),
      attendance("attendance-3", "session-cancelled", "absent"),
    ],
    activeParticipantCourses: [
      { course_id: "course-1", participant_id: "participant-1" },
    ],
  });

  assert.equal(briefing.summary.attendanceRiskParticipantCount, 0);
});

test("숨김·제외·휴강 회차만 있는 수업은 종료 후보가 아니다", () => {
  const base = session("session-hidden", "course-1", "2026-07-10", "10:00:00");
  const briefing = buildAdminCopilotBriefing({
    workspaceId: WORKSPACE_ID,
    timezone: "Asia/Seoul",
    referenceDate: "2026-07-17T12:00:00+09:00",
    courses: [{ id: "course-1", name: "진행 수업", status: "in_progress" }],
    sessions: [
      { ...base, visibility_status: "hidden" },
      { ...base, id: "session-excluded", rollup_status: "excluded" },
      { ...base, id: "session-cancelled", progress_status: "cancelled" },
    ],
    materials: [],
    feedbacks: [],
    attendanceRecords: [],
    activeParticipantCourses: [],
  });

  assert.equal(briefing.summary.completionCandidateCount, 0);
});

function session(id, courseId, date, endsAt) {
  return {
    id,
    course_id: courseId,
    session_no: 1,
    date,
    starts_at: "09:00:00",
    ends_at: endsAt,
    visibility_status: "visible",
    rollup_status: "included",
    progress_status: "scheduled",
  };
}

function attendance(id, sessionId, status) {
  return {
    id,
    session_id: sessionId,
    participant_id: "participant-1",
    participant_name_snapshot: "참여자 1",
    status,
    updated_at: "2026-07-17T00:00:00Z",
  };
}
