'use client';

import { addDays, format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  AlertTriangle,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ExternalLink,
  RotateCcw,
  UserRound,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition, type CSSProperties } from 'react';

import { cn } from '@/lib/utils/cn';
import type { AttendanceStatus, WorkspaceRole } from '@/lib/api/types';
import type {
  AttendanceDashboardCourse,
  AttendanceDashboardDailySession,
  AttendanceDashboardOutput,
  AttendanceDashboardParticipant,
} from '@/services/attendance-dashboard-logic';

type StatusKey = AttendanceStatus | 'missing';

const STATUS_CONFIG: Array<{
  key: StatusKey;
  label: string;
  className: string;
  style: CSSProperties;
}> = [
  { key: 'present', label: '출석', className: 'bg-emerald-600', style: {} },
  {
    key: 'partial',
    label: '부분 출석',
    className: 'bg-lime-300',
    style: {
      backgroundImage:
        'repeating-linear-gradient(135deg, rgba(55, 84, 27, .28) 0 1px, transparent 1px 4px)',
    },
  },
  {
    key: 'absent',
    label: '결석',
    className: 'bg-red-300',
    style: {
      backgroundImage:
        'repeating-linear-gradient(45deg, rgba(142, 39, 39, .3) 0 1px, transparent 1px 4px), repeating-linear-gradient(-45deg, rgba(142, 39, 39, .18) 0 1px, transparent 1px 5px)',
    },
  },
  {
    key: 'missing',
    label: '미입력',
    className: 'bg-slate-200',
    style: {
      backgroundImage:
        'radial-gradient(rgba(88, 104, 126, .65) .8px, transparent .8px)',
      backgroundSize: '5px 5px',
    },
  },
];

type DashboardHomeClientProps = {
  workspaceId: string;
  timezone: string;
  role: WorkspaceRole;
  initialData: AttendanceDashboardOutput;
};

