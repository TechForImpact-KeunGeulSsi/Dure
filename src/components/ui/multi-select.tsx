"use client";

import * as React from "react";
import { Check, ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils/cn";

export type MultiSelectOption = {
  id: string;
  label: string;
  disabled?: boolean;
};

type MultiSelectProps = {
  options: MultiSelectOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
};

export function MultiSelect({
  options,
  selectedIds,
  onChange,
  placeholder = "선택",
  className,
  disabled,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const selectedSet = new Set(selectedIds);
  const summary =
    selectedIds.length === 0
      ? placeholder
      : options
          .filter((option) => selectedSet.has(option.id))
          .map((option) => option.label)
          .join(", ");

  function toggle(id: string) {
    if (selectedSet.has(id)) {
      onChange(selectedIds.filter((existing) => existing !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "flex h-9 w-full items-center justify-between gap-2 rounded-[var(--radius-md)] border border-[var(--color-input)] bg-white px-3 text-sm outline-none focus:border-[var(--color-ring)] focus:ring-2 focus:ring-[var(--color-ring)]/20 disabled:bg-[var(--color-muted)] disabled:opacity-70",
          selectedIds.length === 0 && "text-[var(--color-muted-foreground)]",
        )}
      >
        <span className="truncate text-left">{summary}</span>
        <ChevronDown className="size-4 shrink-0" />
      </button>
      {open && (
        <div className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-card)] shadow-md">
          {options.length === 0 && (
            <p className="px-3 py-2 text-xs text-[var(--color-muted-foreground)]">
              선택할 항목이 없습니다.
            </p>
          )}
          {options.map((option) => {
            const checked = selectedSet.has(option.id);
            return (
              <button
                key={option.id}
                type="button"
                disabled={option.disabled}
                onClick={() => toggle(option.id)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--color-muted)] disabled:opacity-50",
                  checked && "text-[var(--color-primary)]",
                )}
              >
                <span className="truncate">{option.label}</span>
                {checked && <Check className="size-4" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
