import Link from "next/link";

import { cn } from "@/lib/utils/cn";

type PaginationProps = {
  page: number;
  totalPages: number;
  /**
   * Given a target page number, returns the href to link to. Pages are 1-based.
   */
  buildHref: (page: number) => string;
  className?: string;
};

export function Pagination({
  page,
  totalPages,
  buildHref,
  className,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const prev = Math.max(1, page - 1);
  const next = Math.min(totalPages, page + 1);

  return (
    <nav
      className={cn(
        "flex items-center justify-between text-sm text-[var(--color-muted-foreground)]",
        className,
      )}
      aria-label="페이지네이션"
    >
      <span>
        {page} / {totalPages} 페이지
      </span>
      <div className="flex items-center gap-2">
        <PageLink
          href={buildHref(prev)}
          disabled={page === 1}
          label="이전"
        />
        <PageLink
          href={buildHref(next)}
          disabled={page === totalPages}
          label="다음"
        />
      </div>
    </nav>
  );
}

function PageLink({
  href,
  disabled,
  label,
}: {
  href: string;
  disabled: boolean;
  label: string;
}) {
  const base =
    "inline-flex h-8 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-card)] px-3 text-xs font-medium";
  if (disabled) {
    return (
      <span className={cn(base, "opacity-50")} aria-disabled="true">
        {label}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className={cn(base, "text-[var(--color-foreground)] hover:bg-[var(--color-muted)]")}
    >
      {label}
    </Link>
  );
}
