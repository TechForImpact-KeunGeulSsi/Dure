import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { DureMark } from "@/components/auth/dure-mark";
import { PublicCourseCard } from "@/components/public-catalog/public-course-card";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPublicCourseCatalog } from "@/services/public-catalog";

export default async function RootPage() {
  const supabase = await createSupabaseServerClient();
  const [{ data: userResult }, catalogResult] = await Promise.all([
    supabase.auth.getUser(),
    getPublicCourseCatalog(),
  ]);
  const user = userResult.user;

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <Link href="/" className="flex items-center gap-2">
            <DureMark className="h-8 w-8" />
            <span className="text-lg font-bold text-gray-950">DURE</span>
          </Link>
          <Link
            href={user ? "/workspaces" : "/login"}
            className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-primary)] px-4 text-sm font-medium text-white transition hover:opacity-90"
          >
            {user ? "워크스페이스로 이동" : "로그인"}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 py-10 sm:py-14">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold text-blue-700">마을별 수업 둘러보기</p>
          <h1 className="mt-3 text-3xl font-bold tracking-normal text-gray-950 sm:text-5xl">
            각 마을에서 운영 중인 수업을 한눈에 확인하세요.
          </h1>
          <p className="mt-4 text-base leading-7 text-gray-600">
            공개된 수업의 기간, 회차, 자료 요약을 로그인 없이 볼 수 있습니다.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl space-y-10 px-5 pb-16">
        {!catalogResult.ok ? (
          <div className="rounded-lg border border-rose-200 bg-white px-5 py-8 text-sm text-rose-700">
            공개 수업 목록을 불러오지 못했습니다.
          </div>
        ) : catalogResult.data.workspaces.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white px-5 py-10 text-center text-sm text-gray-500">
            아직 공개된 수업이 없습니다.
          </div>
        ) : (
          catalogResult.data.workspaces.map((workspace) => (
            <section key={workspace.id} className="space-y-4">
              <div className="flex items-end justify-between gap-4 border-b border-gray-200 pb-3">
                <div>
                  <h2 className="text-xl font-semibold text-gray-950">
                    {workspace.name}
                  </h2>
                  <p className="mt-1 text-sm text-gray-500">
                    공개 수업 {workspace.courses.length}개
                  </p>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {workspace.courses.map((course) => (
                  <PublicCourseCard key={course.id} course={course} />
                ))}
              </div>
            </section>
          ))
        )}
      </section>
    </main>
  );
}
