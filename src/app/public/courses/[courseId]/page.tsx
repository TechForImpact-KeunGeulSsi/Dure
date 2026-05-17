import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { DureMark } from "@/components/auth/dure-mark";
import { PublicCourseDetailView } from "@/components/public-catalog/public-course-detail-view";
import { getPublicCourseDetail } from "@/services/public-catalog";

type Props = {
  params: Promise<{ courseId: string }>;
};

export default async function PublicCourseDetailPage({ params }: Props) {
  const { courseId } = await params;
  const result = await getPublicCourseDetail(courseId);

  if (!result.ok) {
    if (result.error.code === "NOT_FOUND") notFound();
    return (
      <main className="min-h-screen bg-gray-50 px-5 py-10">
        <div className="mx-auto max-w-3xl rounded-lg border border-rose-200 bg-white p-6 text-sm text-rose-700">
          공개 수업 정보를 불러오지 못했습니다.
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-5 py-4">
          <Link href="/" className="flex items-center gap-2">
            <DureMark className="h-8 w-8" />
            <span className="text-lg font-bold text-gray-950">DURE</span>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-950"
          >
            <ArrowLeft className="h-4 w-4" />
            공개 수업 목록
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-5 py-8">
        <PublicCourseDetailView course={result.data} />
      </div>
    </main>
  );
}
