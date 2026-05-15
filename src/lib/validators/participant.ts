import { z } from "zod";

// api-spec.md §9.2
export const UpsertParticipantSchema = z.object({
  id: z.string().uuid().optional(),
  name: z
    .string()
    .trim()
    .min(1, "참여자 이름을 입력해 주세요.")
    .max(60, "이름은 60자 이하로 입력해 주세요."),
  memo: z
    .string()
    .trim()
    .max(500, "메모는 500자 이하로 입력해 주세요.")
    .nullable()
    .optional(),
  status: z.enum(["active", "inactive"]).default("active"),
  groupIds: z.array(z.string().uuid()).optional(),
});

export type UpsertParticipantInput = z.infer<typeof UpsertParticipantSchema>;

// api-spec.md §9.3
export const UpdateParticipantGroupsSchema = z.object({
  groupIds: z.array(z.string().uuid()).min(0),
});

export type UpdateParticipantGroupsInput = z.infer<
  typeof UpdateParticipantGroupsSchema
>;
