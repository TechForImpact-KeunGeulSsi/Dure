"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Building2, ChevronDown, Home, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createWorkspaceAction } from "@/services/workspaces";

const DEFAULT_TIMEZONE = "Asia/Seoul";

type NewWorkspaceFormProps = {
  defaultOwnerName: string | null;
};

export function NewWorkspaceForm({ defaultOwnerName }: NewWorkspaceFormProps) {
  void defaultOwnerName; // 폼에 직접 표시하지는 않지만 후속 UX에서 사용 가능.
  const router = useRouter();
  const [name, setName] = useState("");
  const [firstGroupName, setFirstGroupName] = useState("");
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    if (!name.trim()) {
      toast.error("워크스페이스 이름을 입력해 주세요.");
      return;
    }

    startTransition(async () => {
      const result = await createWorkspaceAction({
        name: name.trim(),
        timezone: DEFAULT_TIMEZONE,
        firstGroupName: firstGroupName.trim() || null,
      });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success("워크스페이스를 만들었어요.");
      router.replace(`/workspaces/${result.data.workspaceId}/home`);
      router.refresh();
    });
  }

  return (
    <section>
      <header className="flex items-center justify-between border-b border-[var(--color-border)] pb-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-foreground)]">
          <ChevronDown className="size-4 text-[var(--color-muted-foreground)]" />
          새 워크스페이스 만들기
        </div>
        <Badge tone="primary">권장 시작</Badge>
      </header>

      <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
        <FieldRow
          id="ws-name"
          label="워크스페이스 이름"
          placeholder="예: 다로리 교육센터"
          icon={<Building2 className="size-4" />}
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          maxLength={80}
        />
        <FieldRow
          id="ws-first-group"
          label="첫 번째 그룹 이름"
          placeholder="예: 다로리 그룹"
          icon={<Home className="size-4" />}
          value={firstGroupName}
          onChange={(event) => setFirstGroupName(event.target.value)}
          maxLength={80}
        />

        <Button type="submit" disabled={pending} className="w-full">
          <Plus className="size-4" />
          {pending ? "만드는 중…" : "워크스페이스 만들기"}
        </Button>
      </form>
    </section>
  );
}

type FieldRowProps = React.InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  icon: React.ReactNode;
};

function FieldRow({ id, label, icon, className, ...rest }: FieldRowProps) {
  return (
    <div className="space-y-1">
      <label
        htmlFor={id}
        className="block text-xs font-semibold text-[var(--color-foreground)]"
      >
        {label}
      </label>
      <div className="flex h-10 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-input)] bg-white px-3 focus-within:border-[var(--color-ring)] focus-within:ring-2 focus-within:ring-[var(--color-ring)]/20">
        <span className="text-[var(--color-muted-foreground)]">{icon}</span>
        <input
          id={id}
          className={
            "h-full w-full border-0 bg-transparent text-sm outline-none placeholder:text-[var(--color-muted-foreground)]" +
            (className ? ` ${className}` : "")
          }
          {...rest}
        />
      </div>
    </div>
  );
}
