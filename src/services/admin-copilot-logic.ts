import type {
  AttendanceStatus,
  CourseFeedbackCategory,
  CourseStatus,
  SessionProgressStatus,
  SessionRollupStatus,
  SessionVisibilityStatus,
  UUID,
  WorkspaceRole,
} from "@/lib/api/types";

export type AdminCopilotTaskType =
  | "pending_material_review"
  | "attendance_risk_participant"
  | "new_course_feedback"
  | "course_completion_candidate";

export type AdminCopilotTaskPriority = "high" | "medium" | "low";

export type AdminCopilotEvidenceEntityType =
  | "course"
  | "course_session"
  | "participant"
  | "material"
  | "attendance_record"
  | "course_feedback";

export type AdminCopilotEvidence = {
  entityType: AdminCopilotEvidenceEntityType;
  entityId: UUID;
  label: string;
  reason: string;
  metadata?: Record<string, unknown>;
};

export type AdminCopilotTask = {
  id: string;
  type: AdminCopilotTaskType;
  priority: AdminCopilotTaskPriority;
  title: string;
  summary: string;
  evidence: AdminCopilotEvidence[];
  relatedHref: string;
  recommendedManualAction: string;
  createdAt?: string;
};

export type AdminCopilotBriefing = {
  window: {
    timezone: string;
    recentFrom: string;
    today: string;
    upcomingUntil: string;
  };
  summary: {
    upcomingSessionCount: number;
    recentSessionCount: number;
    pendingMaterialCount: number;
    attendanceRiskParticipantCount: number;
    newFeedbackCount: number;
    completionCandidateCount: number;
  };
  tasks: AdminCopilotTask[];
};

export type AdminCopilotCourseRow = {
  id: UUID;
  name: string;
  status: CourseStatus;
};

export type AdminCopilotSessionRow = {
  id: UUID;
  course_id: UUID;
  session_no: number;
  date: string;
  starts_at: string;
  ends_at: string;
  visibility_status: SessionVisibilityStatus;
  rollup_status: SessionRollupStatus;
  progress_status: SessionProgressStatus;
};

export type AdminCopilotMaterialRow = {
  id: UUID;
  course_id: UUID;
  title: string;
  created_at: string;
  updated_at: string;
};

export type AdminCopilotFeedbackRow = {
  id: UUID;
  course_id: UUID;
  course_name_snapshot: string;
  category: CourseFeedbackCategory;
  message: string;
  created_at: string;
};

export type AdminCopilotAttendanceRow = {
  id: UUID;
  session_id: UUID;
  participant_id: UUID;
  participant_name_snapshot: string;
  status: AttendanceStatus;
  updated_at: string;
};

export type AdminCopilotParticipantCourseRow = {
  course_id: UUID;
  participant_id: UUID;
};

type BuildAdminCopilotBriefingInput = {
  workspaceId: UUID;
  timezone: string;
  referenceDate?: string;
  courses: AdminCopilotCourseRow[];
  sessions: AdminCopilotSessionRow[];
  materials: AdminCopilotMaterialRow[];
  feedbacks: AdminCopilotFeedbackRow[];
  attendanceRecords: AdminCopilotAttendanceRow[];
  activeParticipantCourses: AdminCopilotParticipantCourseRow[];
};

type BriefingWindowWithReference = AdminCopilotBriefing["window"] & {
  referenceLocalDateTime: string;
};

const TASK_ORDER: Record<AdminCopilotTaskType, number> = {
  attendance_risk_participant: 0,
  pending_material_review: 1,
  course_completion_candidate: 2,
  new_course_feedback: 3,
};

export function getAdminCopilotRoleError(
  role: WorkspaceRole,
): "ROLE_FORBIDDEN" | null {
  return role === "owner_admin" ? null : "ROLE_FORBIDDEN";
}

