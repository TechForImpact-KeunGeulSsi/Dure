import Link from "next/link";
import { redirect } from "next/navigation";
import { type ReactNode } from "react";
import { ArrowRight, Building2, CalendarDays, CheckCircle2 } from "lucide-react";

import { DureMark } from "@/components/auth/dure-mark";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function RootPage() {
  const supabase = await createSupabaseServerClient();
  const { data: userResult } = await supabase.auth.getUser();
  const user = userResult.user;

  // 로그인한 사용자는 공개 탐색이 아닌 운영 워크스페이스로 바로 이동한다.
  if (user) redirect("/workspaces");

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
              운영 방식
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
              센터 운영을 위한 수업 관리
            </p>
            <h1 className="mt-5 max-w-2xl text-5xl font-extrabold leading-[1.04] tracking-normal text-gray-950 sm:text-6xl lg:text-7xl">
              수업과 출석을 한곳에서 관리하세요
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
              DURE는 센터 운영자가 수업 현황과 참여자 출석을 빠르게 확인하고
              관리할 수 있도록 돕는 운영 플랫폼입니다.
            </p>
            <div className="mt-9 flex flex-wrap gap-2.5">
              <Link
                href={user ? "/workspaces" : "/login"}
                className="inline-flex h-11 items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-primary)] px-5 text-sm font-bold text-white transition hover:opacity-90"
              >
                운영 화면으로 이동
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto grid max-w-6xl gap-14 px-5 py-20 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
        <div>
          <p className="text-sm font-extrabold text-[var(--color-primary)]">
            운영에 필요한 흐름
          </p>
          <h2 className="mt-4 text-4xl font-extrabold leading-tight text-gray-950">
            센터가 매일 확인하는 정보에 집중합니다
          </h2>
        </div>
        <div className="grid gap-7">
          <FeatureItem
            icon={<CheckCircle2 className="size-5" />}
            title="참여자와 출석 현황을 관리합니다"
          >
            수업별 참여자 명단과 회차별 출석을 기록하고, 출석률이 낮은 이용자를
            빠르게 확인합니다.
          </FeatureItem>
          <FeatureItem
            icon={<CalendarDays className="size-5" />}
            title="수업 일정과 운영 상태를 한눈에 봅니다"
          >
            운영자와 강사는 담당 수업, 예정 회차, 수업 자료와 메모를 같은
            워크스페이스에서 확인합니다.
          </FeatureItem>
        </div>
      </section>

      <section className="bg-slate-950 px-5 py-20 text-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="max-w-2xl text-4xl font-extrabold leading-tight">
              우리 센터의 수업 운영도 DURE에서 시작하세요
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-300">
              워크스페이스를 만들고, 수업을 관리하고, 멤버를 초대하세요.
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
