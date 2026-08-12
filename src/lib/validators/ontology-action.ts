import { z } from "zod";

const UUIDSchema = z.string().uuid("유효한 ID가 필요합니다.");

export const EnsureReviewMaterialProposalSchema = z.object({
  workspaceId: UUIDSchema,
  materialId: UUIDSchema,
  targetUpdatedAt: z
    .string({ required_error: "자료 버전이 필요합니다." })
    .trim()
    .datetime({ offset: true, message: "자료 버전은 ISO 날짜·시간이어야 합니다." }),
});

export const DecideReviewMaterialProposalSchema = z.object({
  workspaceId: UUIDSchema,
  proposalId: UUIDSchema,
  decision: z.enum(["approve", "reject"], {
    required_error: "결정 유형이 필요합니다.",
  }),
  note: z
    .string()
    .trim()
    .max(2000, "결정 메모는 2000자 이하로 입력해 주세요.")
    .nullable()
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
});

export type EnsureReviewMaterialProposalInput = z.infer<
  typeof EnsureReviewMaterialProposalSchema
>;

export type DecideReviewMaterialProposalInput = z.infer<
  typeof DecideReviewMaterialProposalSchema
>;
