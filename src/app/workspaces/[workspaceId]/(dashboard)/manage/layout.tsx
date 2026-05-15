import { ManageTabs } from "./manage-tabs";

type ManageLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ workspaceId: string }>;
};

export default async function ManageLayout({
  children,
  params,
}: ManageLayoutProps) {
  const { workspaceId } = await params;
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-[var(--color-foreground)]">
          그룹 · 수업 · 참여자
        </h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          운영 단위와 참여자를 등록하고 관리합니다.
        </p>
      </header>
      <ManageTabs workspaceId={workspaceId} />
      <section>{children}</section>
    </div>
  );
}
