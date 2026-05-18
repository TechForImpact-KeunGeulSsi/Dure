"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarDays,
  FileText,
  Search,
} from "lucide-react";

import type {
  PublicCourseCatalog,
  PublicCourseSummary,
} from "@/services/public-catalog";
import { COURSE_STATUS_LABEL } from "@/types/course";

type PublicVillageCatalogProps = {
  catalog: PublicCourseCatalog;
};

function formatPeriod(startsOn: string | null, endsOn: string | null) {
  if (!startsOn && !endsOn) return "기간 미정";
  const start = startsOn?.replaceAll("-", ".") ?? "시작일 미정";
  const end = endsOn?.replaceAll("-", ".") ?? "종료일 미정";
  return `${start} - ${end}`;
}

export function PublicVillageCatalog({ catalog }: PublicVillageCatalogProps) {
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(
    null,
  );
  const [search, setSearch] = useState("");

  const selectedWorkspace = useMemo(
    () =>
      catalog.workspaces.find(
        (workspace) => workspace.id === selectedWorkspaceId,
      ) ?? null,
    [catalog.workspaces, selectedWorkspaceId],
  );

  const filteredWorkspaces = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("ko-KR");
    if (!keyword) return catalog.workspaces;
    return catalog.workspaces.filter((workspace) =>
      workspace.name.toLocaleLowerCase("ko-KR").includes(keyword),
    );
  }, [catalog.workspaces, search]);

  if (catalog.workspaces.length === 0) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] bg-white px-5 py-12 text-center text-sm text-[var(--color-muted-foreground)]">
        아직 공개된 마을 수업이 없습니다.
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-[var(--color-border)] bg-white/90 p-4 shadow-[0_24px_70px_rgba(15,23,42,0.08)] sm:p-6">
      {selectedWorkspace ? (
        <VillageCourseView
          workspace={selectedWorkspace}
          onBack={() => setSelectedWorkspaceId(null)}
        />
      ) : (
        <VillageSelectionView
          search={search}
          onSearchChange={setSearch}
          workspaces={filteredWorkspaces}
          onSelect={setSelectedWorkspaceId}
        />
      )}
    </div>
  );
}

