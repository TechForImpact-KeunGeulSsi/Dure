#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

import {
  DEFAULT_DEVELOPER_QA_ACCOUNTS,
  DEVELOPER_QA_BUCKET,
  DEVELOPER_QA_WORKSPACE_NAME,
  buildDeveloperQaFixture,
  deterministicUuid,
  getSeoulDate,
} from "./developer-qa-fixture.mjs";

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
  course_participants: "workspace_id, course_id, participant_id, status",
  course_participant_groups: "workspace_id, course_participant_id, group_id",
  course_sessions: "id, workspace_id, course_id, date, visibility_status, rollup_status, progress_status",
  materials: "id, workspace_id, course_id, upload_status, review_status, visibility_scope",
  general_schedule_items: "id, workspace_id, date",
  general_schedule_item_groups: "workspace_id, schedule_item_id, group_id",
  attendance_records: "id, workspace_id, session_id, participant_id, status",
  class_memos: "id, workspace_id, session_id",
  activity_logs: "id, workspace_id, event_type",
  instructor_payout_accounts: "id, workspace_id, user_id",
  settlement_requests: "id, workspace_id, course_id, status",
  settlement_request_items: "id, settlement_request_id, subtotal",
  settlement_request_receipts: "id, settlement_request_id, storage_path",
  course_feedbacks: "id, workspace_id, course_id, status",
  ontology_action_proposals: "id, workspace_id, target_id, status",
  ontology_action_executions: "id, workspace_id, proposal_id, status",
};

const LOCAL_QA_WORKSPACE_ID = "d0000000-0000-4000-8000-000000000001";
const LOCAL_QA_PASSWORD = "dure-local-qa-password";

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.dryRun && !args.reset && !args.verifyOnly) {
    throw new Error("Choose one mode: --dry-run, --reset, or --verify-only.");
  }
  const env = loadEnv();
  const config = args.local
    ? loadLocalConfig(env, args.referenceDate)
    : loadRemoteConfig(env, args.referenceDate);
  const fixture = buildDeveloperQaFixture({
    workspaceId: config.workspaceId,
    referenceDate: config.referenceDate,
  });
  const admin = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  await preflight(admin, config);

  if (args.dryRun) {
    printResult("Developer QA dry run passed preflight.", fixture, config);
  } else if (args.verifyOnly) {
    await verifySeed(admin, config, fixture);
    printResult("Developer QA verification passed.", fixture, config);
  } else if (args.reset) {
    await resetSeed(admin, config, fixture);
    await verifySeed(admin, config, fixture);
    printResult("Developer QA reset and verification passed.", fixture, config);
  }
}

