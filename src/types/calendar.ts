import type {
  CourseSessionSummary,
  GroupSummary,
  InstructorSummary,
  ISODate,
  ISOTime,
  SessionType,
  UUID,
} from '@/types/course';

export type CalendarItem =
  | {
      kind: 'course_session';
      session: CourseSessionSummary;
      instructor: InstructorSummary | null;
      groups: GroupSummary[];
      canUpdateSessionDisplay: boolean;
    }
  | {
      kind: 'general_schedule_item';
      item: {
        id: UUID;
        title: string;
        date: ISODate;
        startsAt: ISOTime | null;
        endsAt: ISOTime | null;
        description: string | null;
        color: string | null;
        groups: GroupSummary[];
        canEdit: boolean;
        canDelete: boolean;
      };
    };

export type GetCalendarMonthInput = {
  workspaceId: UUID;
  month: string;
  groupId?: UUID;
};

export type GetCalendarMonthOutput = {
  timezone: string;
  items: CalendarItem[];
};

export const SESSION_CHIP_STYLES: Record<SessionType, string> = {
  regular: 'bg-blue-100 text-blue-700',
  makeup: 'bg-red-100 text-red-700',
  special: 'bg-purple-100 text-purple-700',
  practice: 'bg-green-100 text-green-700',
};

export const LEGEND_ITEMS: { type: SessionType; label: string }[] = [
  { type: 'regular', label: '정규' },
  { type: 'makeup', label: '보충' },
  { type: 'special', label: '특강' },
  { type: 'practice', label: '실습' },
];