function VillageSelectionView({
  search,
  onSearchChange,
  workspaces,
  onSelect,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  workspaces: PublicCourseCatalog["workspaces"];
  onSelect: (workspaceId: string) => void;
}) {
  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="inline-flex h-8 w-fit items-center rounded-full border border-blue-200 bg-blue-50 px-3 text-xs font-bold text-blue-700">
          마을 선택
        </span>
        <label className="relative block w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--color-muted-foreground)]" />
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            className="h-11 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white pl-9 pr-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
            placeholder="마을 이름으로 검색"
            aria-label="마을 이름으로 검색"
          />
        </label>
      </div>

      {workspaces.length === 0 ? (
        <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] bg-[var(--color-muted)] px-5 py-10 text-center text-sm text-[var(--color-muted-foreground)]">
          검색 결과에 맞는 마을이 없습니다.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {workspaces.map((workspace, index) => {
            const inProgressCount = workspace.courses.filter(
              (course) => course.status === "in_progress",
            ).length;
            const plannedCount = workspace.courses.filter(
              (course) => course.status === "planned",
            ).length;
            const initial = workspace.name.trim().slice(0, 1) || "마";
            const toneClass =
              VILLAGE_MARK_TONES[index % VILLAGE_MARK_TONES.length];

            return (
              <button
                key={workspace.id}
                type="button"
                onClick={() => onSelect(workspace.id)}
                className="group relative min-h-[236px] rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-5 text-left shadow-[0_16px_40px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_18px_46px_rgba(15,23,42,0.09)]"
              >
                <span
                  className={`grid size-13 place-items-center rounded-2xl text-xl font-black text-white ${toneClass}`}
                >
                  {initial}
                </span>
                <ArrowRight className="absolute right-5 top-6 size-5 text-[var(--color-primary)] transition group-hover:translate-x-1" />
                <h3 className="mt-6 text-xl font-bold text-[var(--color-foreground)]">
                  {workspace.name}
                </h3>
                <p className="mt-2 text-sm leading-6 text-[var(--color-muted-foreground)]">
                  공개된 수업 {workspace.courses.length}개를 이 마을 안에서
                  확인할 수 있습니다.
                </p>
                <div className="mt-5 flex flex-wrap gap-1.5">
                  <SummaryBadge>공개 수업 {workspace.courses.length}개</SummaryBadge>
                  <SummaryBadge>진행 중 {inProgressCount}개</SummaryBadge>
                  <SummaryBadge>예정 {plannedCount}개</SummaryBadge>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function VillageCourseView({
  workspace,
  onBack,
}: {
  workspace: PublicCourseCatalog["workspaces"][number];
  onBack: () => void;
}) {
  return (
    <div>
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex h-10 w-fit items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3 text-sm font-semibold text-slate-600 transition hover:border-blue-200 hover:text-[var(--color-primary)]"
        >
          <ArrowLeft className="size-4" />
          마을 다시 선택
        </button>
        <span className="inline-flex h-8 w-fit items-center rounded-full border border-blue-200 bg-blue-50 px-3 text-xs font-bold text-blue-700">
          선택 마을 수업
        </span>
      </div>

      <div className="mb-4">
        <h3 className="text-2xl font-bold text-[var(--color-foreground)] sm:text-3xl">
          {workspace.name}
        </h3>
        <p className="mt-2 text-sm leading-6 text-[var(--color-muted-foreground)]">
          이 마을에서 공개한 수업만 모아 보여드립니다.
        </p>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        <FilterPill active>전체</FilterPill>
        <FilterPill>진행 중</FilterPill>
        <FilterPill>예정</FilterPill>
        <FilterPill>자료 있음</FilterPill>
      </div>

      {workspace.courses.length === 0 ? (
        <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] bg-[var(--color-muted)] px-5 py-10 text-center text-sm text-[var(--color-muted-foreground)]">
          이 마을에는 아직 공개된 수업이 없습니다.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {workspace.courses.map((course) => (
            <VillageCourseCard key={course.id} course={course} />
          ))}
        </div>
      )}
    </div>
  );
}

function VillageCourseCard({ course }: { course: PublicCourseSummary }) {
  const accent = course.cardColor ?? "#2563eb";

  return (
    <Link
      href={`/public/courses/${course.id}`}
      className="group flex min-h-[288px] flex-col rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_18px_46px_rgba(15,23,42,0.09)]"
    >
      <span
        className="h-1.5 w-14 rounded-full"
        style={{ backgroundColor: accent }}
      />
      <div className="mt-5 flex items-start justify-between gap-3">
        <h4 className="line-clamp-2 text-xl font-bold leading-snug text-[var(--color-foreground)]">
          {course.name}
        </h4>
        <span className="shrink-0 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
          {COURSE_STATUS_LABEL[course.status]}
        </span>
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {course.groupNames.length > 0 ? (
          course.groupNames.map((name) => (
            <SummaryBadge key={name}>{name}</SummaryBadge>
          ))
        ) : (
          <SummaryBadge>연결된 그룹 없음</SummaryBadge>
        )}
      </div>
      <div className="mt-auto grid grid-cols-2 gap-3 pt-7 text-sm font-semibold text-slate-600">
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays className="size-4 text-[var(--color-primary)]" />
          {formatPeriod(course.startsOn, course.endsOn)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <BookOpen className="size-4 text-[var(--color-primary)]" />
          {course.sessionCount}회차
        </span>
        <span className="inline-flex items-center gap-1.5">
          <FileText className="size-4 text-[var(--color-primary)]" />
          자료 {course.materialCount}개
        </span>
        <span className="inline-flex items-center justify-end gap-1.5 text-[var(--color-primary)]">
          자세히 보기
          <ArrowRight className="size-4 transition group-hover:translate-x-1" />
        </span>
      </div>
    </Link>
  );
}

function SummaryBadge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-[var(--color-muted)] px-2.5 py-1 text-xs font-bold text-slate-600">
      {children}
    </span>
  );
}

function FilterPill({
  children,
  active = false,
}: {
  children: ReactNode;
  active?: boolean;
}) {
  return (
    <span
      className={
        active
          ? "inline-flex h-9 items-center rounded-full bg-[var(--color-primary)] px-4 text-sm font-bold text-white"
          : "inline-flex h-9 items-center rounded-full border border-[var(--color-border)] bg-white px-4 text-sm font-bold text-slate-600"
      }
    >
      {children}
    </span>
  );
}

const VILLAGE_MARK_TONES = [
  "bg-blue-600",
  "bg-violet-600",
  "bg-teal-700",
  "bg-orange-600",
];
