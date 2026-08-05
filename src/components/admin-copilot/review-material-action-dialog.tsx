"use client";

import {
  CheckCircle2,
  ClipboardCheck,
  Download,
  ExternalLink,
  Loader2,
  RefreshCcw,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { materialVisibilityLabel } from "@/lib/api/labels";
import {
  decideReviewMaterialProposal,
  ensureReviewMaterialProposal,
} from "@/services/ontology-actions";
import { getMaterialDownloadUrl } from "@/services/materials";
import type {
  AdminCopilotTask,
  AdminCopilotTaskAction,
  AdminCopilotProposalStatus,
} from "@/services/admin-copilot-logic";

type ReviewMaterialActionDialogProps = {
  workspaceId: string;
  task: AdminCopilotTask;
  action: AdminCopilotTaskAction;
};

type DecisionOutcome = "approved" | "replayed" | "rejected";

export function ReviewMaterialActionDialog({
  workspaceId,
  task,
  action,
}: ReviewMaterialActionDialogProps) {
  const router = useRouter();
  const materialEvidence = task.evidence.find(
    (evidence) =>
      evidence.entityType === "material" && evidence.entityId === action.targetId,
  );
  const courseEvidence = task.evidence.find(
    (evidence) => evidence.entityType === "course",
  );
  const [open, setOpen] = useState(false);
  const [proposalId, setProposalId] = useState<string | null>(
    action.proposalId ?? null,
  );
  const [proposalStatus, setProposalStatus] =
    useState<AdminCopilotProposalStatus | null>(action.proposalStatus ?? null);
  const [decisionNote, setDecisionNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [outcome, setOutcome] = useState<DecisionOutcome | null>(null);
  const [downloadPending, startDownload] = useTransition();
  const [proposalPending, startProposal] = useTransition();
  const [decisionPending, startDecision] = useTransition();
  const busy = downloadPending || proposalPending || decisionPending;

  useEffect(() => {
    if (open) return;
    setProposalId(action.proposalId ?? null);
    setProposalStatus(action.proposalStatus ?? null);
    setDecisionNote("");
    setMessage(null);
    setError(null);
    setStale(false);
    setOutcome(null);
  }, [action.proposalId, action.proposalStatus, open]);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && busy) return;
    setOpen(nextOpen);
  }

  function handleDownload() {
    setError(null);
    startDownload(async () => {
      const result = await getMaterialDownloadUrl(workspaceId, action.targetId);
      if (!result.ok) {
        setError(result.error.message);
        toast.error(result.error.message);
        return;
      }
      window.open(result.data.signedDownloadUrl, "_blank", "noopener,noreferrer");
    });
  }

  function handleEnsureProposal() {
    setError(null);
    setMessage(null);
    setStale(false);
    startProposal(async () => {
      const result = await ensureReviewMaterialProposal({
        workspaceId,
        materialId: action.targetId,
        targetUpdatedAt: action.targetUpdatedAt,
      });
      if (!result.ok) {
        handleActionError(result.error);
        return;
      }

      setProposalId(result.data.id);
      setProposalStatus(result.data.status);
      setMessage(
        result.data.status === "pending"
          ? "검토 제안을 준비했습니다. 자료를 확인한 뒤 결정해 주세요."
          : proposalStatusMessage(result.data.status),
      );
      toast.success(
        result.data.status === "pending"
          ? "자료 검토 제안을 준비했습니다."
          : proposalStatusMessage(result.data.status),
      );
    });
  }

  function handleDecision(decision: "approve" | "reject") {
    if (!proposalId || proposalStatus !== "pending") return;
    setError(null);
    setMessage(null);
    setStale(false);
    startDecision(async () => {
      const result = await decideReviewMaterialProposal({
        workspaceId,
        proposalId,
        decision,
        note: decisionNote,
      });
      if (!result.ok) {
        handleActionError(result.error);
        return;
      }

      setProposalStatus(result.data.proposal.status);
      setOutcome(
        result.data.outcome === "succeeded" ? "approved" : result.data.outcome,
      );
      if (decision === "approve") {
        const successMessage =
          result.data.outcome === "replayed"
            ? "이미 승인된 자료입니다. 기존 실행 결과를 확인했습니다."
            : "자료를 확인됨으로 변경했습니다.";
        setMessage(successMessage);
        toast.success(successMessage);
      } else {
        const rejectionMessage =
          "제안 거절을 기록했습니다. 자료는 미확인 상태로 유지됩니다.";
        setMessage(rejectionMessage);
        toast.success("제안 거절을 기록했습니다.");
      }
      setDecisionNote("");
      // The server action revalidates home; refresh removes an approved signal
      // and keeps a rejected, still-pending signal visible.
      router.refresh();
    });
  }

  function handleActionError(actionError: {
    code: string;
    message: string;
    meta?: Record<string, unknown>;
  }) {
    const isStale =
      actionError.code === "CONFLICT" &&
      (actionError.meta?.reason === "STALE_TARGET_VERSION" ||
        actionError.meta?.reason === "STALE_PROPOSAL");
    if (isStale) {
      setStale(true);
      setError("자료가 변경되어 최신 버전을 다시 확인해야 합니다.");
      setMessage("현재 자료 버전과 제안의 기준 버전이 다릅니다.");
    } else {
      setError(actionError.message);
      setMessage(null);
    }
    toast.error(isStale ? "자료가 변경되었습니다. 최신 상태를 확인해 주세요." : actionError.message);
  }

  const status = outcome ?? proposalStatus;
  const canStartProposal =
    !stale &&
    !proposalId &&
    proposalStatus !== "rejected" &&
    proposalStatus !== "expired";
  const canDecide = proposalId && proposalStatus === "pending" && !outcome && !stale;
  const materialTitle = materialEvidence?.label ?? "자료";
  const courseTitle = courseEvidence?.label ?? "소속 수업";

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        aria-label={`${materialTitle} 자료 검토 열기`}
      >
        <ClipboardCheck className="h-4 w-4" />
        {action.proposalStatus === "pending" ? "검토 이어가기" : "자료 검토"}
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange} className="max-w-lg">
        <DialogHeader
          title="자료 확인 결정"
          description="자료를 직접 확인한 뒤 대표 운영자가 처리 여부를 결정합니다."
        />
        <DialogBody>
          <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-blue-700">자료</p>
                <h3 className="mt-1 truncate text-base font-bold text-gray-950">
                  {materialTitle}
                </h3>
                <p className="mt-1 text-sm text-gray-600">{courseTitle}</p>
              </div>
              <Badge tone="warning">업로드 완료 · 미확인</Badge>
            </div>
            <dl className="mt-4 grid gap-3 border-t border-blue-100 pt-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-gray-500">공개 범위</dt>
                <dd className="mt-1 font-medium text-gray-800">
                  {materialVisibilityLabel(action.visibilityScope)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">검토 기준 버전</dt>
                <dd className="mt-1 font-medium text-gray-800">
                  {formatTargetVersion(action.targetUpdatedAt)}
                </dd>
              </div>
            </dl>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownload}
              disabled={busy}
            >
              {downloadPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {downloadPending ? "준비 중..." : "자료 열기"}
            </Button>
            <Link
              href={task.relatedHref}
              className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-md)] px-3 text-sm font-medium text-blue-700 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]/30"
            >
              자료 관리 화면
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-gray-500" />
              <p className="text-sm font-semibold text-gray-800">판단 근거</p>
            </div>
            <ul className="mt-2 space-y-2 text-sm text-gray-600">
              {task.evidence.map((evidence, index) => (
                <li key={`${evidence.entityType}:${evidence.entityId}:${index}`}>
                  <span className="font-medium text-gray-800">{evidence.label}</span>
                  <span className="mx-1 text-gray-300">·</span>
                  {evidence.reason}
                </li>
              ))}
            </ul>
          </div>

          {error ? (
            <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          {message ? (
            <div
              role="status"
              className={`rounded-lg border px-4 py-3 text-sm ${
                stale || status === "rejected" || status === "expired"
                  ? "border-amber-200 bg-amber-50 text-amber-800"
                  : "border-emerald-200 bg-emerald-50 text-emerald-800"
              }`}
            >
              {message}
            </div>
          ) : null}

          {canStartProposal ? (
            <div className="rounded-lg border border-dashed border-gray-200 px-4 py-4">
              <p className="text-sm font-semibold text-gray-800">아직 검토 제안이 없습니다.</p>
              <p className="mt-1 text-sm leading-5 text-gray-600">
                자료를 확인할 준비가 되었을 때 검토 제안을 생성하세요. 이 버튼을 누르기 전에는 아무것도 변경되지 않습니다.
              </p>
              <Button
                type="button"
                className="mt-3"
                onClick={handleEnsureProposal}
                disabled={busy}
              >
                {proposalPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {proposalPending ? "제안 준비 중..." : "검토 시작"}
              </Button>
            </div>
          ) : null}

          {canDecide ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-4 py-4">
              <p className="text-sm font-semibold text-gray-900">대표 운영자의 결정을 남겨 주세요.</p>
              <p className="mt-1 text-sm leading-5 text-gray-700">
                승인하면 현재 자료가 확인됨으로 변경되고, 거절하면 자료는 미확인 상태로 남습니다.
              </p>
              <Textarea
                className="mt-3 bg-white"
                value={decisionNote}
                onChange={(event) => setDecisionNote(event.target.value)}
                placeholder="결정 메모 (선택 입력)"
                maxLength={2000}
                disabled={busy}
                aria-label="결정 메모"
              />
              <div className="mt-3 flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="border-rose-200 text-rose-700 hover:bg-rose-50"
                  onClick={() => handleDecision("reject")}
                  disabled={busy}
                >
                  {decisionPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  제안 거절
                </Button>
                <Button
                  type="button"
                  onClick={() => handleDecision("approve")}
                  disabled={busy}
                >
                  {decisionPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  확인됨으로 변경
                </Button>
              </div>
            </div>
          ) : null}

          {proposalStatus === "rejected" && !message ? (
            <StatusNotice tone="warning">
              이 자료 버전의 제안은 거절되었습니다. 자료는 미확인 상태로 유지됩니다.
            </StatusNotice>
          ) : null}

          {proposalStatus === "expired" || stale ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setOpen(false);
                router.refresh();
              }}
              disabled={busy}
            >
              <RefreshCcw className="h-4 w-4" />
              최신 상태 다시 확인
            </Button>
          ) : null}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
            닫기
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  );
}

function StatusNotice({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "warning" | "success";
}) {
  return (
    <div
      role="status"
      className={
        tone === "warning"
          ? "rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
          : "rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
      }
    >
      {children}
    </div>
  );
}

function proposalStatusMessage(status: AdminCopilotProposalStatus): string {
  switch (status) {
    case "approved":
      return "이미 승인된 제안입니다.";
    case "rejected":
      return "이미 거절된 제안입니다. 자료는 미확인 상태로 유지됩니다.";
    case "expired":
      return "자료가 변경되어 기존 제안이 만료되었습니다.";
    case "pending":
      return "검토 제안을 준비했습니다. 자료를 확인한 뒤 결정해 주세요.";
  }
}

function formatTargetVersion(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
