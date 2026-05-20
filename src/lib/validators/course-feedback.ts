import { z } from "zod";

export const CourseFeedbackCategorySchema = z.enum([
  "suggestion",
  "praise",
  "other",
]);

export const CourseFeedbackStatusSchema = z.enum(["new", "reviewed"]);

export const COURSE_FEEDBACK_MESSAGE_MIN_LENGTH = 10;
export const COURSE_FEEDBACK_MESSAGE_MAX_LENGTH = 1000;

const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `${max}자 이하로 입력해 주세요.`)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined));

export const CreateCourseFeedbackSchema = z
  .object({
    category: CourseFeedbackCategorySchema,
    message: z
      .string()
      .trim()
      .min(
        COURSE_FEEDBACK_MESSAGE_MIN_LENGTH,
        `의견은 ${COURSE_FEEDBACK_MESSAGE_MIN_LENGTH}자 이상 입력해 주세요.`,
      )
      .max(
        COURSE_FEEDBACK_MESSAGE_MAX_LENGTH,
        `의견은 ${COURSE_FEEDBACK_MESSAGE_MAX_LENGTH}자 이하로 입력해 주세요.`,
      ),
    authorName: optionalTrimmed(50),
    authorPhone: optionalTrimmed(30).refine(
      (value) => {
        if (!value) return true;
        const digits = value.replace(/\D/g, "");
        return digits.length >= 10 && digits.length <= 11;
      },
      { message: "전화번호를 확인해 주세요." },
    ),
    privacyConsent: z
      .boolean()
      .refine((value) => value, "개인정보 수집 및 이용에 동의해 주세요."),
  })
  .superRefine((value, ctx) => {
    if (value.authorPhone && !value.authorName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["authorName"],
        message: "전화번호를 남기려면 성함도 입력해 주세요.",
      });
    }
  });

export const UpdateCourseFeedbackStatusSchema = z.object({
  status: CourseFeedbackStatusSchema,
});

export type CreateCourseFeedbackInput = {
  category: z.infer<typeof CourseFeedbackCategorySchema>;
  message: string;
  authorName?: string;
  authorPhone?: string;
  privacyConsent: boolean;
};

export type UpdateCourseFeedbackStatusInput = z.infer<
  typeof UpdateCourseFeedbackStatusSchema
>;
