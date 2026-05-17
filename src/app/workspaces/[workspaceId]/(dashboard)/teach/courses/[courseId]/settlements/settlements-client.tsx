"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { settlementStatusLabel } from "@/lib/api/labels";
import type {
  PayoutAccount,
  SettlementRequestListItem,
  SettlementRequestStatus,
} from "@/lib/api/types";
import { savePayoutAccount } from "@/services/payout-accounts";
import {
  createSettlementRequest,
  getSettlementRequestDetail,
  updateSettlementRequest,
} from "@/services/settlements";

type Props = {
  workspaceId: string;
  courseId: string;
  initialAccount: PayoutAccount | null;
  initialRequests: SettlementRequestListItem[];
};

type ItemRow = {
  key: string;
  itemName: string;
  quantity: string;
  unitPrice: string;
};

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

function newItemRow(): ItemRow {
  return {
    key: crypto.randomUUID(),
    itemName: "",
    quantity: "1",
    unitPrice: "",
  };
}

type DialogMode =
  | { kind: "closed" }
  | { kind: "create" }
  | {
      kind: "edit";
      requestId: string;
      initialItems: ItemRow[];
      initialMemo: string;
    };

export function InstructorSettlementsClient({
  workspaceId,
  courseId,
  initialAccount,
  initialRequests,
}: Props) {
  const router = useRouter();
  const [account, setAccount] = useState(initialAccount);
  const [editingAccount, setEditingAccount] = useState(initialAccount === null);
  const [requests] = useState(initialRequests);
  const [dialogMode, setDialogMode] = useState<DialogMode>({ kind: "closed" });
  const [loadingEditId, setLoadingEditId] = useState<string | null>(null);

  function handleAccountSaved(next: PayoutAccount) {
    setAccount(next);
    setEditingAccount(false);
  }

  function handleRequestSaved() {
    setDialogMode({ kind: "closed" });
    router.refresh();
  }

  async function handleEditClick(requestId: string) {
    setLoadingEditId(requestId);
    try {
      const result = await getSettlementRequestDetail(workspaceId, requestId);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      const detail = result.data.request;
      if (detail.status !== "pending") {
        toast.error("지급 완료된 요청은 수정할 수 없습니다.");
        return;
      }
      setDialogMode({
        kind: "edit",
        requestId: detail.id,
        initialItems: detail.items.map((item) => ({
          key: item.id,
          itemName: item.itemName,
          quantity: String(item.quantity),
          unitPrice: String(item.unitPrice),
        })),
        initialMemo: detail.memo,
      });
    } finally {
      setLoadingEditId(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-[var(--color-border)] bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-[var(--color-foreground)]">
              내 계좌 정보
            </h2>
            <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
              정산 받을 본인 계좌 정보입니다. 언제든 수정할 수 있어요.
            </p>
          </div>
          {!editingAccount && account && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditingAccount(true)}
            >
              수정
            </Button>
          )}
        </div>

        {editingAccount ? (
          <AccountForm
            workspaceId={workspaceId}
            initial={account}
            onSaved={handleAccountSaved}
            onCancel={
              account
                ? () => setEditingAccount(false)
                : undefined
            }
          />
        ) : account ? (
          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs text-[var(--color-muted-foreground)]">
                은행
              </dt>
              <dd className="mt-0.5 text-[var(--color-foreground)]">
                {account.bankName}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--color-muted-foreground)]">
                계좌번호
              </dt>
              <dd className="mt-0.5 text-[var(--color-foreground)]">
                {account.accountNumber}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--color-muted-foreground)]">
                예금주
              </dt>
              <dd className="mt-0.5 text-[var(--color-foreground)]">
                {account.accountHolder}
              </dd>
            </div>
          </dl>
        ) : null}
      </section>

      <section className="rounded-xl border border-[var(--color-border)] bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-[var(--color-foreground)]">
              내 정산 요청
            </h2>
            <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
              이 수업에서 본인이 낸 정산 요청입니다.
            </p>
          </div>
          <Button
            onClick={() => {
              if (!account) {
                toast.error("정산 요청 전에 계좌 정보를 먼저 등록해 주세요.");
                return;
              }
              setDialogMode({ kind: "create" });
            }}
          >
            <Plus className="size-4" />
            새 정산 요청
          </Button>
        </div>

        {requests.length === 0 ? (
          <div className="p-10 text-center text-sm text-[var(--color-muted-foreground)]">
            아직 제출한 정산 요청이 없습니다.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>요청일</TableHead>
                <TableHead>물품 수</TableHead>
                <TableHead className="text-right">총액</TableHead>
                <TableHead>상태</TableHead>
                <TableHead className="text-right">작업</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((req) => (
                <TableRow key={req.id}>
                  <TableCell>{formatDate(req.createdAt)}</TableCell>
                  <TableCell>{req.itemCount}개</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatKRW(req.totalAmount)}
                  </TableCell>
                  <TableCell>
                    <Badge tone={STATUS_TONE[req.status]}>
                      {settlementStatusLabel(req.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {req.status === "pending" ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditClick(req.id)}
                        disabled={loadingEditId === req.id}
                      >
                        <Pencil className="size-3.5" />
                        {loadingEditId === req.id ? "불러오는 중…" : "수정"}
                      </Button>
                    ) : (
                      <span className="text-xs text-[var(--color-muted-foreground)]">
                        —
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      {dialogMode.kind !== "closed" && (
        <RequestDialog
          workspaceId={workspaceId}
          courseId={courseId}
          mode={dialogMode}
          onClose={() => setDialogMode({ kind: "closed" })}
          onSaved={handleRequestSaved}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 계좌 정보 폼
// ─────────────────────────────────────────────────────────────

function AccountForm({
  workspaceId,
  initial,
  onSaved,
  onCancel,
}: {
  workspaceId: string;
  initial: PayoutAccount | null;
  onSaved: (account: PayoutAccount) => void;
  onCancel?: () => void;
}) {
  const [bankName, setBankName] = useState(initial?.bankName ?? "");
  const [accountNumber, setAccountNumber] = useState(
    initial?.accountNumber ?? "",
  );
  const [accountHolder, setAccountHolder] = useState(
    initial?.accountHolder ?? "",
  );
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await savePayoutAccount(workspaceId, {
        bankName,
        accountNumber,
        accountHolder,
      });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success("계좌 정보를 저장했어요.");
      onSaved(result.data.account);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="bankName">은행</Label>
          <Input
            id="bankName"
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            placeholder="예: 국민은행"
            required
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="accountNumber">계좌번호</Label>
          <Input
            id="accountNumber"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
            placeholder="숫자와 - 만 입력"
            required
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="accountHolder">예금주</Label>
          <Input
            id="accountHolder"
            value={accountHolder}
            onChange={(e) => setAccountHolder(e.target.value)}
            placeholder="이름"
            required
            className="mt-1"
          />
        </div>
      </div>
      <div className="flex items-center justify-end gap-2">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={pending}
          >
            취소
          </Button>
        )}
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "저장 중…" : "저장"}
        </Button>
      </div>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────
// 정산 요청 다이얼로그 (생성/수정 공용)
// ─────────────────────────────────────────────────────────────

function RequestDialog({
  workspaceId,
  courseId,
  mode,
  onClose,
  onSaved,
}: {
  workspaceId: string;
  courseId: string;
  mode: DialogMode;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEditing = mode.kind === "edit";
  const [items, setItems] = useState<ItemRow[]>(() =>
    mode.kind === "edit" && mode.initialItems.length > 0
      ? mode.initialItems
      : [newItemRow()],
  );
  const [memo, setMemo] = useState(
    mode.kind === "edit" ? mode.initialMemo : "",
  );
  const [receipts, setReceipts] = useState<File[]>([]);
  const [pending, startTransition] = useTransition();

  const totalAmount = useMemo(() => {
    return items.reduce((sum, item) => {
      const q = Number.parseInt(item.quantity || "0", 10);
      const p = Number.parseInt(item.unitPrice || "0", 10);
      if (Number.isFinite(q) && Number.isFinite(p)) {
        return sum + q * p;
      }
      return sum;
    }, 0);
  }, [items]);

  function updateItem(index: number, patch: Partial<ItemRow>) {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  }

  function addItem() {
    setItems((prev) => [...prev, newItemRow()]);
  }

  function removeItem(index: number) {
    setItems((prev) => {
      if (prev.length === 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  }

  function handleReceiptsChange(event: React.ChangeEvent<HTMLInputElement>) {
    const list = event.target.files;
    if (!list) return;
    setReceipts(Array.from(list));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    // 클라이언트 사전 검증
    const parsedItems = items.map((item) => ({
      itemName: item.itemName.trim(),
      quantity: Number.parseInt(item.quantity || "0", 10),
      unitPrice: Number.parseInt(item.unitPrice || "0", 10),
    }));
    for (const [idx, item] of parsedItems.entries()) {
      if (!item.itemName) {
        toast.error(`${idx + 1}번째 행: 물품명을 입력해 주세요.`);
        return;
      }
      if (!Number.isFinite(item.quantity) || item.quantity < 1) {
        toast.error(`${idx + 1}번째 행: 개수가 올바르지 않습니다.`);
        return;
      }
      if (!Number.isFinite(item.unitPrice) || item.unitPrice < 0) {
        toast.error(`${idx + 1}번째 행: 단가가 올바르지 않습니다.`);
        return;
      }
    }

    const payload = {
      memo: memo.trim(),
      items: parsedItems,
    };

    startTransition(async () => {
      if (mode.kind === "edit") {
        const result = await updateSettlementRequest(
          workspaceId,
          mode.requestId,
          payload,
        );
        if (!result.ok) {
          toast.error(result.error.message);
          return;
        }
        toast.success("정산 요청을 수정했어요.");
        onSaved();
        return;
      }

      const formData = new FormData();
      formData.set("payload", JSON.stringify(payload));
      receipts.forEach((file, idx) => {
        formData.append(`receipt_${idx}`, file);
      });
      const result = await createSettlementRequest(
        workspaceId,
        courseId,
        formData,
      );
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success("정산 요청을 제출했어요.");
      onSaved();
    });
  }

  return (
    <Dialog open={true} onOpenChange={(v) => !v && onClose()} className="max-w-2xl">
      <DialogHeader
        title={isEditing ? "정산 요청 수정" : "새 정산 요청"}
        description={
          isEditing
            ? "대기 상태인 요청의 물품과 메모를 수정할 수 있어요. 영수증은 변경되지 않습니다."
            : "물품과 금액을 입력하고 영수증을 첨부해 주세요."
        }
      />
      <form onSubmit={handleSubmit}>
        <DialogBody>
          <div className="space-y-2">
            <Label>물품 목록</Label>
            <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)]">
              <table className="w-full text-sm">
                <thead className="bg-[var(--color-muted)] text-xs text-[var(--color-muted-foreground)]">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">물품명</th>
                    <th className="w-20 px-2 py-2 text-left font-medium">개수</th>
                    <th className="w-32 px-2 py-2 text-left font-medium">단가</th>
                    <th className="w-32 px-2 py-2 text-right font-medium">소계</th>
                    <th className="w-10 px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => {
                    const q = Number.parseInt(item.quantity || "0", 10);
                    const p = Number.parseInt(item.unitPrice || "0", 10);
                    const subtotal =
                      Number.isFinite(q) && Number.isFinite(p) ? q * p : 0;
                    return (
                      <tr
                        key={item.key}
                        className="border-t border-[var(--color-border)]"
                      >
                        <td className="px-3 py-2">
                          <Input
                            value={item.itemName}
                            onChange={(e) =>
                              updateItem(idx, { itemName: e.target.value })
                            }
                            placeholder="예: A4 용지"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <Input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={(e) =>
                              updateItem(idx, { quantity: e.target.value })
                            }
                          />
                        </td>
                        <td className="px-2 py-2">
                          <Input
                            type="number"
                            min={0}
                            value={item.unitPrice}
                            onChange={(e) =>
                              updateItem(idx, { unitPrice: e.target.value })
                            }
                            placeholder="원"
                          />
                        </td>
                        <td className="px-2 py-2 text-right text-sm font-medium">
                          {formatKRW(subtotal)}
                        </td>
                        <td className="px-2 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => removeItem(idx)}
                            disabled={items.length === 1}
                            className="text-[var(--color-muted-foreground)] hover:text-rose-600 disabled:opacity-30"
                            aria-label="물품 삭제"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addItem}
            >
              <Plus className="size-4" />
              물품 추가
            </Button>
            <div className="flex items-center justify-end border-t border-[var(--color-border)] pt-3 text-sm">
              <span className="mr-2 text-[var(--color-muted-foreground)]">
                총액
              </span>
              <span className="text-base font-semibold text-[var(--color-foreground)]">
                {formatKRW(totalAmount)}
              </span>
            </div>
          </div>

          <div>
            <Label htmlFor="memo">메모 (선택)</Label>
            <Textarea
              id="memo"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="사용 목적, 참고 사항 등"
              rows={3}
              className="mt-1"
            />
          </div>

          {!isEditing && (
            <div>
              <Label htmlFor="receipts">영수증 (선택)</Label>
              <input
                id="receipts"
                type="file"
                multiple
                accept="image/jpeg,image/png,application/pdf"
                onChange={handleReceiptsChange}
                className="mt-1 block w-full text-sm text-[var(--color-foreground)] file:mr-3 file:rounded-[var(--radius-md)] file:border-0 file:bg-[var(--color-muted)] file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-[var(--color-foreground)] hover:file:bg-[var(--color-border)]"
              />
              <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                JPG, PNG, PDF · 각 10MB 이하
              </p>
              {receipts.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs text-[var(--color-muted-foreground)]">
                  {receipts.map((file) => (
                    <li key={file.name}>· {file.name}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={pending}
          >
            취소
          </Button>
          <Button type="submit" size="sm" disabled={pending}>
            {pending
              ? isEditing
                ? "저장 중…"
                : "제출 중…"
              : isEditing
                ? "수정 저장"
                : "정산 요청 제출"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

