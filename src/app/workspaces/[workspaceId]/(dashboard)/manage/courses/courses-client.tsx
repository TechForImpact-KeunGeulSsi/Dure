"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Pencil, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { CourseStatusBadge } from "@/components/ui/status-badge";
import { Table, TBody, THead, Td, Th, Tr } from "@/components/ui/table";
import type {
  CourseStatus,
  GroupSummary,
} from "@/lib/api/types";

import type { GetCoursesPageOutput } from "@/services/courses";

type CoursesClientProps = {
  workspaceId: string;
  initialFilters: { search: string; groupId: string; status: string };
  data: GetCoursesPageOutput;
  accessibleGroups: GroupSummary[];
  canCreate: boolean;
};

export function CoursesClient({
  workspaceId,
  initialFilters,
  data,
  accessibleGroups,
  canCreate,
}: CoursesClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(initialFilters.search);
  const [groupId, setGroupId] = useState(initialFilters.groupId);
  const [statusFilter, setStatusFilter] = useState(initialFilters.status);

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

  const totalPages = Math.max(
    1,
    Math.ceil(data.pageInfo.totalCount / data.pageInfo.pageSize),
  );
  const newCourseHref = `/workspaces/${workspaceId}/manage/courses/new`;

  const stats = computeStats(data.courses);

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-3">
        <StatCard label="전체 수업" value={data.pageInfo.totalCount} />
        <StatCard label="진행 중" value={stats.inProgress} />
        <StatCard label="진행 완료" value={stats.completed} />
      </section>

      <form
        onSubmit={handleSearchSubmit}
        className="flex flex-col gap-3 sm:flex-row sm:items-center"
      >
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="수업 이름 검색"
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
          <option value="">전체 상태</option>
          <option value="planned">진행 전</option>
          <option value="in_progress">진행 중</option>
          <option value="completed">진행 완료</option>
        </Select>
        <div className="flex-1" />
        <Button type="submit" variant="secondary">
          검색
        </Button>
        {canCreate && (
          <Link
            href={newCourseHref}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-primary)] px-4 text-sm font-medium text-[var(--color-primary-foreground)] hover:opacity-90"
          >
            <Plus className="size-4" />새 수업
          </Link>
        )}
      </form>

      {data.courses.length === 0 ? (
        <EmptyState
          title="등록된 수업이 없습니다"
          description={
            canCreate
              ? "첫 수업을 만들어 회차와 참여자를 한 번에 배정하세요."
              : "운영자에게 수업 생성 요청을 보내 보세요."
          }
          action={
            canCreate ? (
              <Link
                href={newCourseHref}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-primary)] px-4 text-sm font-medium text-[var(--color-primary-foreground)] hover:opacity-90"
              >
                <Plus className="size-4" />새 수업
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          <Table>
            <THead>
              <Tr>
                <Th>수업</Th>
                <Th>연결 그룹</Th>
                <Th>담당자</Th>
                <Th className="text-right">참여자</Th>
                <Th className="text-right">회차</Th>
                <Th>상태</Th>
                <Th className="text-right">작업</Th>
              </Tr>
            </THead>
            <TBody>
              {data.courses.map((course) => (
                <Tr key={course.id}>
                  <Td className="font-medium">
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="size-2.5 rounded-full"
                        style={{
                          backgroundColor: course.cardColor ?? "#2563eb",
                        }}
                      />
                      {course.name}
                    </span>
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {course.groups.length === 0 && (
                        <span className="text-xs text-[var(--color-muted-foreground)]">
                          그룹 없음
                        </span>
                      )}
                      {course.groups.map((group) => (
                        <Badge key={group.id} tone="primary">
                          {group.name}
                        </Badge>
                      ))}
                    </div>
                  </Td>
                  <Td className="text-[var(--color-muted-foreground)]">
                    {course.instructor?.displayName ??
                      course.instructor?.email ??
                      "미배정"}
                  </Td>
                  <Td className="text-right tabular-nums">
                    {course.participantCount}명
                  </Td>
                  <Td className="text-right tabular-nums">
                    {course.sessionCount}회
                  </Td>
                  <Td>
                    <CourseStatusBadge status={course.status as CourseStatus} />
                  </Td>
                  <Td className="text-right">
                    {course.canManageFullCourse ? (
                      <Link
                        href={`/workspaces/${workspaceId}/manage/courses/${course.id}/edit`}
                        className="inline-flex items-center gap-1 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-2.5 py-1 text-xs font-medium text-[var(--color-foreground)] hover:bg-[var(--color-muted)]"
                        aria-label={`${course.name} 편집`}
                      >
                        <Pencil className="size-3.5" />
                        편집
                      </Link>
                    ) : (
                      <span className="text-xs text-[var(--color-muted-foreground)]">
                        —
                      </span>
                    )}
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
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-card)] px-5 py-4">
      <p className="text-xs text-[var(--color-muted-foreground)]">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-[var(--color-foreground)]">
        {value}
      </p>
    </div>
  );
}

function computeStats(courses: GetCoursesPageOutput["courses"]): {
  inProgress: number;
  completed: number;
} {
  let inProgress = 0;
  let completed = 0;
  for (const course of courses) {
    if (course.status === "in_progress") inProgress += 1;
    else if (course.status === "completed") completed += 1;
  }
  return { inProgress, completed };
}
