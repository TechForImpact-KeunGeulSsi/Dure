"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useSearchParams } from "next/navigation";

type Phase = "idle" | "loading" | "completing";

type ContextValue = {
  start: () => void;
};

const NavigationProgressContext = createContext<ContextValue | null>(null);

export function NavigationProgressProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const completingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phaseRef = useRef<Phase>("idle");
  phaseRef.current = phase;

  const start = useCallback(() => {
    if (completingTimerRef.current) {
      clearTimeout(completingTimerRef.current);
      completingTimerRef.current = null;
    }
    // 같은 클릭 사이클 안에 다시 시작되는 경우 width를 0으로 리셋한 뒤
    // 다음 프레임에 loading 단계로 진입해 0→80% 트랜지션이 다시 재생되도록 한다.
    setPhase("idle");
    requestAnimationFrame(() => {
      setPhase("loading");
    });
  }, []);

  // 라우트 전환이 끝나면(pathname/searchParams 변경) 진행 바를 완료 단계로.
  useEffect(() => {
    if (phaseRef.current !== "loading") return;
    setPhase("completing");
    completingTimerRef.current = setTimeout(() => {
      setPhase("idle");
      completingTimerRef.current = null;
    }, 400);
  }, [pathname, searchParams]);

  useEffect(
    () => () => {
      if (completingTimerRef.current) clearTimeout(completingTimerRef.current);
    },
    [],
  );

  // 모든 동일 출처 좌클릭 <a> 네비게이션을 이벤트 위임으로 캐치.
  // capture 단계에서 듣는 이유: Next.js Link 핸들러가 bubble 단계에서
  // preventDefault()를 호출해 클라이언트 라우팅으로 전환하기 때문에,
  // bubble 단계에 도달하면 event.defaultPrevented가 true가 되어 일반적인
  // "이미 처리된 클릭" 체크와 구분이 안 된다. capture에서 먼저 받으면
  // 안전하게 네비게이션 의도를 감지할 수 있다.
  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
        return;

      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href) return;
      if (anchor.target === "_blank") return;
      if (anchor.hasAttribute("download")) return;

      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      const currentUrl = `${window.location.pathname}${window.location.search}`;
      const nextUrl = `${url.pathname}${url.search}`;
      if (nextUrl === currentUrl) return;

      start();
    }

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [start]);

  return (
    <NavigationProgressContext.Provider value={{ start }}>
      <ProgressBar phase={phase} />
      {children}
    </NavigationProgressContext.Provider>
  );
}

function ProgressBar({ phase }: { phase: Phase }) {
  const visible = phase !== "idle";
  const width =
    phase === "loading" ? "80%" : phase === "completing" ? "100%" : "0%";
  const widthTransition =
    phase === "loading"
      ? "width 8s cubic-bezier(0.1, 0.5, 0.2, 0.95)"
      : phase === "completing"
        ? "width 200ms ease-out"
        : "none";
  const opacity = phase === "completing" ? 0 : visible ? 1 : 0;
  const opacityTransition =
    phase === "completing" ? "opacity 300ms ease-out 200ms" : "opacity 0ms";

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5"
      style={{ opacity, transition: opacityTransition }}
    >
      <div
        className="h-full bg-[var(--color-primary)]"
        style={{ width, transition: widthTransition }}
      />
    </div>
  );
}

export function useNavigationProgress() {
  const ctx = useContext(NavigationProgressContext);
  if (!ctx) {
    throw new Error(
      "useNavigationProgress must be used within NavigationProgressProvider",
    );
  }
  return ctx;
}
