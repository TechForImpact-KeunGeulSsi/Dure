import * as React from "react";

import { cn } from "@/lib/utils/cn";

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
};

export function EmptyState({
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex min-h-[40vh] flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] bg-[var(--color-card)] px-6 py-12 text-center",
        className,
      )}
    >
      <p className="text-base font-medium text-[var(--color-foreground)]">
        {title}
      </p>
      {description && (
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
