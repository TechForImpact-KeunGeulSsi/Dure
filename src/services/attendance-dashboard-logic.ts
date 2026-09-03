import type {
  AttendanceStatus,
  CourseParticipantStatus,
  CourseStatus,
  UUID,
} from "@/lib/api/types";

export type AttendanceDashboardSessionInput = {
  id: UUID;
  courseId: UUID;
  sessionNo: number;
  date: string;
  startsAt: string;
  endsAt: string;
  rollupStatus: "included" | "excluded";
  progressStatus: "scheduled" | "cancelled";
};

export type AttendanceDashboardParticipantInput = {
  participantId: UUID;
  participantName: string;
  courseId: UUID;
  assignedAt: string;
  status: CourseParticipantStatus;
};

export type AttendanceDashboardRecordInput = {
  sessionId: UUID;
  participantId: UUID;
  status: AttendanceStatus;
  note?: string | null;
};

export type AttendanceDashboardCourseInput = {
  id: UUID;
  name: string;
  status: CourseStatus;
};

export type AttendanceDashboardSessionState =
  | "upcoming"
  | "in_progress"
  | "ended"
  | "cancelled";

export type AttendanceDashboardDailySession = {
  sessionId: UUID;
  sessionNo: number;
  date: string;
  startsAt: string;
  endsAt: string;
  state: AttendanceDashboardSessionState;
  participantCount: number;
  presentCount: number;
  partialCount: number;
  absentCount: number;
  missingAttendanceCount: number;
  attendanceRate: number | null;
};

export type AttendanceDashboardSessionHistory = {
  sessionId: UUID;
  sessionNo: number;
  date: string;
  status: AttendanceStatus | "missing";
  note: string | null;
};

export type AttendanceDashboardParticipant = {
  participantId: UUID;
  participantName: string;
  attendanceRate: number | null;
  attendedSessionCount: number;
  validSessionCount: number;
  presentCount: number;
  partialCount: number;
  absentCount: number;
  sessionHistory: AttendanceDashboardSessionHistory[];
};

export type AttendanceDashboardCourse = {
  id: UUID;
  name: string;
  status: CourseStatus;
  dailySessions: AttendanceDashboardDailySession[];
  participants: AttendanceDashboardParticipant[];
  lowAttendanceParticipantIds: UUID[];
  missingAttendanceCount: number;
  warning: boolean;
  warningReasons: string[];
};

export type AttendanceDashboardOutput = {
  selectedDate: string;
  courses: AttendanceDashboardCourse[];
  summary: {
    missingAttendanceCount: number;
    lowAttendanceParticipantCount: number;
  };
};

type BuildAttendanceDashboardInput = {
  selectedDate: string;
  now: string;
  timezone: string;
  courses: AttendanceDashboardCourseInput[];
  sessions: AttendanceDashboardSessionInput[];
  participants: AttendanceDashboardParticipantInput[];
  records: AttendanceDashboardRecordInput[];
};

export function buildAttendanceDashboard(
  input: BuildAttendanceDashboardInput,
): AttendanceDashboardOutput {
  const localNow = getLocalNow(input.now, input.timezone);
  const sessionsByCourse = groupBy(input.sessions, (session) => session.courseId);
  const participantsByCourse = groupBy(
    input.participants.filter((participant) => participant.status === "active"),
    (participant) => participant.courseId,
  );
  const recordsBySessionParticipant = new Map<string, AttendanceDashboardRecordInput>();

  for (const record of input.records) {
    recordsBySessionParticipant.set(recordKey(record.sessionId, record.participantId), record);
  }

  const courses = input.courses.map((course) => {
    const courseSessions = (sessionsByCourse.get(course.id) ?? [])
      .filter((session) => session.rollupStatus === "included")
      .filter((session) => session.progressStatus !== "cancelled")
      .sort(compareSessions);
    const courseParticipants = participantsByCourse.get(course.id) ?? [];
    const participantResults = courseParticipants
      .map((participant) =>
        buildParticipantResult({
          participant,
          sessions: courseSessions,
          recordsBySessionParticipant,
          localNow,
        }),
      )
      .sort(compareParticipants);

    const dailySessions = courseSessions
      .filter((session) => session.date === input.selectedDate)
      .map((session) =>
        buildDailySession({
          session,
          participants: courseParticipants,
          recordsBySessionParticipant,
          localNow,
        }),
      );
    const lowAttendanceParticipantIds = participantResults
      .filter((participant) => isLowAttendance(participant.attendanceRate))
      .map((participant) => participant.participantId);
    const missingAttendanceCount = dailySessions.reduce(
      (total, session) => total + (session.state === "ended" ? session.missingAttendanceCount : 0),
      0,
    );
    const warningReasons: string[] = [];
    if (lowAttendanceParticipantIds.length > 0) {
      warningReasons.push("저출석 " + lowAttendanceParticipantIds.length + "명");
    }
    if (missingAttendanceCount > 0) {
      warningReasons.push("미입력 " + missingAttendanceCount + "건");
    }

    return {
      id: course.id,
      name: course.name,
      status: course.status,
      dailySessions,
      participants: participantResults,
      lowAttendanceParticipantIds,
      missingAttendanceCount,
      warning: warningReasons.length > 0,
      warningReasons,
    };
  });

  return {
    selectedDate: input.selectedDate,
    courses,
    summary: {
      missingAttendanceCount: courses.reduce(
        (total, course) => total + course.missingAttendanceCount,
        0,
      ),
      lowAttendanceParticipantCount: courses.reduce(
        (total, course) => total + course.lowAttendanceParticipantIds.length,
        0,
      ),
    },
  };
}

