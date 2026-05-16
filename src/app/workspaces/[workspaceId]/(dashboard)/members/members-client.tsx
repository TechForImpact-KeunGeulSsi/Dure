'use client';

import { Mail, UserPlus } from 'lucide-react';
import { useState } from 'react';

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
import type { MemberStatus, WorkspaceRole } from '@/lib/api/types';
import { cn } from '@/lib/utils';
import type { GetWorkspaceMembersOutput } from '@/services/workspace-members';

import { InviteInstructorDialog } from './invite-instructor-dialog';

type Props = {
  workspaceId: string;
  initial: GetWorkspaceMembersOutput;
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

export function MembersClient({ workspaceId, initial }: Props) {
  const [inviteOpen, setInviteOpen] = useState(false);

  const instructorCount = initial.members.filter((m) => m.role === 'instructor').length;
  const activeCount = initial.members.filter((m) => m.status === 'active').length;
  const invitedCount = initial.members.filter((m) => m.status === 'invited').length;

  return (
    <section className="space-y-6">
      <Banner />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard label="전체 멤버" value={`${initial.members.length}명`} tone="blue" />
        <StatCard label="강사" value={`${instructorCount}명`} tone="emerald" />
        <StatCard label="초대 대기" value={`${invitedCount}명`} tone="amber" />
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">멤버 목록</h3>
            <p className="mt-0.5 text-xs text-gray-500">
              활성 {activeCount}명 · 전체 {initial.members.length}명
            </p>
          </div>
          {initial.canInviteInstructor && (
            <Button type="button" onClick={() => setInviteOpen(true)}>
              <UserPlus className="h-4 w-4" />
              강사 초대
            </Button>
          )}
        </div>
      </Card>

      {initial.members.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-sm text-gray-500">등록된 멤버가 없습니다.</p>
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
              {initial.members.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">
                        {m.displayName ?? '—'}
                      </span>
                      {m.isCurrentUser && <Badge tone="primary">나</Badge>}
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

      <InviteInstructorDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        workspaceId={workspaceId}
      />
    </section>
  );
}

function Banner() {
  return (
    <section className="rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 p-8 shadow-sm">
      <h2 className="text-2xl font-bold text-white">사용자 초대 / 권한 설정</h2>
      <p className="mt-1 text-sm text-blue-100">
        강사를 초대하고 수업에 배정하세요. 이미 가입된 이메일이면 즉시 활성, 아니면 초대 대기
        상태로 보관됩니다.
      </p>
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