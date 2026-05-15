'use client';

import { CalendarCheck, Plus, Trash2 } from 'lucide-react';
import { format, parse } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import type { CalendarItem } from '@/types/calendar';

type ScheduleSidePanelProps = {
  selectedDate: string;
  items: CalendarItem[];
  onRemoveItem: (id: string) => void;
  onAddItem: (item: CalendarItem) => void;
};

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
  return item.kind === 'course_session' ? item.session.courseName : item.item.title;
}

function getItemTime(item: CalendarItem) {
  if (item.kind === 'course_session') {
    return formatTimeRange(item.session.startsAt, item.session.endsAt);
  }
  return formatTimeRange(item.item.startsAt, item.item.endsAt);
}

function getAssignee(item: CalendarItem) {
  if (item.kind === 'course_session') {
    return item.instructor?.displayName ?? item.instructor?.email ?? '미배정';
  }
  return item.item.groups.map((g) => g.name).join(', ') || '전체';
}

export function ScheduleSidePanel({
  selectedDate,
  items,
  onRemoveItem,
  onAddItem,
}: ScheduleSidePanelProps) {
  const [title, setTitle] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [groupId, setGroupId] = useState('group-001');

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

  const handleAdd = () => {
    if (!title.trim()) return;

    onAddItem({
      kind: 'general_schedule_item',
      item: {
        id: `gs-local-${Date.now()}`,
        title: title.trim(),
        date: selectedDate,
        startsAt: startsAt ? `${startsAt}:00` : null,
        endsAt: endsAt ? `${endsAt}:00` : null,
        description: null,
        color: '#F97316',
        groups: [
          {
            id: groupId,
            name: groupId === 'group-001' ? '햇살 그룹' : '바람 그룹',
            description: null,
            status: 'active',
          },
        ],
        canEdit: true,
        canDelete: true,
      },
    });

    setTitle('');
    setStartsAt('');
    setEndsAt('');
  };

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
        <p className="mt-0.5 text-xs text-gray-500">일정명과 시간을 입력해 빠르게 추가합니다.</p>

        <div className="mt-4 space-y-3">
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="일정명 입력"
          />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs text-gray-500">시작</label>
              <Input
                type="time"
                value={startsAt}
                onChange={(event) => setStartsAt(event.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">종료</label>
              <Input
                type="time"
                value={endsAt}
                onChange={(event) => setEndsAt(event.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">그룹</label>
            <Select value={groupId} onChange={(event) => setGroupId(event.target.value)}>
              <option value="group-001">햇살 그룹</option>
              <option value="group-002">바람 그룹</option>
            </Select>
          </div>
          <Button type="button" className="w-full" onClick={handleAdd}>
            <Plus className="h-4 w-4" />
            추가하기
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
            dayItems.map((item) => (
              <li
                key={getItemId(item)}
                className="flex items-start justify-between gap-3 rounded-lg border border-gray-100 bg-white p-3 shadow-sm"
              >
                <div className="min-w-0">
                  <p className="text-xs text-gray-400">{getItemTime(item)}</p>
                  <p className="mt-0.5 font-semibold text-gray-900">{getItemTitle(item)}</p>
                  <p className="mt-0.5 text-xs text-gray-500">담당: {getAssignee(item)}</p>
                </div>
                {(item.kind === 'general_schedule_item' && item.item.canDelete) ||
                item.kind === 'course_session' ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="flex-shrink-0 text-red-500 hover:bg-red-50 hover:text-red-600"
                    onClick={() => onRemoveItem(getItemId(item))}
                    aria-label="일정 삭제"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : null}
              </li>
            ))
          )}
        </ul>

        <p className="mt-3 text-center text-[11px] text-gray-400">
          필요한 일정은 계속 추가할 수 있습니다.
        </p>
      </section>
    </aside>
  );
}
