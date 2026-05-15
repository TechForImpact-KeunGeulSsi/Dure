import { EmptyState } from '@/components/courses/empty-state';
import { getCourseParticipantsStatus } from '@/services/course-participants';

import { ParticipantsStatusClient } from './participants-status-client';

type Props = {
  params: Promise<{ workspaceId: string; courseId: string }>;
};

export default async function CourseParticipantsPage({ params }: Props) {
  const { workspaceId, courseId } = await params;
  const result = await getCourseParticipantsStatus(workspaceId, courseId);

  if (!result.ok) {
    return <EmptyState message={result.error.message} />;
  }

  return <ParticipantsStatusClient data={result.data} />;
}