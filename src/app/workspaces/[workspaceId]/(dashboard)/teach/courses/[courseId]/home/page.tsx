import { EmptyState } from '@/components/courses/empty-state';
import { getInstructorCourseHome } from '@/services/instructor-course';

import { InstructorHomeClient } from './instructor-home-client';

type Props = {
  params: Promise<{ workspaceId: string; courseId: string }>;
};

export default async function InstructorCourseHomePage({ params }: Props) {
  const { workspaceId, courseId } = await params;
  const result = await getInstructorCourseHome(workspaceId, courseId);

  if (!result.ok) {
    return <EmptyState message={result.error.message} />;
  }

  return (
    <InstructorHomeClient
      workspaceId={workspaceId}
      courseId={courseId}
      data={result.data}
    />
  );
}