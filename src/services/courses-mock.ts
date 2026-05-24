import type {
  CourseHomePageData,
  CourseParticipantStatusItem,
  CourseSessionSummary,
  DashboardCourseItem,
  GetCourseHomeInput,
  GetCourseHomeOutput,
  GetCourseParticipantsStatusInput,
  GetCourseParticipantsStatusOutput,
  GetCourseSessionsInput,
  GetCourseSessionsOutput,
  UUID,
} from '@/types/course';

const MOCK_WORKSPACE_ID = 'ws-demo-001';

const MOCK_COURSES: Record<UUID, GetCourseHomeOutput['course']> = {
  'course-001': {
    id: 'course-001',
    name: '요리 수업',
    status: 'in_progress',
    startsOn: '2026-03-01',
    endsOn: '2026-06-30',
    cardColor: '#2563EB',
    bannerUrl: null,
    groups: [
      {
        id: 'group-001',
        name: '햇살 그룹',
        description: '청도 권역',
        status: 'active',
      },
    ],
    instructor: {
      id: 'member-001',
      email: 'instructor@dure.app',
      displayName: '김강사',
      status: 'active',
    },
    canUpdateVisuals: true,
  },
  'course-002': {
    id: 'course-002',
    name: '미술 수업',
    status: 'planned',
    startsOn: '2026-04-01',
    endsOn: '2026-08-31',
    cardColor: '#8B5CF6',
    bannerUrl: null,
    groups: [
      {
        id: 'group-002',
        name: '바람 그룹',
        description: '서울 권역',
        status: 'active',
      },
    ],
    instructor: null,
    canUpdateVisuals: true,
  },
  'course-003': {
    id: 'course-003',
    name: '영어 회화',
    status: 'completed',
    startsOn: '2025-09-01',
    endsOn: '2026-02-28',
    cardColor: '#111827',
    bannerUrl: null,
    groups: [
      {
        id: 'group-001',
        name: '햇살 그룹',
        description: '기초 회화 과정',
        status: 'active',
      },
    ],
    instructor: {
      id: 'member-002',
      email: 'sarah@dure.app',
      displayName: '사라 젠킨스',
      status: 'active',
    },
    canUpdateVisuals: true,
  },
  'course-004': {
    id: 'course-004',
    name: '체육',
    status: 'in_progress',
    startsOn: '2026-02-01',
    endsOn: '2026-07-31',
    cardColor: '#EA580C',
    bannerUrl: null,
    groups: [
      {
        id: 'group-002',
        name: '바람 그룹',
        description: '주말 체육반',
        status: 'active',
      },
    ],
    instructor: {
      id: 'member-003',
      email: 'coach@dure.app',
      displayName: '박코치',
      status: 'active',
    },
    canUpdateVisuals: true,
  },
  'course-005': {
    id: 'course-005',
    name: '코딩 기초',
    status: 'planned',
    startsOn: '2026-06-01',
    endsOn: '2026-09-30',
    cardColor: '#0D9488',
    bannerUrl: null,
    groups: [
      {
        id: 'group-001',
        name: '햇살 그룹',
        description: '파이썬 입문',
        status: 'active',
      },
    ],
    instructor: {
      id: 'member-001',
      email: 'instructor@dure.app',
      displayName: '김강사',
      status: 'active',
    },
    canUpdateVisuals: true,
  },
};

const MOCK_PARTICIPANTS: CourseParticipantStatusItem[] = [
  {
    courseParticipantId: 'cp-001',
    participant: {
      id: 'participant-001',
      name: '김하나',
      email: 'hana@dure.app',
      status: 'active',
    },
    assignmentGroups: [{ id: 'group-001', name: '햇살 그룹', description: '청도 권역', status: 'active' }],
    assignmentStatus: 'active',
    presentCount: 12,
    partialCount: 0,
    absentCount: 0,
    attendanceRate: null,
    latestNote: '과제 제출과 출석 모두 안정적입니다.',
    canEditAssignment: true,
  },
  {
    courseParticipantId: 'cp-002',
    participant: {
      id: 'participant-002',
      name: '이민준',
      email: 'minjun@dure.app',
      status: 'active',
    },
    assignmentGroups: [{ id: 'group-001', name: '햇살 그룹', description: '청도 권역', status: 'active' }],
    assignmentStatus: 'active',
    presentCount: 11,
    partialCount: 1,
    absentCount: 0,
    attendanceRate: null,
    latestNote: '지난주 1회 부분 출석, 보호자 안내 완료',
    canEditAssignment: true,
  },
  {
    courseParticipantId: 'cp-003',
    participant: {
      id: 'participant-003',
      name: '박서연',
      email: 'seoyeon@dure.app',
      status: 'active',
    },
    assignmentGroups: [{ id: 'group-001', name: '햇살 그룹', description: '청도 권역', status: 'active' }],
    assignmentStatus: 'active',
    presentCount: 11,
    partialCount: 0,
    absentCount: 1,
    attendanceRate: null,
    latestNote: '감기 결석 1회, 보충 자료 전달',
    canEditAssignment: true,
  },
  {
    courseParticipantId: 'cp-004',
    participant: {
      id: 'participant-004',
      name: '최지우',
      email: 'jiwoo@dure.app',
      status: 'active',
    },
    assignmentGroups: [{ id: 'group-001', name: '햇살 그룹', description: '청도 권역', status: 'active' }],
    assignmentStatus: 'excluded',
    presentCount: 8,
    partialCount: 0,
    absentCount: 2,
    attendanceRate: null,
    latestNote: '수업 제외 처리됨',
    canEditAssignment: true,
  },
];

