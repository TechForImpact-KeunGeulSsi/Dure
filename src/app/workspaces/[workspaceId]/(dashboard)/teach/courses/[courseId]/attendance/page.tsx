import { EmptyState } from '@/components/courses/empty-state';
import { getAttendanceBook } from '@/services/attendance';

import { AttendanceClient } from './attendance-client';

type Props = {
  params: Promise<{ workspaceId: string; courseId: string }>;
  searchParams: Promise<{ session?: string }>;
};

export default async function InstructorAttendancePage({
  params,
  searchParams,
}: Props) {
  const { workspaceId, courseId } = await params;
  const { session: sessionId } = await searchParams;

  const result = await getAttendanceBook({ workspaceId, courseId, sessionId });

  if (!result.ok) {
    return <EmptyState message={result.error.message} />;
  }

  return (
    <AttendanceClient
      workspaceId={workspaceId}
      courseId={courseId}
      initial={result.data}
    />
  );
}