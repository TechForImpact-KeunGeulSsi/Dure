import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import { LoginForm } from "./login-form";

type LoginPageProps = {
  searchParams: Promise<{ next?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { next } = await searchParams;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect(next ?? "/workspaces");
  }

  return (
    <main className="min-h-screen bg-[var(--color-muted)] flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-[var(--color-card)] rounded-[var(--radius-lg)] shadow-sm border border-[var(--color-border)] p-8">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-[var(--color-foreground)]">DURE</h1>
          <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
            교육 운영 관리 워크스페이스
          </p>
        </div>
        <LoginForm next={next ?? "/workspaces"} />
      </div>
    </main>
  );
}
