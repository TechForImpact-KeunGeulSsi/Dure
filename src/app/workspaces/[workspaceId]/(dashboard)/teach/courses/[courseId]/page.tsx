import { redirect } from 'next/navigation';

type Props = {
  params: Promise<{ workspaceId: string; courseId: string }>;
};

export default async function InstructorCourseIndex({ params }: Props) {
  const { workspaceId, courseId } = await params;
  redirect(`/workspaces/${workspaceId}/teach/courses/${courseId}/home`);
}