export function buildAdminCopilotBriefing(
  input: BuildAdminCopilotBriefingInput,
): AdminCopilotBriefing {
  const window = buildBriefingWindow(input.referenceDate, input.timezone);
  const courseById = new Map(input.courses.map((course) => [course.id, course]));
  const sessionById = new Map(input.sessions.map((session) => [session.id, session]));
  const activeParticipantKeys = new Set(
    input.activeParticipantCourses.map((row) =>
      participantCourseKey(row.course_id, row.participant_id),
    ),
  );

  const tasks: AdminCopilotTask[] = [
    ...buildAttendanceRiskTasks({
      workspaceId: input.workspaceId,
      records: input.attendanceRecords,
      sessionById,
      courseById,
      activeParticipantKeys,
    }),
    ...buildPendingMaterialTasks({
      workspaceId: input.workspaceId,
      materials: input.materials,
      courseById,
    }),
    ...buildCompletionCandidateTasks({
      workspaceId: input.workspaceId,
      courses: input.courses,
      sessions: input.sessions,
      referenceLocalDateTime: window.referenceLocalDateTime,
    }),
    ...buildNewFeedbackTasks({
      workspaceId: input.workspaceId,
      feedbacks: input.feedbacks,
      courseById,
    }),
  ].sort(compareTasks);

  const visibleEligibleSessions = input.sessions.filter(isVisibleEligibleSession);

  return {
    window: {
      timezone: window.timezone,
      recentFrom: window.recentFrom,
      today: window.today,
      upcomingUntil: window.upcomingUntil,
    },
    summary: {
      upcomingSessionCount: visibleEligibleSessions.filter(
        (session) =>
          session.date >= window.today && session.date <= window.upcomingUntil,
      ).length,
      recentSessionCount: visibleEligibleSessions.filter(
        (session) =>
          session.date >= window.recentFrom && session.date < window.today,
      ).length,
      pendingMaterialCount: countTasks(tasks, "pending_material_review"),
      attendanceRiskParticipantCount: countTasks(
        tasks,
        "attendance_risk_participant",
      ),
      newFeedbackCount: countTasks(tasks, "new_course_feedback"),
      completionCandidateCount: countTasks(
        tasks,
        "course_completion_candidate",
      ),
    },
    tasks,
  };
}

export function buildBriefingWindow(
  referenceDate: string | undefined,
  requestedTimezone: string,
): BriefingWindowWithReference {
  const timezone = normalizeTimezone(requestedTimezone);

  if (referenceDate && /^\d{4}-\d{2}-\d{2}$/.test(referenceDate)) {
    return {
      timezone,
      recentFrom: addCalendarDays(referenceDate, -7),
      today: referenceDate,
      upcomingUntil: addCalendarDays(referenceDate, 7),
      referenceLocalDateTime: `${referenceDate}T00:00:00`,
    };
  }

  const reference = referenceDate ? new Date(referenceDate) : new Date();
  if (Number.isNaN(reference.getTime())) {
    throw new Error("INVALID_REFERENCE_DATE");
  }

  const parts = zonedDateTimeParts(reference, timezone);
  const today = `${parts.year}-${parts.month}-${parts.day}`;
  return {
    timezone,
    recentFrom: addCalendarDays(today, -7),
    today,
    upcomingUntil: addCalendarDays(today, 7),
    referenceLocalDateTime: `${today}T${parts.hour}:${parts.minute}:${parts.second}`,
  };
}

function buildPendingMaterialTasks(input: {
  workspaceId: UUID;
  materials: AdminCopilotMaterialRow[];
  courseById: Map<UUID, AdminCopilotCourseRow>;
}): AdminCopilotTask[] {
  return input.materials.map((material) => {
    const course = input.courseById.get(material.course_id);
    const courseName = course?.name ?? "삭제된 수업";
    return {
      id: `pending-material-review:${material.id}`,
      type: "pending_material_review",
      priority: "medium",
      title: "확인이 필요한 수업 자료",
      summary: `${courseName}의 ‘${material.title}’ 자료가 확인 대기 중입니다.`,
      evidence: [
        {
          entityType: "material",
          entityId: material.id,
          label: material.title,
          reason: "업로드가 완료됐지만 review_status가 pending입니다.",
          metadata: { uploadStatus: "uploaded", reviewStatus: "pending" },
        },
        {
          entityType: "course",
          entityId: material.course_id,
          label: courseName,
          reason: "자료가 속한 수업입니다.",
        },
      ],
      relatedHref: `/workspaces/${input.workspaceId}/courses/${material.course_id}/materials`,
      recommendedManualAction: "수업 자료 화면에서 내용을 확인하고 검토 상태를 변경하세요.",
      createdAt: material.created_at,
    };
  });
}

