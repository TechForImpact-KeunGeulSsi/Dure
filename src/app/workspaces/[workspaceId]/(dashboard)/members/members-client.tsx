'use client';

import { Mail, MessageSquare, Search, UserPlus } from 'lucide-react';
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { workspaceRoleLabel } from '@/lib/api/labels';
import type { GroupSummary, MemberStatus, WorkspaceRole } from '@/lib/api/types';
import { cn } from '@/lib/utils';
import { rejectJoinRequest } from '@/services/join-requests';
import type { JoinRequestListItem } from '@/services/join-requests';
import type {
  GetWorkspaceMembersOutput,
  WorkspaceMemberListItem,
} from '@/services/workspace-members';

import { ApproveRequestDialog } from './approve-request-dialog';
import { EditMemberDialog } from './edit-member-dialog';
import { InviteMemberDialog } from './invite-member-dialog';

type Props = {
  workspaceId: string;
  initial: GetWorkspaceMembersOutput;
  groups: GroupSummary[];
  pendingRequests: JoinRequestListItem[];
};

const ROLE_LABEL: Record<WorkspaceRole, string> = {
  owner_admin: '대표 운영자',
  group_admin: '그룹 운영자',
  instructor: '강사',
};

const STATUS_LABEL: Record<MemberStatus, string> = {
  active: '활성',
  invited: '초대 대기',
  disabled: '비활성',
  removed: '제외',
};

const STATUS_TONE: Record<MemberStatus, 'success' | 'warning' | 'neutral' | 'danger'> = {
  active: 'success',
  invited: 'warning',
  disabled: 'neutral',
  removed: 'danger',
};

type RoleFilter = 'all' | WorkspaceRole;

const ROLE_FILTERS: { value: RoleFilter; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'owner_admin', label: '대표 운영자' },
  { value: 'group_admin', label: '그룹 운영자' },
  { value: 'instructor', label: '강사' },
];

