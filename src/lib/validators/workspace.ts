import { z } from "zod";

export const SignupPreferredRoleSchema = z.enum(
  ["owner_admin", "group_admin", "instructor"],
  {
    required_error: "역할을 선택해 주세요.",
    invalid_type_error: "역할을 선택해 주세요.",
  },
);

// architecture.md §6 — workspace name is required, timezone defaults to Asia/Seoul.
// Use workspace/group terminology consistently across the product.
export const CreateWorkspaceInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "워크스페이스 이름을 입력해 주세요.")
    .max(80, "이름은 80자 이하로 입력해 주세요."),
  timezone: z.string().trim().min(1).default("Asia/Seoul"),
  firstGroupName: z
    .string()
    .trim()
    .max(80, "그룹 이름은 80자 이하로 입력해 주세요.")
    .nullable()
    .optional(),
});

export type CreateWorkspaceInput = z.infer<typeof CreateWorkspaceInputSchema>;

export const SignupInputSchema = z
  .object({
    displayName: z
      .string()
      .trim()
      .min(1, "이름을 입력해 주세요.")
      .max(40, "이름은 40자 이하로 입력해 주세요."),
    email: z.string().trim().email("올바른 이메일을 입력해 주세요."),
    password: z
      .string()
      .min(8, "비밀번호는 8자 이상이어야 합니다.")
      .max(72, "비밀번호는 72자 이하로 입력해 주세요."),
    passwordConfirm: z.string(),
    preferredRole: SignupPreferredRoleSchema,
    termsAccepted: z.literal(true, {
      errorMap: () => ({ message: "약관에 동의해 주세요." }),
    }),
  })
  .refine((value) => value.password === value.passwordConfirm, {
    path: ["passwordConfirm"],
    message: "비밀번호가 일치하지 않습니다.",
  });

export type SignupInput = z.infer<typeof SignupInputSchema>;
