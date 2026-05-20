#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

export const DARORI_WORKSPACE_NAME = "다로리인 유저테스트";
export const DARORI_TEST_PASSWORD = "123456";

export const DARORI_TEST_ACCOUNTS = [
  {
    key: "owner",
    email: "darori.owner@test.local",
    password: DARORI_TEST_PASSWORD,
    displayName: "다로리 대표 운영자",
    role: "owner_admin",
  },
  {
    key: "instructor",
    email: "darori.instructor@test.local",
    password: DARORI_TEST_PASSWORD,
    displayName: "다로리 강사",
    role: "instructor",
  },
  {
    key: "group",
    email: "darori.group@test.local",
    password: DARORI_TEST_PASSWORD,
    displayName: "다로리 그룹 운영자",
    role: "group_admin",
  },
];

const ROLE_ASSIGNMENT_LABELS = {
  owner: "대표 운영자",
  instructor: "강사",
};

export function buildDaroriAccountsForLabel(label = "") {
  if (!label) return DARORI_TEST_ACCOUNTS;
  return DARORI_TEST_ACCOUNTS.map((account) => ({
    ...account,
    email: `darori.${account.key}+${label}@test.local`,
    displayName: `${account.displayName} ${label}`,
  }));
}

export function buildDaroriSeedSpec({
  label = "",
  assignmentRole = "owner",
} = {}) {
  return {
    label,
    assignmentRole,
    workspaceName: label ? `${DARORI_WORKSPACE_NAME} ${label}` : DARORI_WORKSPACE_NAME,
    accounts: buildDaroriAccountsForLabel(label),
  };
}

export function buildDaroriGoogleFormSeedSpecs({
  ownerCount = 10,
  instructorCount = 10,
} = {}) {
  const specs = [];
  for (let index = 1; index <= ownerCount; index += 1) {
    specs.push(
      buildDaroriSeedSpec({
        label: `owner${String(index).padStart(2, "0")}`,
        assignmentRole: "owner",
      }),
    );
  }
  for (let index = 1; index <= instructorCount; index += 1) {
    specs.push(
      buildDaroriSeedSpec({
        label: `instructor${String(index).padStart(2, "0")}`,
        assignmentRole: "instructor",
      }),
    );
  }
  return specs;
}

export function buildDaroriGoogleFormAssignmentRows(specs) {
  return specs.map((spec) => {
    const account = spec.accounts.find((item) => item.key === spec.assignmentRole);
    return {
      participantId: spec.label || spec.assignmentRole,
      role: ROLE_ASSIGNMENT_LABELS[spec.assignmentRole] ?? spec.assignmentRole,
      email: account.email,
      password: account.password,
      workspace: spec.workspaceName,
      appUrl: "https://dure-user-test-dure-s-projects.vercel.app",
    };
  });
}

export const DARORI_TEST_GROUPS = [
  "다로리마을학교",
  "노는 엄마들",
  "그로우그루",
  "읍성마을학교",
  "에제르마을학교",
  "배단내마을학교",
  "토리마을학교",
];

export const DARORI_TEST_PARTICIPANTS = [
  { name: "김다온", group: "다로리마을학교", memo: "음원 활동에 관심이 많음" },
  { name: "이다은", group: "다로리마을학교" },
  { name: "박서준", group: "다로리마을학교" },
  { name: "최하린", group: "다로리마을학교" },
  { name: "정유찬", group: "다로리마을학교" },
  { name: "한지우", group: "노는 엄마들", memo: "요리 활동 참여 가능" },
  { name: "오민서", group: "노는 엄마들" },
  { name: "서윤아", group: "노는 엄마들" },
  { name: "강하준", group: "노는 엄마들" },
  { name: "문소율", group: "노는 엄마들" },
  { name: "윤채원", group: "그로우그루" },
  { name: "임도윤", group: "그로우그루" },
  { name: "조예린", group: "그로우그루" },
  { name: "백시우", group: "그로우그루" },
  { name: "신유나", group: "읍성마을학교" },
  { name: "전민재", group: "읍성마을학교" },
  { name: "홍서아", group: "읍성마을학교" },
  { name: "양준호", group: "읍성마을학교" },
  { name: "배하율", group: "에제르마을학교" },
  { name: "남지호", group: "에제르마을학교" },
  { name: "고서연", group: "에제르마을학교" },
  { name: "유태오", group: "에제르마을학교" },
  { name: "권나윤", group: "배단내마을학교" },
  { name: "장우진", group: "배단내마을학교" },
  { name: "차은서", group: "배단내마을학교" },
  { name: "류도현", group: "배단내마을학교" },
  { name: "송아린", group: "배단내마을학교" },
  { name: "마지안", group: "토리마을학교" },
  { name: "길서현", group: "토리마을학교" },
  { name: "도윤재", group: "토리마을학교" },
  { name: "표하은", group: "토리마을학교" },
  { name: "원지민", group: "토리마을학교" },
];