main().catch((error) => {
  console.error("Developer QA command failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

function parseArgs(rawArgs) {
  const options = {
    dryRun: false,
    reset: false,
    verifyOnly: false,
    local: false,
    referenceDate: undefined,
  };
  for (let index = 0; index < rawArgs.length; index += 1) {
    const value = rawArgs[index];
    if (value === "--dry-run") options.dryRun = true;
    else if (value === "--reset") options.reset = true;
    else if (value === "--verify-only") options.verifyOnly = true;
    else if (value === "--local") options.local = true;
    else if (value === "--reference-date") {
      options.referenceDate = rawArgs[index + 1];
      if (!options.referenceDate) throw new Error("--reference-date requires YYYY-MM-DD.");
      index += 1;
    } else {
      throw new Error(`Unknown option: ${value}`);
    }
  }
  const modeCount = [options.dryRun, options.reset, options.verifyOnly].filter(Boolean).length;
  if (modeCount > 1) throw new Error("Only one execution mode can be used at a time.");
  return options;
}

function loadRemoteConfig(source, referenceDateOverride) {
  const required = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "DURE_QA_ALLOWED_PROJECT_REFS",
    "DURE_QA_WORKSPACE_ID",
    "DURE_QA_PASSWORD",
  ];
  const missing = required.filter((key) => !source[key]);
  if (missing.length > 0) throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  if (source.DURE_QA_PASSWORD.length < 12) {
    throw new Error("DURE_QA_PASSWORD must contain at least 12 characters.");
  }

  const accounts = {
    owner: {
      ...DEFAULT_DEVELOPER_QA_ACCOUNTS.owner,
      email: source.DURE_QA_OWNER_EMAIL || DEFAULT_DEVELOPER_QA_ACCOUNTS.owner.email,
    },
    groupAdmin: {
      ...DEFAULT_DEVELOPER_QA_ACCOUNTS.groupAdmin,
      email: source.DURE_QA_GROUP_ADMIN_EMAIL || DEFAULT_DEVELOPER_QA_ACCOUNTS.groupAdmin.email,
    },
    instructor: {
      ...DEFAULT_DEVELOPER_QA_ACCOUNTS.instructor,
      email: source.DURE_QA_INSTRUCTOR_EMAIL || DEFAULT_DEVELOPER_QA_ACCOUNTS.instructor.email,
    },
  };
  const emails = Object.values(accounts).map((account) => account.email.toLowerCase());
  if (new Set(emails).size !== emails.length) {
    throw new Error("Developer QA account emails must be distinct.");
  }

  return {
    supabaseUrl: source.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: source.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    serviceRoleKey: source.SUPABASE_SERVICE_ROLE_KEY,
    allowedProjectRefs: source.DURE_QA_ALLOWED_PROJECT_REFS.split(",").map((value) => value.trim()).filter(Boolean),
    workspaceId: source.DURE_QA_WORKSPACE_ID,
    password: source.DURE_QA_PASSWORD,
    accounts,
    referenceDate: referenceDateOverride || getSeoulDate(),
    appUrl: source.DURE_QA_APP_URL || source.APP_URL || null,
  };
}

function loadLocalConfig(source, referenceDateOverride) {
  let output;
  try {
    output = execFileSync("supabase", ["status", "-o", "json"], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    throw new Error(
      "Local Supabase is not running. Start Docker, run 'supabase start', and retry with --local.",
    );
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

  return loadRemoteConfig(
    {
      ...source,
      NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
      SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
      DURE_QA_ALLOWED_PROJECT_REFS: "local",
      DURE_QA_WORKSPACE_ID: LOCAL_QA_WORKSPACE_ID,
      DURE_QA_PASSWORD: LOCAL_QA_PASSWORD,
      DURE_QA_OWNER_EMAIL: DEFAULT_DEVELOPER_QA_ACCOUNTS.owner.email,
      DURE_QA_GROUP_ADMIN_EMAIL: DEFAULT_DEVELOPER_QA_ACCOUNTS.groupAdmin.email,
      DURE_QA_INSTRUCTOR_EMAIL: DEFAULT_DEVELOPER_QA_ACCOUNTS.instructor.email,
      DURE_QA_APP_URL: source.DURE_QA_APP_URL || "http://localhost:3000",
    },
    referenceDateOverride,
  );
}

async function preflight(client, config) {
  const targetRef = getSupabaseProjectRef(config.supabaseUrl);
  if (!config.allowedProjectRefs.includes(targetRef)) {
    throw new Error(`Supabase project ref '${targetRef}' is not in DURE_QA_ALLOWED_PROJECT_REFS.`);
  }
  const jwtPayload = decodeJwtPayload(config.serviceRoleKey);
  if (jwtPayload.role !== "service_role") {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY must be a service_role JWT.");
  }

  for (const [table, projection] of Object.entries(REQUIRED_TABLE_PROJECTIONS)) {
    const { error } = await client.from(table).select(projection).limit(0);
    if (error) throw new Error(`Schema preflight failed for ${table}: ${error.message}`);
  }

  const { data: buckets, error: bucketError } = await client.storage.listBuckets();
  if (bucketError) throw new Error(`Storage preflight failed: ${bucketError.message}`);
  if (!(buckets ?? []).some((bucket) => bucket.id === DEVELOPER_QA_BUCKET)) {
    throw new Error(`Required storage bucket '${DEVELOPER_QA_BUCKET}' does not exist.`);
  }

  const { data: existingWorkspace, error: workspaceError } = await client
    .from("workspaces")
    .select("id, name, created_by")
    .eq("id", config.workspaceId)
    .maybeSingle();
  if (workspaceError) throw workspaceError;
  if (!existingWorkspace) return;
  if (existingWorkspace.name !== DEVELOPER_QA_WORKSPACE_NAME) {
    throw new Error("Configured workspace ID belongs to a workspace with a different name.");
  }

  const ownerUser = await findAuthUserByEmail(client, config.accounts.owner.email);
  if (!ownerUser || existingWorkspace.created_by !== ownerUser.id) {
    throw new Error("Existing QA workspace owner identity does not match the configured owner account.");
  }
}

async function resetSeed(client, config, fixture) {
  const users = await ensureAuthUsers(client, config);
  const members = buildMembers(config, users);

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
    if (error) throw new Error(`QA workspace update failed: ${error.message}`);
  } else {
    await insertRows(client, "workspaces", [{
      ...fixture.workspace,
      created_by: users.owner.id,
    }]);
  }

  const { error: memberUpsertError } = await client
    .from("workspace_members")
    .upsert(Object.values(members), { onConflict: "id" });
  if (memberUpsertError) throw new Error(`QA member reset failed: ${memberUpsertError.message}`);
  await removeUnexpectedMembers(client, config.workspaceId, new Set(Object.values(members).map((row) => row.id)));
  await insertRows(client, "groups", fixture.groups.map(stripFixtureFields));
  await insertRows(client, "workspace_member_groups", [{
    id: deterministicUuid(config.workspaceId, "member-group:group-admin:alpha"),
    workspace_id: config.workspaceId,
    member_id: members.groupAdmin.id,
    group_id: fixture.groups.find((row) => row.key === "alpha").id,
  }]);
  await insertRows(client, "participants", fixture.participants.map((row) => ({
    ...stripFixtureFields(row),
    created_by: members.owner.id,
  })));
  await insertRows(client, "participant_groups", fixture.participantGroups);
  await insertRows(client, "courses", fixture.courses.map((row) => ({
    ...stripFixtureFields(row),
    instructor_member_id: row.instructorKey ? members[row.instructorKey].id : null,
  })));
  await insertRows(client, "course_recurrence_rules", fixture.courses.map((course) => {
    const courseSessions = fixture.sessions.filter((session) => session.course_id === course.id);
    return {
      id: deterministicUuid(config.workspaceId, `recurrence:${course.key}`),
      workspace_id: config.workspaceId,
      course_id: course.id,
      repeat_weekdays: [weekday(courseSessions[0].date)],
      starts_at: "10:00:00",
      ends_at: "12:00:00",
      session_count: courseSessions.length,
    };
  }));
  await insertRows(client, "course_groups", fixture.courseGroups);
  await insertRows(client, "course_participants", fixture.courseParticipants);
  await insertRows(client, "course_participant_groups", fixture.courseParticipantGroups);
  await insertRows(client, "course_sessions", fixture.sessions.map(stripFixtureFields));
  await insertRows(client, "attendance_records", fixture.attendanceRecords.map((row) => ({
    ...row,
    updated_by: members.instructor.id,
  })));
  await insertRows(client, "class_memos", fixture.classMemos.map((row) => ({
    ...row,
    updated_by: members.instructor.id,
  })));

  for (const file of fixture.storageFiles) {
    const { error } = await client.storage.from(DEVELOPER_QA_BUCKET).upload(file.path, file.body, {
      contentType: file.contentType,
      upsert: false,
    });
    if (error) throw new Error(`Storage upload failed for ${file.key}: ${error.message}`);
  }

  await insertRows(client, "materials", fixture.materials.map((row) => ({
    ...stripFixtureFields(row),
    size_bytes: Buffer.byteLength(fixture.storageFiles.find((file) => file.path === row.storage_path).body),
    uploaded_by: members.owner.id,
  })));
  await insertRows(client, "general_schedule_items", fixture.generalScheduleItems.map((row) => ({
    ...stripFixtureFields(row),
    created_by: members.owner.id,
  })));
  await insertRows(client, "general_schedule_item_groups", fixture.generalScheduleItems.flatMap((item) =>
    item.groupKeys.map((groupKey) => ({
      id: deterministicUuid(config.workspaceId, `schedule-group:${item.key}:${groupKey}`),
      workspace_id: config.workspaceId,
      schedule_item_id: item.id,
      group_id: fixture.groups.find((group) => group.key === groupKey).id,
    })),
  ));
  await insertRows(client, "course_feedbacks", fixture.feedbacks.map(stripFixtureFields));
  await insertRows(client, "instructor_payout_accounts", [{
    ...fixture.payoutAccount,
    user_id: users.instructor.id,
  }]);
  await insertRows(client, "settlement_requests", fixture.settlements.map((row) => ({
    ...stripFixtureFields(row),
    instructor_member_id: members.instructor.id,
    paid_by: row.status === "paid" ? members.owner.id : null,
  })));
  await insertRows(client, "settlement_request_items", fixture.settlementItems);
  await insertRows(client, "settlement_request_receipts", [fixture.settlementReceipt]);
  await insertRows(client, "activity_logs", fixture.activityLogs.map((row) => ({
    ...row,
    actor_member_id: ["attendance_saved", "class_memo_saved", "settlement_requested"].includes(row.event_type)
      ? members.instructor.id
      : members.owner.id,
  })));
}

async function verifySeed(client, config, fixture) {
  const users = {};
  for (const [key, account] of Object.entries(config.accounts)) {
    const authClient = createClient(config.supabaseUrl, config.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await authClient.auth.signInWithPassword({
      email: account.email,
      password: config.password,
    });
    if (error || !data.user) throw new Error(`Auth verification failed for role ${account.role}: ${error?.message}`);
    users[key] = { user: data.user, client: authClient };
  }

  await verifyCounts(client, config.workspaceId, fixture);
  await verifyStorage(client, fixture.storageFiles);
  await verifyRoleScopes(users, config, fixture);
}

async function verifyCounts(client, workspaceId, fixture) {
  const expectedCounts = {
    workspace_members: 3,
    groups: fixture.groups.length,
    participants: fixture.participants.length,
    participant_groups: fixture.participantGroups.length,
    courses: fixture.courses.length,
    course_groups: fixture.courseGroups.length,
    course_participants: fixture.courseParticipants.length,
    course_sessions: fixture.sessions.length,
    materials: fixture.materials.length,
    attendance_records: fixture.attendanceRecords.length,
    class_memos: fixture.classMemos.length,
    general_schedule_items: fixture.generalScheduleItems.length,
    course_feedbacks: fixture.feedbacks.length,
    settlement_requests: fixture.settlements.length,
    activity_logs: fixture.activityLogs.length,
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

async function verifyStorage(client, expectedFiles) {
  const actualPaths = await listStoragePaths(client.storage.from(DEVELOPER_QA_BUCKET), `workspaces/${expectedFiles[0].path.split("/")[1]}`);
  assert.deepEqual(new Set(actualPaths), new Set(expectedFiles.map((file) => file.path)), "Storage fixture paths mismatch");
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
  }

  const expectedCourseKeys = {
    owner: fixture.courses.map((row) => row.key),
    groupAdmin: fixture.expected.groupAdminCourseKeys,
    instructor: fixture.expected.instructorCourseKeys,
  };
  for (const [key, session] of Object.entries(users)) {
    const { data, error } = await session.client
      .from("courses")
      .select("id")
      .eq("workspace_id", config.workspaceId);
    if (error) throw new Error(`Course scope verification failed for ${key}: ${error.message}`);
    const expectedIds = expectedCourseKeys[key].map((courseKey) => fixture.courses.find((row) => row.key === courseKey).id).sort();
    assert.deepEqual((data ?? []).map((row) => row.id).sort(), expectedIds, `${key} course scope mismatch`);
  }

  const { data: groupIds, error: groupError } = await users.groupAdmin.client.rpc("accessible_group_ids", {
    target_workspace_id: config.workspaceId,
  });
  if (groupError) throw new Error(`Group scope RPC verification failed: ${groupError.message}`);
  const normalized = (groupIds ?? []).map((row) => typeof row === "string" ? row : row.accessible_group_ids);
  assert.deepEqual(normalized, [fixture.groups.find((row) => row.key === "alpha").id]);
}

async function selectWorkspaceRows(client, table, projection, workspaceId, refine = (query) => query) {
  const { data, error } = await refine(client.from(table).select(projection).eq("workspace_id", workspaceId));
  if (error) throw new Error(`Verification query failed for ${table}: ${error.message}`);
  return data ?? [];
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

async function ensureAuthUsers(client, config) {
  const result = {};
  for (const [key, account] of Object.entries(config.accounts)) {
    const existing = await findAuthUserByEmail(client, account.email);
    if (existing) {
      const { data, error } = await client.auth.admin.updateUserById(existing.id, {
        password: config.password,
        email_confirm: true,
        user_metadata: { display_name: account.displayName, fixture: "developer-qa" },
      });
      if (error) throw error;
      result[key] = data.user;
    } else {
      const { data, error } = await client.auth.admin.createUser({
        email: account.email,
        password: config.password,
        email_confirm: true,
        user_metadata: { display_name: account.displayName, fixture: "developer-qa" },
      });
      if (error) throw error;
      result[key] = data.user;
    }
  }
  return result;
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

async function insertRows(client, table, rows) {
  if (rows.length === 0) return;
  const { error } = await client.from(table).insert(rows);
  if (error) throw new Error(`Insert failed for ${table}: ${error.message}`);
}

async function resetWorkspaceData(client, workspaceId) {
  // Keep the workspace and deterministic owner member in place: the database
  // correctly prevents deleting the last active owner. Delete workspace data
  // in FK-safe order, then rebuild it below.
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
    "participants",
    "workspace_member_groups",
    "workspace_join_requests",
    "activity_logs",
    "groups",
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
  if (error) throw new Error(`QA member cleanup lookup failed: ${error.message}`);
  for (const row of data ?? []) {
    if (expectedIds.has(row.id)) continue;
    const { error: deleteError } = await client.from("workspace_members").delete().eq("id", row.id);
    if (deleteError) throw new Error(`QA member cleanup failed: ${deleteError.message}`);
  }
}

async function removeStoragePrefix(client, prefix) {
  const bucket = client.storage.from(DEVELOPER_QA_BUCKET);
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

function stripFixtureFields(row) {
  const { key: _key, groupKeys: _groupKeys, instructorKey: _instructorKey, ...databaseRow } = row;
  return databaseRow;
}

function weekday(isoDate) {
  return new Date(`${isoDate}T12:00:00+09:00`).getUTCDay();
}

function getSupabaseProjectRef(url) {
  const parsed = new URL(url);
  if (["127.0.0.1", "localhost"].includes(parsed.hostname)) return "local";
  const match = parsed.hostname.match(/^([a-z0-9-]+)\.supabase\.co$/i);
  if (!match) throw new Error(`Cannot derive Supabase project ref from ${parsed.hostname}.`);
  return match[1];
}

function decodeJwtPayload(token) {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("SUPABASE_SERVICE_ROLE_KEY must be a JWT.");
  try {
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY contains an invalid JWT payload.");
  }
}

function loadEnv() {
  const result = { ...process.env };
  for (const filename of [".env.local", ".env"]) {
    try {
      const content = readFileSync(resolve(process.cwd(), filename), "utf8");
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
        const [key, ...rest] = trimmed.split("=");
        if (result[key]) continue;
        result[key] = rest.join("=").replace(/^['"]|['"]$/g, "");
      }
    } catch {
      // Optional local environment file.
    }
  }
  return result;
}

function printResult(message, fixture, config) {
  console.log(message);
  console.log(JSON.stringify({
    workspaceId: config.workspaceId,
    workspaceName: fixture.workspace.name,
    referenceDate: fixture.referenceDate,
    appUrl: config.appUrl,
    profile: "smoke",
    roles: Object.values(config.accounts).map((account) => account.role),
    expected: fixture.expected,
  }, null, 2));
}
