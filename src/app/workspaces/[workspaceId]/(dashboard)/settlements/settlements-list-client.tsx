"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { settlementStatusLabel } from "@/lib/api/labels";
import { cn } from "@/lib/utils/cn";
import type {
  SettlementRequestListItem,
  SettlementRequestStatus,
} from "@/lib/api/types";

type Props = {
  workspaceId: string;
  initialRequests: SettlementRequestListItem[];
};

type Filter = "all" | SettlementRequestStatus;

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "pending", label: "대기" },
  { value: "paid", label: "지급 완료" },
];

const STATUS_TONE: Record<SettlementRequestStatus, "warning" | "success"> = {
  pending: "warning",
  paid: "success",
};

function formatKRW(amount: number): string {
  return new Intl.NumberFormat("ko-KR").format(amount) + "원";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function SettlementsListClient({
  workspaceId,
  initialRequests,
}: Props) {
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = useMemo(() => {
    if (filter === "all") return initialRequests;
    return initialRequests.filter((r) => r.status === filter);
  }, [filter, initialRequests]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={cn(
              "rounded-full px-3 py-1 text-sm font-medium transition-colors",
              filter === f.value
                ? "bg-[var(--color-primary)] text-[var(--color-primary-foreground)]"
                : "bg-white text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] border border-[var(--color-border)]",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-white shadow-sm">
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-[var(--color-muted-foreground)]">
            {filter === "all"
              ? "아직 제출된 정산 요청이 없습니다."
              : "해당 상태의 정산 요청이 없습니다."}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>요청일</TableHead>
                <TableHead>강사</TableHead>
                <TableHead>수업</TableHead>
                <TableHead>물품 수</TableHead>
                <TableHead className="text-right">총액</TableHead>
                <TableHead>상태</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((req) => (
                <TableRow
                  key={req.id}
                  className="cursor-pointer transition-colors hover:bg-[var(--color-muted)]/60"
                >
                  <TableCell>
                    <Link
                      href={`/workspaces/${workspaceId}/settlements/${req.id}`}
                      className="block"
                    >
                      {formatDate(req.createdAt)}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/workspaces/${workspaceId}/settlements/${req.id}`}
                      className="block"
                    >
                      {req.instructor?.displayName ??
                        req.instructor?.email ??
                        "(알 수 없음)"}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/workspaces/${workspaceId}/settlements/${req.id}`}
                      className="block"
                    >
                      {req.courseName}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/workspaces/${workspaceId}/settlements/${req.id}`}
                      className="block"
                    >
                      {req.itemCount}개
                    </Link>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    <Link
                      href={`/workspaces/${workspaceId}/settlements/${req.id}`}
                      className="block"
                    >
                      {formatKRW(req.totalAmount)}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/workspaces/${workspaceId}/settlements/${req.id}`}
                      className="block"
                    >
                      <Badge tone={STATUS_TONE[req.status]}>
                        {settlementStatusLabel(req.status)}
                      </Badge>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