export const DARORI_TEST_COURSES = [
  {
    name: "마을학교 음원출시",
    group: "다로리마을학교",
    status: "in_progress",
    instructor: true,
    sessionCount: 4,
    startOffset: -14,
    time: ["10:00", "12:00"],
    color: "#7c3aed",
  },
  {
    name: "방과후, 캠핑",
    group: "노는 엄마들",
    status: "in_progress",
    instructor: true,
    sessionCount: 5,
    startOffset: -14,
    time: ["15:00", "17:00"],
    color: "#0f766e",
  },
  {
    name: "그림책 속으로",
    group: "그로우그루",
    status: "in_progress",
    sessionCount: 4,
    startOffset: -7,
    time: ["13:30", "15:00"],
    color: "#2563eb",
  },
  {
    name: "꼬마 창업가 교실",
    group: "읍성마을학교",
    status: "in_progress",
    sessionCount: 6,
    startOffset: -21,
    time: ["16:00", "18:00"],
    color: "#c2410c",
  },
  {
    name: "동네 생태 탐험",
    group: "에제르마을학교",
    status: "in_progress",
    sessionCount: 5,
    startOffset: -10,
    time: ["09:30", "11:30"],
    color: "#15803d",
  },
  {
    name: "목공학교",
    group: "배단내마을학교",
    status: "completed",
    sessionCount: 4,
    startOffset: -56,
    time: ["14:00", "16:00"],
    color: "#a16207",
  },
  {
    name: "내 아이와의 대화법",
    group: "노는 엄마들",
    status: "completed",
    sessionCount: 3,
    startOffset: -35,
    time: ["19:00", "21:00"],
    color: "#be123c",
  },
  {
    name: "꼬마 사물놀이패",
    group: "토리마을학교",
    status: "planned",
    sessionCount: 4,
    startOffset: 7,
    time: ["10:00", "12:00"],
    color: "#4338ca",
  },
  {
    name: "동네 쓰·담데이",
    group: "다로리마을학교",
    status: "planned",
    sessionCount: 1,
    startOffset: 14,
    time: ["09:00", "11:00"],
    color: "#047857",
  },
];

const MATERIAL_FIXTURES = [
  {
    courseName: "마을학교 음원출시",
    title: "가사 초안 활동지.txt",
    filename: "가사 초안 활동지.txt",
    storageFilename: "lyrics-draft.txt",
    body: "마을학교 음원출시 수업용 가사 초안 활동지입니다.\n좋아하는 장소와 기억나는 소리를 적어 봅니다.\n",
  },
  {
    courseName: "방과후, 캠핑",
    title: "캠핑 안전 안내.txt",
    filename: "캠핑 안전 안내.txt",
    storageFilename: "camping-safety.txt",
    body: "방과후, 캠핑 수업 안전 안내입니다.\n밧줄놀이 전 안전 거리와 준비운동을 확인합니다.\n",
  },
];

