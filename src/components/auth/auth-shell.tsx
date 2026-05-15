import * as React from "react";

import { cn } from "@/lib/utils/cn";

import { DureMark } from "./dure-mark";

type AuthShellProps = {
  /**
   * Right-side card (form). Rendered against a primary-colored background.
   */
  formCard: React.ReactNode;
  /**
   * Text shown under the DURE logo in the left card. Defaults to the brand line.
   */
  tagline?: string;
  /**
   * Footer rendered inside the left card (e.g. "아직 계정이 없나요? 회원가입").
   */
  footer: React.ReactNode;
};

/**
 * The two-card auth layout used by login and signup screens.
 * Mirrors the Figma frames `27:2` and `27:55` — a soft-blue page with two
 * overlapping cards (a brand card on the left, a primary form card on the right).
 */
export function AuthShell({
  formCard,
  tagline = "모두의 수업 운영 서비스",
  footer,
}: AuthShellProps) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#eaf2ff] flex items-center justify-center px-4 py-12">
      <Decorations />
      <div className="relative z-10 grid w-full max-w-4xl grid-cols-1 md:grid-cols-[1.05fr_1fr] items-stretch">
        <section className="relative z-0 rounded-[var(--radius-lg)] bg-white shadow-sm md:shadow-md md:-mr-12 md:py-14 px-8 py-12 flex flex-col items-center justify-center text-center">
          <p className="text-2xl font-extrabold tracking-tight text-[var(--color-primary)]">
            DURE
          </p>
          <p className="mt-2 text-sm font-semibold text-[var(--color-foreground)]">
            {tagline}
          </p>
          <DureMark className="mt-8 size-32 md:size-36" />
          <div className="mt-10 w-full max-w-[220px]">{footer}</div>
        </section>
        <section className="relative z-10 rounded-[var(--radius-lg)] bg-[var(--color-primary)] text-white shadow-lg md:py-12 px-8 py-10 md:-ml-4 md:mt-6 md:mb-6">
          {formCard}
        </section>
      </div>
    </main>
  );
}

function Decorations() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <span
        className={cn(
          "absolute -right-24 top-12 size-72 rounded-full bg-white/40 blur-sm",
        )}
      />
      <span className="absolute right-12 top-44 size-40 rounded-full bg-white/50" />
      <span className="absolute -left-20 bottom-10 size-44 rounded-full bg-white/40 blur-sm" />
    </div>
  );
}
