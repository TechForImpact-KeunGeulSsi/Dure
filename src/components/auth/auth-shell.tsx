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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 px-4 py-12">
      <Decorations />
      <div className="relative z-10 grid w-full max-w-4xl grid-cols-1 items-stretch md:grid-cols-[1.05fr_1fr]">
        <section className="relative z-0 flex translate-y-0 flex-col items-center justify-center rounded-[var(--radius-lg)] border border-white/15 bg-slate-800/50 px-8 py-12 text-center opacity-100 shadow-2xl shadow-black/30 backdrop-blur-xl transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] starting:translate-y-5 starting:opacity-0 motion-reduce:transition-none motion-reduce:starting:translate-y-0 motion-reduce:starting:opacity-100 md:-mr-12 md:py-14">
          <p className="text-3xl font-extrabold tracking-tight text-white drop-shadow-[0_0_20px_rgba(34,211,238,0.25)] md:text-4xl">
            DURE
          </p>
          <p className="mt-3 text-base font-semibold text-cyan-100/90 md:text-lg">
            {tagline}
          </p>
          <DureMark className="mt-8 size-32 md:size-36" />
          <div className="mt-10 w-full max-w-[280px]">{footer}</div>
        </section>
        <section className="relative z-10 translate-y-0 rounded-[var(--radius-lg)] border border-white/15 bg-blue-950/50 px-8 py-10 text-white opacity-100 shadow-2xl shadow-black/35 backdrop-blur-xl transition-all delay-100 duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] starting:translate-y-5 starting:opacity-0 motion-reduce:transition-none motion-reduce:delay-0 motion-reduce:starting:translate-y-0 motion-reduce:starting:opacity-100 md:-ml-4 md:mb-6 md:mt-6 md:py-12">
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
          "absolute -left-40 top-1/4 size-[28rem] rounded-full bg-cyan-400/20 blur-3xl",
        )}
      />
      <span className="absolute -right-32 bottom-1/4 size-[24rem] rounded-full bg-blue-500/25 blur-3xl" />
      <span className="absolute left-1/2 top-1/2 size-[20rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-300/15 blur-3xl" />
    </div>
  );
}
