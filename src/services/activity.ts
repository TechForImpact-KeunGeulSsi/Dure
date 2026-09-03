"use server";

import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { apiError, apiOk, type ApiResult } from "@/lib/api/errors";
import { workspaceRoleLabel } from "@/lib/api/labels";
import type {
  ActivityItem,
  ActivityTarget,
  ISODateTime,
  LoggableTargetType,
  MemberSummary,
  UUID,
  WorkspaceRole,
} from "@/lib/api/types";

import { canAccessCourse, loadCurrentMembership } from "./access";

// ─────────────────────────────────────────────────────────────
// logActivity — fire-and-forget. Never throws.
// ─────────────────────────────────────────────────────────────

export async function logActivity(input: {
  workspaceId: UUID;
  actorMemberId: UUID | null;
  eventType: string;
  targetType: LoggableTargetType;
  targetId: UUID | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const admin = createSupabaseAdminClient();
    if (input.actorMemberId) {
      const { data: actor } = await admin
        .from("workspace_members")
        .select("id")
        .eq("workspace_id", input.workspaceId)
        .eq("id", input.actorMemberId)
        .eq("status", "active")
        .maybeSingle();
      if (!actor) {
        console.warn(
          `[activity_logs] skipped out-of-scope actor (${input.eventType}): ${input.actorMemberId}`,
        );
        return;
      }
    }
    const { error } = await admin.from("activity_logs").insert({
      workspace_id: input.workspaceId,
      actor_member_id: input.actorMemberId,
      event_type: input.eventType,
      target_type: input.targetType,
      target_id: input.targetId,
      metadata: input.metadata ?? {},
    });
    if (error) {
      console.warn(`[activity_logs] insert failed (${input.eventType}):`, error.message);
    }
  } catch (err) {
    console.warn(
      `[activity_logs] insert threw (${input.eventType}):`,
      err instanceof Error ? err.message : err,
    );
  }
}

// ─────────────────────────────────────────────────────────────
// getRecentActivity — api-spec.md §16.1
// ─────────────────────────────────────────────────────────────

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const ACTIVE_ACTIVITY_TARGET_TYPES = [
  "material",
  "attendance",
  "class_memo",
  "member",
  "course",
] as const satisfies readonly LoggableTargetType[];
const ACTIVE_ACTIVITY_TARGET_TYPE_SET = new Set<LoggableTargetType>(
  ACTIVE_ACTIVITY_TARGET_TYPES,
);

export async function getRecentActivity(input: {
  workspaceId: UUID;
  limit?: number;
}): Promise<ApiResult<{ activities: ActivityItem[] }>> {
  const limit = Math.min(MAX_LIMIT, Math.max(1, input.limit ?? DEFAULT_LIMIT));
  const fetchLimit = Math.min(MAX_LIMIT * 3, limit * 3);

  const membership = await loadCurrentMembership(input.workspaceId);
  if (!membership) {
    return apiError("WORKSPACE_ACCESS_DENIED", "워크스페이스 접근 권한이 없습니다.");
  }

  const admin = createSupabaseAdminClient();

  const { data: rows, error } = await admin
    .from("activity_logs")
    .select("id, event_type, target_type, target_id, metadata, actor_member_id, created_at")
    .eq("workspace_id", input.workspaceId)
    .in("target_type", [...ACTIVE_ACTIVITY_TARGET_TYPES])
    .order("created_at", { ascending: false })
    .limit(fetchLimit);
  if (error) return apiError("INTERNAL_ERROR", error.message);

  const events = (rows ?? []) as ActivityRow[];
  const activeEvents = events.filter((event) =>
    ACTIVE_ACTIVITY_TARGET_TYPE_SET.has(event.target_type as LoggableTargetType),
  );
  if (activeEvents.length === 0) {
    return apiOk({ activities: [] });
  }

  // 보조 데이터 lookups (배치)
  const actorIds = uniqueNonNull(activeEvents.map((e) => e.actor_member_id));
  const courseIds = uniqueNonNull(
    activeEvents.map((e) =>
      e.target_type === "course"
        ? e.target_id
        : readMetadataString(e.metadata, "courseId"),
    ),
  );

  const [actorMap, courseMap] = await Promise.all([
    loadActors(input.workspaceId, actorIds),
    loadCourses(input.workspaceId, courseIds),
  ]);

  const filtered: ActivityItem[] = [];
  for (const e of activeEvents) {
    if (filtered.length >= limit) break;

    const courseId =
      e.target_type === "course"
        ? e.target_id
        : readMetadataString(e.metadata, "courseId");
    const course = courseId ? courseMap.get(courseId) : null;

    // 권한 필터링
    if (e.target_type === "member") {
      // 멤버 관리 이벤트는 owner_admin만
      if (membership.role !== "owner_admin") continue;
    } else if (
      e.target_type === "material" ||
      e.target_type === "attendance" ||
      e.target_type === "class_memo" ||
      e.target_type === "course"
    ) {
      if (!course) continue;
      const allowed = await canAccessCourse({
        workspaceId: input.workspaceId,
        membership,
        course,
      });
      if (!allowed) continue;
    }

    const actor = e.actor_member_id ? actorMap.get(e.actor_member_id) ?? null : null;
    const target = buildTarget(
      input.workspaceId,
      e,
      membership.role,
    );
    if (!target) continue;

    filtered.push({
      id: e.id,
      eventType: e.event_type,
      title: buildTitle(e, actor),
      description: buildDescription(e, course?.name ?? null),
      actor,
      target,
      createdAt: e.created_at,
    });
  }

  return apiOk({ activities: filtered });
}