export function buildDaroriSeedSummary() {
  return {
    workspace: DARORI_WORKSPACE_NAME,
    accounts: DARORI_TEST_ACCOUNTS.length,
    groups: DARORI_TEST_GROUPS.length,
    participants: DARORI_TEST_PARTICIPANTS.length,
    courses: DARORI_TEST_COURSES.length,
    materials: MATERIAL_FIXTURES.length,
    attendanceSessions: 2,
    activityLogs: 8,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const specs = options.googleForm
    ? buildDaroriGoogleFormSeedSpecs({
        ownerCount: options.ownerCount,
        instructorCount: options.instructorCount,
      })
    : [buildDaroriSeedSpec()];
  const summary = options.googleForm
    ? buildDaroriBatchSeedSummary(specs)
    : buildDaroriSeedSummary();

  if (options.dryRun) {
    console.log(JSON.stringify(summary, null, 2));
    if (options.googleForm) {
      printAssignmentRows(buildDaroriGoogleFormAssignmentRows(specs));
    }
    return;
  }

  const env = loadEnv();
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required. Check .env.local.",
    );
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const results = [];
  for (const spec of specs) {
    console.log(`Seeding ${spec.workspaceName}...`);
    results.push(await seedDaroriWorkspace(admin, spec));
  }

  console.log("Darori user test seed completed.");
  console.log(JSON.stringify({ ...summary, workspaces: results }, null, 2));
  if (options.googleForm) {
    printAssignmentRows(buildDaroriGoogleFormAssignmentRows(specs));
  }
}

function parseArgs(args) {
  const options = {
    dryRun: false,
    googleForm: false,
    ownerCount: 10,
    instructorCount: 10,
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--google-form") options.googleForm = true;
    else if (arg === "--owner-count") {
      options.ownerCount = Number.parseInt(args[index + 1] ?? "", 10);
      index += 1;
    } else if (arg === "--instructor-count") {
      options.instructorCount = Number.parseInt(args[index + 1] ?? "", 10);
      index += 1;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
  if (!Number.isInteger(options.ownerCount) || options.ownerCount < 0) {
    throw new Error("--owner-count must be a non-negative integer.");
  }
  if (!Number.isInteger(options.instructorCount) || options.instructorCount < 0) {
    throw new Error("--instructor-count must be a non-negative integer.");
  }
  return options;
}

function buildDaroriBatchSeedSummary(specs) {
  const assignmentRows = buildDaroriGoogleFormAssignmentRows(specs);
  return {
    workspacePrefix: DARORI_WORKSPACE_NAME,
    workspaces: specs.length,
    ownerAssignments: assignmentRows.filter((row) => row.role === "대표 운영자").length,
    instructorAssignments: assignmentRows.filter((row) => row.role === "강사").length,
    authAccounts: specs.length * DARORI_TEST_ACCOUNTS.length,
    groupsPerWorkspace: DARORI_TEST_GROUPS.length,
    participantsPerWorkspace: DARORI_TEST_PARTICIPANTS.length,
    coursesPerWorkspace: DARORI_TEST_COURSES.length,
  };
}

function printAssignmentRows(rows) {
  console.log("\nparticipant_id,role,email,password,workspace,app_url");
  for (const row of rows) {
    console.log(
      [
        row.participantId,
        row.role,
        row.email,
        row.password,
        row.workspace,
        row.appUrl,
      ].join(","),
    );
  }
}

async function seedDaroriWorkspace(admin, spec) {
  await cleanupExistingSeed(admin, spec);

  const users = await createAuthUsers(admin, spec.accounts);
  const ownerUser = users.get("owner");
  if (!ownerUser) throw new Error("Owner user was not created.");

  const workspace = await insertSingle(admin, "workspaces", {
    name: spec.workspaceName,
    timezone: "Asia/Seoul",
    created_by: ownerUser.id,
  });

  const members = await createMembers(admin, workspace.id, users, spec.accounts);
  const groups = await createGroups(admin, workspace.id);
  await createGroupAdminScope(admin, workspace.id, members, groups);

  const participants = await createParticipants(admin, workspace.id, members, groups);
  const courses = await createCourses(admin, workspace.id, members, groups, participants);
  const sessions = await createSessions(admin, workspace.id, courses);
  await createAttendanceAndMemos(admin, workspace.id, members, participants, courses, sessions);
  const materials = await createMaterials(admin, workspace.id, members, courses);
  await createActivityLogs(admin, workspace.id, members, courses, materials, sessions, spec.accounts);
  return {
    label: spec.label,
    workspaceId: workspace.id,
    workspace: spec.workspaceName,
  };
}

function loadEnv() {
  const env = { ...process.env };
  for (const filename of [".env.local", ".env"]) {
    try {
      const content = readFileSync(resolve(process.cwd(), filename), "utf8");
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
        const [key, ...rest] = trimmed.split("=");
        if (env[key]) continue;
        env[key] = rest.join("=").replace(/^['"]|['"]$/g, "");
      }
    } catch {
      // Optional file.
    }
  }
  return env;
}

async function cleanupExistingSeed(admin, spec) {
  const { data: workspaces, error } = await admin
    .from("workspaces")
    .select("id")
    .eq("name", spec.workspaceName);
  if (error) throw error;

  const archiveSuffix = new Date().toISOString().replace(/[:.]/g, "-");
  for (const workspace of workspaces ?? []) {
    await removeStoragePrefix(admin, `workspaces/${workspace.id}`);
    await checked(
      admin
        .from("workspace_members")
        .update({ user_id: null })
        .eq("workspace_id", workspace.id)
        .in(
          "email",
          spec.accounts.map((account) => account.email),
        ),
    );
    await checked(
      admin
        .from("workspaces")
        .update({ name: `${spec.workspaceName} (archived ${archiveSuffix})` })
        .eq("id", workspace.id),
    );
  }
}

async function removeStoragePrefix(admin, prefix) {
  const bucket = admin.storage.from("course-materials");
  const paths = await listStoragePaths(bucket, prefix);
  if (paths.length > 0) {
    const { error } = await bucket.remove(paths);
    if (error) throw error;
  }
}

async function listStoragePaths(bucket, prefix) {
  const result = [];
  const { data, error } = await bucket.list(prefix, { limit: 1000 });
  if (error) return result;
  for (const item of data ?? []) {
    const path = `${prefix}/${item.name}`;
    if (item.id) {
      result.push(path);
    } else {
      result.push(...(await listStoragePaths(bucket, path)));
    }
  }
  return result;
}

async function createAuthUsers(admin, accounts) {
  const users = new Map();
  for (const account of accounts) {
    const existingUser = await findAuthUserByEmail(admin, account.email);
    if (existingUser) {
      const { data, error } = await admin.auth.admin.updateUserById(existingUser.id, {
        password: account.password,
        email_confirm: true,
        user_metadata: { display_name: account.displayName },
      });
      if (error) throw error;
      users.set(account.key, data.user);
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email: account.email,
        password: account.password,
        email_confirm: true,
        user_metadata: { display_name: account.displayName },
      });
      if (error) throw error;
      users.set(account.key, data.user);
    }
  }
  return users;
}

async function findAuthUserByEmail(admin, email) {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (error) throw error;
    const found = data.users.find((user) => user.email === email);
    if (found) return found;
    if (data.users.length < 1000) break;
  }
  return null;
}

