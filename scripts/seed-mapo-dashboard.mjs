#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

import {
  MAPO_DASHBOARD_ACCOUNTS,
  MAPO_DASHBOARD_BUCKET,
  MAPO_DASHBOARD_PASSWORD,
  MAPO_DASHBOARD_TIMEZONE,
  MAPO_DASHBOARD_WORKSPACE_ID,
  MAPO_DASHBOARD_WORKSPACE_NAME,
  buildMapoDashboardFixture,
} from "./mapo-dashboard-fixture.mjs";
import { deterministicUuid } from "./developer-qa-fixture.mjs";
import { buildAttendanceDashboard } from "../src/services/attendance-dashboard-logic.ts";

const REQUIRED_TABLE_PROJECTIONS = {
  workspaces: "id, name, timezone, created_by",
  workspace_members: "id, workspace_id, user_id, email, role, status",
  workspace_member_groups: "workspace_id, member_id, group_id",
  groups: "id, workspace_id, name, status",
  participants: "id, workspace_id, name, status, deleted_at",
  participant_groups: "workspace_id, participant_id, group_id, status",
  courses: "id, workspace_id, name, status, instructor_member_id, public_visibility",
  course_recurrence_rules: "workspace_id, course_id, repeat_weekdays, session_count",
  course_groups: "workspace_id, course_id, group_id",
  course_participants: "workspace_id, course_id, participant_id, status, assigned_at",
  course_participant_groups: "workspace_id, course_participant_id, group_id",
  course_sessions: "id, workspace_id, course_id, date, visibility_status, rollup_status, progress_status",
  attendance_records: "id, workspace_id, session_id, participant_id, status",
  class_memos: "id, workspace_id, session_id",
};

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.local) {
    throw new Error("This demo seed is local-only. Pass --local explicitly.");
  }
  if (!args.reset && !args.verifyOnly) {
    throw new Error("Choose one mode: --reset or --verify-only.");
  }

  const config = loadLocalConfig(args.referenceDate);
  const fixture = buildMapoDashboardFixture({
    workspaceId: config.workspaceId,
    referenceDate: config.referenceDate,
  });
  const admin = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  await preflight(admin, config);
  if (args.reset) {
    await resetSeed(admin, config, fixture);
  }
  await verifySeed(admin, config, fixture);
  console.log(args.reset ? "Mapo dashboard demo reset and verification passed." : "Mapo dashboard demo verification passed.");
  console.log(JSON.stringify({
    workspaceId: config.workspaceId,
    workspaceName: fixture.workspace.name,
    referenceDate: fixture.referenceDate,
    appUrl: "http://localhost:3000",
    profile: "mapo-dashboard",
    roles: Object.values(config.accounts).map((account) => account.role),
    counts: {
      courses: fixture.courses.length,
      sessions: fixture.sessions.length,
      participants: fixture.participants.length,
      attendanceRecords: fixture.attendanceRecords.length,
    },
    dashboard: {
      dailyMissingCount: fixture.expected.dailyMissingCount,
      lowAttendance: fixture.expected.lowAttendance,
      exactFifty: fixture.expected.exactFifty,
    },
  }, null, 2));
}

