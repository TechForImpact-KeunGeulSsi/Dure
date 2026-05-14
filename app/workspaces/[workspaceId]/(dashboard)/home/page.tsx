export default function DashboardHomePage() {
  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-[var(--color-foreground)]">
          홈
        </h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          운영 중인 수업이 여기에 표시됩니다.
        </p>
      </header>
      <section className="flex min-h-[40vh] items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] bg-[var(--color-card)]">
        <div className="text-center text-sm text-[var(--color-muted-foreground)]">
          <p className="text-base font-medium text-[var(--color-foreground)]">
            아직 수업이 없습니다.
          </p>
          <p className="mt-1">
            그룹과 수업을 만들면 이곳에서 한 눈에 확인할 수 있어요.
          </p>
        </div>
      </section>
    </div>
  );
}