export function MembersClient({ workspaceId, initial, groups, pendingRequests }: Props) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [approveTarget, setApproveTarget] = useState<JoinRequestListItem | null>(null);
  const [editTarget, setEditTarget] = useState<WorkspaceMemberListItem | null>(null);
  const [rejectPending, startReject] = useTransition();
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [search, setSearch] = useState('');
  const router = useRouter();
  const canEdit = initial.canEditMembers;

  const instructorCount = initial.members.filter((m) => m.role === 'instructor').length;
  const activeCount = initial.members.filter((m) => m.status === 'active').length;
  const invitedCount = initial.members.filter((m) => m.status === 'invited').length;

  const filteredMembers = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return initial.members.filter((m) => {
      if (roleFilter !== 'all' && m.role !== roleFilter) return false;
      if (needle.length > 0) {
        const haystack = `${m.displayName ?? ''} ${m.email}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }, [initial.members, roleFilter, search]);

  function handleReject(req: JoinRequestListItem) {
    if (!initial.canInviteMembers) return;
    const reason = window.prompt(
      `${req.user.displayName ?? req.user.email}의 요청을 거부합니다. 사유(선택)를 입력하세요.`,
      '',
    );
    if (reason === null) return; // cancel
    startReject(async () => {
      const result = await rejectJoinRequest(workspaceId, req.id, reason || undefined);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success('참여 요청을 거부했습니다.');
      router.refresh();
    });
  }

  return (
    <section className="space-y-6">
      <Banner
        canInvite={initial.canInviteMembers}
        onInvite={() => setInviteOpen(true)}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard label="전체 멤버" value={`${initial.members.length}명`} tone="blue" />
        <StatCard label="강사" value={`${instructorCount}명`} tone="emerald" />
        <StatCard label="초대 대기" value={`${invitedCount}명`} tone="amber" />
      </div>

      {initial.canInviteMembers && pendingRequests.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center justify-between gap-3 border-b border-gray-100 pb-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">참여 요청</h3>
              <p className="mt-0.5 text-xs text-gray-500">
                대기 중 {pendingRequests.length}건
              </p>
            </div>
          </div>
          <ul className="mt-3 divide-y divide-gray-100">
            {pendingRequests.map((req) => (
              <li
                key={req.id}
                className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-sm text-gray-900">
                    <span className="font-medium">
                      {req.user.displayName ?? req.user.email}
                    </span>
                    <Badge tone="warning">{workspaceRoleLabel(req.desiredRole)} 희망</Badge>
                  </div>
                  <p className="flex items-center gap-1.5 text-xs text-gray-500">
                    <Mail className="h-3 w-3" />
                    {req.user.email}
                  </p>
                  {req.message && (
                    <p className="flex items-start gap-1.5 text-xs text-gray-600">
                      <MessageSquare className="mt-0.5 h-3 w-3 shrink-0" />
                      <span className="whitespace-pre-line">{req.message}</span>
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={rejectPending}
                    onClick={() => handleReject(req)}
                  >
                    거부
                  </Button>
                  <Button size="sm" onClick={() => setApproveTarget(req)}>
                    수락
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="p-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">멤버 목록</h3>
          <p className="mt-0.5 text-xs text-gray-500">
            활성 {activeCount}명 · 전체 {initial.members.length}명
          </p>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {ROLE_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setRoleFilter(f.value)}
              className={cn(
                'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
                roleFilter === f.value
                  ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
                  : 'bg-white text-gray-600 hover:bg-gray-50 border border-[var(--color-border)]',
              )}
            >
              {f.label}
            </button>
          ))}
          <div className="ml-auto relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="이름 또는 이메일 검색"
              className="h-9 w-full rounded-full border border-[var(--color-border)] bg-white pl-9 pr-3 text-sm outline-none placeholder:text-gray-400 focus:border-[var(--color-ring)] focus:ring-2 focus:ring-[var(--color-ring)]/20"
            />
          </div>
        </div>
      </Card>

      {initial.members.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-sm text-gray-500">등록된 멤버가 없습니다.</p>
        </Card>
      ) : filteredMembers.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-sm text-gray-500">조건에 맞는 멤버가 없습니다.</p>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>이름</TableHead>
                <TableHead>이메일</TableHead>
                <TableHead>역할</TableHead>
                <TableHead>상태</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMembers.map((m) => (
                <TableRow
                  key={m.id}
                  onClick={canEdit ? () => setEditTarget(m) : undefined}
                  className={
                    canEdit
                      ? 'cursor-pointer hover:bg-gray-50'
                      : undefined
                  }
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">
                        {m.displayName ?? '—'}
                      </span>
                      {m.isCurrentUser && <Badge tone="primary">나</Badge>}
                      {m.memo && (
                        <span
                          className="text-xs text-gray-400"
                          title={m.memo}
                        >
                          · 메모 있음
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-sm text-gray-600">
                      <Mail className="h-3.5 w-3.5 text-gray-400" />
                      <span>{m.email}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-gray-700">{ROLE_LABEL[m.role]}</span>
                  </TableCell>
                  <TableCell>
                    <Badge tone={STATUS_TONE[m.status]}>{STATUS_LABEL[m.status]}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <InviteMemberDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        workspaceId={workspaceId}
        groups={groups}
        canInviteOwner={initial.canInviteOwner}
      />

      <ApproveRequestDialog
        request={approveTarget}
        workspaceId={workspaceId}
        groups={groups}
        open={approveTarget !== null}
        onOpenChange={(open) => {
          if (!open) setApproveTarget(null);
        }}
      />

      <EditMemberDialog
        member={editTarget}
        workspaceId={workspaceId}
        groups={groups}
        open={editTarget !== null}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null);
        }}
      />
    </section>
  );
}

function Banner({
  canInvite,
  onInvite,
}: {
  canInvite: boolean;
  onInvite: () => void;
}) {
  return (
    <section className="flex flex-col gap-6 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 p-8 shadow-sm sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="text-2xl font-bold text-white">강사·운영자 관리</h2>
        <p className="mt-1 text-sm text-blue-100">
          강사와 그룹 운영자를 초대하거나, 사용자가 보낸 참여 요청을 수락해 워크스페이스 멤버를 관리하세요.
        </p>
      </div>
      {canInvite && (
        <Button
          type="button"
          variant="outline"
          onClick={onInvite}
          className="shrink-0 border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"
        >
          <UserPlus className="size-4" />
          멤버 초대
        </Button>
      )}
    </section>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'blue' | 'emerald' | 'amber';
}) {
  const valueColor = {
    blue: 'text-blue-600',
    emerald: 'text-emerald-600',
    amber: 'text-amber-600',
  }[tone];
  return (
    <Card>
      <CardContent>
        <CardTitle>{label}</CardTitle>
        <p className={cn('mt-1 text-2xl font-bold', valueColor)}>{value}</p>
      </CardContent>
    </Card>
  );
}
