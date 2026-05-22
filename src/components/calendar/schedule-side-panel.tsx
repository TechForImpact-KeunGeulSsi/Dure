'use client';

import { CalendarCheck, Plus, Trash2 } from 'lucide-react';
import { format, parse } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { toast } from 'sonner';

import {
  formatCourseSessionLabel,
  formatGroupBracket,
} from '@/components/calendar/calendar-chip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MultiSelect } from '@/components/ui/multi-select';
import {
  deleteGeneralScheduleItem,
  upsertGeneralScheduleItem,
} from '@/services/calendar';
import type { CalendarItem } from '@/types/calendar';
import type { GroupSummary } from '@/types/course';

type ScheduleSidePanelProps = {
  workspaceId: string;
  selectedDate: string;
  items: CalendarItem[];
  groupOptions: GroupSummary[];
};

const DEFAULT_COLOR = '#F97316';

function formatTimeRange(startsAt: string | null, endsAt: string | null) {
  if (!startsAt) return '시간 미정';
  const start = startsAt.slice(0, 5);
  const end = endsAt ? endsAt.slice(0, 5) : '';
  return end ? `${start} - ${end}` : start;
}

function getItemId(item: CalendarItem) {
  return item.kind === 'course_session' ? item.session.id : item.item.id;
}

function getItemTitle(item: CalendarItem) {
  if (item.kind === 'course_session') {
    return formatCourseSessionLabel(item.session?.courseName, item.groups);
  }
  return item.item?.title ?? '';
}

function getCourseSessionGroupNames(item: Extract<CalendarItem, { kind: 'course_session' }>) {
  return (item.groups ?? [])
    .map((group) => group?.name?.trim())
    .filter((name): name is string => Boolean(name));
}

function getItemTime(item: CalendarItem) {
  if (item.kind === 'course_session') {
    return formatTimeRange(item.session.startsAt, item.session.endsAt);
  }
  return formatTimeRange(item.item.startsAt, item.item.endsAt);
}

function getInstructorLabel(item: CalendarItem) {
  if (item.kind !== 'course_session') return null;
  return (
    item.instructor?.displayName?.trim() ??
    item.instructor?.email?.trim() ??
    '미배정'
  );
}

function getGeneralScheduleGroupsLabel(item: CalendarItem) {
  if (item.kind !== 'general_schedule_item') return '전체';
  const names = (item.item?.groups ?? [])
    .map((group) => group?.name?.trim())
    .filter((name): name is string => Boolean(name));
  return names.length > 0 ? names.join(', ') : '전체';
}

