'use client';

import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parse,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { useMemo } from 'react';

import { cn } from '@/lib/utils';
import type { CalendarItem } from '@/types/calendar';

import { CalendarChip } from './calendar-chip';
import { CalendarLegend } from './calendar-legend';

const WEEKDAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'];
const MAX_VISIBLE_CHIPS = 2;

type MonthGridProps = {
  month: string;
  items: CalendarItem[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
};

function groupItemsByDate(items: CalendarItem[]) {
  const map = new Map<string, CalendarItem[]>();
  for (const item of items) {
    const date = item.kind === 'course_session' ? item.session.date : item.item.date;
    const existing = map.get(date) ?? [];
    existing.push(item);
    map.set(date, existing);
  }
  return map;
}

export function MonthGrid({ month, items, selectedDate, onSelectDate }: MonthGridProps) {
  const monthDate = parse(`${month}-01`, 'yyyy-MM-dd', new Date());

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(monthDate), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(monthDate), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [monthDate]);

  const itemsByDate = useMemo(() => groupItemsByDate(items), [items]);
  const sessionCount = items.filter((item) => item.kind === 'course_session').length;

  return (
    <section className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <p className="text-sm text-gray-500">총 {sessionCount}개 수업 일정</p>
      </header>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
          {WEEKDAY_LABELS.map((label, index) => (
            <div
              key={label}
              className={cn(
                'px-2 py-2 text-center text-xs font-semibold',
                index >= 5 ? 'text-red-500' : 'text-gray-600',
              )}
            >
              {label}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {days.map((day) => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const dayItems = itemsByDate.get(dateKey) ?? [];
            const inMonth = isSameMonth(day, monthDate);
            const isSelected = dateKey === selectedDate;
            const isTodayDate = isToday(day);
            const visible = dayItems.slice(0, MAX_VISIBLE_CHIPS);
            const overflow = dayItems.length - visible.length;

            return (
              <button
                key={dateKey}
                type="button"
                onClick={() => onSelectDate(dateKey)}
                className={cn(
                  'flex min-h-[100px] flex-col border-b border-r border-gray-100 p-1.5 text-left transition-colors last:border-r-0',
                  !inMonth && 'bg-gray-50/80',
                  isSelected && 'bg-blue-50/60 ring-1 ring-inset ring-blue-200',
                  !isSelected && 'hover:bg-gray-50',
                )}
              >
                <span
                  className={cn(
                    'mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium',
                    !inMonth && 'text-gray-300',
                    inMonth && (isTodayDate ? 'bg-blue-600 text-white' : 'text-gray-700'),
                    inMonth && isSelected && !isTodayDate && 'bg-blue-600 text-white',
                  )}
                >
                  {format(day, 'd')}
                </span>

                <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
                  {dayItems.length === 0 ? (
                    <span className="mt-auto text-center text-[10px] text-gray-300">일정 없음</span>
                  ) : (
                    <>
                      {visible.map((item) => (
                        <CalendarChip
                          key={
                            item.kind === 'course_session'
                              ? item.session.id
                              : item.item.id
                          }
                          item={item}
                        />
                      ))}
                      {overflow > 0 ? (
                        <span className="text-[10px] font-medium text-gray-500">+ {overflow}개</span>
                      ) : null}
                    </>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <CalendarLegend />
    </section>
  );
}
