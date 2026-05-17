import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { EmptyState } from "@/components/courses/empty-state";
import { getSettlementRequestDetail } from "@/services/settlements";

import { SettlementDetailClient } from "./settlement-detail-client";

type Props = {
  params: Promise<{ workspaceId: string; requestId: string }>;
};

export default async function SettlementDetailPage({ params }: Props) {
  const { workspaceId, requestId } = await params;
  const result = await getSettlementRequestDetail(workspaceId, requestId);

  if (!result.ok) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <Link
          href={`/workspaces/${workspaceId}/settlements`}
          className="inline-flex items-center gap-1 text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
        >
          <ChevronLeft className="size-4" />
          정산 요청 목록
        </Link>
        <EmptyState message={result.error.message} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link
        href={`/workspaces/${workspaceId}/settlements`}
        className="inline-flex items-center gap-1 text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
      >
        <ChevronLeft className="size-4" />
        정산 요청 목록
      </Link>
      <SettlementDetailClient
        workspaceId={workspaceId}
        initialRequest={result.data.request}
      />
    </div>
  );
}
