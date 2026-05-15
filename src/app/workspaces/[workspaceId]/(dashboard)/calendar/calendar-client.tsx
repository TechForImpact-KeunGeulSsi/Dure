'use client';

import { addMonths, format, parse } from 'date-fns';
import { ko } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { MonthGrid } from '@/components/calendar/month-grid';
import { ScheduleSidePanel } from '@/components/calendar/schedule-side-panel';
import { Button } from '@/components/ui/button';
import type { CalendarItem, GetCalendarMonthOutput } from '@/types/calendar';

type CalendarClientProps = {
  workspaceId: string;
  month: string;
  initialData: GetCalendarMonthOutput;
};

function defaultSelectedDate(month: string) {
  const today = format(new Date(), 'yyyy-MM-dd');
  if (today.startsWith(month)) return today;
  return `${month}-01`;
}

export function CalendarClient({ month, initialData }: CalendarClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [items, setItems] = useState<CalendarItem[]>(initialData.items);
  const [selectedDate, setSelectedDate] = useState(() => defaultSelectedDate(month));

  useEffect(() => {
    setItems(initialData.items);
    setSelectedDate(defaultSelectedDate(month));
  }, [month, initialData]);

  const monthLabel = useMemo(
    () => format(parse(`${month}-01`, 'yyyy-MM-dd', new Date()), 'yyyy년 M월', { locale: ko }),
    [month],
  );

  const navigateMonth = (offset: number) => {
    const next = addMonths(parse(`${month}-01`, 'yyyy-MM-dd', new Date()), offset);
    const nextMonth = format(next, 'yyyy-MM');
    router.push(`${pathname}?month=${nextMonth}`);
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) =>
      prev.filter((item) => {
        const itemId = item.kind === 'course_session' ? item.session.id : item.item.id;
        return itemId !== id;
      }),
    );
  };

  const handleAddItem = (item: CalendarItem) => {
    setItems((prev) => [...prev, item]);
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
          items={items}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
        />
        <ScheduleSidePanel
          selectedDate={selectedDate}
          items={items}
          onRemoveItem={handleRemoveItem}
          onAddItem={handleAddItem}
        />
      </div>
    </div>
  );
}