main().catch((error) => {
  console.error("Mapo dashboard demo command failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

function parseArgs(rawArgs) {
  const options = {
    local: false,
    reset: false,
    verifyOnly: false,
    referenceDate: undefined,
  };
  for (let index = 0; index < rawArgs.length; index += 1) {
    const value = rawArgs[index];
    if (value === "--local") options.local = true;
    else if (value === "--reset") options.reset = true;
    else if (value === "--verify-only") options.verifyOnly = true;
    else if (value === "--reference-date") {
      options.referenceDate = rawArgs[index + 1];
      if (!options.referenceDate) throw new Error("--reference-date requires YYYY-MM-DD.");
      index += 1;
    } else {
      throw new Error(`Unknown option: ${value}`);
    }
  }
  if (options.reset && options.verifyOnly) {
    throw new Error("Only one execution mode can be used at a time.");
  }
  return options;
}

function loadLocalConfig(referenceDateOverride) {
  let output;
  try {
    output = execFileSync("supabase", ["status", "-o", "json"], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    throw new Error("Local Supabase is not running. Start Docker and run 'supabase start'.");
  }

  let status;
  try {
    status = JSON.parse(output);
  } catch {
    throw new Error("Could not parse 'supabase status -o json' output.");
  }
  const supabaseUrl = status.API_URL ?? status.api_url;
  const anonKey = status.ANON_KEY ?? status.anon_key;
  const serviceRoleKey = status.SERVICE_ROLE_KEY ?? status.service_role_key;
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    throw new Error("Local Supabase status did not include API_URL, ANON_KEY, and SERVICE_ROLE_KEY.");
  }
  return {
    supabaseUrl,
    anonKey,
    serviceRoleKey,
    workspaceId: MAPO_DASHBOARD_WORKSPACE_ID,
    password: MAPO_DASHBOARD_PASSWORD,
    accounts: MAPO_DASHBOARD_ACCOUNTS,
    referenceDate: referenceDateOverride || getSeoulDate(),
  };
}

async function preflight(client, config) {
  const parsedUrl = new URL(config.supabaseUrl);
  if (!['127.0.0.1', 'localhost'].includes(parsedUrl.hostname)) {
    throw new Error("Mapo dashboard demo seed only accepts a local Supabase URL.");
  }
  for (const [table, projection] of Object.entries(REQUIRED_TABLE_PROJECTIONS)) {
    const { error } = await client.from(table).select(projection).limit(0);
    if (error) throw new Error(`Schema preflight failed for ${table}: ${error.message}`);
  }
  const { data: buckets, error: bucketError } = await client.storage.listBuckets();
  if (bucketError) throw new Error(`Storage preflight failed: ${bucketError.message}`);
  if (!(buckets ?? []).some((bucket) => bucket.id === MAPO_DASHBOARD_BUCKET)) {
    throw new Error(`Required storage bucket '${MAPO_DASHBOARD_BUCKET}' does not exist.`);
  }

  const { data: workspace, error: workspaceError } = await client
    .from("workspaces")
    .select("id, name")
    .eq("id", config.workspaceId)
    .maybeSingle();
  if (workspaceError) throw workspaceError;
  if (workspace && workspace.name !== MAPO_DASHBOARD_WORKSPACE_NAME) {
    throw new Error("Configured Mapo demo workspace ID belongs to a different workspace.");
  }
}

async function resetSeed(client, config, fixture) {
  const users = await ensureAuthUsers(client, config);
  await removeStoragePrefix(client, `workspaces/${config.workspaceId}`);

  const { data: existingWorkspace, error: workspaceLookupError } = await client
    .from("workspaces")
    .select("id")
    .eq("id", config.workspaceId)
    .maybeSingle();
  if (workspaceLookupError) throw workspaceLookupError;

  if (existingWorkspace) {
    await resetWorkspaceData(client, config.workspaceId);
    const { error } = await client
      .from("workspaces")
      .update({
        name: fixture.workspace.name,
        timezone: fixture.workspace.timezone,
        created_by: users.owner.id,
      })
      .eq("id", config.workspaceId);
    if (error) throw new Error(`Mapo demo workspace update failed: ${error.message}`);
  } else {
    await insertRows(client, "workspaces", [{
      ...fixture.workspace,
      created_by: users.owner.id,
    }]);
  }

  const members = buildMembers(config, users);
  await upsertRows(client, "workspace_members", Object.values(members));
  await removeUnexpectedMembers(client, config.workspaceId, new Set(Object.values(members).map((row) => row.id)));
  await insertRows(client, "groups", fixture.groups.map(stripFixtureFields));
  await insertRows(client, "workspace_member_groups", [{
    id: deterministicUuid(config.workspaceId, "member-group:operator:center"),
    workspace_id: config.workspaceId,
    member_id: members.operator.id,
    group_id: fixture.groups[0].id,
  }]);
  await insertRows(client, "participants", fixture.participants.map(stripFixtureFields));
  await insertRows(client, "participant_groups", fixture.participantGroups);
  await insertRows(client, "courses", fixture.courses.map((row) => {
    const databaseRow = stripFixtureFields(row);
    delete databaseRow.starts_at;
    delete databaseRow.ends_at;
    return {
      ...databaseRow,
      instructor_member_id: members[row.instructorKey].id,
    };
  }));
  await insertRows(client, "course_recurrence_rules", fixture.courses.map((course) => {
    const courseSessions = fixture.sessions.filter((session) => session.course_id === course.id);
    return {
      id: deterministicUuid(config.workspaceId, `recurrence:${course.key}`),
      workspace_id: config.workspaceId,
      course_id: course.id,
      repeat_weekdays: [weekday(courseSessions[0].date)],
      starts_at: course.starts_at,
      ends_at: course.ends_at,
      session_count: courseSessions.length,
    };
  }));
  await insertRows(client, "course_groups", fixture.courseGroups);
  await insertRows(client, "course_participants", fixture.courseParticipants);
  await insertRows(client, "course_participant_groups", fixture.courseParticipantGroups);
  await insertRows(client, "course_sessions", fixture.sessions.map(stripSessionFixtureFields));
  await insertRows(client, "attendance_records", fixture.attendanceRecords.map((row) => {
    const { instructorKey: _instructorKey, ...databaseRow } = row;
    return {
      ...databaseRow,
      updated_by: members[row.instructorKey].id,
    };
  }));
  await insertRows(client, "class_memos", fixture.classMemos.map((row) => {
    const { instructorKey: _instructorKey, ...databaseRow } = row;
    return {
      ...databaseRow,
      updated_by: members[row.instructorKey].id,
    };
  }));
}

async function verifySeed(client, config, fixture) {
  const users = await signInUsers(config);
  await verifyCounts(client, config.workspaceId, fixture);
  await verifyRoleScopes(users, config, fixture);
  verifyDashboardProjection(fixture);
}

async function verifyCounts(client, workspaceId, fixture) {
  const expectedCounts = {
    workspace_members: Object.keys(MAPO_DASHBOARD_ACCOUNTS).length,
    groups: fixture.groups.length,
    participants: fixture.participants.length,
    participant_groups: fixture.participantGroups.length,
    courses: fixture.courses.length,
    course_groups: fixture.courseGroups.length,
    course_participants: fixture.courseParticipants.length,
    course_participant_groups: fixture.courseParticipantGroups.length,
    course_sessions: fixture.sessions.length,
    attendance_records: fixture.attendanceRecords.length,
    class_memos: fixture.classMemos.length,
    materials: 0,
    general_schedule_items: 0,
    course_feedbacks: 0,
    settlement_requests: 0,
    activity_logs: 0,
    ontology_action_proposals: 0,
    ontology_action_executions: 0,
  };
  for (const [table, expected] of Object.entries(expectedCounts)) {
    const { count, error } = await client
      .from(table)
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", workspaceId);
    if (error) throw new Error(`Count verification failed for ${table}: ${error.message}`);
    assert.equal(count, expected, `${table} count mismatch`);
  }
}

async function signInUsers(config) {
  const users = {};
  for (const [key, account] of Object.entries(config.accounts)) {
    const client = createClient(config.supabaseUrl, config.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await client.auth.signInWithPassword({
      email: account.email,
      password: config.password,
    });
    if (error || !data.user) throw new Error(`Auth verification failed for ${account.role}: ${error?.message}`);
    users[key] = { user: data.user, client };
  }
  return users;
}

async function verifyRoleScopes(users, config, fixture) {
  for (const [key, session] of Object.entries(users)) {
    const account = config.accounts[key];
    const { data: membership, error: membershipError } = await session.client
      .from("workspace_members")
      .select("id, role, status")
      .eq("workspace_id", config.workspaceId)
      .eq("user_id", session.user.id)
      .single();
    if (membershipError) throw new Error(`Membership verification failed for ${account.role}: ${membershipError.message}`);
    assert.equal(membership.role, account.role);
    assert.equal(membership.status, "active");

    const { data: courseRows, error: courseError } = await session.client
      .from("courses")
      .select("id")
      .eq("workspace_id", config.workspaceId);
    if (courseError) throw new Error(`Course scope verification failed for ${key}: ${courseError.message}`);
    const expectedIds = fixture.expected.roleCourseKeys[key]
      .map((courseKey) => fixture.courses.find((course) => course.key === courseKey).id)
      .sort();
    assert.deepEqual((courseRows ?? []).map((row) => row.id).sort(), expectedIds, `${key} course scope mismatch`);
  }

  const { data: groupIds, error: groupError } = await users.operator.client.rpc("accessible_group_ids", {
    target_workspace_id: config.workspaceId,
  });
  if (groupError) throw new Error(`Group scope RPC verification failed: ${groupError.message}`);
  const normalized = (groupIds ?? []).map((row) => typeof row === "string" ? row : row.accessible_group_ids);
  assert.deepEqual(normalized, fixture.expected.groupAdminGroupKeys.map((key) => fixture.groups.find((group) => group.key === key).id));
}

async function ensureAuthUsers(client, config) {
  const users = {};
  for (const [key, account] of Object.entries(config.accounts)) {
    const existing = await findAuthUserByEmail(client, account.email);
    if (existing) {
      const { data, error } = await client.auth.admin.updateUserById(existing.id, {
        password: config.password,
        email_confirm: true,
        user_metadata: { display_name: account.displayName, fixture: "mapo-dashboard-demo" },
      });
      if (error) throw error;
      users[key] = data.user;
    } else {
      const { data, error } = await client.auth.admin.createUser({
        email: account.email,
        password: config.password,
        email_confirm: true,
        user_metadata: { display_name: account.displayName, fixture: "mapo-dashboard-demo" },
      });
      if (error) throw error;
      users[key] = data.user;
    }
  }
  return users;
}

async function insertRows(client, table, rows) {
  if (rows.length === 0) return;
  const { error } = await client.from(table).insert(rows);
  if (error) throw new Error(`Insert failed for ${table}: ${error.message}`);
}

async function upsertRows(client, table, rows) {
  if (rows.length === 0) return;
  const { error } = await client.from(table).upsert(rows, { onConflict: "id" });
  if (error) throw new Error(`Upsert failed for ${table}: ${error.message}`);
}

async function findAuthUserByEmail(client, email) {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const found = data.users.find((user) => user.email === email);
    if (found) return found;
    if (data.users.length < 1000) return null;
  }
  throw new Error("Auth user lookup exceeded 20,000 users.");
}

function buildMembers(config, users) {
  return Object.fromEntries(Object.entries(config.accounts).map(([key, account]) => [key, {
    id: deterministicUuid(config.workspaceId, `member:${key}`),
    workspace_id: config.workspaceId,
    user_id: users[key].id,
    email: account.email,
    display_name: account.displayName,
    role: account.role,
    status: "active",
  }]));
}

async function resetWorkspaceData(client, workspaceId) {
  for (const table of [
    "settlement_requests",
    "instructor_payout_accounts",
    "course_feedbacks",
    "ontology_action_executions",
    "ontology_action_proposals",
    "materials",
    "class_memos",
    "course_participant_groups",
    "attendance_records",
    "course_participants",
    "course_recurrence_rules",
    "course_sessions",
    "course_groups",
    "invites",
    "courses",
    "general_schedule_item_groups",
    "general_schedule_items",
    "participant_groups",
    "workspace_member_groups",
    "workspace_join_requests",
    "activity_logs",
    "groups",
    "participants",
  ]) {
    const { error } = await client.from(table).delete().eq("workspace_id", workspaceId);
    if (error) throw new Error(`Pre-reset cleanup failed for ${table}: ${error.message}`);
  }
}

async function removeUnexpectedMembers(client, workspaceId, expectedIds) {
  const { data, error } = await client
    .from("workspace_members")
    .select("id")
    .eq("workspace_id", workspaceId);
  if (error) throw new Error(`Member cleanup lookup failed: ${error.message}`);
  for (const row of data ?? []) {
    if (expectedIds.has(row.id)) continue;
    const { error: deleteError } = await client.from("workspace_members").delete().eq("id", row.id);
    if (deleteError) throw new Error(`Member cleanup failed: ${deleteError.message}`);
  }
}

async function removeStoragePrefix(client, prefix) {
  const bucket = client.storage.from(MAPO_DASHBOARD_BUCKET);
  const paths = await listStoragePaths(bucket, prefix);
  if (paths.length === 0) return;
  const { error } = await bucket.remove(paths);
  if (error) throw new Error(`Storage cleanup failed: ${error.message}`);
}

async function listStoragePaths(bucket, prefix) {
  const result = [];
  const { data, error } = await bucket.list(prefix, { limit: 1000 });
  if (error) throw error;
  for (const item of data ?? []) {
    const path = `${prefix}/${item.name}`;
    if (item.id) result.push(path);
    else result.push(...(await listStoragePaths(bucket, path)));
  }
  return result;
}

function verifyDashboardProjection(fixture) {
  const participantById = new Map(fixture.participants.map((participant) => [participant.id, participant]));
  const activeAssignments = fixture.courseParticipants.filter((row) => row.status === "active");
  const assignments = activeAssignments.map((row) => ({
    participantId: row.participant_id,
    participantName: participantById.get(row.participant_id).name,
    courseId: row.course_id,
    assignedAt: row.assigned_at,
    status: "active",
  }));
  const records = fixture.attendanceRecords.map((row) => ({
    sessionId: row.session_id,
    participantId: row.participant_id,
    status: row.status,
    note: row.note,
  }));

  const projection = buildAttendanceDashboard({
    selectedDate: fixture.referenceDate,
    now: `${fixture.referenceDate}T18:00:00+09:00`,
    timezone: MAPO_DASHBOARD_TIMEZONE,
    courses: fixture.courses.map((course) => ({ id: course.id, name: course.name, status: course.status })),
    sessions: fixture.sessions.map((session) => ({
      id: session.id,
      courseId: session.course_id,
      sessionNo: session.session_no,
      date: session.date,
      startsAt: session.starts_at,
      endsAt: session.ends_at,
      rollupStatus: session.rollup_status,
      progressStatus: session.progress_status,
    })),
    participants: assignments,
    records,
  });
  assert.equal(projection.summary.missingAttendanceCount, fixture.expected.dailyMissingCount);
  assert.equal(projection.summary.lowAttendanceParticipantCount, fixture.expected.lowAttendance.length);

  const fitness = projection.courses.find((course) => course.id === fixture.courses.find((item) => item.key === "fitness").id);
  const art = projection.courses.find((course) => course.id === fixture.courses.find((item) => item.key === "art").id);
  const music = projection.courses.find((course) => course.id === fixture.courses.find((item) => item.key === "music").id);
  assert.deepEqual(
    [fitness.dailySessions[0], art.dailySessions[0], music.dailySessions[0]].map((session) => ({
      present: session.presentCount,
      partial: session.partialCount,
      absent: session.absentCount,
      missing: session.missingAttendanceCount,
    })),
    [
      { present: 4, partial: 2, absent: 2, missing: 0 },
      { present: 4, partial: 0, absent: 1, missing: 1 },
      { present: 2, partial: 0, absent: 2, missing: 1 },
    ],
  );
  for (const boundary of fixture.expected.lowAttendance) {
    const course = projection.courses.find((item) => item.id === fixture.courses.find((row) => row.key === boundary.courseKey).id);
    const participant = course.participants.find((item) => item.participantId === fixture.participants.find((row) => row.key === boundary.participantKey).id);
    assert.deepEqual(
      { attended: participant.attendedSessionCount, valid: participant.validSessionCount },
      { attended: boundary.attended, valid: boundary.valid },
    );
    assert.ok(course.lowAttendanceParticipantIds.includes(participant.participantId));
  }
  for (const boundary of fixture.expected.exactFifty) {
    const course = projection.courses.find((item) => item.id === fixture.courses.find((row) => row.key === boundary.courseKey).id);
    const participant = course.participants.find((item) => item.participantId === fixture.participants.find((row) => row.key === boundary.participantKey).id);
    assert.deepEqual(
      { attended: participant.attendedSessionCount, valid: participant.validSessionCount },
      { attended: boundary.attended, valid: boundary.valid },
    );
    assert.equal(course.lowAttendanceParticipantIds.includes(participant.participantId), false);
  }
}

function stripFixtureFields(row) {
  const {
    key: _key,
    groupKeys: _groupKeys,
    instructorKey: _instructorKey,
    starts_at: _startsAt,
    ends_at: _endsAt,
    ...databaseRow
  } = row;
  return databaseRow;
}

function stripSessionFixtureFields(row) {
  const { key: _key, ...databaseRow } = row;
  return databaseRow;
}

function weekday(isoDate) {
  return new Date(`${isoDate}T12:00:00+09:00`).getUTCDay();
}

function getSeoulDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: MAPO_DASHBOARD_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