export function DashboardHomeClient({
  workspaceId,
  timezone,
  role,
  initialData,
}: DashboardHomeClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>(() =>
    initialData.courses.map((course) => course.id),
  );
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [selectedParticipantId, setSelectedParticipantId] = useState<string | null>(null);
  const [activeStatus, setActiveStatus] = useState<StatusKey | null>(null);

  useEffect(() => {
    setSelectedCourseIds(initialData.courses.map((course) => course.id));
    setSelectedCourseId(null);
    setSelectedParticipantId(null);
    setActiveStatus(null);
  }, [initialData.selectedDate, initialData.courses]);

  const visibleCourses = useMemo(
    () => initialData.courses.filter((course) => selectedCourseIds.includes(course.id)),
    [initialData.courses, selectedCourseIds],
  );
  const visibleSessions = useMemo(
    () =>
      visibleCourses.flatMap((course) =>
        course.dailySessions.map((session) => ({ course, session })),
      ),
    [visibleCourses],
  );
  const visibleMissingCount = visibleCourses.reduce(
    (total, course) => total + course.missingAttendanceCount,
    0,
  );
  const visibleLowCount = visibleCourses.reduce(
    (total, course) => total + course.lowAttendanceParticipantIds.length,
    0,
  );
  const selectedCourse =
    visibleCourses.find((course) => course.id === selectedCourseId) ?? null;
  const selectedParticipant =
    selectedCourse?.participants.find(
      (participant) => participant.participantId === selectedParticipantId,
    ) ?? null;
  const today = getTodayInTimezone(timezone);
  const isToday = initialData.selectedDate === today;

  function toggleCourse(courseId: string) {
    setSelectedCourseIds((current) => {
      if (current.includes(courseId)) {
        if (current.length === 1) return current;
        return current.filter((id) => id !== courseId);
      }
      return [...current, courseId];
    });
    if (selectedCourseId === courseId) {
      setSelectedCourseId(null);
      setSelectedParticipantId(null);
    }
  }

  function selectAllCourses() {
    setSelectedCourseIds(initialData.courses.map((course) => course.id));
    setSelectedCourseId(null);
    setSelectedParticipantId(null);
  }

  function navigateDate(date: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('date', date);
    const query = params.toString();
    startTransition(() => {
      router.push(query ? pathname + '?' + query : pathname);
    });
  }

  function shiftDate(days: number) {
    const date = format(addDays(parseISO(initialData.selectedDate), days), 'yyyy-MM-dd');
    navigateDate(date);
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-[var(--color-primary)]">운영 현황</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--color-foreground)]">
            {isToday ? '오늘의 출석 현황' : '출석 현황'}
          </h1>
          <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
            날짜와 수업을 고르면 회차별 출석 현황과 참여자별 누적 출석률을 바로 볼 수 있어요.
          </p>
        </div>

        <div className="flex items-center gap-1 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-card)] p-1 shadow-sm">
          <DateButton
            label="이전 날짜"
            onClick={() => shiftDate(-1)}
            disabled={isPending}
          >
            <ChevronLeft className="size-4" />
          </DateButton>
          <label className="flex h-9 items-center gap-2 rounded-[var(--radius-md)] px-2 text-sm font-semibold text-[var(--color-foreground)]">
            <CalendarDays className="size-4 text-[var(--color-primary)]" />
            <span>{formatDateLabel(initialData.selectedDate)}</span>
            <input
              type="date"
              value={initialData.selectedDate}
              onChange={(event) => {
                if (event.target.value) navigateDate(event.target.value);
              }}
              className="sr-only"
              aria-label="날짜 선택"
            />
          </label>
          <DateButton
            label="다음 날짜"
            onClick={() => shiftDate(1)}
            disabled={isPending}
          >
            <ChevronRight className="size-4" />
          </DateButton>
          {!isToday && (
            <button
              type="button"
              className="mr-1 inline-flex h-9 items-center gap-1 rounded-[var(--radius-md)] px-2 text-xs font-semibold text-[var(--color-primary)] hover:bg-[var(--color-muted)]"
              onClick={() => navigateDate(today)}
              disabled={isPending}
            >
              <RotateCcw className="size-3.5" />
              오늘
            </button>
          )}
        </div>
      </header>

      <section
        aria-label="수업 필터"
        className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-card)] p-2 shadow-sm"
      >
        <div className="flex items-center gap-3">
          <div className="flex shrink-0 items-center gap-2 px-2 text-xs font-semibold text-[var(--color-muted-foreground)]">
            <span className="size-2 rounded-full bg-[var(--color-primary)]" />
            수업
          </div>
          <div className="h-5 w-px shrink-0 bg-[var(--color-border)]" />
          <div className="scrollbar-none flex min-w-0 flex-1 gap-1 overflow-x-auto">
            <button
              type="button"
              aria-pressed={selectedCourseIds.length === initialData.courses.length}
              onClick={selectAllCourses}
              className={cn(
                'shrink-0 rounded-[var(--radius-md)] px-3 py-2 text-xs font-semibold transition-colors',
                selectedCourseIds.length === initialData.courses.length
                  ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
                  : 'text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)]',
              )}
            >
              전체 수업
            </button>
            {initialData.courses.map((course) => {
              const selected = selectedCourseIds.includes(course.id);
              return (
                <button
                  key={course.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleCourse(course.id)}
                  className={cn(
                    'inline-flex shrink-0 items-center gap-2 rounded-[var(--radius-md)] px-3 py-2 text-xs font-semibold transition-colors',
                    selected
                      ? 'bg-blue-50 text-[var(--color-primary)] ring-1 ring-inset ring-blue-100'
                      : 'text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)]',
                  )}
                >
                  <span
                    className={cn(
                      'size-2 rounded-full',
                      selected ? 'bg-[var(--color-primary)]' : 'bg-slate-300',
                    )}
                  />
                  {course.name}
                  {selected && <Check className="size-3.5" />}
                </button>
              );
            })}
          </div>
          <span className="hidden shrink-0 pr-2 text-xs text-[var(--color-muted-foreground)] sm:block">
            {visibleCourses.length}개 선택
          </span>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2" aria-label="출석 요약">
        <SummaryMetric
          label="출석 기록 확인 필요"
          value={visibleMissingCount}
          unit="건"
          icon={<Clock3 className="size-5" />}
          tone="warning"
          onClick={() => setActiveStatus(activeStatus === 'missing' ? null : 'missing')}
          active={activeStatus === 'missing'}
        />
        <SummaryMetric
          label="저출석 이용자"
          value={visibleLowCount}
          unit="명"
          icon={<AlertTriangle className="size-5" />}
          tone="danger"
          onClick={() => {
            const firstWarning = visibleCourses.find(
              (course) => course.lowAttendanceParticipantIds.length > 0,
            );
            if (firstWarning) {
              setSelectedCourseId(firstWarning.id);
              setSelectedParticipantId(null);
            }
          }}
          active={selectedCourseId !== null}
        />
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.75fr)_minmax(300px,0.75fr)]">
        <section className="min-w-0 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-card)] shadow-sm">
          <div className="flex flex-col gap-3 border-b border-[var(--color-border)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 rounded-[var(--radius-md)] bg-blue-50 p-2 text-[var(--color-primary)]">
                <span className="block text-sm font-bold">▥</span>
              </span>
              <div>
                <h2 className="text-base font-semibold text-[var(--color-foreground)]">
                  {selectedCourse
                    ? selectedCourse.name + ' 참여자 출석률'
                    : isToday
                      ? '오늘 수업 출석 현황'
                      : formatDateLabel(initialData.selectedDate) + ' 수업 출석 현황'}
                </h2>
                <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                  {selectedCourse
                    ? '50% 기준선 아래의 참여자부터 확인하세요.'
                    : '수업 회차를 클릭하면 해당 수업의 참여자 분석으로 이동합니다.'}
                </p>
              </div>
            </div>
            {selectedCourse ? (
              <button
                type="button"
                onClick={() => {
                  setSelectedCourseId(null);
                  setSelectedParticipantId(null);
                }}
                className="self-start text-xs font-semibold text-[var(--color-primary)] hover:underline"
              >
                전체 수업 보기
              </button>
            ) : (
              <span className="text-xs text-[var(--color-muted-foreground)]">
                {formatDateLabel(initialData.selectedDate)}
              </span>
            )}
          </div>

          {selectedCourse ? (
            <ParticipantRateChart
              course={selectedCourse}
              selectedParticipantId={selectedParticipantId}
              onSelectParticipant={setSelectedParticipantId}
            />
          ) : (
            <DailyAttendanceChart
              rows={visibleSessions}
              activeStatus={activeStatus}
              onSelectStatus={(status) =>
                setActiveStatus(activeStatus === status ? null : status)
              }
              onSelectCourse={(courseId) => {
                setSelectedCourseId(courseId);
                setSelectedParticipantId(null);
              }}
            />
          )}
        </section>

        <aside className="min-w-0 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-card)] shadow-sm">
          {selectedParticipant && selectedCourse ? (
            <ParticipantDetail
              workspaceId={workspaceId}
              role={role}
              course={selectedCourse}
              participant={selectedParticipant}
              onBack={() => setSelectedParticipantId(null)}
            />
          ) : selectedCourse ? (
            <CourseContext
              course={selectedCourse}
              onClose={() => {
                setSelectedCourseId(null);
                setSelectedParticipantId(null);
              }}
              onSelectParticipant={setSelectedParticipantId}
            />
          ) : (
            <WarningContext
              courses={visibleCourses}
              onSelectCourse={(courseId) => {
                setSelectedCourseId(courseId);
                setSelectedParticipantId(null);
              }}
            />
          )}
        </aside>
      </div>
    </div>
  );
}

function DateButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)] disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function SummaryMetric({
  label,
  value,
  unit,
  icon,
  tone,
  onClick,
  active,
}: {
  label: string;
  value: number;
  unit: string;
  icon: React.ReactNode;
  tone: 'warning' | 'danger';
  onClick: () => void;
  active: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex min-h-[92px] items-center justify-between rounded-[var(--radius-lg)] border bg-[var(--color-card)] px-5 text-left shadow-sm transition-colors',
        active
          ? 'border-[var(--color-primary)] ring-2 ring-blue-100'
          : 'border-[var(--color-border)] hover:border-blue-200',
      )}
    >
      <span>
        <span className="block text-sm font-semibold text-[var(--color-muted-foreground)]">
          {label}
        </span>
        <span className="mt-2 block text-3xl font-bold tracking-tight text-[var(--color-foreground)]">
          {value}
          <span
            className={cn(
              'ml-1 text-sm font-semibold',
              tone === 'danger' ? 'text-red-500' : 'text-amber-600',
            )}
          >
            {unit}
          </span>
        </span>
      </span>
      <span
        className={cn(
          'grid size-11 place-items-center rounded-[var(--radius-lg)]',
          tone === 'danger' ? 'bg-red-50 text-red-500' : 'bg-amber-50 text-amber-600',
        )}
      >
        {icon}
      </span>
    </button>
  );
}

