import { z } from "zod";

// architecture.md §6, api-spec.md §7.2
export const UpsertGroupSchema = z.object({
  id: z.string().uuid().optional(),
  name: z
    .string()
    .trim()
    .min(1, "그룹 이름을 입력해 주세요.")
    .max(80, "그룹 이름은 80자 이하로 입력해 주세요."),
  description: z
    .string()
    .trim()
    .max(500, "설명은 500자 이하로 입력해 주세요.")
    .nullable()
    .optional(),
  status: z.enum(["active", "inactive"]).default("active"),
});

export type UpsertGroupInput = z.infer<typeof UpsertGroupSchema>;
