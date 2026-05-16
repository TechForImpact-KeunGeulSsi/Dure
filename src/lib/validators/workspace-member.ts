import { z } from "zod";

export const InviteInstructorSchema = z.object({
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
    .transform((v) => (v && v.length > 0 ? v : undefined)),
});

export type InviteInstructorInput = z.infer<typeof InviteInstructorSchema>;