function buildSessions(courseId: UUID, courseName: string): CourseSessionSummary[] {
  return [
    {
      id: `${courseId}-session-1`,
      courseId,
      courseName,
      sessionNo: 1,
      date: '2026-05-10',
      startsAt: '10:00:00',
      endsAt: '12:00:00',
      type: 'regular',
      visibilityStatus: 'visible',
      rollupStatus: 'included',
      progressStatus: 'scheduled',
      cancellationReason: null,
    },
    {
      id: `${courseId}-session-2`,
      courseId,
      courseName,
      sessionNo: 2,
      date: '2026-05-17',
      startsAt: '10:00:00',
      endsAt: '12:00:00',
      type: 'regular',
      visibilityStatus: 'visible',
      rollupStatus: 'included',
      progressStatus: 'scheduled',
      cancellationReason: null,
    },
    {
      id: `${courseId}-session-3`,
      courseId,
      courseName,
      sessionNo: 3,
      date: '2026-05-24',
      startsAt: '14:00:00',
      endsAt: '16:00:00',
      type: 'makeup',
      visibilityStatus: 'hidden',
      rollupStatus: 'included',
      progressStatus: 'scheduled',
      cancellationReason: null,
    },
    {
      id: `${courseId}-session-4`,
      courseId,
      courseName,
      sessionNo: 4,
      date: '2026-05-31',
      startsAt: '10:00:00',
      endsAt: '12:00:00',
      type: 'special',
      visibilityStatus: 'visible',
      rollupStatus: 'excluded',
      progressStatus: 'cancelled',
      cancellationReason: '공휴일',
    },
  ];
}

function resolveCourse(courseId: UUID): GetCourseHomeOutput['course'] {
  const found = MOCK_COURSES[courseId];
  if (found) return found;

  return {
    id: courseId,
    name: '요리 수업',
    status: 'in_progress',
    startsOn: '2026-03-01',
    endsOn: '2026-06-30',
    cardColor: '#2563EB',
    bannerUrl: null,
    groups: [
      {
        id: 'group-001',
        name: '햇살 그룹',
        description: '청도 권역',
        status: 'active',
      },
    ],
    instructor: {
      id: 'member-001',
      email: 'instructor@dure.app',
      displayName: '김강사',
      status: 'active',
    },
    canUpdateVisuals: true,
  };
}

/** Mock: getCourseHome — api-spec.md §10.1 */
export async function getCourseHome(
  input: GetCourseHomeInput,
): Promise<GetCourseHomeOutput> {
  await delay();
  void input.workspaceId;
  return { course: resolveCourse(input.courseId) };
}

/** Mock: getCourseSessions */
export async function getCourseSessions(
  input: GetCourseSessionsInput,
): Promise<GetCourseSessionsOutput> {
  await delay();
  const course = resolveCourse(input.courseId);
  return {
    sessions: buildSessions(course.id, course.name),
  };
}

/** Mock: course home tab aggregate */
export async function getCourseHomePageData(
  input: GetCourseHomeInput,
): Promise<CourseHomePageData> {
  const [{ course }, { sessions }] = await Promise.all([
    getCourseHome(input),
    getCourseSessions(input),
  ]);

  return {
    course,
    sessions,
    sessionCount: sessions.length,
  };
}

/** Mock: getCourseParticipantsStatus — api-spec.md §12.1 */
export async function getCourseParticipantsStatus(
  input: GetCourseParticipantsStatusInput,
): Promise<GetCourseParticipantsStatusOutput> {
  await delay();
  const course = resolveCourse(input.courseId);

  return {
    course: {
      id: course.id,
      name: course.name,
      status: course.status,
      startsOn: course.startsOn,
      endsOn: course.endsOn,
      cardColor: course.cardColor,
      bannerUrl: course.bannerUrl,
    },
    summary: {
      attendanceRate: null,
      partialCount: 0,
      absentCount: 0,
      countedSessionCount: 0,
    },
    participants: MOCK_PARTICIPANTS,
  };
}

/** Mock: getDashboardHome courses list */
export async function getDashboardCourses(
  workspaceId: UUID,
): Promise<DashboardCourseItem[]> {
  await delay();
  void workspaceId;

  return Object.values(MOCK_COURSES).map((course) => ({
    ...course,
    participantCount: 24,
    sessionCount: 12,
    nextSession: buildSessions(course.id, course.name)[0] ?? null,
    pendingMaterialCount: 2,
  }));
}

export function getDefaultWorkspaceId(): UUID {
  return MOCK_WORKSPACE_ID;
}

function delay(ms = 80) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
