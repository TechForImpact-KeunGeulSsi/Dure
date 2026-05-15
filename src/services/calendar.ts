import { parse } from 'date-fns';

import type {
  CalendarItem,
  GetCalendarMonthInput,
  GetCalendarMonthOutput,
} from '@/types/calendar';
import type { GroupSummary, InstructorSummary } from '@/types/course';

const MOCK_TIMEZONE = 'Asia/Seoul';

const MOCK_GROUP: GroupSummary = {
  id: 'group-001',
  name: '햇살 그룹',
  description: '청도 권역',
  status: 'active',
};

const MOCK_INSTRUCTOR: InstructorSummary = {
  id: 'member-001',
  email: 'instructor@dure.app',
  displayName: '김강사',
  status: 'active',
};

/** api-spec.md §5.1 — getCalendarMonth Mock */
export async function getCalendarMonth(
  input: GetCalendarMonthInput,
): Promise<GetCalendarMonthOutput> {
  await delay();
  void input.workspaceId;
  void input.groupId;

  return {
    timezone: MOCK_TIMEZONE,
    items: buildMonthItems(input.month),
  };
}

function buildMonthItems(month: string): CalendarItem[] {
  const [year, monthNum] = month.split('-').map(Number);
  if (!year || !monthNum) return buildDefaultMay2026();

  if (year === 2026 && monthNum === 5) {
    return buildDefaultMay2026();
  }

  return buildSparseMonth(year, monthNum);
}

function buildDefaultMay2026(): CalendarItem[] {
  const sessions: CalendarItem[] = [
    sessionItem('2026-05-10', 1, '요리 수업', 'regular', '10:00:00', '12:00:00', '#2563EB'),
    sessionItem('2026-05-13', 2, '파이썬 입문', 'regular', '10:00:00', '11:30:00', '#2563EB'),
    sessionItem('2026-05-13', 3, '미술 수업', 'special', '14:00:00', '16:00:00', '#8B5CF6'),
    sessionItem('2026-05-15', 1, '요리 수업', 'regular', '10:00:00', '12:00:00', '#2563EB'),
    sessionItem('2026-05-15', 2, '영어 회화', 'practice', '13:00:00', '14:30:00', '#16A34A'),
    sessionItem('2026-05-15', 3, '체육 보충', 'makeup', '15:00:00', '16:00:00', '#DC2626'),
    sessionItem('2026-05-17', 1, '요리 수업', 'regular', '10:00:00', '12:00:00', '#2563EB'),
    sessionItem('2026-05-20', 1, '미술 수업', 'special', '10:00:00', '12:00:00', '#8B5CF6'),
    sessionItem('2026-05-22', 1, '영어 회화', 'practice', '14:00:00', '15:30:00', '#16A34A'),
    sessionItem('2026-05-24', 1, '체육 보충', 'makeup', '10:00:00', '11:00:00', '#DC2626'),
    sessionItem('2026-05-27', 1, '파이썬 입문', 'regular', '10:00:00', '12:00:00', '#2563EB'),
    sessionItem('2026-05-29', 1, '요리 수업', 'regular', '10:00:00', '12:00:00', '#2563EB'),
  ];

  const general: CalendarItem[] = [
    generalItem('gs-001', '운영자 미팅', '2026-05-08', '09:00:00', '10:00:00', '#F97316'),
    generalItem('gs-002', '센터 점검', '2026-05-13', '09:00:00', '10:30:00', '#F97316'),
    generalItem('gs-003', '강사 워크숍', '2026-05-19', '15:00:00', '17:00:00', '#EA580C'),
    generalItem('gs-004', '학부모 상담', '2026-05-25', '11:00:00', '12:00:00', '#F97316'),
    generalItem('gs-005', '월말 정산', '2026-05-30', '16:00:00', '17:30:00', '#EA580C'),
  ];

  return [...sessions, ...general];
}

function buildSparseMonth(year: number, monthNum: number): CalendarItem[] {
  const monthStr = `${year}-${String(monthNum).padStart(2, '0')}`;
  const baseDate = parse(`${monthStr}-08`, 'yyyy-MM-dd', new Date());

  return [
    sessionItem(
      formatIso(baseDate),
      1,
      '요리 수업',
      'regular',
      '10:00:00',
      '12:00:00',
      '#2563EB',
    ),
    sessionItem(
      formatIso(addDays(baseDate, 7)),
      2,
      '미술 수업',
      'special',
      '14:00:00',
      '16:00:00',
      '#8B5CF6',
    ),
    generalItem(
      `gs-${monthStr}-1`,
      '운영 회의',
      formatIso(addDays(baseDate, 14)),
      '09:00:00',
      '10:00:00',
      '#F97316',
    ),
  ];
}

function sessionItem(
  date: string,
  sessionNo: number,
  courseName: string,
  type: 'regular' | 'makeup' | 'special' | 'practice',
  startsAt: string,
  endsAt: string,
  _color: string,
): CalendarItem {
  const courseId = `course-${courseName.replace(/\s/g, '-').toLowerCase()}`;
  return {
    kind: 'course_session',
    session: {
      id: `${courseId}-${date}-s${sessionNo}`,
      courseId,
      courseName,
      sessionNo,
      date,
      startsAt,
      endsAt,
      type,
      visibilityStatus: 'visible',
      rollupStatus: 'included',
      progressStatus: 'scheduled',
    },
    instructor: MOCK_INSTRUCTOR,
    groups: [MOCK_GROUP],
    canUpdateSessionDisplay: true,
  };
}

function generalItem(
  id: string,
  title: string,
  date: string,
  startsAt: string,
  endsAt: string,
  color: string,
): CalendarItem {
  return {
    kind: 'general_schedule_item',
    item: {
      id,
      title,
      date,
      startsAt,
      endsAt,
      description: null,
      color,
      groups: [MOCK_GROUP],
      canEdit: true,
      canDelete: true,
    },
  };
}

function formatIso(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function delay(ms = 60) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