// ─────────────────────────────────────────────────────────────
// internal helpers
// ─────────────────────────────────────────────────────────────

type ActivityRow = {
  id: UUID;
  event_type: string;
  target_type: string;
  target_id: UUID | null;
  metadata: Record<string, unknown> | null;
  actor_member_id: UUID | null;
  created_at: ISODateTime;
};

type CourseLookup = {
  id: UUID;
  name: string;
  instructor_member_id: UUID | null;
};

async function loadActors(
  workspaceId: UUID,
  memberIds: UUID[],
): Promise<Map<UUID, MemberSummary>> {
  const result = new Map<UUID, MemberSummary>();
  if (memberIds.length === 0) return result;
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("workspace_members")
    .select("id, email, display_name, role, status")
    .eq("workspace_id", workspaceId)
    .in("id", memberIds);
  for (const row of data ?? []) {
    result.set(row.id, {
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      role: row.role,
      status: row.status,
    });
  }
  return result;
}

async function loadCourses(
  workspaceId: UUID,
  courseIds: UUID[],
): Promise<Map<UUID, CourseLookup>> {
  const result = new Map<UUID, CourseLookup>();
  if (courseIds.length === 0) return result;
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("courses")
    .select("id, name, instructor_member_id")
    .eq("workspace_id", workspaceId)
    .in("id", courseIds);
  for (const row of data ?? []) {
    result.set(row.id, {
      id: row.id,
      name: row.name,
      instructor_member_id: row.instructor_member_id,
    });
  }
  return result;
}

function readMetadataString(
  metadata: Record<string, unknown> | null | undefined,
  key: string,
): string | null {
  const value = metadata?.[key];
  return typeof value === "string" ? value : null;
}

function uniqueNonNull(values: Array<string | null | undefined>): string[] {
  const set = new Set<string>();
  for (const v of values) {
    if (typeof v === "string" && v.length > 0) set.add(v);
  }
  return [...set];
}

function buildTarget(
  workspaceId: UUID,
  event: ActivityRow,
  viewerRole: WorkspaceRole,
): ActivityTarget | null {
  const courseId = readMetadataString(event.metadata, "courseId");

  switch (event.target_type) {
    case "material": {
      if (!event.target_id || !courseId) return null;
      const base = viewerRole === "instructor" ? "teach/courses" : "courses";
      return {
        type: "course_material",
        courseId,
        materialId: event.target_id,
        href: `/workspaces/${workspaceId}/${base}/${courseId}/materials`,
      };
    }
    case "attendance": {
      if (!event.target_id || !courseId) return null;
      const href =
        viewerRole === "instructor"
          ? `/workspaces/${workspaceId}/teach/courses/${courseId}/attendance`
          : `/workspaces/${workspaceId}/courses/${courseId}/participants`;
      return {
        type: "attendance",
        courseId,
        sessionId: event.target_id,
        href,
      };
    }
    case "class_memo": {
      if (!event.target_id || !courseId) return null;
      const href =
        viewerRole === "instructor"
          ? `/workspaces/${workspaceId}/teach/courses/${courseId}/notes`
          : `/workspaces/${workspaceId}/courses/${courseId}/participants`;
      return {
        type: "class_memo",
        courseId,
        sessionId: event.target_id,
        href,
      };
    }
    case "member": {
      if (!event.target_id) return null;
      return {
        type: "member",
        memberId: event.target_id,
        href: `/workspaces/${workspaceId}/members`,
      };
    }
    case "course": {
      if (!event.target_id) return null;
      return {
        type: "course",
        courseId: event.target_id,
        href: `/workspaces/${workspaceId}/courses/${event.target_id}/home`,
      };
    }
    default:
      return null;
  }
}

