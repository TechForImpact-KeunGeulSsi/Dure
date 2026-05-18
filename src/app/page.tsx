import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, Building2, CheckCircle2, MapPin } from "lucide-react";

import { DureMark } from "@/components/auth/dure-mark";
import { PublicVillageCatalog } from "@/components/public-catalog/public-village-catalog";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getPublicCourseCatalog,
  type PublicCourseCatalog,
} from "@/services/public-catalog";

export default async function RootPage() {
  const supabase = await createSupabaseServerClient();
  const [{ data: userResult }, catalogResult] = await Promise.all([
    supabase.auth.getUser(),
    getPublicCourseCatalog(),
  ]);
  const user = userResult.user;
  const catalog = catalogResult.ok ? catalogResult.data : { workspaces: [] };
  const totals = getCatalogTotals(catalog);

  return (
    <main className="min-h-screen bg-white text-[var(--color-foreground)]">
      <header className="sticky top-0 z-30 border-b border-[var(--color-border)]/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between gap-4 px-5">
          <Link href="/" className="flex items-center gap-2.5">
            <DureMark className="h-8 w-8" />
            <span className="text-lg font-extrabold text-gray-950">DURE</span>
          </Link>
          <nav className="hidden items-center gap-5 text-sm font-semibold text-[var(--color-muted-foreground)] sm:flex">
            <Link href="#features" className="transition hover:text-gray-950">
              서비스 소개
            </Link>
            <Link href="#catalog" className="transition hover:text-gray-950">
              마을별 둘러보기
            </Link>
          </nav>
          <Link
            href={user ? "/workspaces" : "/login"}
            className="inline-flex h-10 items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-4 text-sm font-bold text-gray-950 transition hover:border-blue-200 hover:text-[var(--color-primary)]"
          >
            {user ? "워크스페이스로 이동" : "로그인"}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <section className="relative min-h-[calc(100svh-72px)] overflow-hidden bg-[linear-gradient(180deg,rgba(241,245,249,0.78),rgba(255,255,255,0)_46%),radial-gradient(circle_at_82%_18%,rgba(37,99,235,0.12),transparent_30%)] px-5 py-16 sm:py-20">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[0.94fr_1.06fr]">
          <div>
            <p className="text-sm font-extrabold text-[var(--color-primary)]">
              마을별 수업 둘러보기
            </p>
            <h1 className="mt-5 max-w-2xl text-5xl font-extrabold leading-[1.04] tracking-normal text-gray-950 sm:text-6xl lg:text-7xl">
              마을마다 열리는 배움을 한곳에서 둘러보세요
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
              DURE는 마을 교육 운영을 위한 수업 관리 플랫폼입니다.
            </p>
            <div className="mt-9 flex flex-wrap gap-2.5">
              <Link
                href="#catalog"
                className="inline-flex h-11 items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-primary)] px-5 text-sm font-bold text-white transition hover:opacity-90"
              >
                마을별 수업 둘러보기
                <ArrowRight className="size-4" />
              </Link>
              <Link
                href={user ? "/workspaces" : "/login"}
                className="inline-flex h-11 items-center rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-5 text-sm font-bold text-gray-950 transition hover:border-blue-200"
              >
                {user ? "워크스페이스로 이동" : "로그인"}
              </Link>
            </div>
            <dl className="mt-12 flex flex-wrap gap-8 text-sm text-slate-600">
              <div>
                <dt className="text-3xl font-extrabold text-gray-950">
                  {totals.courseCount}
                </dt>
                <dd className="mt-1">공개 수업</dd>
              </div>
              <div>
                <dt className="text-3xl font-extrabold text-gray-950">
                  {totals.workspaceCount}
                </dt>
                <dd className="mt-1">참여 마을</dd>
              </div>
              <div>
                <dt className="text-3xl font-extrabold text-gray-950">
                  {totals.sessionCount}
                </dt>
                <dd className="mt-1">예정 회차</dd>
              </div>
            </dl>
          </div>

          <TodayVillageMap catalog={catalog} />
        </div>
      </section>

      <section id="features" className="mx-auto grid max-w-6xl gap-14 px-5 py-20 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
        <div>
          <p className="text-sm font-extrabold text-[var(--color-primary)]">
            DURE가 연결하는 흐름
          </p>
          <h2 className="mt-4 text-4xl font-extrabold leading-tight text-gray-950">
            공개 탐색부터 수업 운영까지 한 흐름으로 이어집니다
          </h2>
        </div>
        <div className="grid gap-7">
          <FeatureItem
            icon={<MapPin className="size-5" />}
            title="마을 수업을 공개하고 발견하게 합니다"
          >
            방문자는 로그인 없이 마을별 수업의 기간, 회차, 대상 그룹, 공개
            자료를 확인할 수 있습니다.
          </FeatureItem>
          <FeatureItem
            icon={<CheckCircle2 className="size-5" />}
            title="운영자는 수업 운영을 한 흐름으로 관리합니다"
          >
            참여자, 출석, 자료, 정산, 멤버 초대까지 마을 교육 운영에 필요한 일을
            같은 워크스페이스에서 처리합니다.
          </FeatureItem>
        </div>
      </section>

      <section id="catalog" className="bg-[var(--color-muted)] px-5 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 max-w-3xl">
            <p className="text-sm font-extrabold text-[var(--color-primary)]">
              마을별 둘러보기
            </p>
            <h2 className="mt-4 text-4xl font-extrabold leading-tight text-gray-950">
              먼저 마을을 선택하세요
            </h2>
            <p className="mt-4 text-base leading-7 text-[var(--color-muted-foreground)]">
              관심 있는 마을을 고르면 그 마을에서 공개한 수업만 모아
              보여드립니다.
            </p>
          </div>

          {!catalogResult.ok ? (
            <div className="rounded-[var(--radius-lg)] border border-rose-200 bg-white px-5 py-8 text-sm text-rose-700">
              공개 수업 목록을 불러오지 못했습니다.
            </div>
          ) : (
            <PublicVillageCatalog catalog={catalog} />
          )}
        </div>
      </section>

      <section className="bg-slate-950 px-5 py-20 text-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="max-w-2xl text-4xl font-extrabold leading-tight">
              우리 마을의 수업 운영도 DURE에서 시작하세요
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-300">
              워크스페이스를 만들고, 수업을 공개하고, 멤버를 초대하세요.
            </p>
          </div>
          <Link
            href="/workspaces/new"
            className="inline-flex h-11 w-fit items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-primary)] px-5 text-sm font-bold text-white transition hover:opacity-90"
          >
            <Building2 className="size-4" />
            워크스페이스 만들기
          </Link>
        </div>
      </section>
    </main>
  );
}

