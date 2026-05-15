import Link from "next/link";

import { cn } from "@/lib/utils/cn";

export type TabItem = {
  href: string;
  label: string;
  active: boolean;
};

export function Tabs({ items, className }: { items: TabItem[]; className?: string }) {
  return (
    <nav
      className={cn(
        "flex gap-1 border-b border-[var(--color-border)]",
        className,
      )}
      aria-label="탭"
    >
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.active ? "page" : undefined}
          className={cn(
            "-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
            item.active
              ? "border-[var(--color-primary)] text-[var(--color-primary)]"
              : "border-transparent text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]",
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
