import { EmptyState } from '@/components/courses/empty-state';
import { getCourseDetail } from '@/services/course-detail';
import { getCourseSessions } from '@/services/course-sessions';

import { CourseHomeClient } from './course-home-client';

type Props = {
  params: Promise<{ workspaceId: string; courseId: string }>;
};

export default async function CourseHomePage({ params }: Props) {
  const { workspaceId, courseId } = await params;

  const [courseResult, sessionsResult] = await Promise.all([
    getCourseDetail(workspaceId, courseId),
    getCourseSessions(workspaceId, courseId),
  ]);

  if (!courseResult.ok) {
    return <EmptyState message={courseResult.error.message} />;
  }
  if (!sessionsResult.ok) {
    return <EmptyState message={sessionsResult.error.message} />;
  }

  return (
    <CourseHomeClient
      workspaceId={workspaceId}
      data={{
        course: courseResult.data,
        sessions: sessionsResult.data,
        sessionCount: sessionsResult.data.filter((s) => s.progressStatus === "scheduled")
          .length,
      }}
    />
  );
}