async function createMembers(admin, workspaceId, users, accounts) {
  const rows = accounts.map((account) => ({
    workspace_id: workspaceId,
    user_id: users.get(account.key)?.id,
    email: account.email,
    display_name: account.displayName,
    role: account.role,
    status: "active",
  }));
  const { data, error } = await admin.from("workspace_members").insert(rows).select();
  if (error) throw error;
  return indexBy(data, (row) => row.role);
}

async function createGroups(admin, workspaceId) {
  const { data, error } = await admin
    .from("groups")
    .insert(
      DARORI_TEST_GROUPS.map((name) => ({
        workspace_id: workspaceId,
        name,
        description: `${name} 유저 테스트 그룹`,
        status: "active",
      })),
    )
    .select();
  if (error) throw error;
  return indexBy(data, (row) => row.name);
}

async function createGroupAdminScope(admin, workspaceId, members, groups) {
  await checked(
    admin.from("workspace_member_groups").insert({
      workspace_id: workspaceId,
      member_id: members.get("group_admin").id,
      group_id: groups.get("노는 엄마들").id,
    }),
  );
}

async function createParticipants(admin, workspaceId, members, groups) {
  const owner = members.get("owner_admin");
  const participantRows = DARORI_TEST_PARTICIPANTS.map((participant) => ({
    workspace_id: workspaceId,
    name: participant.name,
    memo: participant.memo ?? null,
    status: "active",
    created_by: owner.id,
  }));
  const { data, error } = await admin.from("participants").insert(participantRows).select();
  if (error) throw error;

  const byName = indexBy(data, (row) => row.name);
  await checked(
    admin.from("participant_groups").insert(
      DARORI_TEST_PARTICIPANTS.map((participant) => ({
        workspace_id: workspaceId,
        participant_id: byName.get(participant.name).id,
        group_id: groups.get(participant.group).id,
        status: "active",
      })),
    ),
  );
  return byName;
}

