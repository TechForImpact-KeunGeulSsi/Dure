'use client';

import { addMonths, format, parse } from 'date-fns';
import { ko } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { MonthGrid } from '@/components/calendar/month-grid';
import { ScheduleSidePanel } from '@/components/calendar/schedule-side-panel';
import { Button } from '@/components/ui/button';
import type { GroupSummary } from '@/types/course';
import type { GetCalendarMonthOutput } from '@/types/calendar';

type CalendarClientProps = {
  workspaceId: string;
  month: string;
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
  initialData,
  groupOptions,
}: CalendarClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [selectedDate, setSelectedDate] = useState(() => defaultSelectedDate(month));

  useEffect(() => {
    setSelectedDate(defaultSelectedDate(month));
  }, [month]);

  const monthLabel = useMemo(
    () => format(parse(`${month}-01`, 'yyyy-MM-dd', new Date()), 'yyyy년 M월', { locale: ko }),
    [month],
  );

  const navigateMonth = (offset: number) => {
    const next = addMonths(parse(`${month}-01`, 'yyyy-MM-dd', new Date()), offset);
    const nextMonth = format(next, 'yyyy-MM');
    router.push(`${pathname}?month=${nextMonth}`);
  };

  return (
    <div className="flex h-full flex-col gap-6 p-8">
      <header className="flex items-center justify-center gap-4">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => navigateMonth(-1)}
          aria-label="이전 달"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h1 className="min-w-[140px] text-center text-xl font-bold text-gray-900">{monthLabel}</h1>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => navigateMonth(1)}
          aria-label="다음 달"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </header>

      <div className="grid flex-1 grid-cols-1 gap-6 lg:grid-cols-[1fr_320px] xl:grid-cols-[1fr_360px]">
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
