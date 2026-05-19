import { FeedbackClient } from "./feedback-client";
import { getCourseFeedbacks } from "@/services/course-feedbacks";

type Props = {
  params: Promise<{ workspaceId: string }>;
};

export default async function FeedbackPage({ params }: Props) {
  const { workspaceId } = await params;
  const result = await getCourseFeedbacks({ workspaceId });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-[var(--color-foreground)]">
          의견 수렴
        </h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          공개 수업 상세에서 접수된 의견을 확인합니다.
        </p>
      </header>

      {result.ok ? (
        <FeedbackClient workspaceId={workspaceId} initial={result.data} />
      ) : (
        <div className="rounded-lg border border-rose-200 bg-white px-4 py-6 text-sm text-rose-700">
          {result.error.message}
        </div>
      )}
    </div>
  );
}
