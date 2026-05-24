"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MultiSelect } from "@/components/ui/multi-select";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { ParticipantStatusBadge } from "@/components/ui/status-badge";
import { Table, TBody, THead, Td, Th, Tr } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  deleteParticipantAction,
  updateParticipantGroupsAction,
  upsertParticipantAction,
  type GetParticipantsPageOutput,
} from "@/services/participants";
import type {
  GroupSummary,
  ParticipantListItem,
  ParticipantStatus,
} from "@/lib/api/types";

type ParticipantsClientProps = {
  workspaceId: string;
  initialFilters: { search: string; groupId: string; status: string };
  data: GetParticipantsPageOutput;
  accessibleGroups: GroupSummary[];
  canCreate: boolean;
  canDelete: boolean;
  isGroupAdmin: boolean;
};

type DialogState =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "edit"; participant: ParticipantListItem };

export function ParticipantsClient({
  workspaceId,
  initialFilters,
  data,
  accessibleGroups,
  canCreate,
  canDelete,
  isGroupAdmin,
}: ParticipantsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(initialFilters.search);
  const [groupId, setGroupId] = useState(initialFilters.groupId);
  const [statusFilter, setStatusFilter] = useState(initialFilters.status);
  const [dialog, setDialog] = useState<DialogState>({ kind: "closed" });
  const [pending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function applyFilters(next: {
    search?: string;
    groupId?: string;
    status?: string;
    page?: string;
  }) {
    const params = new URLSearchParams(searchParams.toString());
    for (const key of ["search", "groupId", "status"] as const) {
      const value = next[key];
      if (value !== undefined) {
        if (value) params.set(key, value);
        else params.delete(key);
      }
    }
    if (next.page) params.set("page", next.page);
    else params.delete("page");
    router.replace(`?${params.toString()}`);
  }

  function handleSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    applyFilters({ search, groupId, status: statusFilter });
  }

  function handleDelete(participant: ParticipantListItem) {
    if (!canDelete) return;
    const ok = window.confirm(
      `'${participant.name}' 참여자를 삭제할까요?\n기존 출석 기록은 보존되며, 이후 회차 출석 대상에서 제외됩니다.`,
    );
    if (!ok) return;
    setDeletingId(participant.id);
    startTransition(async () => {
      const result = await deleteParticipantAction(workspaceId, participant.id);
      setDeletingId(null);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success("참여자를 삭제했어요.");
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
          placeholder="참여자 이름 검색"
          className="sm:max-w-xs"
        />
        <Select
          value={groupId}
          onChange={(event) => {
            setGroupId(event.target.value);
            applyFilters({ search, groupId: event.target.value, status: statusFilter });
          }}
          className="sm:max-w-[200px]"
        >
          <option value="">전체 그룹</option>
          {accessibleGroups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </Select>
        <Select
          value={statusFilter}
          onChange={(event) => {
            setStatusFilter(event.target.value);
            applyFilters({ search, groupId, status: event.target.value });
          }}
          className="sm:max-w-[160px]"
        >
          <option value="">활성 + 비활성</option>
          <option value="active">활성</option>
          <option value="inactive">비활성</option>
          <option value="deleted">삭제됨</option>
        </Select>
        <div className="flex-1" />
        <Button type="submit" variant="secondary">
          검색
        </Button>
        {canCreate && (
          <Button type="button" onClick={() => setDialog({ kind: "create" })}>
            <Plus className="size-4" />새 참여자
          </Button>
        )}
      </form>

      {data.participants.length === 0 ? (
        <EmptyState
          title="등록된 참여자가 없습니다"
          description={
            canCreate
              ? "첫 참여자를 등록하세요. 이름만으로도 시작할 수 있어요."
              : "검색 조건을 바꾸거나 운영자에게 문의해 주세요."
          }
          action={
            canCreate ? (
              <Button onClick={() => setDialog({ kind: "create" })}>
                <Plus className="size-4" />새 참여자
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <Table className="table-fixed">
            <THead>
              <Tr>
                <Th>이름</Th>
                <Th>소속 그룹</Th>
                <Th className="text-right">수업</Th>
                <Th>상태</Th>
                <Th>메모</Th>
                <Th className="text-right">작업</Th>
              </Tr>
            </THead>
            <TBody>
              {data.participants.map((participant) => (
                <Tr key={participant.id}>
                  <Td className="font-medium">{participant.name}</Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {participant.groups.length === 0 && (
                        <span className="text-xs text-[var(--color-muted-foreground)]">
                          그룹 없음
                        </span>
                      )}
                      {participant.groups.map((group) => (
                        <Badge key={group.id} tone="primary">
                          {group.name}
                        </Badge>
                      ))}
                    </div>
                  </Td>
                  <Td className="text-right tabular-nums">
                    {participant.courseCount}
                  </Td>
                  <Td>
                    <ParticipantStatusBadge
                      status={participant.status as ParticipantStatus}
                    />
                  </Td>
                  <Td className="w-[18rem] text-[var(--color-muted-foreground)]">
                    <span className="block truncate">
                      {participant.memo ?? "—"}
                    </span>
                  </Td>
                  <Td>
                    <div className="flex items-center justify-end gap-1">
                      {(participant.canEditMaster ||
                        participant.canRemoveFromAccessibleGroups ||
                        canCreate) && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setDialog({ kind: "edit", participant })
                          }
                          aria-label="수정"
                        >
                          <Pencil className="size-4" />
                          수정
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(participant)}
                          disabled={pending && deletingId === participant.id}
                          aria-label="삭제"
                        >
                          <Trash2 className="size-4 text-[var(--color-destructive)]" />
                        </Button>
                      )}
                    </div>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
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

      <UpsertDialog
        state={dialog}
        onClose={() => setDialog({ kind: "closed" })}
        onSubmitted={() => {
          setDialog({ kind: "closed" });
          router.refresh();
        }}
        workspaceId={workspaceId}
        accessibleGroups={accessibleGroups}
        canCreate={canCreate}
        isGroupAdmin={isGroupAdmin}
      />
    </div>
  );
}

type UpsertDialogProps = {
  state: DialogState;
  onClose: () => void;
  onSubmitted: () => void;
  workspaceId: string;
  accessibleGroups: GroupSummary[];
  canCreate: boolean;
  isGroupAdmin: boolean;
};

function UpsertDialog({
  state,
  onClose,
  onSubmitted,
  workspaceId,
  accessibleGroups,
  canCreate,
  isGroupAdmin,
}: UpsertDialogProps) {
  const open = state.kind === "create" || state.kind === "edit";
  const editing = state.kind === "edit" ? state.participant : null;
  const isEdit = !!editing;

  const [name, setName] = useState("");
  const [memo, setMemo] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (state.kind === "edit") {
      const accessibleGroupIdSet = new Set(
        accessibleGroups.map((group) => group.id),
      );
      setName(state.participant.name);
      setMemo(state.participant.memo ?? "");
      setStatus(state.participant.status === "inactive" ? "inactive" : "active");
      setGroupIds(
        state.participant.groups
          .map((group) => group.id)
          .filter((id) => accessibleGroupIdSet.has(id)),
      );
      return;
    }
    if (state.kind === "create") {
      setName("");
      setMemo("");
      setStatus("active");
      setGroupIds([]);
    }
  }, [accessibleGroups, state]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    startTransition(async () => {
      if (!isEdit || editing?.canEditMaster) {
        const result = await upsertParticipantAction(workspaceId, {
          id: editing?.id,
          name: name.trim(),
          memo: memo.trim().length === 0 ? null : memo.trim(),
          status,
          groupIds: isEdit ? undefined : groupIds,
        });
        if (!result.ok) {
          toast.error(result.error.message);
          return;
        }
      }

      if (
        isEdit &&
        editing &&
        (editing.canRemoveFromAccessibleGroups || canCreate)
      ) {
        const groupResult = await updateParticipantGroupsAction(
          workspaceId,
          editing.id,
          { groupIds },
        );
        if (!groupResult.ok) {
          toast.error(groupResult.error.message);
          return;
        }
      }

      toast.success(isEdit ? "참여자를 수정했어요." : "참여자를 등록했어요.");
      onSubmitted();
    });
  }

  const canEditGroups =
    !isEdit || !!editing?.canRemoveFromAccessibleGroups || canCreate;
  const canEditMaster = !isEdit || !!editing?.canEditMaster;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogHeader
        title={isEdit ? "참여자 수정" : "새 참여자"}
        description={
          isEdit
            ? "기본 정보와 소속 그룹을 한 번에 수정합니다."
            : "참여자 이름을 입력하고, 필요하면 소속 그룹을 선택해 주세요."
        }
      />
      <form onSubmit={handleSubmit}>
        <DialogBody>
          <div className="space-y-2">
            <Label htmlFor="participant-name">이름</Label>
            <Input
              id="participant-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={60}
              required
              disabled={!canEditMaster}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="participant-memo">메모</Label>
            <Textarea
              id="participant-memo"
              value={memo}
              onChange={(event) => setMemo(event.target.value)}
              maxLength={500}
              rows={3}
              disabled={!canEditMaster}
            />
          </div>
          {canEditGroups && (
            <div className="space-y-2">
              <Label>소속 그룹{isGroupAdmin ? " (필수)" : " (선택)"}</Label>
              <MultiSelect
                options={accessibleGroups.map((group) => ({
                  id: group.id,
                  label: group.name,
                }))}
                selectedIds={groupIds}
                onChange={setGroupIds}
                placeholder="그룹 선택"
              />
              {isEdit && (
                <p className="text-xs text-[var(--color-muted-foreground)]">
                  접근 권한이 없는 그룹은 이 목록에 보이지 않으며 변경 대상이 아닙니다.
                </p>
              )}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="participant-status">상태</Label>
            <Select
              id="participant-status"
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as "active" | "inactive")
              }
              disabled={!canEditMaster}
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
