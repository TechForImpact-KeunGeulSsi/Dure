"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { Table, TBody, THead, Td, Th, Tr } from "@/components/ui/table";
import { GroupStatusBadge } from "@/components/ui/status-badge";
import {
  deleteGroupAction,
  upsertGroupAction,
  type GetGroupsPageOutput,
} from "@/services/groups";
import type { GroupListItem, GroupStatus } from "@/lib/api/types";

type GroupsClientProps = {
  workspaceId: string;
  initialFilters: { search: string; status: string };
  data: GetGroupsPageOutput;
  canCreate: boolean;
};

type DialogState =
  | { mode: "closed" }
  | { mode: "create" }
  | { mode: "edit"; group: GroupListItem };

export function GroupsClient({
  workspaceId,
  initialFilters,
  data,
  canCreate,
}: GroupsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(initialFilters.search);
  const [statusFilter, setStatusFilter] = useState(initialFilters.status);
  const [dialog, setDialog] = useState<DialogState>({ mode: "closed" });
  const [pending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function applyFilters(next: { search?: string; status?: string; page?: string }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.search !== undefined) {
      if (next.search) params.set("search", next.search);
      else params.delete("search");
    }
    if (next.status !== undefined) {
      if (next.status) params.set("status", next.status);
      else params.delete("status");
    }
    if (next.page !== undefined) params.set("page", next.page);
    else params.delete("page");
    router.replace(`?${params.toString()}`);
  }

  function handleSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    applyFilters({ search, status: statusFilter });
  }

  function handleDelete(group: GroupListItem) {
    if (!group.canManageLifecycle) return;
    const ok = window.confirm(
      `'${group.name}' 그룹을 삭제할까요?\n기존 수업/참여자 기록은 그대로 보존됩니다.`,
    );
    if (!ok) return;
    setDeletingId(group.id);
    startTransition(async () => {
      const result = await deleteGroupAction(workspaceId, group.id);
      setDeletingId(null);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success("그룹을 삭제했어요.");
      router.refresh();
    });
  }

  const totalPages = Math.max(
    1,
    Math.ceil(data.pageInfo.totalCount / data.pageInfo.pageSize),
  );

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleSearchSubmit}
        className="flex flex-col gap-3 sm:flex-row sm:items-center"
      >
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="그룹 이름 검색"
          className="sm:max-w-xs"
        />
        <Select
          value={statusFilter}
          onChange={(event) => {
            setStatusFilter(event.target.value);
            applyFilters({ search, status: event.target.value });
          }}
          className="sm:max-w-[160px]"
        >
          <option value="">전체 상태</option>
          <option value="active">활성</option>
          <option value="inactive">비활성</option>
        </Select>
        <div className="flex-1" />
        <Button type="submit" variant="secondary">
          검색
        </Button>
        {canCreate && (
          <Button type="button" onClick={() => setDialog({ mode: "create" })}>
            <Plus className="size-4" />새 그룹
          </Button>
        )}
      </form>

      {data.groups.length === 0 ? (
        <EmptyState
          title="등록된 그룹이 없습니다"
          description={
            canCreate
              ? "첫 그룹을 만들어 운영 단위를 시작해 보세요."
              : "이 워크스페이스에 접근 가능한 그룹이 아직 없습니다."
          }
          action={
            canCreate ? (
              <Button onClick={() => setDialog({ mode: "create" })}>
                <Plus className="size-4" />새 그룹
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white shadow-sm">
          <Table>
            <THead>
              <Tr>
                <Th>이름</Th>
                <Th>설명</Th>
                <Th>상태</Th>
                <Th className="text-right">참여자</Th>
                <Th className="text-right">수업</Th>
                <Th className="text-right">작업</Th>
              </Tr>
            </THead>
            <TBody>
              {data.groups.map((group) => {
                const participantsHref = `/workspaces/${workspaceId}/manage/participants?groupId=${encodeURIComponent(group.id)}`;
                return (
                  <Tr
                    key={group.id}
                    className="relative transition-colors hover:bg-[var(--color-muted)]/60"
                  >
                    <Td className="font-medium">
                      <Link
                        href={participantsHref}
                        aria-label={`${group.name} 그룹의 참여자 보기`}
                        className="absolute inset-0"
                      />
                      {group.name}
                    </Td>
                    <Td className="text-[var(--color-muted-foreground)]">
                      {group.description ?? "—"}
                    </Td>
                    <Td>
                      <GroupStatusBadge status={group.status as GroupStatus} />
                    </Td>
                    <Td className="text-right tabular-nums">
                      {group.participantCount}
                    </Td>
                    <Td className="text-right tabular-nums">
                      {group.courseCount}
                    </Td>
                    <Td className="relative z-10">
                      <div className="flex items-center justify-end gap-1">
                        {group.canEditDescription && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDialog({ mode: "edit", group })}
                            aria-label="수정"
                          >
                            <Pencil className="size-4" />
                          </Button>
                        )}
                        {group.canManageLifecycle && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(group)}
                            disabled={pending && deletingId === group.id}
                            aria-label="삭제"
                          >
                            <Trash2 className="size-4 text-[var(--color-destructive)]" />
                          </Button>
                        )}
                      </div>
                    </Td>
                  </Tr>
                );
              })}
            </TBody>
          </Table>
          </div>
          <Pagination
            page={data.pageInfo.page}
            totalPages={totalPages}
            buildHref={(targetPage) => {
              const params = new URLSearchParams(searchParams.toString());
              params.set("page", String(targetPage));
              return `?${params.toString()}`;
            }}
          />
        </>
      )}

      <GroupDialog
        state={dialog}
        onClose={() => setDialog({ mode: "closed" })}
        onSubmitted={() => {
          setDialog({ mode: "closed" });
          router.refresh();
        }}
        workspaceId={workspaceId}
      />
    </div>
  );
}

