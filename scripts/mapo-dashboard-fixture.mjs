import {
  addDays,
  deterministicUuid,
  getSeoulDate,
} from "./developer-qa-fixture.mjs";

export const MAPO_DASHBOARD_WORKSPACE_ID = "d0000000-0000-4000-8000-000000000002";
export const MAPO_DASHBOARD_WORKSPACE_NAME = "마포 장애인 가족 지원 센터 데모";
export const MAPO_DASHBOARD_TIMEZONE = "Asia/Seoul";
export const MAPO_DASHBOARD_PASSWORD = "dure-local-qa-password";
export const MAPO_DASHBOARD_BUCKET = "course-materials";

export const MAPO_DASHBOARD_ACCOUNTS = {
  owner: {
    email: "mapo.demo.owner@test.local",
    displayName: "마포센터 대표 운영자",
    role: "owner_admin",
  },
  operator: {
    email: "mapo.demo.operator@test.local",
    displayName: "마포센터 운영 코디네이터",
    role: "group_admin",
  },
  fitnessInstructor: {
    email: "mapo.demo.fitness@test.local",
    displayName: "생활체육 담당 강사",
    role: "instructor",
  },
  artInstructor: {
    email: "mapo.demo.art@test.local",
    displayName: "미술활동 담당 강사",
    role: "instructor",
  },
  musicInstructor: {
    email: "mapo.demo.music@test.local",
    displayName: "음악교실 담당 강사",
    role: "instructor",
  },
};

