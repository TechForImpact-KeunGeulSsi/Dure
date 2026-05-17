"use client";

import { Download } from "lucide-react";
import { useTransition } from "react";

import { getPublicMaterialDownloadUrl } from "@/services/public-catalog";

type Props = {
  materialId: string;
};

export function PublicMaterialDownloadButton({ materialId }: Props) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await getPublicMaterialDownloadUrl(materialId);
      if (!result.ok) {
        window.alert(result.error.message);
        return;
      }
      window.open(result.data.url, "_blank", "noopener,noreferrer");
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-60"
    >
      <Download className="h-3.5 w-3.5" />
      {pending ? "준비 중..." : "다운로드"}
    </button>
  );
}
