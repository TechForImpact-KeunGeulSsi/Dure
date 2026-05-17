"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { settlementStatusLabel } from "@/lib/api/labels";
import type {
  SettlementRequestDetail,
  SettlementRequestStatus,
} from "@/lib/api/types";
import {
  getReceiptSignedUrl,
  markSettlementRequestPaid,
} from "@/services/settlements";

type Props = {
  workspaceId: string;
  initialRequest: SettlementRequestDetail;
};

const STATUS_TONE: Record<SettlementRequestStatus, "warning" | "success"> = {
  pending: "warning",
  paid: "success",
};

function formatKRW(amount: number): string {
  return new Intl.NumberFormat("ko-KR").format(amount) + "원";
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SettlementDetailClient({
  workspaceId,
  initialRequest,
}: Props) {
  const router = useRouter();
  const [request, setRequest] = useState(initialRequest);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleMarkPaid() {
    startTransition(async () => {
      const result = await markSettlementRequestPaid(workspaceId, request.id);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success("지급 완료로 표시했어요.");
      setConfirmOpen(false);
      router.refresh();
      setRequest((prev) => ({ ...prev, status: "paid" }));
    });
  }

  async function handleDownload(receiptId: string) {
    const result = await getReceiptSignedUrl(
      workspaceId,
      request.id,
      receiptId,
    );
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    window.open(result.data.url, "_blank", "noopener,noreferrer");
  }

  const isPaid = request.status === "paid";

  return (
    <>
      <header className="rounded-xl border border-[var(--color-border)] bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-[var(--color-foreground)]">
                {request.courseName}
              </h1>
              <Badge tone={STATUS_TONE[request.status]}>
                {settlementStatusLabel(request.status)}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
              {request.instructor?.displayName ??
                request.instructor?.email ??
                "(알 수 없음)"}{" "}
              · {formatDateTime(request.createdAt)} 요청
            </p>
            {isPaid && request.paidAt && (
              <p className="mt-0.5 text-xs text-emerald-700">
                {formatDateTime(request.paidAt)}
                {request.paidBy
                  ? ` · ${request.paidBy.displayName ?? request.paidBy.email} 처리`
                  : ""}
              </p>
            )}
          </div>
          <Button
            disabled={isPaid || pending}
            onClick={() => setConfirmOpen(true)}
            variant={isPaid ? "outline" : "primary"}
          >
            {isPaid ? "지급 완료됨" : "지급 완료"}
          </Button>
        </div>
      </header>

      <section className="rounded-xl border border-[var(--color-border)] bg-white p-6 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-[var(--color-foreground)]">
          계좌 정보
        </h2>
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-[var(--color-muted-foreground)]">은행</dt>
            <dd className="mt-0.5 text-[var(--color-foreground)]">
              {request.bankNameSnapshot}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--color-muted-foreground)]">
              계좌번호
            </dt>
            <dd className="mt-0.5 text-[var(--color-foreground)]">
              {request.accountNumberSnapshot}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--color-muted-foreground)]">
              예금주
            </dt>
            <dd className="mt-0.5 text-[var(--color-foreground)]">
              {request.accountHolderSnapshot}
            </dd>
          </div>
        </dl>
      </section>

      <section className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-white shadow-sm">
        <div className="border-b border-[var(--color-border)] px-6 py-4">
          <h2 className="text-sm font-semibold text-[var(--color-foreground)]">
            물품 목록
          </h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>물품명</TableHead>
              <TableHead className="text-right">개수</TableHead>
              <TableHead className="text-right">단가</TableHead>
              <TableHead className="text-right">소계</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {request.items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.itemName}</TableCell>
                <TableCell className="text-right">{item.quantity}</TableCell>
                <TableCell className="text-right">
                  {formatKRW(item.unitPrice)}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatKRW(item.subtotal)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="flex items-center justify-end border-t border-[var(--color-border)] px-6 py-4 text-sm">
          <span className="mr-3 text-[var(--color-muted-foreground)]">총액</span>
          <span className="text-lg font-semibold text-[var(--color-foreground)]">
            {formatKRW(request.totalAmount)}
          </span>
        </div>
      </section>

      {request.memo && (
        <section className="rounded-xl border border-[var(--color-border)] bg-white p-6 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold text-[var(--color-foreground)]">
            메모
          </h2>
          <p className="whitespace-pre-wrap text-sm text-[var(--color-foreground)]">
            {request.memo}
          </p>
        </section>
      )}

      <section className="rounded-xl border border-[var(--color-border)] bg-white p-6 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-[var(--color-foreground)]">
          영수증 ({request.receipts.length}개)
        </h2>
        {request.receipts.length === 0 ? (
          <p className="text-sm text-[var(--color-muted-foreground)]">
            첨부된 영수증이 없습니다.
          </p>
        ) : (
          <ul className="space-y-2">
            {request.receipts.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-sm"
              >
                <span className="min-w-0 truncate text-[var(--color-foreground)]">
                  {r.originalFilename}
                </span>
                <button
                  type="button"
                  onClick={() => handleDownload(r.id)}
                  className="inline-flex items-center gap-1 text-[var(--color-primary)] hover:underline"
                >
                  <Download className="size-4" />
                  다운로드
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {confirmOpen && (
        <Dialog open={true} onOpenChange={(v) => !v && setConfirmOpen(false)}>
          <DialogHeader
            title="지급 완료로 표시"
            description="지급 완료 후에는 되돌릴 수 없습니다. 강사에게 알림이 전달됩니다."
          />
          <DialogBody>
            <p className="text-sm text-[var(--color-foreground)]">
              <span className="font-medium">{request.courseName}</span> 정산{" "}
              <span className="font-medium">{formatKRW(request.totalAmount)}</span>{" "}
              지급 완료로 표시할까요?
            </p>
          </DialogBody>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmOpen(false)}
              disabled={pending}
            >
              취소
            </Button>
            <Button size="sm" onClick={handleMarkPaid} disabled={pending}>
              {pending ? "처리 중…" : "지급 완료"}
            </Button>
          </DialogFooter>
        </Dialog>
      )}
    </>
  );
}