function buildDailySession(input: {
  session: AttendanceDashboardSessionInput;
  participants: AttendanceDashboardParticipantInput[];
  recordsBySessionParticipant: Map<string, AttendanceDashboardRecordInput>;
  localNow: LocalNow;
}): AttendanceDashboardDailySession {
  const state = getSessionState(input.session, input.localNow);
  let presentCount = 0;
  let partialCount = 0;
  let absentCount = 0;
  let missingAttendanceCount = 0;

  for (const participant of input.participants) {
    if (!isAssignedForSession(participant, input.session)) continue;
    const record = input.recordsBySessionParticipant.get(
      recordKey(input.session.id, participant.participantId),
    );
    if (!record) {
      if (state !== "upcoming") missingAttendanceCount += 1;
      continue;
    }
    if (record.status === "present") presentCount += 1;
    if (record.status === "partial") partialCount += 1;
    if (record.status === "absent") absentCount += 1;
  }

  const participantCount = input.participants.filter((participant) =>
    isAssignedForSession(participant, input.session),
  ).length;
  const recordedAttendanceCount = presentCount + partialCount;

  return {
    sessionId: input.session.id,
    sessionNo: input.session.sessionNo,
    date: input.session.date,
    startsAt: input.session.startsAt,
    endsAt: input.session.endsAt,
    state,
    participantCount,
    presentCount,
    partialCount,
    absentCount,
    missingAttendanceCount: state === "upcoming" ? 0 : missingAttendanceCount,
    attendanceRate:
      participantCount > 0
        ? roundRate((recordedAttendanceCount / participantCount) * 100)
        : null,
  };
}

function buildParticipantResult(input: {
  participant: AttendanceDashboardParticipantInput;
  sessions: AttendanceDashboardSessionInput[];
  recordsBySessionParticipant: Map<string, AttendanceDashboardRecordInput>;
  localNow: LocalNow;
}): AttendanceDashboardParticipant {
  let attendedSessionCount = 0;
  let validSessionCount = 0;
  let presentCount = 0;
  let partialCount = 0;
  let absentCount = 0;
  const sessionHistory: AttendanceDashboardSessionHistory[] = [];

  for (const session of input.sessions) {
    if (!isAssignedForSession(input.participant, session)) continue;
    const state = getSessionState(session, input.localNow);
    if (state !== "ended") continue;
    const record = input.recordsBySessionParticipant.get(
      recordKey(session.id, input.participant.participantId),
    );
    sessionHistory.push({
      sessionId: session.id,
      sessionNo: session.sessionNo,
      date: session.date,
      status: record?.status ?? "missing",
      note: record?.note ?? null,
    });
    if (!record) continue;

    validSessionCount += 1;
    if (record.status === "present") {
      presentCount += 1;
      attendedSessionCount += 1;
    } else if (record.status === "partial") {
      partialCount += 1;
      attendedSessionCount += 1;
    } else if (record.status === "absent") {
      absentCount += 1;
    }
  }

  return {
    participantId: input.participant.participantId,
    participantName: input.participant.participantName,
    attendanceRate:
      validSessionCount > 0
        ? roundRate((attendedSessionCount / validSessionCount) * 100)
        : null,
    attendedSessionCount,
    validSessionCount,
    presentCount,
    partialCount,
    absentCount,
    sessionHistory,
  };
}

function getSessionState(
  session: AttendanceDashboardSessionInput,
  localNow: LocalNow,
): AttendanceDashboardSessionState {
  if (session.progressStatus === "cancelled") return "cancelled";
  if (session.date > localNow.date) return "upcoming";
  if (session.date < localNow.date) return "ended";

  const startsAt = timeToMinutes(session.startsAt);
  const endsAt = timeToMinutes(session.endsAt);
  if (localNow.minutes < startsAt) return "upcoming";
  if (localNow.minutes >= endsAt) return "ended";
  return "in_progress";
}

function isAssignedForSession(
  participant: AttendanceDashboardParticipantInput,
  session: AttendanceDashboardSessionInput,
): boolean {
  return participant.status === "active" && participant.assignedAt.slice(0, 10) <= session.date;
}

function isLowAttendance(rate: number | null): boolean {
  return rate !== null && rate < 50;
}

function compareSessions(
  left: AttendanceDashboardSessionInput,
  right: AttendanceDashboardSessionInput,
): number {
  return (
    left.date.localeCompare(right.date) ||
    left.startsAt.localeCompare(right.startsAt) ||
    left.sessionNo - right.sessionNo
  );
}

function compareParticipants(
  left: AttendanceDashboardParticipant,
  right: AttendanceDashboardParticipant,
): number {
  if (left.attendanceRate === null && right.attendanceRate !== null) return 1;
  if (left.attendanceRate !== null && right.attendanceRate === null) return -1;
  if (left.attendanceRate !== null && right.attendanceRate !== null) {
    const rateOrder = left.attendanceRate - right.attendanceRate;
    if (rateOrder !== 0) return rateOrder;
  }
  return left.participantName.localeCompare(right.participantName, "ko");
}

type LocalNow = { date: string; minutes: number };

function getLocalNow(value: string, timezone: string): LocalNow {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(new Date(value))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return {
    date: parts.year + "-" + parts.month + "-" + parts.day,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function recordKey(sessionId: UUID, participantId: UUID): string {
  return sessionId + ":" + participantId;
}

function roundRate(value: number): number {
  return Math.round(value * 10) / 10;
}

function groupBy<T>(values: T[], keyOf: (value: T) => UUID): Map<UUID, T[]> {
  const grouped = new Map<UUID, T[]>();
  for (const value of values) {
    const key = keyOf(value);
    const current = grouped.get(key) ?? [];
    current.push(value);
    grouped.set(key, current);
  }
  return grouped;
}
