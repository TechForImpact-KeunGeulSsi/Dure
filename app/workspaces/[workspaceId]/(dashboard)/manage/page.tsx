import { redirect } from "next/navigation";

type ManageIndexProps = {
  params: Promise<{ workspaceId: string }>;
};

export default async function ManageIndex({ params }: ManageIndexProps) {
  const { workspaceId } = await params;
  redirect(`/workspaces/${workspaceId}/manage/groups`);
}