function actorName(actor: MemberSummary | null): string {
  if (!actor) return "시스템";
  return actor.displayName?.trim() || actor.email;
}

/** 멤버가 아닌 요청자(join_requested 등)에 대해 metadata에서 표시 이름 추론 */
function externalActorName(event: ActivityRow): string {
  const displayName = readMetadataString(event.metadata, "displayName");
  if (displayName) return displayName;
  const email = readMetadataString(event.metadata, "email");
  if (email) return email;
  return "익명 사용자";
}

function buildTitle(event: ActivityRow, actor: MemberSummary | null): string {
  if (event.event_type === "join_requested") {
    return `${externalActorName(event)}님이 워크스페이스 참여를 요청했어요`;
  }
  const name = actorName(actor);
  switch (event.event_type) {
    case "material_uploaded":
      return `${name}님이 자료를 업로드했어요`;
    case "material_updated":
      return `${name}님이 자료를 수정했어요`;
    case "material_file_replaced":
      return `${name}님이 자료 파일을 교체했어요`;
    case "attendance_saved":
      return `${name}님이 출석을 저장했어요`;
    case "class_memo_saved":
      return `${name}님이 수업 메모를 저장했어요`;
    case "invite_created":
      return `${name}님이 멤버를 초대했어요`;
    case "invite_accepted": {
      const email = readMetadataString(event.metadata, "email");
      return `${email ?? name}님이 초대를 수락했어요`;
    }
    case "member_removed":
      return `${name}님이 멤버를 제거했어요`;
    case "course_completed":
      return "수업이 자동으로 완료 처리되었어요";
    default:
      return `${name}님의 활동`;
  }
}

function buildDescription(
  event: ActivityRow,
  courseName: string | null,
): string | null {
  switch (event.event_type) {
    case "material_uploaded":
    case "material_updated":
    case "material_file_replaced": {
      const title = readMetadataString(event.metadata, "title");
      const filename = readMetadataString(event.metadata, "originalFilename");
      return title || filename || courseName;
    }
    case "attendance_saved":
    case "class_memo_saved":
      return courseName;
    case "invite_created": {
      const email = readMetadataString(event.metadata, "email");
      const role = readMetadataString(event.metadata, "role");
      const roleLabel = role
        ? workspaceRoleLabel(role as WorkspaceRole)
        : null;
      if (email && roleLabel) return `${email} · ${roleLabel}`;
      return email ?? roleLabel ?? null;
    }
    case "invite_accepted": {
      const role = readMetadataString(event.metadata, "role");
      return role ? workspaceRoleLabel(role as WorkspaceRole) : null;
    }
    case "member_removed": {
      const email = readMetadataString(event.metadata, "email");
      const role = readMetadataString(event.metadata, "role");
      const roleLabel = role ? workspaceRoleLabel(role as WorkspaceRole) : null;
      if (email && roleLabel) return `${email} · ${roleLabel}`;
      return email ?? roleLabel ?? null;
    }
    case "join_requested": {
      const role = readMetadataString(event.metadata, "desiredRole");
      const roleLabel = role ? workspaceRoleLabel(role as WorkspaceRole) : null;
      const message = readMetadataString(event.metadata, "message");
      if (roleLabel && message) return `${roleLabel} 희망 · ${message}`;
      return roleLabel ?? message;
    }
    default:
      return null;
  }
}
