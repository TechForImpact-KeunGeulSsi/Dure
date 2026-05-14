import { z } from "zod";

// architecture.md §6 — workspace name is required, timezone defaults to Asia/Seoul.
export const CreateWorkspaceInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "워크스페이스 이름을 입력해 주세요.")
    .max(80, "이름은 80자 이하로 입력해 주세요."),
  timezone: z.string().trim().min(1).default("Asia/Seoul"),
});

export type CreateWorkspaceInput = z.infer<typeof CreateWorkspaceInputSchema>;
