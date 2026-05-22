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
          <p className="text-sm text-white/70">
            이미 계정이 있나요?
          </p>
          <Link
            href={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`}
            className="block w-full rounded-full border-2 border-cyan-500/50 px-6 py-3.5 text-center text-base font-bold text-cyan-400 transition-all hover:bg-cyan-500/10 hover:shadow-[0_0_15px_rgba(34,211,238,0.3)] md:py-4 md:text-lg"
          >
            로그인
          </Link>
        </div>
      }
      formCard={<SignupForm next={next ?? "/workspaces"} />}
    />
  );
}
