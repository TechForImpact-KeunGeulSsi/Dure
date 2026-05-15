"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type OnboardingHeaderProps = {
  email: string;
  role: string;
};

export function OnboardingHeader({ email, role }: OnboardingHeaderProps) {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="border-b border-[var(--color-border)] bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <p className="text-sm font-bold tracking-tight text-[var(--color-primary)]">
          Dure
        </p>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-[var(--color-muted-foreground)]">{email}</span>
          <Badge tone="primary">{role}</Badge>
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-foreground)] hover:text-[var(--color-primary)]"
          >
            <LogOut className="size-3.5" />
            로그아웃
          </button>
        </div>
      </div>
    </header>
  );
}
