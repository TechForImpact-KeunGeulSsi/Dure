import { EmptyState } from '@/components/courses/empty-state';
import { getCourseMemos } from '@/services/class-memos';

import { NotesClient } from './notes-client';

type Props = {
  params: Promise<{ workspaceId: string; courseId: string }>;
};

export default async function InstructorNotesPage({ params }: Props) {
  const { workspaceId, courseId } = await params;
  const result = await getCourseMemos(workspaceId, courseId);

  if (!result.ok) {
    return <EmptyState message={result.error.message} />;
  }

  return (
    <NotesClient
      workspaceId={workspaceId}
      courseId={courseId}
      initial={result.data}
    />
  );
}