async function createCourses(admin, workspaceId, members, groups, participants) {
  const result = new Map();
  for (const course of DARORI_TEST_COURSES) {
    const startsOn = isoDate(course.startOffset);
    const endsOn = isoDate(course.startOffset + 7 * (course.sessionCount - 1));
    const row = await insertSingle(admin, "courses", {
      workspace_id: workspaceId,
      name: course.name,
      status: course.status,
      starts_on: startsOn,
      ends_on: endsOn,
      instructor_member_id: course.instructor ? members.get("instructor").id : null,
      card_color: course.color,
    });
    result.set(course.name, { ...course, id: row.id, startsOn, endsOn });

    const group = groups.get(course.group);
    await checked(
      admin.from("course_groups").insert({
        workspace_id: workspaceId,
        course_id: row.id,
        group_id: group.id,
        group_name_snapshot: group.name,
      }),
    );

    const groupParticipants = DARORI_TEST_PARTICIPANTS.filter((p) => p.group === course.group);
    const courseParticipantRows = groupParticipants.map((participant) => ({
      workspace_id: workspaceId,
      course_id: row.id,
      participant_id: participants.get(participant.name).id,
      participant_name_snapshot: participant.name,
      status: "active",
    }));
    const { data: courseParticipants, error } = await admin
      .from("course_participants")
      .insert(courseParticipantRows)
      .select();
    if (error) throw error;

    await checked(
      admin.from("course_participant_groups").insert(
        courseParticipants.map((courseParticipant) => ({
          workspace_id: workspaceId,
          course_participant_id: courseParticipant.id,
          group_id: group.id,
          group_name_snapshot: group.name,
        })),
      ),
    );

    await checked(
      admin.from("course_recurrence_rules").insert({
        workspace_id: workspaceId,
        course_id: row.id,
        repeat_weekdays: [weekday(startsOn)],
        starts_at: course.time[0],
        ends_at: course.time[1],
        session_count: course.sessionCount,
      }),
    );
  }
  return result;
}

async function createSessions(admin, workspaceId, courses) {
  const result = new Map();
  for (const course of courses.values()) {
    const rows = Array.from({ length: course.sessionCount }, (_, index) => ({
      workspace_id: workspaceId,
      course_id: course.id,
      session_no: index + 1,
      date: isoDate(course.startOffset + index * 7),
      starts_at: course.time[0],
      ends_at: course.time[1],
      type: "regular",
      visibility_status: "visible",
      rollup_status: "included",
      progress_status: "scheduled",
    }));
    const { data, error } = await admin.from("course_sessions").insert(rows).select();
    if (error) throw error;
    result.set(course.name, indexBy(data, (row) => row.session_no));
  }
  return result;
}

async function createAttendanceAndMemos(admin, workspaceId, members, participants, courses, sessions) {
  const instructor = members.get("instructor");
  const camping = courses.get("방과후, 캠핑");
  const campingSessions = sessions.get("방과후, 캠핑");
  const campingParticipants = DARORI_TEST_PARTICIPANTS.filter((p) => p.group === camping.group);

  for (const sessionNo of [1, 2]) {
    await checked(
      admin.from("attendance_records").insert(
        campingParticipants.map((participant, index) => ({
          workspace_id: workspaceId,
          session_id: campingSessions.get(sessionNo).id,
          participant_id: participants.get(participant.name).id,
          participant_name_snapshot: participant.name,
          status: index === 0 && sessionNo === 2 ? "partial" : "present",
          note: index === 0 && sessionNo === 2 ? "중간 귀가" : null,
          updated_by: instructor.id,
        })),
      ),
    );
  }

  await checked(
    admin.from("class_memos").insert([
      {
        workspace_id: workspaceId,
        session_id: campingSessions.get(1).id,
        content: "텐트 설치 활동을 중심으로 진행했고, 준비물 확인이 원활했습니다.",
        updated_by: instructor.id,
      },
      {
        workspace_id: workspaceId,
        session_id: sessions.get("마을학교 음원출시").get(1).id,
        content: "각자 마을에서 기억나는 소리를 말로 풀어 보는 시간을 가졌습니다.",
        updated_by: instructor.id,
      },
    ]),
  );
}