function FeatureItem({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <article className="grid grid-cols-[48px_1fr] gap-5">
      <div className="grid size-12 place-items-center rounded-[var(--radius-lg)] bg-[var(--color-muted)] text-[var(--color-primary)]">
        {icon}
      </div>
      <div>
        <h3 className="text-lg font-bold text-gray-950">{title}</h3>
        <p className="mt-2 text-sm leading-7 text-[var(--color-muted-foreground)]">
          {children}
        </p>
      </div>
    </article>
  );
}

function TodayVillageMap({ catalog }: { catalog: PublicCourseCatalog }) {
  const mapLabels = getMapLabels(catalog);

  return (
    <section
      className="relative min-h-[560px] overflow-hidden rounded-[22px] border border-[var(--color-border)] bg-white/90 shadow-[0_28px_80px_rgba(15,23,42,0.12)]"
      aria-label="오늘의 마을 교육 운영"
    >
      <div className="flex items-center justify-between p-6">
        <div>
          <h2 className="text-lg font-extrabold text-gray-950">
            오늘의 마을 교육 운영
          </h2>
          <p className="mt-1 text-xs font-medium text-slate-500">
            지역별 수업 현황을 한눈에 보는 지도형 요약
          </p>
        </div>
        <span className="size-3 rounded-full bg-emerald-500 shadow-[0_0_0_10px_rgba(34,197,94,0.12)]" />
      </div>

      <div className="absolute inset-x-5 bottom-5 top-24 overflow-hidden rounded-[18px] bg-slate-50">
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 z-10 h-full w-full"
          aria-hidden="true"
        >
          {mapLabels.map((label) => (
            <g key={label.id}>
              <path
                d={`M${label.labelAnchorX} ${label.labelAnchorY} L${label.dotX} ${label.dotY}`}
                fill="none"
                stroke="#38bdf8"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
              <circle cx={label.dotX} cy={label.dotY} r="1.8" fill="#2563eb" />
            </g>
          ))}
        </svg>

        <img
          src="/korea-map-reference.svg"
          alt="대한민국 지도"
          className="absolute left-1/2 top-[42%] z-0 h-[64%] max-h-[330px] w-auto -translate-x-1/2 -translate-y-1/2 opacity-95"
        />

        {mapLabels.map((label) => (
          <div
            key={label.id}
            className="absolute z-20 rounded-[var(--radius-md)] bg-[var(--color-primary)] px-3 py-2 text-xs font-extrabold text-white shadow-[0_12px_30px_rgba(37,99,235,0.22)]"
            style={{ left: `${label.labelLeft}%`, top: `${label.labelTop}%` }}
          >
            {label.name}
            <span className="ml-2 font-bold text-blue-100">
              {label.count}개
            </span>
          </div>
        ))}

        <div className="absolute bottom-5 left-5 right-5 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white/90 p-4 shadow-[0_18px_50px_rgba(15,23,42,0.1)] backdrop-blur">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-extrabold text-gray-950">
                전국 마을 수업 현황
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                마을별 공개 수업이 늘어나면 지역 단위로 묶어 보여줍니다.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-right text-xs font-bold text-slate-600">
              <span>표시 마을 {mapLabels.length}곳</span>
              <span>공개 수업 {getCatalogTotals(catalog).courseCount}개</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function getCatalogTotals(catalog: PublicCourseCatalog) {
  return catalog.workspaces.reduce(
    (totals, workspace) => {
      totals.workspaceCount += 1;
      totals.courseCount += workspace.courses.length;
      totals.sessionCount += workspace.courses.reduce(
        (sum, course) => sum + course.sessionCount,
        0,
      );
      return totals;
    },
    { workspaceCount: 0, courseCount: 0, sessionCount: 0 },
  );
}

function getMapLabels(catalog: PublicCourseCatalog) {
  const fallback = [
    { id: "capital", name: "수도권", courses: 2 },
    { id: "central", name: "충청권", courses: 1 },
    { id: "south", name: "영남권", courses: 1 },
    { id: "jeju", name: "제주권", courses: 0 },
  ];
  const source =
    catalog.workspaces.length > 0
      ? catalog.workspaces.slice(0, 4).map((workspace) => ({
          id: workspace.id,
          name: workspace.name,
          courses: workspace.courses.length,
        }))
      : fallback;

  return source.map((item, index) => ({
    id: item.id,
    name: item.name,
    count: item.courses,
    ...MAP_LABEL_SLOTS[index % MAP_LABEL_SLOTS.length],
  }));
}

const MAP_LABEL_SLOTS = [
  {
    dotX: 43,
    dotY: 28,
    labelAnchorX: 28,
    labelAnchorY: 20,
    labelLeft: 5,
    labelTop: 17,
  },
  {
    dotX: 48,
    dotY: 45,
    labelAnchorX: 27,
    labelAnchorY: 44,
    labelLeft: 5,
    labelTop: 42,
  },
  {
    dotX: 60,
    dotY: 54,
    labelAnchorX: 78,
    labelAnchorY: 47,
    labelLeft: 71,
    labelTop: 44,
  },
  {
    dotX: 44,
    dotY: 80,
    labelAnchorX: 27,
    labelAnchorY: 74,
    labelLeft: 5,
    labelTop: 72,
  },
];
