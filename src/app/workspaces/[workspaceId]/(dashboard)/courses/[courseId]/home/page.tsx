import { EmptyState } from '@/components/courses/empty-state';
import { getCourseDetail } from '@/services/course-detail';
import { getCourseSessions } from '@/services/course-sessions';
import { getCoursePublicPreview } from '@/services/public-catalog';

import { CourseHomeClient } from './course-home-client';

type Props = {
  params: Promise<{ workspaceId: string; courseId: string }>;
};

export default async function CourseHomePage({ params }: Props) {
  const { workspaceId, courseId } = await params;

  const [courseResult, sessionsResult, publicPreviewResult] = await Promise.all([
    getCourseDetail(workspaceId, courseId),
    getCourseSessions(workspaceId, courseId),
    getCoursePublicPreview({ workspaceId, courseId }),
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
        sessionCount: sessionsResult.data.length,
      }}
      publicPreview={
        publicPreviewResult.ok
          ? { course: publicPreviewResult.data, errorMessage: null }
          : { course: null, errorMessage: publicPreviewResult.error.message }
      }
    />
  );
}
