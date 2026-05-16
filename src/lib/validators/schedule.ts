import { z } from "zod";

const ISODate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD 형식이어야 합니다.");

const ISOTime = z
  .string()
  .regex(/^\d{2}:\d{2}(:\d{2})?$/, "HH:mm 형식이어야 합니다.");

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/**
 * 일반 일정 생성/수정 (api-spec.md §5.2 upsertGeneralScheduleItem).
 *
 * - `id`가 있으면 수정, 없으면 생성.
 * - `groupIds`는 1개 이상 필수.
 * - `endsAt`이 있으면 `startsAt`도 있어야 하며 `endsAt > startsAt`.
 *   (시간 둘 다 NULL은 종일 일정으로 허용)
 */
export const UpsertGeneralScheduleItemSchema = z
  .object({
    id: z.string().uuid().optional(),
    title: z
      .string()
      .trim()
      .min(1, "제목을 입력해 주세요.")
      .max(120, "제목은 120자 이하로 입력해 주세요."),
    date: ISODate,
    startsAt: ISOTime.nullable().optional(),
    endsAt: ISOTime.nullable().optional(),
    description: z
      .string()
      .trim()
      .max(500, "설명은 500자 이하로 입력해 주세요.")
      .nullable()
      .optional(),
    color: z
      .string()
      .regex(HEX_COLOR, "#RRGGBB 형식의 색상을 사용해 주세요.")
      .nullable()
      .optional(),
    groupIds: z
      .array(z.string().uuid())
      .min(1, "그룹을 1개 이상 선택해 주세요."),
  })
  .superRefine((val, ctx) => {
    if (val.endsAt && !val.startsAt) {
      ctx.addIssue({
        code: "custom",
        path: ["startsAt"],
        message: "시작 시간을 입력해 주세요.",
      });
    }
    if (val.startsAt && val.endsAt && val.endsAt <= val.startsAt) {
      ctx.addIssue({
        code: "custom",
        path: ["endsAt"],
        message: "종료 시간은 시작 시간 이후여야 합니다.",
      });
    }
  });

export type UpsertGeneralScheduleItemInput = z.infer<
  typeof UpsertGeneralScheduleItemSchema
>;
