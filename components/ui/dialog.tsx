"use client";

import * as React from "react";

import { cn } from "@/lib/utils/cn";

type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  className?: string;
};

export function Dialog({
  open,
  onOpenChange,
  children,
  className,
}: DialogProps) {
  React.useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-10"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onOpenChange(false);
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "w-full max-w-md rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-card)] shadow-lg",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function DialogHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="border-b border-[var(--color-border)] px-6 py-4">
      <h2 className="text-base font-semibold text-[var(--color-foreground)]">
        {title}
      </h2>
      {description && (
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          {description}
        </p>
      )}
    </div>
  );
}

export function DialogBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("px-6 py-4 space-y-4", className)}>{children}</div>;
}

export function DialogFooter({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-end gap-2 border-t border-[var(--color-border)] px-6 py-3",
        className,
      )}
    >
      {children}
    </div>
  );
}
