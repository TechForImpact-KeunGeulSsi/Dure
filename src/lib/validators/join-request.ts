import { z } from "zod";

/**
 * Input the *requester* submits when asking to join a workspace.
 *
 * `desiredRole` is what they hope to be granted — the owner_admin makes the
 * final decision on approval. `owner_admin` is intentionally excluded; the
 * only way to obtain owner_admin is to create the workspace yourself.
 */
export const RequestAccessSchema = z.object({
  desiredRole: z.enum(["group_admin", "instructor"], {
    required_error: "역할을 선택해 주세요.",
  }),
  displayName: z
    .string()
    .trim()
    .max(80, "이름은 80자 이하로 입력해 주세요.")
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null)),
  message: z
    .string()
    .trim()
    .max(500, "메시지는 500자 이하로 입력해 주세요.")
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null)),
});

export type RequestAccessInput = z.infer<typeof RequestAccessSchema>;

/**
 * Input the *owner_admin* submits when approving a pending join request.
 *
 * `role` overrides the requester's `desired_role`. For `group_admin` the
 * scope groups must be provided (≥ 1).
 */
export const ApproveJoinRequestSchema = z
  .object({
    role: z.enum(["group_admin", "instructor"], {
      required_error: "역할을 선택해 주세요.",
    }),
    groupIds: z.array(z.string().uuid()).optional(),
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

export type ApproveJoinRequestInput = z.infer<typeof ApproveJoinRequestSchema>;