function buildNewFeedbackTasks(input: {
  workspaceId: UUID;
  feedbacks: AdminCopilotFeedbackRow[];
  courseById: Map<UUID, AdminCopilotCourseRow>;
}): AdminCopilotTask[] {
  return input.feedbacks.map((feedback) => {
    const courseName =
      input.courseById.get(feedback.course_id)?.name ?? feedback.course_name_snapshot;
    return {
      id: `new-course-feedback:${feedback.id}`,
      type: "new_course_feedback",
      priority: "low",
      title: "새 수업 피드백",
      summary: `${courseName}에 새 의견이 등록됐습니다: ${preview(feedback.message)}`,
      evidence: [
        {
          entityType: "course_feedback",
          entityId: feedback.id,
          label: `${courseName} 피드백`,
          reason: "status가 new인 미검토 피드백입니다.",
          metadata: { category: feedback.category, status: "new" },
        },
        {
          entityType: "course",
          entityId: feedback.course_id,
          label: courseName,
          reason: "피드백이 등록된 수업입니다.",
        },
      ],
      relatedHref: `/workspaces/${input.workspaceId}/feedback`,
      recommendedManualAction: "의견 수렴 화면에서 내용을 확인하고 검토 상태를 변경하세요.",
      createdAt: feedback.created_at,
    };
  });
}

function buildCompletionCandidateTasks(input: {
  workspaceId: UUID;
  courses: AdminCopilotCourseRow[];
  sessions: AdminCopilotSessionRow[];
  referenceLocalDateTime: string;
}): AdminCopilotTask[] {
  const sessionsByCourse = new Map<UUID, AdminCopilotSessionRow[]>();
  for (const session of input.sessions.filter(isVisibleEligibleSession)) {
    const existing = sessionsByCourse.get(session.course_id) ?? [];
    existing.push(session);
    sessionsByCourse.set(session.course_id, existing);
  }

  return input.courses.flatMap((course) => {
    if (course.status !== "in_progress") return [];
    const sessions = sessionsByCourse.get(course.id) ?? [];
    const finalSession = sessions.sort((a, b) =>
      sessionEndKey(b).localeCompare(sessionEndKey(a)),
    )[0];
    if (!finalSession || sessionEndKey(finalSession) >= input.referenceLocalDateTime) {
      return [];
    }

    return [
      {
        id: `course-completion-candidate:${course.id}`,
        type: "course_completion_candidate" as const,
        priority: "medium" as const,
        title: "수업 종료 상태 확인",
        summary: `${course.name}의 마지막 유효 회차가 종료됐지만 수업 상태는 진행 중입니다.`,
        evidence: [
          {
            entityType: "course" as const,
            entityId: course.id,
            label: course.name,
            reason: "수업 상태가 in_progress입니다.",
            metadata: { status: course.status },
          },
          {
            entityType: "course_session" as const,
            entityId: finalSession.id,
            label: `${finalSession.session_no}회차 · ${finalSession.date}`,
            reason: "마지막 포함·공개·정상 회차의 종료 시각이 지났습니다.",
            metadata: {
              date: finalSession.date,
              startsAt: finalSession.starts_at,
              endsAt: finalSession.ends_at,
            },
          },
        ],
        relatedHref: `/workspaces/${input.workspaceId}/manage/courses/${course.id}/edit`,
        recommendedManualAction: "수업 관리 화면에서 운영 상태를 확인하고 완료 여부를 결정하세요.",
        createdAt: sessionEndKey(finalSession),
      },
    ];
  });
}

