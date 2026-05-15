import * as React from "react";

import { cn } from "@/lib/utils/cn";

type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive" | "outline";
type ButtonSize = "sm" | "md" | "icon";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--color-primary)] text-[var(--color-primary-foreground)] hover:opacity-90 disabled:opacity-60",
  secondary:
    "bg-[var(--color-secondary)] text-[var(--color-secondary-foreground)] hover:bg-[var(--color-muted)] disabled:opacity-60 border border-[var(--color-border)]",
  ghost:
    "text-[var(--color-foreground)] hover:bg-[var(--color-muted)] disabled:opacity-60",
  destructive:
    "bg-[var(--color-destructive)] text-[var(--color-destructive-foreground)] hover:opacity-90 disabled:opacity-60",
  outline:
    "border border-[var(--color-border)] bg-white text-[var(--color-foreground)] hover:bg-[var(--color-muted)] disabled:opacity-60",
};

const SIZE: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-9 px-4 text-sm",
  icon: "h-9 w-9 p-0",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { className, variant = "primary", size = "md", type = "button", ...rest },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-md)] font-medium transition-opacity focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]/30",
          VARIANT[variant],
          SIZE[size],
          className,
        )}
        {...rest}
      />
    );
  },
);
