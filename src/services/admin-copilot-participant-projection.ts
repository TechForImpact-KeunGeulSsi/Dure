import type {
  CourseParticipantStatus,
  ParticipantGroupStatus,
  ParticipantStatus,
  UUID,
} from "@/lib/api/types";

import type { AdminCopilotParticipantCourseRow } from "./admin-copilot-logic";

export type AdminCopilotCourseGroupRow = {
  course_id: UUID;
  group_id: UUID;
};

export type AdminCopilotGroupRow = {
  id: UUID;
  deleted_at: string | null;
};

export type AdminCopilotParticipantGroupRow = {
  participant_id: UUID;
  group_id: UUID;
  status: ParticipantGroupStatus;
};

export type AdminCopilotParticipantRow = {
  id: UUID;
  status: ParticipantStatus;
  deleted_at: string | null;
};

export type AdminCopilotParticipantCourseStatusRow = {
  course_id: UUID;
  participant_id: UUID;
  status: CourseParticipantStatus;
};

export function deriveAdminCopilotParticipantCourses(input: {
  courseGroups: AdminCopilotCourseGroupRow[];
  groups: AdminCopilotGroupRow[];
  participantGroups: AdminCopilotParticipantGroupRow[];
  participants: AdminCopilotParticipantRow[];
  participantCourses: AdminCopilotParticipantCourseStatusRow[];
}): AdminCopilotParticipantCourseRow[] {
  const eligibleGroupIds = new Set(
    input.groups.filter((group) => !group.deleted_at).map((group) => group.id),
  );
  const eligibleParticipantIds = new Set(
    input.participants
      .filter((participant) => participant.status !== "deleted" && !participant.deleted_at)
      .map((participant) => participant.id),
  );
  const excludedParticipantCourseKeys = new Set(
    input.participantCourses
      .filter((row) => row.status === "excluded")
      .map((row) => participantCourseKey(row.course_id, row.participant_id)),
  );
  const courseIdsByGroupId = new Map<UUID, Set<UUID>>();

  for (const row of input.courseGroups) {
    if (!eligibleGroupIds.has(row.group_id)) continue;
    const courseIds = courseIdsByGroupId.get(row.group_id) ?? new Set<UUID>();
    courseIds.add(row.course_id);
    courseIdsByGroupId.set(row.group_id, courseIds);
  }

  const participantCourses = new Map<string, AdminCopilotParticipantCourseRow>();
  for (const row of input.participantGroups) {
    if (row.status !== "active" || !eligibleParticipantIds.has(row.participant_id)) continue;

    for (const courseId of courseIdsByGroupId.get(row.group_id) ?? []) {
      const key = participantCourseKey(courseId, row.participant_id);
      if (excludedParticipantCourseKeys.has(key)) continue;
      participantCourses.set(key, {
        course_id: courseId,
        participant_id: row.participant_id,
      });
    }
  }

  return Array.from(participantCourses.values()).sort((a, b) => {
    const courseOrder = a.course_id.localeCompare(b.course_id);
    return courseOrder !== 0
      ? courseOrder
      : a.participant_id.localeCompare(b.participant_id);
  });
}

export async function loadAllAdminCopilotRows<T>(
  loadPage: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  pageSize = 1_000,
): Promise<{ data: T[]; error: { message: string } | null }> {
  const rows: T[] = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await loadPage(from, from + pageSize - 1);
    if (error) return { data: rows, error };

    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) return { data: rows, error: null };
  }
}

function participantCourseKey(courseId: UUID, participantId: UUID): string {
  return `${courseId}:${participantId}`;
}
