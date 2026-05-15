import { format } from 'date-fns';

import { getCalendarMonth } from '@/services/calendar';

import { CalendarClient } from './calendar-client';

type CalendarPageProps = {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<{ month?: string }>;
};

export default async function CalendarPage({ params, searchParams }: CalendarPageProps) {
  const { workspaceId } = await params;
  const { month: monthParam } = await searchParams;
  const month = monthParam ?? format(new Date(), 'yyyy-MM');

  const data = await getCalendarMonth({ workspaceId, month });

  return <CalendarClient workspaceId={workspaceId} month={month} initialData={data} />;
}
