import { getCourseParticipantsStatus } from '@/services/courses';

import { ParticipantsStatusClient } from './participants-status-client';

type CourseParticipantsPageProps = {
  params: Promise<{ workspaceId: string; courseId: string }>;
};

export default async function CourseParticipantsPage({ params }: CourseParticipantsPageProps) {
  const { workspaceId, courseId } = await params;
  const data = await getCourseParticipantsStatus({ workspaceId, courseId });

  return <ParticipantsStatusClient data={data} />;
}