function DailyAttendanceChart({
  rows,
  activeStatus,
  onSelectStatus,
  onSelectCourse,
}: {
  rows: Array<{ course: AttendanceDashboardCourse; session: AttendanceDashboardDailySession }>;
  activeStatus: StatusKey | null;
  onSelectStatus: (status: StatusKey) => void;
  onSelectCourse: (courseId: string) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="flex min-h-[330px] flex-col items-center justify-center px-6 text-center">
        <CalendarDays className="size-8 text-slate-300" />
        <p className="mt-3 text-sm font-medium text-[var(--color-foreground)]">
          선택한 날짜에 예정된 수업이 없습니다.
        </p>
        <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
          날짜를 바꾸거나 다른 수업을 선택해 보세요.
        </p>
      </div>
    );
  }

  return (
    <div className="px-5 py-4">
      <div className="grid grid-cols-[minmax(118px,170px)_minmax(0,1fr)_48px] gap-3 px-1 pb-2 text-[10px] font-medium text-[var(--color-muted-foreground)]">
        <span>수업 · 시간</span>
        <span className="flex justify-between"><span>0%</span><span>50%</span><span>100%</span></span>
        <span className="text-right">출석률</span>
      </div>
      <div className="divide-y divide-[var(--color-border)]">
        {rows.map(({ course, session }) => (
          <DailySessionRow
            key={session.sessionId}
            course={course}
            session={session}
            activeStatus={activeStatus}
            onClick={() => onSelectCourse(course.id)}
          />
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-[var(--color-border)] pt-3">
        {STATUS_CONFIG.map((status) => (
          <button
            key={status.key}
            type="button"
            onClick={() => onSelectStatus(status.key)}
            aria-pressed={activeStatus === status.key}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-[var(--radius-md)] px-1.5 py-1 text-[11px] font-medium text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)]',
              activeStatus && activeStatus !== status.key && 'opacity-40',
            )}
          >
            <span className={cn('size-2.5 rounded-[3px]', status.className)} style={status.style} />
            {status.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function DailySessionRow({
  course,
  session,
  activeStatus,
  onClick,
}: {
  course: AttendanceDashboardCourse;
  session: AttendanceDashboardDailySession;
  activeStatus: StatusKey | null;
  onClick: () => void;
}) {
  const total = Math.max(session.participantCount, 1);
  const segments: Array<{ key: StatusKey; count: number }> = [
    { key: 'present', count: session.presentCount },
    { key: 'partial', count: session.partialCount },
    { key: 'absent', count: session.absentCount },
    { key: 'missing', count: session.missingAttendanceCount },
  ];
  const statusLabel =
    session.state === 'upcoming'
      ? '진행 전'
      : session.state === 'in_progress'
        ? '진행 중'
        : session.attendanceRate === null
          ? '—'
          : session.attendanceRate + '%';

  return (
    <button
      type="button"
      onClick={onClick}
      className="grid w-full grid-cols-[minmax(118px,170px)_minmax(0,1fr)_48px] items-center gap-3 px-1 py-4 text-left transition-colors hover:bg-[var(--color-muted)]/50"
    >
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-[var(--color-foreground)]">
          {course.name}
        </span>
        <span className="mt-1 flex items-center gap-1.5 text-[11px] text-[var(--color-muted-foreground)]">
          <Clock3 className="size-3" />
          {formatTime(session.startsAt)}–{formatTime(session.endsAt)}
          <span>·</span>
          {session.participantCount}명
        </span>
      </span>
      {session.state === 'upcoming' ? (
        <span className="flex h-7 items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50 text-[11px] font-medium text-slate-400">
          수업 예정
        </span>
      ) : (
        <span className="flex h-7 min-w-0 overflow-hidden rounded-md bg-slate-100">
          {segments.map((segment) => {
            const status = STATUS_CONFIG.find((item) => item.key === segment.key);
            if (!status || segment.count === 0) return null;
            return (
              <span
                key={segment.key}
                title={status.label + ' ' + segment.count + '명'}
                className={cn(
                  'flex min-w-[3px] items-center justify-center text-[10px] font-bold text-slate-800 transition-opacity',
                  status.className,
                  activeStatus && activeStatus !== segment.key && 'opacity-20',
                )}
                style={{ ...status.style, width: (segment.count / total) * 100 + '%' }}
              >
                {segment.count / total > 0.1 ? segment.count : ''}
              </span>
            );
          })}
        </span>
      )}
      <span className="text-right text-xs font-bold text-[var(--color-foreground)]">
        {statusLabel}
        <span className="mt-1 block text-[10px] font-normal text-[var(--color-muted-foreground)]">
          {session.state === 'upcoming'
            ? ''
            : session.presentCount + session.partialCount + '/' + session.participantCount}
        </span>
      </span>
    </button>
  );
}

function WarningContext({
  courses,
  onSelectCourse,
}: {
  courses: AttendanceDashboardCourse[];
  onSelectCourse: (courseId: string) => void;
}) {
  const warningCourses = courses.filter((course) => course.warning);
  return (
    <div>
      <div className="flex items-start justify-between border-b border-[var(--color-border)] px-5 py-4">
        <div className="flex items-start gap-3">
          <span className="rounded-[var(--radius-md)] bg-amber-50 p-2 text-amber-600">
            <AlertTriangle className="size-4" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-[var(--color-foreground)]">주의 수업</h2>
            <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
              먼저 확인할 수업을 모아봤어요.
            </p>
          </div>
        </div>
        <span className="text-xs font-semibold text-[var(--color-muted-foreground)]">
          {warningCourses.length}개
        </span>
      </div>
      {warningCourses.length === 0 ? (
        <div className="flex min-h-[250px] flex-col items-center justify-center px-6 text-center">
          <Check className="size-8 text-emerald-500" />
          <p className="mt-3 text-sm font-medium text-[var(--color-foreground)]">
            지금 확인할 주의 수업이 없습니다.
          </p>
          <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
            출석 기록과 저출석 기준을 모두 확인했어요.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-[var(--color-border)] px-5">
          {warningCourses.map((course) => (
            <button
              type="button"
              key={course.id}
              onClick={() => onSelectCourse(course.id)}
              className="flex w-full items-center gap-3 py-4 text-left hover:bg-[var(--color-muted)]/40"
            >
              <span
                className={cn(
                  'h-9 w-1 shrink-0 rounded-full',
                  course.missingAttendanceCount > 0 ? 'bg-amber-400' : 'bg-red-400',
                )}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-[var(--color-foreground)]">
                  {course.name}
                </span>
                <span className="mt-1 block truncate text-[11px] text-[var(--color-muted-foreground)]">
                  {course.warningReasons.join(' · ')}
                </span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-slate-300" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CourseContext({
  course,
  onClose,
  onSelectParticipant,
}: {
  course: AttendanceDashboardCourse;
  onClose: () => void;
  onSelectParticipant: (participantId: string) => void;
}) {
  return (
    <div>
      <div className="flex items-start justify-between border-b border-[var(--color-border)] px-5 py-4">
        <div className="flex items-start gap-3">
          <span className="rounded-[var(--radius-md)] bg-blue-50 p-2 text-[var(--color-primary)]">
            <UserRound className="size-4" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-[var(--color-foreground)]">{course.name}</h2>
            <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
              참여자 출석률을 낮은 순서로 표시합니다.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-xs font-semibold text-[var(--color-primary)] hover:underline"
        >
          닫기
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 px-5 py-4">
        <MiniSummary label="저출석 이용자" value={course.lowAttendanceParticipantIds.length + '명'} tone="danger" />
        <MiniSummary label="미입력 기록" value={course.missingAttendanceCount + '건'} tone="warning" />
      </div>
      <div className="border-t border-[var(--color-border)] px-5">
        <div className="flex items-center justify-between py-3 text-[11px] font-semibold text-[var(--color-muted-foreground)]">
          <span>참여자 출석률</span>
          <span>50% 기준</span>
        </div>
        <div className="divide-y divide-[var(--color-border)]">
          {course.participants.map((participant) => (
            <button
              type="button"
              key={participant.participantId}
              onClick={() => onSelectParticipant(participant.participantId)}
              className="flex w-full items-center gap-3 py-3 text-left hover:bg-[var(--color-muted)]/40"
            >
              <span className="grid size-7 shrink-0 place-items-center rounded-[var(--radius-md)] bg-blue-50 text-xs font-bold text-[var(--color-primary)]">
                {participant.participantName.slice(0, 1)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold text-[var(--color-foreground)]">
                  {participant.participantName}
                </span>
                <span className="mt-1 block text-[10px] text-[var(--color-muted-foreground)]">
                  {participant.attendanceRate !== null && participant.attendanceRate < 50
                    ? '확인 필요'
                    : '정상'}
                </span>
              </span>
              <span className="text-right text-xs font-bold text-[var(--color-foreground)]">
                {formatRate(participant.attendanceRate)}
                <span className="mt-1 block text-[10px] font-normal text-[var(--color-muted-foreground)]">
                  ({participant.attendedSessionCount}/{participant.validSessionCount})
                </span>
              </span>
            </button>
          ))}
        </div>
        <div className="relative mb-4 mt-3 h-5 border-b border-slate-200">
          <span className="absolute bottom-1 left-1/2 text-[9px] font-semibold text-red-500">
            50% 기준선
          </span>
          <span className="absolute bottom-0 left-1/2 h-4 border-l border-dashed border-red-400" />
        </div>
      </div>
    </div>
  );
}

function ParticipantRateChart({
  course,
  selectedParticipantId,
  onSelectParticipant,
}: {
  course: AttendanceDashboardCourse;
  selectedParticipantId: string | null;
  onSelectParticipant: (participantId: string) => void;
}) {
  return (
    <div className="px-5 py-4">
      <div className="mb-3 flex items-center justify-between text-[10px] font-medium text-[var(--color-muted-foreground)]">
        <span>참여자</span>
        <span>출석 / 유효회차</span>
      </div>
      <div className="divide-y divide-[var(--color-border)]">
        {course.participants.map((participant) => {
          const rate = participant.attendanceRate ?? 0;
          const low = participant.attendanceRate !== null && participant.attendanceRate < 50;
          return (
            <button
              type="button"
              key={participant.participantId}
              onClick={() => onSelectParticipant(participant.participantId)}
              className={cn(
                'grid w-full grid-cols-[minmax(95px,150px)_minmax(0,1fr)_75px] items-center gap-4 py-4 text-left',
                selectedParticipantId === participant.participantId && 'rounded-[var(--radius-md)] bg-blue-50 px-2',
              )}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="grid size-7 shrink-0 place-items-center rounded-[var(--radius-md)] bg-slate-100 text-[10px] font-bold text-slate-600">
                  {participant.participantName.slice(0, 1)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-xs font-semibold text-[var(--color-foreground)]">
                    {participant.participantName}
                  </span>
                  <span className={cn('mt-1 block text-[10px]', low ? 'text-red-500' : 'text-[var(--color-muted-foreground)]')}>
                    {low ? '50% 미만' : participant.attendanceRate === null ? '기록 없음' : '정상'}
                  </span>
                </span>
              </span>
              <span className="relative h-3 overflow-hidden rounded-full bg-slate-100">
                <span className="absolute inset-y-0 left-1/2 z-10 border-l border-dashed border-red-400" />
                {participant.attendanceRate !== null && (
                  <span
                    className={cn('absolute inset-y-0 left-0 rounded-full', low ? 'bg-red-400' : 'bg-emerald-500')}
                    style={{ width: Math.min(rate, 100) + '%' }}
                  />
                )}
              </span>
              <span className="text-right text-xs font-bold text-[var(--color-foreground)]">
                {formatRate(participant.attendanceRate)}
                <span className="mt-1 block text-[10px] font-normal text-[var(--color-muted-foreground)]">
                  {participant.attendedSessionCount}/{participant.validSessionCount}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ParticipantDetail({
  workspaceId,
  role,
  course,
  participant,
  onBack,
}: {
  workspaceId: string;
  role: WorkspaceRole;
  course: AttendanceDashboardCourse;
  participant: AttendanceDashboardParticipant;
  onBack: () => void;
}) {
  const attendanceHref =
    role === 'instructor'
      ? '/workspaces/' + workspaceId + '/teach/courses/' + course.id + '/attendance'
      : '/workspaces/' + workspaceId + '/courses/' + course.id + '/participants';
  const detailLinkLabel = role === 'instructor' ? '출석부 열기' : '참여자·출석 현황 열기';

  return (
    <div>
      <div className="flex items-center gap-3 border-b border-[var(--color-border)] px-5 py-4">
        <button
          type="button"
          onClick={onBack}
          className="grid size-8 place-items-center rounded-[var(--radius-md)] text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)]"
          aria-label="수업 참여자 목록으로 돌아가기"
        >
          <ChevronLeft className="size-4" />
        </button>
        <div>
          <p className="text-xs text-[var(--color-muted-foreground)]">{course.name}</p>
          <h2 className="mt-1 text-base font-semibold text-[var(--color-foreground)]">
            {participant.participantName}
          </h2>
        </div>
      </div>
      <div className="px-5 py-4">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs font-medium text-[var(--color-muted-foreground)]">누적 출석률</p>
            <p className="mt-1 text-3xl font-bold tracking-tight text-[var(--color-foreground)]">
              {formatRate(participant.attendanceRate)}
            </p>
          </div>
          <p className="text-right text-xs text-[var(--color-muted-foreground)]">
            출석 {participant.attendedSessionCount}회
            <br />
            유효회차 {participant.validSessionCount}회
          </p>
        </div>
      </div>
      <div className="border-t border-[var(--color-border)] px-5">
        <div className="flex items-center justify-between py-3 text-[11px] font-semibold text-[var(--color-muted-foreground)]">
          <span>회차별 출석 이력</span>
          <span>{participant.sessionHistory.length}회차</span>
        </div>
        <div className="divide-y divide-[var(--color-border)]">
          {participant.sessionHistory.map((session) => (
            <div key={session.sessionId} className="flex items-center justify-between py-3">
              <span>
                <span className="block text-xs font-semibold text-[var(--color-foreground)]">
                  {session.sessionNo}회차
                </span>
                <span className="mt-1 block text-[10px] text-[var(--color-muted-foreground)]">
                  {session.date}
                </span>
              </span>
              <span
                className={cn(
                  'rounded-full px-2 py-1 text-[10px] font-semibold',
                  session.status === 'present' && 'bg-emerald-50 text-emerald-700',
                  session.status === 'partial' && 'bg-lime-50 text-lime-700',
                  session.status === 'absent' && 'bg-red-50 text-red-600',
                  session.status === 'missing' && 'bg-slate-100 text-slate-500',
                )}
              >
                {attendanceLabel(session.status)}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="px-5 py-5">
        <Link
          href={attendanceHref}
          className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-primary)] px-3 text-xs font-semibold text-[var(--color-primary-foreground)] hover:opacity-90"
        >
          {detailLinkLabel}
          <ExternalLink className="size-3.5" />
        </Link>
      </div>
    </div>
  );
}

function MiniSummary({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'warning' | 'danger';
}) {
  return (
    <div className="rounded-[var(--radius-md)] bg-[var(--color-muted)] px-3 py-2.5">
      <span className="block text-[10px] text-[var(--color-muted-foreground)]">{label}</span>
      <span className={cn('mt-1 block text-sm font-bold', tone === 'danger' ? 'text-red-500' : 'text-amber-600')}>
        {value}
      </span>
    </div>
  );
}

function getTodayInTimezone(timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function formatDateLabel(value: string): string {
  return format(parseISO(value), 'yyyy년 M월 d일 (EEE)', { locale: ko });
}

function formatTime(value: string): string {
  return value.slice(0, 5);
}

function formatRate(value: number | null): string {
  return value === null ? '—' : value + '%';
}

function attendanceLabel(status: AttendanceStatus | 'missing'): string {
  if (status === 'present') return '출석';
  if (status === 'partial') return '부분 출석';
  if (status === 'absent') return '결석';
  return '미입력';
}
