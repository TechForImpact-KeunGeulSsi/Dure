import { z } from "zod";

/**
 * Mirrors api-spec.md §6.2 CreateInviteInput.
 *
 * - `role = group_admin` 이면 `groupIds`가 1개 이상이어야 한다.
 * - `role = instructor` 이면 `courseIds`는 선택값.
 * - `role = owner_admin` 이면 `groupIds`/`courseIds`는 서버에서 무시한다.
 */
export const CreateInviteSchema = z
  .object({
    email: z
      .string({ required_error: "이메일을 입력해 주세요." })
      .trim()
      .toLowerCase()
      .email("올바른 이메일을 입력해 주세요."),
    displayName: z
      .string()
      .trim()
      .max(80, "이름은 80자 이하로 입력해 주세요.")
      .optional()
      .nullable()
      .transform((v) => (v && v.length > 0 ? v : null)),
    role: z.enum(["owner_admin", "group_admin", "instructor"], {
      required_error: "역할을 선택해 주세요.",
    }),
    groupIds: z.array(z.string().uuid()).optional(),
    courseIds: z.array(z.string().uuid()).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.role === "group_admin" && (!val.groupIds || val.groupIds.length === 0)) {
      ctx.addIssue({
        code: "custom",
        path: ["groupIds"],
        message: "그룹 운영자는 1개 이상의 그룹을 선택해야 합니다.",
      });
    }
  });

export type CreateInviteInput = z.infer<typeof CreateInviteSchema>;