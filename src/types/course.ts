export type UUID = string;
export type ISODate = string;
export type ISOTime = string;

export type CourseStatus = 'planned' | 'in_progress' | 'completed';
export type GroupStatus = 'active' | 'inactive';
export type MemberStatus = 'active' | 'invited' | 'disabled' | 'removed';
export type SessionType = 'regular' | 'makeup' | 'special' | 'practice';
export type SessionVisibilityStatus = 'visible' | 'hidden';
export type SessionRollupStatus = 'included' | 'excluded';
export type SessionProgressStatus = 'scheduled' | 'cancelled';
export type ParticipantStatus = 'active' | 'inactive' | 'deleted';
export type CourseParticipantStatus = 'active' | 'excluded';
export type AttendanceStatus = 'present' | 'partial' | 'absent';

export type GroupSummary = {
  id: UUID;
  name: string;
  description: string | null;
  status: GroupStatus;
};

export type InstructorSummary = {
  id: UUID;
  email: string;
  displayName: string | null;
  status: MemberStatus;
};

export type CourseSummary = {
  id: UUID;
  name: string;
  status: CourseStatus;
  startsOn: ISODate | null;
  endsOn: ISODate | null;
  cardColor: string | null;
  bannerUrl: string | null;
};

export type CourseSessionSummary = {
  id: UUID;
  courseId: UUID;
  courseName: string;
  sessionNo: number;
  date: ISODate;
  startsAt: ISOTime;
  endsAt: ISOTime;
  type: SessionType;
  visibilityStatus: SessionVisibilityStatus;
  rollupStatus: SessionRollupStatus;
  progressStatus: SessionProgressStatus;
  cancellationReason: string | null;
};

export type ParticipantSummary = {
  id: UUID;
  name: string;
  email: string | null;
  status: ParticipantStatus;
};

export type GetCourseHomeInput = {
  workspaceId: UUID;
  courseId: UUID;
};

export type GetCourseHomeOutput = {
  course: CourseSummary & {
    groups: GroupSummary[];
    instructor: InstructorSummary | null;
    canUpdateVisuals: boolean;
  };
};

export type GetCourseSessionsInput = {
  workspaceId: UUID;
  courseId: UUID;
};

export type GetCourseSessionsOutput = {
  sessions: CourseSessionSummary[];
};

export type CourseHomePageData = GetCourseHomeOutput & {
  sessions: CourseSessionSummary[];
  sessionCount: number;
};

export type CourseParticipantStatusItem = {
  courseParticipantId: UUID | null;
  participant: ParticipantSummary;
  assignmentGroups: GroupSummary[];
  assignmentStatus: CourseParticipantStatus;
  presentCount: number;
  partialCount: number;
  absentCount: number;
  attendanceRate: number | null;
  latestNote: string | null;
  canEditAssignment: boolean;
};

export type GetCourseParticipantsStatusInput = {
  workspaceId: UUID;
  courseId: UUID;
};

export type GetCourseParticipantsStatusOutput = {
  course: CourseSummary;
  summary: {
    attendanceRate: number | null;
    partialCount: number;
    absentCount: number;
    countedSessionCount: number;
  };
  participants: CourseParticipantStatusItem[];
};

export type DashboardCourseItem = CourseSummary & {
  groups: GroupSummary[];
  instructor: InstructorSummary | null;
  participantCount: number;
  sessionCount: number;
  nextSession: CourseSessionSummary | null;
  pendingMaterialCount: number;
};

export const COURSE_STATUS_LABEL: Record<CourseStatus, string> = {
  planned: '진행 전',
  in_progress: '진행 중',
  completed: '진행 완료',
};

export const SESSION_TYPE_LABEL: Record<SessionType, string> = {
  regular: '정규',
  makeup: '보강',
  special: '특별',
  practice: '연습',
};

export const SESSION_VISIBILITY_LABEL: Record<SessionVisibilityStatus, string> = {
  visible: '표시',
  hidden: '숨김',
};

export const SESSION_ROLLUP_LABEL: Record<SessionRollupStatus, string> = {
  included: '포함',
  excluded: '제외',
};

export const SESSION_PROGRESS_LABEL: Record<SessionProgressStatus, string> = {
  scheduled: '예정',
  cancelled: '취소',
};

export const COURSE_PARTICIPANT_STATUS_LABEL: Record<CourseParticipantStatus, string> = {
  active: '참여 중',
  excluded: '제외됨',
};

export type ParticipantRowStatus = 'normal' | 'attention';

export const PARTICIPANT_ROW_STATUS_LABEL: Record<ParticipantRowStatus, string> = {
  normal: '정상',
  attention: '주의',
};
