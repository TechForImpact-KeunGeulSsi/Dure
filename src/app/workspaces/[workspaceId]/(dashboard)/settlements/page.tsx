import { EmptyState } from "@/components/courses/empty-state";
import { listWorkspaceSettlementRequests } from "@/services/settlements";

import { SettlementsListClient } from "./settlements-list-client";

type Props = {
  params: Promise<{ workspaceId: string }>;
};

export default async function SettlementsPage({ params }: Props) {
  const { workspaceId } = await params;
  const result = await listWorkspaceSettlementRequests(workspaceId);

  if (!result.ok) {
    return <EmptyState message={result.error.message} />;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-[var(--color-foreground)]">
          정산 요청
        </h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          강사가 제출한 정산 요청을 확인하고 지급 완료를 표시합니다.
        </p>
      </header>
      <SettlementsListClient
        workspaceId={workspaceId}
        initialRequests={result.data.requests}
      />
    </div>
  );
}