async function createMaterials(admin, workspaceId, members, courses) {
  const bucket = admin.storage.from("course-materials");
  const result = new Map();
  for (const fixture of MATERIAL_FIXTURES) {
    const materialId = randomUUID();
    const course = courses.get(fixture.courseName);
    const path = `workspaces/${workspaceId}/courses/${course.id}/materials/${materialId}/${fixture.storageFilename}`;
    const { error: uploadError } = await bucket.upload(path, fixture.body, {
      contentType: "text/plain",
      upsert: true,
    });
    if (uploadError) throw uploadError;

    const material = await insertSingle(admin, "materials", {
      id: materialId,
      workspace_id: workspaceId,
      course_id: course.id,
      title: fixture.title,
      description: "다로리인 유저 테스트용 자료",
      storage_path: path,
      original_filename: fixture.filename,
      mime_type: "text/plain",
      size_bytes: Buffer.byteLength(fixture.body),
      uploaded_by: members.get("owner_admin").id,
      upload_status: "uploaded",
      review_status: "reviewed",
      visibility_scope: "admin_only",
    });
    result.set(fixture.title, material);
  }
  return result;
}

async function createActivityLogs(admin, workspaceId, members, courses, materials, sessions, accounts) {
  const owner = members.get("owner_admin");
  const instructor = members.get("instructor");
  const instructorAccount = accounts.find((account) => account.key === "instructor");
  const groupAccount = accounts.find((account) => account.key === "group");
  const music = courses.get("마을학교 음원출시");
  const camping = courses.get("방과후, 캠핑");
  const campingSession1 = sessions.get("방과후, 캠핑").get(1);

  await checked(
    admin.from("activity_logs").insert([
      {
        workspace_id: workspaceId,
        actor_member_id: owner.id,
        event_type: "course_created",
        target_type: "course",
        target_id: music.id,
        metadata: { courseId: music.id, courseName: music.name },
      },
      {
        workspace_id: workspaceId,
        actor_member_id: owner.id,
        event_type: "material_uploaded",
        target_type: "material",
        target_id: materials.get("가사 초안 활동지.txt").id,
        metadata: { courseId: music.id, courseName: music.name },
      },
      {
        workspace_id: workspaceId,
        actor_member_id: instructor.id,
        event_type: "attendance_saved",
        target_type: "attendance",
        target_id: campingSession1.id,
        metadata: { courseId: camping.id, courseName: camping.name, sessionNo: 1 },
      },
      {
        workspace_id: workspaceId,
        actor_member_id: instructor.id,
        event_type: "class_memo_saved",
        target_type: "class_memo",
        target_id: campingSession1.id,
        metadata: { courseId: camping.id, courseName: camping.name, sessionNo: 1 },
      },
      {
        workspace_id: workspaceId,
        actor_member_id: owner.id,
        event_type: "member_invited",
        target_type: "member",
        target_id: instructor.id,
        metadata: { role: "instructor", email: instructorAccount?.email },
      },
      {
        workspace_id: workspaceId,
        actor_member_id: owner.id,
        event_type: "course_created",
        target_type: "course",
        target_id: camping.id,
        metadata: { courseId: camping.id, courseName: camping.name },
      },
      {
        workspace_id: workspaceId,
        actor_member_id: owner.id,
        event_type: "material_uploaded",
        target_type: "material",
        target_id: materials.get("캠핑 안전 안내.txt").id,
        metadata: { courseId: camping.id, courseName: camping.name },
      },
      {
        workspace_id: workspaceId,
        actor_member_id: owner.id,
        event_type: "member_invited",
        target_type: "member",
        target_id: members.get("group_admin").id,
        metadata: { role: "group_admin", email: groupAccount?.email },
      },
    ]),
  );
}

async function insertSingle(admin, table, row) {
  const { data, error } = await admin.from(table).insert(row).select().single();
  if (error) throw error;
  return data;
}

async function checked(promise) {
  const { error } = await promise;
  if (error) throw error;
}

function indexBy(rows, keyFn) {
  const result = new Map();
  for (const row of rows ?? []) result.set(keyFn(row), row);
  return result;
}

function isoDate(offsetDays) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function weekday(isoDateValue) {
  return new Date(`${isoDateValue}T12:00:00+09:00`).getDay();
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isDirectRun) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
