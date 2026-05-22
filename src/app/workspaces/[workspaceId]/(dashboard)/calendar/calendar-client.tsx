'use client';

import { addMonths, format, parse } from 'date-fns';
import { ko } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition } from 'react';

import { MonthGrid } from '@/components/calendar/month-grid';
import { ScheduleSidePanel } from '@/components/calendar/schedule-side-panel';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import type { GroupSummary } from '@/types/course';
import type { GetCalendarMonthOutput } from '@/types/calendar';

type CalendarClientProps = {
  workspaceId: string;
  month: string;
  groupId: string;
  initialData: GetCalendarMonthOutput;
  groupOptions: GroupSummary[];
};

function defaultSelectedDate(month: string) {
  const today = format(new Date(), 'yyyy-MM-dd');
  if (today.startsWith(month)) return today;
  return `${month}-01`;
}

export function CalendarClient({
  workspaceId,
  month,
  groupId,
  initialData,
  groupOptions,
}: CalendarClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [selectedDate, setSelectedDate] = useState(() => defaultSelectedDate(month));

  useEffect(() => {
    setSelectedDate(defaultSelectedDate(month));
  }, [month]);

  const monthLabel = useMemo(
    () => format(parse(`${month}-01`, 'yyyy-MM-dd', new Date()), 'yyyy년 M월', { locale: ko }),
    [month],
  );

  const pushCalendarQuery = (nextMonth: string, nextGroupId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('month', nextMonth);
    if (nextGroupId) {
      params.set('groupId', nextGroupId);
    } else {
      params.delete('groupId');
    }
    const query = params.toString();
    startTransition(() => {
      router.push(query ? `${pathname}?${query}` : pathname);
    });
  };

  const navigateMonth = (offset: number) => {
    const next = addMonths(parse(`${month}-01`, 'yyyy-MM-dd', new Date()), offset);
    const nextMonth = format(next, 'yyyy-MM');
    pushCalendarQuery(nextMonth, groupId);
  };

  const handleGroupFilterChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    pushCalendarQuery(month, event.target.value);
  };

  return (
    <div className="flex h-full flex-col gap-6 p-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center justify-center gap-4 sm:justify-start">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => navigateMonth(-1)}
            aria-label="이전 달"
            disabled={isPending}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h1 className="min-w-[140px] text-center text-xl font-bold text-gray-900">
            {monthLabel}
          </h1>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => navigateMonth(1)}
            aria-label="다음 달"
            disabled={isPending}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center justify-center gap-2 sm:justify-end">
          <label htmlFor="calendar-group-filter" className="text-sm font-medium text-gray-700">
            그룹
          </label>
          <Select
            id="calendar-group-filter"
            className="w-full min-w-[180px] max-w-[240px]"
            value={groupId}
            onChange={handleGroupFilterChange}
            disabled={isPending}
            aria-busy={isPending}
          >
            <option value="">전체</option>
            {groupOptions.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </Select>
        </div>
      </header>

      <div
        className={`grid flex-1 grid-cols-1 gap-6 transition-opacity duration-200 lg:grid-cols-[1fr_320px] xl:grid-cols-[1fr_360px] ${
          isPending ? 'pointer-events-none opacity-60' : 'opacity-100'
        }`}
      >
        <MonthGrid
          month={month}
          items={initialData.items}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
        />
        <ScheduleSidePanel
          workspaceId={workspaceId}
          selectedDate={selectedDate}
          items={initialData.items}
          groupOptions={groupOptions}
        />
      </div>
    </div>
  );
}
