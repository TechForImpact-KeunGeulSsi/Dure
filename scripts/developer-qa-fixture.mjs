import { createHash } from "node:crypto";

export const DEVELOPER_QA_WORKSPACE_NAME = "DURE Developer QA";
export const DEVELOPER_QA_TIMEZONE = "Asia/Seoul";
export const DEVELOPER_QA_BUCKET = "course-materials";

export const DEFAULT_DEVELOPER_QA_ACCOUNTS = {
  owner: {
    email: "dure.qa.owner@test.local",
    displayName: "DURE QA 대표 운영자",
    role: "owner_admin",
  },
  groupAdmin: {
    email: "dure.qa.group@test.local",
    displayName: "DURE QA 그룹 운영자",
    role: "group_admin",
  },
  instructor: {
    email: "dure.qa.instructor@test.local",
    displayName: "DURE QA 강사",
    role: "instructor",
  },
};

export function getSeoulDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: DEVELOPER_QA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function addDays(isoDate, offsetDays) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + offsetDays));
  return date.toISOString().slice(0, 10);
}

export function deterministicUuid(namespace, key) {
  const bytes = Buffer.from(createHash("sha256").update(`${namespace}:${key}`).digest().subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function buildDeveloperQaFixture({
  workspaceId,
  referenceDate = getSeoulDate(),
} = {}) {
  if (!isUuid(workspaceId)) throw new Error("workspaceId must be a UUID.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(referenceDate)) {
    throw new Error("referenceDate must use YYYY-MM-DD.");
  }

  const id = (kind, key) => deterministicUuid(workspaceId, `${kind}:${key}`);
  const timestamp = (offset, hour = 3) => `${addDays(referenceDate, offset)}T${String(hour).padStart(2, "0")}:00:00.000Z`;

  const groups = [
    group("alpha", "알파 교육센터", "그룹 운영자 접근 범위", "active"),
    group("beta", "베타 마을학교", "대표 운영자 전용 검증 범위", "active"),
    group("gamma", "감마 창작소", "비공개 수업 검증 범위", "active"),
    group("inactive", "휴면 교육센터", "비활성 그룹 표시 검증", "inactive"),
  ];

  const participants = [
    participant("risk", "김위험", ["alpha"], "최근 3회 중 2회 결석"),
    participant("steady", "이성실", ["alpha"], "정상 출석 기준 참여자"),
    participant("multi", "박다중", ["alpha", "beta"], "여러 그룹 소속"),
    participant("excluded", "최제외", ["alpha"], "운영 수업 명시 제외"),
    participant("beta-1", "정베타", ["beta"]),
    participant("beta-2", "한베타", ["beta"]),
    participant("gamma-1", "오감마", ["gamma"]),
    participant("inactive", "윤휴면", ["inactive"], "비활성 참여자", "inactive"),
  ];

  const courses = [
    course("operations", "운영 점검 수업", "in_progress", ["alpha"], "instructor", "public", -3, 3),
    course("completion", "완료 전환 후보 수업", "in_progress", ["beta"], null, "public", -5, -4),
    course("planned", "공개 예정 수업", "planned", ["beta"], "instructor", "public", 2, 9),
    course("completed", "완료된 수업", "completed", ["alpha"], "instructor", "public", -14, -7),
    course("hidden", "비공개 예정 수업", "planned", ["gamma"], null, "hidden", 4, 4),
    course("multi", "다중 그룹 협업 수업", "planned", ["alpha", "beta"], null, "public", 5, 5),
  ];

  const sessions = [
    session("operations-1", "operations", 1, -3),
    session("operations-2", "operations", 2, -2),
    session("operations-3", "operations", 3, -1),
    session("operations-4", "operations", 4, 3),
    session("operations-cancelled", "operations", 5, 1, { progress_status: "cancelled" }),
    session("completion-1", "completion", 1, -5),
    session("completion-2", "completion", 2, -4),
    session("planned-1", "planned", 1, 2),
    session("planned-2", "planned", 2, 9),
    session("completed-1", "completed", 1, -14),
    session("completed-2", "completed", 2, -7),
    session("hidden-1", "hidden", 1, 4, { visibility_status: "hidden" }),
    session("multi-excluded", "multi", 1, 1, { rollup_status: "excluded" }),
    session("multi-1", "multi", 2, 5, { type: "special" }),
  ];

  const participantGroups = participants.flatMap((item) =>
    item.groupKeys.map((groupKey) => ({
      id: id("participant-group", `${item.key}:${groupKey}`),
      workspace_id: workspaceId,
      participant_id: item.id,
      group_id: id("group", groupKey),
      status: "active",
    })),
  );

  const courseGroups = courses.flatMap((item) =>
    item.groupKeys.map((groupKey) => ({
      id: id("course-group", `${item.key}:${groupKey}`),
      workspace_id: workspaceId,
      course_id: item.id,
      group_id: id("group", groupKey),
      group_name_snapshot: groups.find((groupItem) => groupItem.key === groupKey).name,
    })),
  );

  const courseParticipants = [];
  const courseParticipantGroups = [];
  for (const courseItem of courses) {
    for (const participantItem of participants) {
      const matchingGroups = participantItem.groupKeys.filter((key) => courseItem.groupKeys.includes(key));
      if (matchingGroups.length === 0 || participantItem.status !== "active") continue;
      const key = `${courseItem.key}:${participantItem.key}`;
      const rowId = id("course-participant", key);
      courseParticipants.push({
        id: rowId,
        workspace_id: workspaceId,
        course_id: courseItem.id,
        participant_id: participantItem.id,
        status: courseItem.key === "operations" && participantItem.key === "excluded" ? "excluded" : "active",
        participant_name_snapshot: participantItem.name,
      });
      for (const groupKey of matchingGroups) {
        courseParticipantGroups.push({
          id: id("course-participant-group", `${key}:${groupKey}`),
          workspace_id: workspaceId,
          course_participant_id: rowId,
          group_id: id("group", groupKey),
          group_name_snapshot: groups.find((groupItem) => groupItem.key === groupKey).name,
        });
      }
    }
  }

  const attendanceRecords = [];
  const attendancePattern = {
    risk: ["absent", "present", "absent"],
    steady: ["present", "present", "present"],
    multi: ["present", "partial", "present"],
  };
  ["operations-1", "operations-2", "operations-3"].forEach((sessionKey, sessionIndex) => {
    for (const [participantKey, statuses] of Object.entries(attendancePattern)) {
      const participantItem = participants.find((item) => item.key === participantKey);
      attendanceRecords.push({
        id: id("attendance", `${sessionKey}:${participantKey}`),
        workspace_id: workspaceId,
        session_id: id("session", sessionKey),
        participant_id: participantItem.id,
        participant_name_snapshot: participantItem.name,
        status: statuses[sessionIndex],
        note: participantKey === "risk" && statuses[sessionIndex] === "absent" ? "연락 필요" : null,
        updated_at: timestamp(-1, 6),
      });
    }
  });

  const materials = [
    material("pending", "operations", "확인 필요한 운영 자료.txt", "pending", "admin_only", -5),
    material("public", "planned", "공개 수업 안내.txt", "reviewed", "public", -3),
  ];

  const feedbacks = [
    feedback("new", "operations", "suggestion", "준비물 안내를 수업 전에 더 자세히 받고 싶습니다.", "new", -2),
    feedback("reviewed", "completed", "praise", "활동 구성이 좋아서 다음 수업에도 참여하고 싶습니다.", "reviewed", -6),
  ];

  const generalScheduleItems = [
    schedule("alpha-meeting", "알파 운영 회의", 1, ["alpha"]),
    schedule("joint-event", "알파·베타 공동 행사", 6, ["alpha", "beta"]),
  ];

  const storageFiles = [
    storageFile("material-pending", `workspaces/${workspaceId}/courses/${id("course", "operations")}/materials/${id("material", "pending")}/pending-review.txt`, "확인이 필요한 개발 QA 자료입니다.\n"),
    storageFile("material-public", `workspaces/${workspaceId}/courses/${id("course", "planned")}/materials/${id("material", "public")}/public-guide.txt`, "공개 수업 안내용 개발 QA 자료입니다.\n"),
    storageFile("settlement-receipt", `workspaces/${workspaceId}/settlements/${id("settlement", "pending")}/${id("receipt", "pending")}-receipt.txt`, "개발 QA 정산 영수증입니다.\n"),
  ];

  return {
    workspace: {
      id: workspaceId,
      name: DEVELOPER_QA_WORKSPACE_NAME,
      timezone: DEVELOPER_QA_TIMEZONE,
    },
    referenceDate,
    groups,
    participants,
    participantGroups,
    courses,
    courseGroups,
    courseParticipants,
    courseParticipantGroups,
    sessions,
    attendanceRecords,
    classMemos: [
      {
        id: id("memo", "operations-1"),
        workspace_id: workspaceId,
        session_id: id("session", "operations-1"),
        content: "첫 회차 운영 메모: 준비물과 참여자 상태를 확인했습니다.",
      },
      {
        id: id("memo", "completed-2"),
        workspace_id: workspaceId,
        session_id: id("session", "completed-2"),
        content: "마지막 회차를 정상적으로 마무리했습니다.",
      },
    ],
    materials,
    feedbacks,
    generalScheduleItems,
    payoutAccount: {
      id: id("payout", "instructor"),
      workspace_id: workspaceId,
      bank_name: "QA은행",
      account_number: "000-0000-0000",
      account_holder: "DURE QA 강사",
    },
    settlements: [
      settlement("pending", "operations", "pending", 30000, -1),
      settlement("paid", "completed", "paid", 15000, -8),
    ],
    settlementItems: [
      { id: id("settlement-item", "pending-1"), settlement_request_id: id("settlement", "pending"), item_name: "활동 재료", quantity: 3, unit_price: 10000, sort_order: 0 },
      { id: id("settlement-item", "paid-1"), settlement_request_id: id("settlement", "paid"), item_name: "인쇄비", quantity: 1, unit_price: 15000, sort_order: 0 },
    ],
    settlementReceipt: {
      id: id("receipt", "pending"),
      settlement_request_id: id("settlement", "pending"),
      original_filename: "qa-receipt.txt",
      mime_type: "text/plain",
      size_bytes: Buffer.byteLength(storageFiles[2].body),
      storage_path: storageFiles[2].path,
    },
    activityLogs: [
      activity("course-created", "course_created", "course", id("course", "operations"), -5),
      activity("material-pending", "material_uploaded", "material", id("material", "pending"), -4),
      activity("attendance", "attendance_saved", "attendance", id("session", "operations-3"), -1),
      activity("memo", "class_memo_saved", "class_memo", id("session", "operations-1"), -3),
      activity("feedback", "feedback_submitted", "course_feedback", id("feedback", "new"), -2),
      activity("settlement", "settlement_requested", "settlement", id("settlement", "pending"), -1),
    ],
    storageFiles,
    expected: {
      taskCounts: {
        pending_material_review: 1,
        attendance_risk_participant: 1,
        new_course_feedback: 1,
        course_completion_candidate: 1,
      },
      upcomingSessionCount: 3,
      recentSessionCount: 6,
      groupAdminCourseKeys: ["operations", "completed", "multi"],
      instructorCourseKeys: ["operations", "planned", "completed"],
    },
  };

  function group(key, name, description, status) {
    return { key, id: id("group", key), workspace_id: workspaceId, name, description, status };
  }

  function participant(key, name, groupKeys, memo = null, status = "active") {
    return { key, id: id("participant", key), workspace_id: workspaceId, name, memo, status, groupKeys };
  }

  function course(key, name, status, groupKeys, instructorKey, publicVisibility, startsOffset, endsOffset) {
    return {
      key,
      id: id("course", key),
      workspace_id: workspaceId,
      name,
      status,
      starts_on: addDays(referenceDate, startsOffset),
      ends_on: addDays(referenceDate, endsOffset),
      card_color: "#2563eb",
      public_visibility: publicVisibility,
      groupKeys,
      instructorKey,
    };
  }

  function session(key, courseKey, sessionNo, offset, overrides = {}) {
    return {
      key,
      id: id("session", key),
      workspace_id: workspaceId,
      course_id: id("course", courseKey),
      session_no: sessionNo,
      date: addDays(referenceDate, offset),
      starts_at: "10:00:00",
      ends_at: "12:00:00",
      type: "regular",
      visibility_status: "visible",
      rollup_status: "included",
      progress_status: "scheduled",
      ...overrides,
    };
  }

  function material(key, courseKey, title, reviewStatus, visibilityScope, createdOffset) {
    const path = storageFilesPath(key, courseKey);
    return {
      key,
      id: id("material", key),
      workspace_id: workspaceId,
      course_id: id("course", courseKey),
      title,
      description: "Developer QA smoke fixture",
      storage_path: path,
      original_filename: path.split("/").at(-1),
      mime_type: "text/plain",
      upload_status: "uploaded",
      review_status: reviewStatus,
      visibility_scope: visibilityScope,
      created_at: timestamp(createdOffset),
      updated_at: timestamp(createdOffset),
    };
  }

  function storageFilesPath(key, courseKey) {
    const filename = key === "pending" ? "pending-review.txt" : "public-guide.txt";
    return `workspaces/${workspaceId}/courses/${id("course", courseKey)}/materials/${id("material", key)}/${filename}`;
  }

  function feedback(key, courseKey, category, message, status, createdOffset) {
    const courseItem = courses.find((item) => item.key === courseKey);
    return {
      key,
      id: id("feedback", key),
      workspace_id: workspaceId,
      course_id: courseItem.id,
      course_name_snapshot: courseItem.name,
      category,
      message,
      author_name: "QA 참여자",
      author_phone: null,
      status,
      privacy_consent_at: timestamp(createdOffset),
      created_at: timestamp(createdOffset),
      updated_at: timestamp(createdOffset),
    };
  }

  function schedule(key, title, offset, groupKeys) {
    return {
      key,
      id: id("schedule", key),
      workspace_id: workspaceId,
      title,
      date: addDays(referenceDate, offset),
      starts_at: "14:00:00",
      ends_at: "15:00:00",
      description: "Developer QA 일정 fixture",
      color: "#0f766e",
      groupKeys,
    };
  }

  function settlement(key, courseKey, status, totalAmount, createdOffset) {
    return {
      key,
      id: id("settlement", key),
      workspace_id: workspaceId,
      course_id: id("course", courseKey),
      bank_name_snapshot: "QA은행",
      account_number_snapshot: "000-0000-0000",
      account_holder_snapshot: "DURE QA 강사",
      memo: `${status} 정산 fixture`,
      total_amount: totalAmount,
      status,
      paid_at: status === "paid" ? timestamp(createdOffset + 1) : null,
      created_at: timestamp(createdOffset),
      updated_at: timestamp(createdOffset),
    };
  }

  function activity(key, eventType, targetType, targetId, createdOffset) {
    return {
      id: id("activity", key),
      workspace_id: workspaceId,
      event_type: eventType,
      target_type: targetType,
      target_id: targetId,
      metadata: { fixture: "developer-qa-smoke" },
      created_at: timestamp(createdOffset),
    };
  }
}

function storageFile(key, path, body) {
  return { key, path, body, contentType: "text/plain" };
}

function isUuid(value) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