type GroupDialogProps = {
  state: DialogState;
  onClose: () => void;
  onSubmitted: () => void;
  workspaceId: string;
};

function GroupDialog({
  state,
  onClose,
  onSubmitted,
  workspaceId,
}: GroupDialogProps) {
  const open = state.mode !== "closed";
  const editing = state.mode === "edit" ? state.group : null;
  const canEditAllFields = editing ? editing.canManageLifecycle : true;

  const [name, setName] = useState(editing?.name ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [status, setStatus] = useState<GroupStatus>(
    (editing?.status as GroupStatus) ?? "active",
  );
  const [pending, startTransition] = useTransition();

  // editing 변경 시 폼 값 초기화
  useEffect(() => {
    setName(editing?.name ?? "");
    setDescription(editing?.description ?? "");
    setStatus((editing?.status as GroupStatus) ?? "active");
  }, [editing]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    startTransition(async () => {
      const result = await upsertGroupAction(workspaceId, {
        id: editing?.id,
        name: name.trim() || (editing?.name ?? ""),
        description: description.trim().length === 0 ? null : description.trim(),
        status,
      });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success(editing ? "그룹을 수정했어요." : "그룹을 만들었어요.");
      onSubmitted();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogHeader
        title={editing ? "그룹 수정" : "새 그룹"}
        description={
          canEditAllFields
            ? "그룹 이름, 설명, 상태를 입력해 주세요."
            : "이름과 상태 변경은 대표 운영자만 할 수 있어 비활성됩니다. 설명만 수정해 주세요."
        }
      />
      <form onSubmit={handleSubmit}>
        <DialogBody>
          <div className="space-y-2">
            <Label htmlFor="group-name">이름</Label>
            <Input
              id="group-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required={canEditAllFields}
              disabled={!canEditAllFields}
              maxLength={80}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="group-description">설명</Label>
            <Textarea
              id="group-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={500}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="group-status">상태</Label>
            <Select
              id="group-status"
              value={status}
              onChange={(event) => setStatus(event.target.value as GroupStatus)}
              disabled={!canEditAllFields}
            >
              <option value="active">활성</option>
              <option value="inactive">비활성</option>
            </Select>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            취소
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "저장 중…" : "저장"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