export function buildMapoDashboardFixture({
  workspaceId = MAPO_DASHBOARD_WORKSPACE_ID,
  referenceDate = getSeoulDate(),
} = {}) {
  if (!isUuid(workspaceId)) throw new Error("workspaceId must be a UUID.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(referenceDate)) {
    throw new Error("referenceDate must use YYYY-MM-DD.");
  }

  const id = (kind, key) => deterministicUuid(workspaceId, `${kind}:${key}`);
  const timestamp = (offset, hour = 3) =>
    `${addDays(referenceDate, offset)}T${String(hour).padStart(2, "0")}:00:00.000Z`;

  const groups = [
    {
      key: "center",
      id: id("group", "center"),
      workspace_id: workspaceId,
      name: "센터 전체 운영 범위",
      description: "화면에는 노출하지 않는 데모 권한 범위",
      status: "active",
    },
  ];

  const participants = [
    participant("haneul", "김하늘"),
    participant("sumin", "이수민"),
    participant("jihu", "박지후"),
    participant("daon", "정다온"),
    participant("yejun", "한예준"),
    participant("seoa", "강서아"),
    participant("jiho", "윤지호"),
    participant("junwoo", "서준우"),
    participant("minjun", "최민준"),
    participant("yerin", "배예린"),
    participant("seoyun", "박서윤"),
    participant("doyun", "이도윤"),
  ];

  const courses = [
    course("fitness", "생활체육교실", "fitnessInstructor", -35, "08:00:00", "09:00:00"),
    course("art", "미술활동", "artInstructor", -35, "13:00:00", "14:30:00"),
    course("music", "음악교실", "musicInstructor", -35, "16:00:00", "17:00:00"),
  ];

  const sessionOffsets = [-35, -28, -21, -14, -7, 0];
  const sessions = courses.flatMap((courseItem) =>
    sessionOffsets.map((offset, index) =>
      session(
        `${courseItem.key}-${index + 1}`,
        courseItem.key,
        index + 1,
        offset,
        courseItem.starts_at,
        courseItem.ends_at,
      ),
    ),
  );

  const participantGroups = participants.map((item) => ({
    id: id("participant-group", `${item.key}:center`),
    workspace_id: workspaceId,
    participant_id: item.id,
    group_id: groups[0].id,
    status: "active",
  }));

  const courseGroups = courses.map((courseItem) => ({
    id: id("course-group", `${courseItem.key}:center`),
    workspace_id: workspaceId,
    course_id: courseItem.id,
    group_id: groups[0].id,
    group_name_snapshot: groups[0].name,
  }));

  const courseParticipantKeys = {
    fitness: ["haneul", "sumin", "jihu", "daon", "yejun", "seoa", "jiho", "junwoo"],
    art: ["minjun", "seoa", "jiho", "yerin", "junwoo", "haneul"],
    music: ["seoyun", "doyun", "jihu", "jiho", "yerin"],
  };
  const courseParticipants = [];
  const courseParticipantGroups = [];
  for (const courseItem of courses) {
    const activeParticipantKeys = new Set(courseParticipantKeys[courseItem.key]);
    for (const participantItem of participants) {
      const status = activeParticipantKeys.has(participantItem.key) ? "active" : "excluded";
      const relationKey = `${courseItem.key}:${participantItem.key}`;
      const relationId = id("course-participant", relationKey);
      courseParticipants.push({
        id: relationId,
        workspace_id: workspaceId,
        course_id: courseItem.id,
        participant_id: participantItem.id,
        status,
        participant_name_snapshot: participantItem.name,
        assigned_at: timestamp(-40, 3),
      });
      courseParticipantGroups.push({
        id: id("course-participant-group", `${relationKey}:center`),
        workspace_id: workspaceId,
        course_participant_id: relationId,
        group_id: groups[0].id,
        group_name_snapshot: groups[0].name,
      });
    }
  }

  const attendancePatterns = {
    fitness: {
      haneul: ["absent", "present", "absent", "absent", "present", "absent"],
      sumin: ["present", "partial", "present", "present", "present", "partial"],
      jihu: ["present", "absent", "present", "absent", "present", "absent"],
      daon: ["present", "present", "partial", "present", "present", "present"],
      yejun: ["present", "absent", "present", "present", "present", "present"],
      seoa: ["present", "present", "present", "absent", "present", "present"],
      jiho: ["present", "present", "partial", "present", "present", "partial"],
      junwoo: ["present", "present", "present", "absent", "present", "present"],
    },
    art: {
      minjun: ["absent", "present", "absent", "absent", "present", "absent"],
      seoa: ["present", "present", "partial", "present", "present", "present"],
      jiho: ["present", "absent", "present", "partial", "present", "present"],
      yerin: ["present", "present", "present", "absent", "present", "present"],
      junwoo: ["present", "present", "present", "present", "absent", "present"],
      haneul: ["present", "present", "absent", "present", "present", "absent"],
    },
    music: {
      seoyun: ["present", "partial", "present", "present", "present", "present"],
      doyun: ["present", "present", "present", "absent", "present", "partial"],
      jihu: ["present", "absent", "present", "absent", "present", "absent"],
      jiho: ["present", "present", "partial", "present", "present", "present"],
      yerin: ["absent", "present", "absent", "present", "present", "absent"],
    },
  };
  const missingRecords = new Set(["art:haneul:6", "music:doyun:6"]);
  const attendanceRecords = [];
  for (const courseItem of courses) {
    for (const participantKey of courseParticipantKeys[courseItem.key]) {
      const participantItem = participants.find((item) => item.key === participantKey);
      const statuses = attendancePatterns[courseItem.key][participantKey];
      for (const [index, status] of statuses.entries()) {
        if (missingRecords.has(`${courseItem.key}:${participantKey}:${index + 1}`)) continue;
        const sessionKey = `${courseItem.key}-${index + 1}`;
        attendanceRecords.push({
          id: id("attendance", `${sessionKey}:${participantKey}`),
          workspace_id: workspaceId,
          session_id: id("session", sessionKey),
          participant_id: participantItem.id,
          participant_name_snapshot: participantItem.name,
          status,
          note:
            (participantKey === "haneul" && status === "absent") ||
            (participantKey === "minjun" && status === "absent")
              ? "연락 필요"
              : null,
          updated_at: timestamp(0, 18),
          instructorKey: courseItem.instructorKey,
        });
      }
    }
  }

  return {
    workspace: {
      id: workspaceId,
      name: MAPO_DASHBOARD_WORKSPACE_NAME,
      timezone: MAPO_DASHBOARD_TIMEZONE,
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
    classMemos: courses.map((courseItem) => ({
      id: id("memo", `${courseItem.key}-1`),
      workspace_id: workspaceId,
      session_id: id("session", `${courseItem.key}-1`),
      content: `${courseItem.name} 1회차 운영 메모입니다. 참여자 상태를 확인했습니다.`,
      instructorKey: courseItem.instructorKey,
    })),
    expected: {
      roleCourseKeys: {
        owner: courses.map((courseItem) => courseItem.key),
        operator: courses.map((courseItem) => courseItem.key),
        fitnessInstructor: ["fitness"],
        artInstructor: ["art"],
        musicInstructor: ["music"],
      },
      groupAdminGroupKeys: ["center"],
      lowAttendance: [
        { courseKey: "fitness", participantKey: "haneul", attended: 2, valid: 6 },
        { courseKey: "art", participantKey: "minjun", attended: 2, valid: 6 },
      ],
      exactFifty: [
        { courseKey: "fitness", participantKey: "jihu", attended: 3, valid: 6 },
        { courseKey: "music", participantKey: "jihu", attended: 3, valid: 6 },
        { courseKey: "music", participantKey: "yerin", attended: 3, valid: 6 },
      ],
      dailyMissingCount: 2,
    },
  };

  function participant(key, name) {
    return {
      key,
      id: id("participant", key),
      workspace_id: workspaceId,
      name,
      memo: key === "haneul" || key === "minjun" ? "출석 확인 필요" : null,
      status: "active",
      groupKeys: ["center"],
    };
  }

  function course(key, name, instructorKey, startsOffset, startsAt, endsAt) {
    return {
      key,
      id: id("course", key),
      workspace_id: workspaceId,
      name,
      status: "in_progress",
      starts_on: addDays(referenceDate, startsOffset),
      ends_on: addDays(referenceDate, 0),
      card_color: key === "fitness" ? "#0f766e" : key === "art" ? "#7c3aed" : "#2563eb",
      public_visibility: "hidden",
      groupKeys: ["center"],
      instructorKey,
      starts_at: startsAt,
      ends_at: endsAt,
    };
  }

  function session(key, courseKey, sessionNo, offset, startsAt, endsAt) {
    return {
      key,
      id: id("session", key),
      workspace_id: workspaceId,
      course_id: id("course", courseKey),
      session_no: sessionNo,
      date: addDays(referenceDate, offset),
      starts_at: startsAt,
      ends_at: endsAt,
      type: "regular",
      visibility_status: "visible",
      rollup_status: "included",
      progress_status: "scheduled",
    };
  }
}

function isUuid(value) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
