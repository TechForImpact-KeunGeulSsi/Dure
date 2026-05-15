"use client";

import { Check } from "lucide-react";

import { cn } from "@/lib/utils/cn";

// Figma 2:3 카드 팔레트 기준.
export const COURSE_COLOR_PRESETS = [
  "#2563eb", // blue
  "#0ea5e9", // light blue
  "#c2410c", // orange
  "#0f172a", // black
  "#b45309", // brown
  "#b91c1c", // red
] as const;

type ColorPickerProps = {
  value: string | null;
  onChange: (next: string) => void;
  disabled?: boolean;
};

export function ColorPicker({ value, onChange, disabled }: ColorPickerProps) {
  return (
    <div className="flex gap-2">
      {COURSE_COLOR_PRESETS.map((color) => {
        const active = value === color;
        return (
          <button
            key={color}
            type="button"
            disabled={disabled}
            onClick={() => onChange(color)}
            aria-label={`색상 ${color}`}
            aria-pressed={active}
            className={cn(
              "flex size-8 items-center justify-center rounded-full border-2 transition-transform disabled:opacity-50",
              active
                ? "border-[var(--color-foreground)] scale-110"
                : "border-transparent hover:scale-105",
            )}
            style={{ backgroundColor: color }}
          >
            {active && <Check className="size-4 text-white" />}
          </button>
        );
      })}
    </div>
  );
}
