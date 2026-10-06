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
  cookingInstructor: {
    email: "mapo.demo.cooking@test.local",
    displayName: "요리활동 담당 강사",
    role: "instructor",
  },
  digitalInstructor: {
    email: "mapo.demo.digital@test.local",
    displayName: "디지털활동 담당 강사",
    role: "instructor",
  },
  dailyInstructor: {
    email: "mapo.demo.daily@test.local",
    displayName: "일상생활훈련 담당 강사",
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

  // 한 사람은 한 수업만 듣는다 (센터 신청 규칙). 내부 번호는 배열 순서대로 M-0001부터 붙는다.
  const participants = [
    participant("haneul", "김하늘", "female", 2012, true, "fitness"),
    participant("sumin", "이수민", "female", 1978, false, "digital"),
    participant("jihu", "박지후", "male", 2009, true, "music"),
    participant("daon", "정다온", "female", 2001, true, "fitness"),
    participant("yejun", "한예준", "male", 2014, true, "fitness"),
    participant("seoa", "강서아", "female", 2011, false, "cooking"),
    participant("jiho", "윤지호", "male", 1999, true, "digital"),
    participant("junwoo", "서준우", "male", 1975, false, "fitness"),
    participant("minjun", "최민준", "male", 2008, true, "art"),
    participant("yerin", "배예린", "female", 1983, false, "art"),
    participant("seoyun", "박서윤", "female", 2016, true, "music"),
    participant("doyun", "이도윤", "male", 1996, true, "music"),
    participant("eunchae", "김은채", "female", 1969, false, "cooking"),
    participant("taeyang", "이태양", "male", 2004, true, "cooking"),
    participant("yubin", "최유빈", "female", 1987, false, "digital"),
    participant("junseo", "정준서", "male", 2013, true, "digital"),
    participant("sebin", "오세빈", "male", 2003, true, "daily"),
    participant("jiwoo", "문지우", "female", 1998, true, "daily"),
    participant("sumin2", "이수민", "female", 2010, true, "art"),
    participant("minseo", "장민서", "female", 2015, true, "music"),
    participant("hyunwoo", "조현우", "male", 1972, false, "fitness"),
    participant("hayun", "임하윤", "female", 2007, false, "art"),
    participant("jian", "송지안", "male", 1962, false, "digital"),
    participant("dohyun", "권도현", "male", 2005, true, "cooking"),
    participant("sua", "황수아", "female", 1980, false, "daily"),
    participant("siwoo", "안시우", "male", 2017, true, "music"),
    participant("chaewon", "홍채원", "female", 1966, false, "art"),
    participant("gunwoo", "유건우", "male", 2000, true, "daily"),
    participant("sunhee", "남궁선희", "female", 1961, true, "cooking"),
    participant("seungho", "백승호", "male", 1994, true, "daily"),
  ].map((item, index) => ({ ...item, internal_no: `M-${String(index + 1).padStart(4, "0")}` }));

  const courses = [
    course("fitness", "생활체육교실", "fitnessInstructor", -84, "08:00:00", "09:00:00"),
    course("art", "미술활동", "artInstructor", -84, "13:00:00", "14:30:00"),
    course("music", "음악교실", "musicInstructor", -84, "16:00:00", "17:00:00"),
    course("cooking", "요리활동", "cookingInstructor", -84, "10:00:00", "11:30:00"),
    course("digital", "디지털활동", "digitalInstructor", -84, "14:30:00", "15:30:00"),
    course("daily", "일상생활훈련", "dailyInstructor", -84, "15:00:00", "16:00:00"),
  ];

  // 약 3개월: 주 1회 13회차, 마지막 회차가 기준일
  const SESSION_COUNT = 13;
  const sessionOffsets = Array.from({ length: SESSION_COUNT }, (_, index) => (index - SESSION_COUNT + 1) * 7);
  const cancelledSessionKeys = new Set(["cooking-7"]);
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

  // 모든 참여자가 센터 그룹을 통해 모든 수업에 연결되므로, 듣지 않는 수업은 명시적으로 제외한다.
  const courseParticipants = [];
  const courseParticipantGroups = [];
  for (const courseItem of courses) {
    for (const participantItem of participants) {
      const status = participantItem.courseKey === courseItem.key ? "active" : "excluded";
      const relationKey = `${courseItem.key}:${participantItem.key}`;
      const relationId = id("course-participant", relationKey);
      courseParticipants.push({
        id: relationId,
        workspace_id: workspaceId,
        course_id: courseItem.id,
        participant_id: participantItem.id,
        status,
        participant_name_snapshot: participantItem.name,
        assigned_at: timestamp(-90, 3),
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

  // 회차 번호(1부터) → 상태. 지정하지 않은 사람은 regularStatus로 채운다.
  const attendedOnly = (sessionNos) => (sessionNo) => (sessionNos.includes(sessionNo) ? "present" : "absent");
  // 기록이 있는 회차를 순서대로 번갈아 출석/결석 처리해 정확히 50%를 만든다.
  const alternating = (skipSessionNos) => {
    const order = [];
    for (let no = 1; no <= SESSION_COUNT; no += 1) if (!skipSessionNos.includes(no)) order.push(no);
    return (sessionNo) => {
      const position = order.indexOf(sessionNo);
      if (position % 4 === 2) return "partial";
      return position % 2 === 0 ? "present" : "absent";
    };
  };
  const specialPatterns = {
    haneul: attendedOnly([2, 5, 9, 12]),
    minjun: attendedOnly([1, 4, 7, 10, 13]),
    jiwoo: attendedOnly([1, 3, 8, 11]),
    seungho: attendedOnly([1, 6, 10]),
    jihu: alternating([4]),
    yerin: alternating([6]),
    eunchae: alternating([7]),
    sebin: alternating([9]),
  };
  // 기록이 없는 칸: 정확히 50% 사례의 과거 1칸 + 기준일 미입력 2칸
  const missingRecords = new Set([
    "jihu:4",
    "yerin:6",
    "sebin:9",
    `doyun:${SESSION_COUNT}`,
    `yubin:${SESSION_COUNT}`,
  ]);
  const breakSessionNos = [5, 6, 7, 8];

  const attendanceRecords = [];
  for (const [participantIndex, participantItem] of participants.entries()) {
    const courseItem = courses.find((item) => item.key === participantItem.courseKey);
    for (let sessionNo = 1; sessionNo <= SESSION_COUNT; sessionNo += 1) {
      const sessionKey = `${courseItem.key}-${sessionNo}`;
      if (cancelledSessionKeys.has(sessionKey)) continue;
      if (missingRecords.has(`${participantItem.key}:${sessionNo}`)) continue;
      const onBreak = participantItem.key === "dohyun" && breakSessionNos.includes(sessionNo);
      const status = onBreak
        ? "absent"
        : (specialPatterns[participantItem.key] ?? regularStatus(participantIndex))(sessionNo);
      attendanceRecords.push({
        id: id("attendance", `${sessionKey}:${participantItem.key}`),
        workspace_id: workspaceId,
        session_id: id("session", sessionKey),
        participant_id: participantItem.id,
        participant_name_snapshot: participantItem.name,
        status,
        note: onBreak
          ? "개인 사정으로 쉬는 중"
          : (participantItem.key === "haneul" || participantItem.key === "minjun") && status === "absent"
            ? "연락 필요"
            : null,
        updated_at: timestamp(0, 18),
        instructorKey: courseItem.instructorKey,
      });
    }
  }

  const todaySessionCounts = Object.fromEntries(courses.map((courseItem) => {
    const sessionId = id("session", `${courseItem.key}-${SESSION_COUNT}`);
    const records = attendanceRecords.filter((record) => record.session_id === sessionId);
    const assigned = participants.filter((item) => item.courseKey === courseItem.key).length;
    return [courseItem.key, {
      present: records.filter((record) => record.status === "present").length,
      partial: records.filter((record) => record.status === "partial").length,
      absent: records.filter((record) => record.status === "absent").length,
      missing: assigned - records.length,
    }];
  }));

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
        cookingInstructor: ["cooking"],
        digitalInstructor: ["digital"],
        dailyInstructor: ["daily"],
      },
      groupAdminGroupKeys: ["center"],
      lowAttendance: [
        { courseKey: "fitness", participantKey: "haneul", attended: 4, valid: 13 },
        { courseKey: "art", participantKey: "minjun", attended: 5, valid: 13 },
        { courseKey: "daily", participantKey: "jiwoo", attended: 4, valid: 13 },
        { courseKey: "daily", participantKey: "seungho", attended: 3, valid: 13 },
      ],
      exactFifty: [
        { courseKey: "music", participantKey: "jihu", attended: 6, valid: 12 },
        { courseKey: "art", participantKey: "yerin", attended: 6, valid: 12 },
        { courseKey: "cooking", participantKey: "eunchae", attended: 6, valid: 12 },
        { courseKey: "daily", participantKey: "sebin", attended: 6, valid: 12 },
      ],
      dailyMissingCount: 2,
      todaySessionCounts,
    },
  };

  function participant(key, name, gender, birthYear, hasDisability, courseKey) {
    const memos = {
      haneul: "출석 확인 필요",
      minjun: "출석 확인 필요",
      sumin2: "동명이인 있음 (M-0002 이수민과 다른 사람)",
    };
    return {
      key,
      id: id("participant", key),
      workspace_id: workspaceId,
      name,
      memo: memos[key] ?? null,
      status: "active",
      gender,
      birth_year: birthYear,
      has_disability: hasDisability,
      groupKeys: ["center"],
      courseKey,
    };
  }

  function regularStatus(participantIndex) {
    return (sessionNo) => {
      const value = (participantIndex * 5 + sessionNo * 3) % 11;
      if (value === 0) return "absent";
      if (value === 1) return "partial";
      return "present";
    };
  }

  function course(key, name, instructorKey, startsOffset, startsAt, endsAt) {
    const cardColors = {
      fitness: "#0f766e",
      art: "#7c3aed",
      music: "#2563eb",
      cooking: "#ea580c",
      digital: "#0891b2",
      daily: "#ca8a04",
    };
    return {
      key,
      id: id("course", key),
      workspace_id: workspaceId,
      name,
      status: "in_progress",
      starts_on: addDays(referenceDate, startsOffset),
      ends_on: addDays(referenceDate, 0),
      card_color: cardColors[key] ?? "#2563eb",
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
      progress_status: cancelledSessionKeys.has(key) ? "cancelled" : "scheduled",
      cancellation_reason: cancelledSessionKeys.has(key) ? "강사 개인 사정으로 휴강" : null,
    };
  }
}

function isUuid(value) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