export function ScheduleSidePanel({
  workspaceId,
  selectedDate,
  items,
  groupOptions,
}: ScheduleSidePanelProps) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, startSubmit] = useTransition();
  const [deletingId, startDelete] = useTransition();

  const selectedLabel = format(parse(selectedDate, 'yyyy-MM-dd', new Date()), 'M월 d일', {
    locale: ko,
  });

  const dayItems = useMemo(
    () =>
      items.filter((item) => {
        const date = item.kind === 'course_session' ? item.session.date : item.item.date;
        return date === selectedDate;
      }),
    [items, selectedDate],
  );

  const groupSelectOptions = useMemo(
    () => groupOptions.map((g) => ({ id: g.id, label: g.name })),
    [groupOptions],
  );

  function resetForm() {
    setTitle('');
    setStartsAt('');
    setEndsAt('');
    setGroupIds([]);
    setError(null);
  }

  function handleAdd() {
    setError(null);

    if (!title.trim()) {
      setError('일정명을 입력해 주세요.');
      return;
    }
    if (groupIds.length === 0) {
      setError('그룹을 1개 이상 선택해 주세요.');
      return;
    }
    if (endsAt && !startsAt) {
      setError('시작 시간을 입력해 주세요.');
      return;
    }
    if (startsAt && endsAt && endsAt <= startsAt) {
      setError('종료 시간은 시작 시간 이후여야 합니다.');
      return;
    }

    startSubmit(async () => {
      const result = await upsertGeneralScheduleItem(workspaceId, {
        title: title.trim(),
        date: selectedDate,
        startsAt: startsAt ? `${startsAt}:00` : null,
        endsAt: endsAt ? `${endsAt}:00` : null,
        description: null,
        color: DEFAULT_COLOR,
        groupIds,
      });
      if (!result.ok) {
        setError(result.error.message);
        toast.error(result.error.message);
        return;
      }
      toast.success('일정을 추가했습니다.');
      resetForm();
      router.refresh();
    });
  }

  function handleDelete(item: CalendarItem) {
    if (item.kind !== 'general_schedule_item') return;
    if (!item.item.canDelete) return;
    const confirmed = window.confirm(
      `'${item.item.title}' 일정을 삭제하시겠어요?`,
    );
    if (!confirmed) return;
    startDelete(async () => {
      const result = await deleteGeneralScheduleItem(workspaceId, item.item.id);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success('일정을 삭제했습니다.');
      router.refresh();
    });
  }

  return (
    <aside className="flex h-full flex-col rounded-xl border border-gray-100 bg-white shadow-sm">
      <header className="border-b border-gray-100 px-5 py-4">
        <div className="flex items-center gap-2 text-blue-600">
          <CalendarCheck className="h-5 w-5" />
          <h2 className="text-base font-semibold text-gray-900">일정 관리</h2>
        </div>
        <p className="mt-1 text-sm text-gray-500">선택한 날짜: {selectedLabel}</p>
      </header>

      <section className="border-b border-gray-100 bg-gray-50 px-5 py-4">
        <h3 className="text-sm font-semibold text-gray-900">일정 추가</h3>
        <p className="mt-0.5 text-xs text-gray-500">선택한 날짜에 일반 일정을 등록합니다.</p>

        <div className="mt-4 space-y-3">
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="일정명 입력"
            maxLength={120}
            disabled={submitting}
          />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs text-gray-500">시작</label>
              <Input
                type="time"
                value={startsAt}
                onChange={(event) => setStartsAt(event.target.value)}
                disabled={submitting}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">종료</label>
              <Input
                type="time"
                value={endsAt}
                onChange={(event) => setEndsAt(event.target.value)}
                disabled={submitting}
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">그룹</label>
            <MultiSelect
              options={groupSelectOptions}
              selectedIds={groupIds}
              onChange={setGroupIds}
              placeholder={
                groupOptions.length === 0 ? '등록된 그룹이 없습니다' : '그룹을 선택하세요'
              }
              disabled={submitting || groupOptions.length === 0}
            />
          </div>
          {error && <p className="text-xs text-rose-600">{error}</p>}
          <Button
            type="button"
            className="w-full"
            onClick={handleAdd}
            disabled={submitting}
          >
            <Plus className="h-4 w-4" />
            {submitting ? '추가 중…' : '추가하기'}
          </Button>
        </div>
      </section>

      <section className="flex flex-1 flex-col px-5 py-4">
        <h3 className="text-sm font-semibold text-gray-900">선택 날짜의 일정</h3>

        <ul className="mt-3 flex-1 space-y-2 overflow-y-auto">
          {dayItems.length === 0 ? (
            <li className="rounded-lg border border-dashed border-gray-200 py-8 text-center text-sm text-gray-400">
              등록된 일정이 없습니다.
            </li>
          ) : (
            dayItems.map((item) => {
              const showDelete =
                item.kind === 'general_schedule_item' && item.item.canDelete;
              return (
                <li
                  key={getItemId(item)}
                  className="flex items-start justify-between gap-3 rounded-lg border border-gray-100 bg-white p-3 shadow-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-gray-400">{getItemTime(item)}</p>
                    {item.kind === 'course_session' ? (
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <p className="font-semibold text-gray-900">
                          {item.session?.courseName?.trim() || '수업'}
                        </p>
                        {getCourseSessionGroupNames(item).length > 0 ? (
                          <span
                            className="rounded-md bg-blue-50 px-1.5 py-0.5 text-[11px] font-medium text-blue-700"
                            title={formatGroupBracket(item.groups)}
                          >
                            [{getCourseSessionGroupNames(item).join(', ')}]
                          </span>
                        ) : null}
                      </div>
                    ) : (
                      <p className="mt-0.5 font-semibold text-gray-900">{getItemTitle(item)}</p>
                    )}
                    <p className="mt-1 text-xs text-gray-500">
                      {item.kind === 'course_session'
                        ? `강사: ${getInstructorLabel(item)}`
                        : `그룹: ${getGeneralScheduleGroupsLabel(item)}`}
                    </p>
                  </div>
                  {showDelete ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="flex-shrink-0 text-red-500 hover:bg-red-50 hover:text-red-600"
                      onClick={() => handleDelete(item)}
                      disabled={deletingId}
                      aria-label="일정 삭제"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : null}
                </li>
              );
            })
          )}
        </ul>
      </section>
    </aside>
  );
}
