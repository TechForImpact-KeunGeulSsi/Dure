import { z } from "zod";

// api-spec.md §1.7
const ISODate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD 형식이어야 합니다.");

const ISOTime = z
  .string()
  .regex(/^\d{2}:\d{2}(:\d{2})?$/, "HH:mm 형식이어야 합니다.");

const RecurrenceSchema = z
  .object({
    startsOn: ISODate,
    endsOn: ISODate.nullable().optional(),
    sessionCount: z.number().int().positive().max(500).nullable().optional(),
    repeatWeekdays: z
      .array(z.number().int().min(0).max(6))
      .min(1, "반복 요일을 1개 이상 선택해 주세요."),
    startsAt: ISOTime,
    endsAt: ISOTime,
  })
  .refine(
    (value) => (value.endsOn == null) !== (value.sessionCount == null),
    {
      message: "종료일과 총 회차 수 중 하나만 입력해 주세요.",
      path: ["endsOn"],
    },
  )
  .refine((value) => value.endsAt > value.startsAt, {
    message: "종료 시간은 시작 시간 이후여야 합니다.",
    path: ["endsAt"],
  });

const CARD_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

const ParticipantAssignmentSchema = z.object({
  participantId: z.string().uuid(),
  assignmentGroupIds: z
    .array(z.string().uuid())
    .min(1, "수업 내 참여 그룹을 1개 이상 선택해 주세요."),
});

/** 생성 폼에서 전달하는 회차별 진행/집계 상태 (휴강 포함) */
export const CreateCourseSessionPlanSchema = z
  .object({
    sessionNo: z.number().int().positive(),
    progressStatus: z.enum(["scheduled", "cancelled"]),
    rollupStatus: z.enum(["included", "excluded"]),
    cancellationReason: z.string().trim().max(500).nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.progressStatus === "cancelled") {
      if (value.rollupStatus !== "excluded") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "휴강 회차는 집계에서 제외(excluded)되어야 합니다.",
          path: ["rollupStatus"],
        });
      }
      if (!value.cancellationReason?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "휴강 사유를 입력해 주세요.",
          path: ["cancellationReason"],
        });
      }
    } else if (value.rollupStatus !== "included") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "진행 예정 회차는 집계에 포함(included)되어야 합니다.",
        path: ["rollupStatus"],
      });
    }
  });

export type CreateCourseSessionPlanInput = z.infer<
  typeof CreateCourseSessionPlanSchema
>;

// api-spec.md §8.3
export const CreateCourseSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "수업 이름을 입력해 주세요.")
      .max(80, "수업 이름은 80자 이하로 입력해 주세요."),
    status: z.enum(["planned", "in_progress", "completed"]),
    groupIds: z
      .array(z.string().uuid())
      .min(1, "연결 그룹을 1개 이상 선택해 주세요."),
    instructorMemberId: z.string().uuid().nullable().optional(),
    cardColor: z
      .string()
      .regex(CARD_COLOR_REGEX, "#RRGGBB 형식의 색상을 사용해 주세요.")
      .nullable()
      .optional(),
    bannerUrl: z.string().url().nullable().optional(),
    recurrence: RecurrenceSchema,
    participantAssignments: z.array(ParticipantAssignmentSchema).default([]),
    sessionPlans: z.array(CreateCourseSessionPlanSchema).default([]),
  })
  .superRefine((value, ctx) => {
    const activeCount = value.sessionPlans.filter(
      (plan) => plan.progressStatus === "scheduled",
    ).length;
    if (value.sessionPlans.length > 0 && activeCount < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "최소 1회 이상 진행하는 회차가 있어야 합니다.",
        path: ["sessionPlans"],
      });
    }
  });

export type CreateCourseInput = z.infer<typeof CreateCourseSchema>;

// api-spec.md §8.4
export const UpdateCourseSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "수업 이름을 입력해 주세요.")
    .max(80, "수업 이름은 80자 이하로 입력해 주세요.")
    .optional(),
  status: z.enum(["planned", "in_progress", "completed"]).optional(),
  instructorMemberId: z.string().uuid().nullable().optional(),
  groupIds: z
    .array(z.string().uuid())
    .min(1, "연결 그룹을 1개 이상 선택해 주세요.")
    .optional(),
  cardColor: z
    .string()
    .regex(CARD_COLOR_REGEX, "#RRGGBB 형식의 색상을 사용해 주세요.")
    .nullable()
    .optional(),
  bannerUrl: z.string().url().nullable().optional(),
});

export type UpdateCourseInput = z.infer<typeof UpdateCourseSchema>;

// api-spec.md §8.5
export const UpdateCourseParticipantAssignmentSchema = z.object({
  assignmentGroupIds: z.array(z.string().uuid()).min(0),
  status: z.enum(["active", "excluded"]).optional(),
});

export type UpdateCourseParticipantAssignmentInput = z.infer<
  typeof UpdateCourseParticipantAssignmentSchema
>;
