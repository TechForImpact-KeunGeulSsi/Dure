import Link from "next/link";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AuthShell } from "@/components/auth/auth-shell";

import { SignupForm } from "./signup-form";

type SignupPageProps = {
  searchParams: Promise<{ next?: string }>;
};

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const { next } = await searchParams;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect(next ?? "/workspaces");
  }

  return (
    <AuthShell
      footer={
        <div className="w-full space-y-4">
          <p className="text-sm text-slate-600">
            이미 계정이 있나요?
          </p>
          <Link
            href={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`}
            className="block w-full rounded-full border-2 border-blue-400/50 px-6 py-3.5 text-center text-base font-bold text-blue-600 transition-all hover:bg-blue-50 hover:shadow-[0_0_15px_rgba(37,99,235,0.15)] md:py-4 md:text-lg"
          >
            로그인
          </Link>
        </div>
      }
      formCard={<SignupForm next={next ?? "/workspaces"} />}
    />
  );
}