function buildAttendanceRiskTasks(input: {
  workspaceId: UUID;
  records: AdminCopilotAttendanceRow[];
  sessionById: Map<UUID, AdminCopilotSessionRow>;
  courseById: Map<UUID, AdminCopilotCourseRow>;
  activeParticipantKeys: Set<string>;
}): AdminCopilotTask[] {
  const recordsByParticipantCourse = new Map<string, AdminCopilotAttendanceRow[]>();

  for (const record of input.records) {
    const session = input.sessionById.get(record.session_id);
    if (!session || !isAttendanceEligibleSession(session)) continue;
    const key = participantCourseKey(session.course_id, record.participant_id);
    if (!input.activeParticipantKeys.has(key)) continue;
    const existing = recordsByParticipantCourse.get(key) ?? [];
    existing.push(record);
    recordsByParticipantCourse.set(key, existing);
  }

  const tasks: AdminCopilotTask[] = [];
  for (const [key, records] of recordsByParticipantCourse) {
    const [courseId, participantId] = key.split(":") as [UUID, UUID];
    const recent = records
      .sort((a, b) => {
        const aSession = input.sessionById.get(a.session_id);
        const bSession = input.sessionById.get(b.session_id);
        return sessionStartKey(bSession).localeCompare(sessionStartKey(aSession));
      })
      .slice(0, 3);
    if (recent.length < 3 || recent.filter((record) => record.status === "absent").length < 2) {
      continue;
    }

    const course = input.courseById.get(courseId);
    const courseName = course?.name ?? "삭제된 수업";
    const participantName = recent[0]?.participant_name_snapshot ?? "이름 없는 참여자";
    const statuses = recent.map((record) => record.status);
    tasks.push({
      id: `attendance-risk:${courseId}:${participantId}`,
      type: "attendance_risk_participant",
      priority: "high",
      title: "출석 위험 참여자 확인",
      summary: `${participantName} 참여자가 ${courseName}의 최근 3회 출석 중 ${statuses.filter((status) => status === "absent").length}회 결석했습니다.`,
      evidence: [
        {
          entityType: "participant",
          entityId: participantId,
          label: participantName,
          reason: "최근 3개 유효 출석 기록 중 결석이 2회 이상입니다.",
          metadata: { recentStatuses: statuses },
        },
        {
          entityType: "course",
          entityId: courseId,
          label: courseName,
          reason: "출석 위험이 감지된 수업입니다.",
        },
        ...recent.map((record) => {
          const session = input.sessionById.get(record.session_id);
          return {
            entityType: "attendance_record" as const,
            entityId: record.id,
            label: `${session?.date ?? "날짜 미상"} · ${attendanceLabel(record.status)}`,
            reason: "최근 출석 위험 계산에 사용된 기록입니다.",
            metadata: { sessionId: record.session_id, status: record.status },
          };
        }),
      ],
      relatedHref: `/workspaces/${input.workspaceId}/courses/${courseId}/participants`,
      recommendedManualAction: "참여자 현황에서 최근 출석 기록을 확인하고 담당 강사와 후속 조치를 논의하세요.",
      createdAt: sessionStartKey(input.sessionById.get(recent[0].session_id)),
    });
  }

  return tasks;
}

function compareTasks(a: AdminCopilotTask, b: AdminCopilotTask): number {
  const typeOrder = TASK_ORDER[a.type] - TASK_ORDER[b.type];
  if (typeOrder !== 0) return typeOrder;
  if (a.type === "attendance_risk_participant") {
    return (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
  }
  return (a.createdAt ?? "").localeCompare(b.createdAt ?? "");
}

function isVisibleEligibleSession(session: AdminCopilotSessionRow): boolean {
  return (
    session.rollup_status === "included" &&
    session.visibility_status === "visible" &&
    session.progress_status === "scheduled"
  );
}

function isAttendanceEligibleSession(session: AdminCopilotSessionRow): boolean {
  return (
    session.rollup_status === "included" && session.progress_status !== "cancelled"
  );
}

function sessionEndKey(session: AdminCopilotSessionRow): string {
  return `${session.date}T${normalizeTime(session.ends_at)}`;
}

function sessionStartKey(session: AdminCopilotSessionRow | undefined): string {
  return session ? `${session.date}T${normalizeTime(session.starts_at)}` : "";
}

function normalizeTime(time: string): string {
  return time.length === 5 ? `${time}:00` : time.slice(0, 8);
}

function participantCourseKey(courseId: UUID, participantId: UUID): string {
  return `${courseId}:${participantId}`;
}

function countTasks(tasks: AdminCopilotTask[], type: AdminCopilotTaskType): number {
  return tasks.filter((task) => task.type === type).length;
}

function preview(message: string): string {
  const normalized = message.replace(/\s+/g, " ").trim();
  return normalized.length <= 70 ? normalized : `${normalized.slice(0, 67)}…`;
}

function attendanceLabel(status: AttendanceStatus): string {
  return status === "present" ? "출석" : status === "partial" ? "부분 출석" : "결석";
}

function normalizeTimezone(timezone: string): string {
  const candidate = timezone.trim() || "Asia/Seoul";
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return "Asia/Seoul";
  }
}

function zonedDateTimeParts(date: Date, timezone: string) {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return values as Record<"year" | "month" | "day" | "hour" | "minute" | "second", string>;
}

function addCalendarDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}
