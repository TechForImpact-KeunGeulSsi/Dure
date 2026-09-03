import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(relativePath) {
  return readFile(new URL(relativePath, root), "utf8");
}

async function exists(relativePath) {
  try {
    await access(new URL(relativePath, root));
    return true;
  } catch {
    return false;
  }
}

test("retired product surfaces are absent from active navigation and routes", async () => {
  const [
    sidebar,
    instructorTabs,
    landing,
    courseHome,
    instructorCourseHome,
    uploadDialog,
    editDialog,
    materialRow,
    materialsService,
  ] =
    await Promise.all([
      source("src/components/layout/sidebar.tsx"),
      source("src/components/courses/instructor-course-tabs.tsx"),
      source("src/app/page.tsx"),
      source("src/app/workspaces/[workspaceId]/(dashboard)/courses/[courseId]/home/course-home-client.tsx"),
      source("src/app/workspaces/[workspaceId]/(dashboard)/courses/[courseId]/home/page.tsx"),
      source("src/app/workspaces/[workspaceId]/(dashboard)/courses/[courseId]/materials/upload-dialog.tsx"),
      source("src/app/workspaces/[workspaceId]/(dashboard)/courses/[courseId]/materials/edit-dialog.tsx"),
      source("src/app/workspaces/[workspaceId]/(dashboard)/courses/[courseId]/materials/material-row.tsx"),
      source("src/services/materials.ts"),
    ]);

  for (const retiredLabel of [
    "마을별 둘러보기",
    "정산 요청",
    "의견 수렴",
  ]) {
    assert.doesNotMatch(sidebar, new RegExp(retiredLabel));
  }
  assert.doesNotMatch(instructorTabs, /settlements|정산 요청/);
  assert.doesNotMatch(landing, /PublicVillageCatalog|getPublicCourseCatalog|#catalog|마을별|우리 마을/);
  assert.doesNotMatch(courseHome, /CoursePublicPreviewSection|publicPreview|공개 페이지/);
  assert.doesNotMatch(instructorCourseHome, /getCoursePublicPreview|publicPreview/);
  for (const materialSource of [uploadDialog, editDialog, materialRow]) {
    assert.doesNotMatch(materialSource, /VisibilityFields|visibilityScope|전체 공개/);
  }
  assert.match(materialsService, /canAccessCourse/);
  assert.match(materialsService, /SCOPE_FORBIDDEN.*자료를 업로드할 권한/);

  for (const retiredRoute of [
    "src/app/public/courses/[courseId]/page.tsx",
    "src/app/workspaces/[workspaceId]/(dashboard)/feedback/page.tsx",
    "src/app/workspaces/[workspaceId]/(dashboard)/settlements/page.tsx",
    "src/app/workspaces/[workspaceId]/(dashboard)/settlements/[requestId]/page.tsx",
    "src/app/workspaces/[workspaceId]/(dashboard)/teach/courses/[courseId]/settlements/page.tsx",
  ]) {
    assert.equal(await exists(retiredRoute), false, `${retiredRoute} must be removed`);
  }
});

test("retired signals cannot re-enter the active dashboard or activity outputs", async () => {
  const [activity, dashboardPage, dashboardClient, apiTypes] =
    await Promise.all([
      source("src/services/activity.ts"),
      source("src/app/workspaces/[workspaceId]/(dashboard)/home/page.tsx"),
      source("src/app/workspaces/[workspaceId]/(dashboard)/home/home-client.tsx"),
      source("src/lib/api/types.ts"),
    ]);

  for (const activeSource of [activity, dashboardPage, dashboardClient]) {
    assert.doesNotMatch(
      activeSource,
      /\/feedback|\/settlements|new_course_feedback|newFeedbackCount/,
    );
    assert.doesNotMatch(activeSource, /admin-copilot|AdminCopilot|ReviewMaterial/);
  }
  assert.match(dashboardPage, /getAttendanceDashboard/);
  assert.match(dashboardClient, /수업 필터/);
  assert.match(dashboardClient, /overflow-x-auto/);
  assert.match(dashboardClient, /aria-pressed/);
  assert.doesNotMatch(dashboardClient, /Popover|Filters/);
  assert.match(activity, /\.in\("target_type", \[\.\.\.ACTIVE_ACTIVITY_TARGET_TYPES\]\)/);
  assert.match(activity, /viewerRole === "instructor"/);
  assert.match(activity, /courses\/\$\{courseId\}\/participants/);
  assert.match(activity, /loadActors\(input\.workspaceId, actorIds\)/);
  assert.match(activity, /\.eq\("workspace_id", input\.workspaceId\)\n        \.eq\("id", input\.actorMemberId\)/);
  assert.match(activity, /e\.target_type === "course"/);
  assert.doesNotMatch(apiTypes, /type: "course_feedback"|type: "settlement_request"/);
});

test("retirement keeps data migrations but closes settlement and receipt policies", async () => {
  const migration = await source(
    "supabase/migrations/20260902090000_retire_non_operational_surfaces.sql",
  );

  for (const policy of [
    '"public materials anyone can read"',
    '"users can view own payout account"',
    '"users can insert own payout account"',
    '"users can update own payout account"',
    '"instructors view own or owners view all settlement requests"',
    '"instructors create own settlement requests"',
    '"owners update settlement requests"',
    '"view items via parent request"',
    '"insert items via parent request"',
    '"view receipts via parent request"',
    '"insert receipts via parent request"',
    '"settlement participants can read receipt objects"',
    '"instructors can upload receipt objects"',
  ]) {
    assert.match(migration, new RegExp(`drop policy if exists ${policy}`));
  }
  assert.match(migration, /public course catalog and public material download surface are retired/i);
  assert.match(migration, /set visibility_scope = 'admin_only'/i);
  assert.match(migration, /materials_admin_only_visibility_check/);
  assert.match(migration, /instructor\.id is not null/);
  assert.match(migration, /revoke execute on function public\.can_access_settlement_request\(uuid\) from public/);
  assert.match(migration, /activity_logs\.actor_member_id is null/);
  assert.match(migration, /historical rows and storage objects are retained/i);
});
