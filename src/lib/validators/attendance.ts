import { z } from "zod";

export const ATTENDANCE_STATUSES = ["present", "partial", "absent"] as const;

export const AttendanceRecordInputSchema = z.object({
  participantId: z.string().uuid(),
  status: z.enum(ATTENDANCE_STATUSES),
  note: z
    .string()
    .trim()
    .max(500, "메모는 500자 이하로 입력해 주세요.")
    .nullable()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
});

export const SaveAttendanceSchema = z.object({
  sessionId: z.string().uuid(),
  records: z
    .array(AttendanceRecordInputSchema)
    .min(1, "출석을 기록할 참여자가 없습니다."),
});

export type SaveAttendanceInput = z.infer<typeof SaveAttendanceSchema>;

export const SaveClassMemoSchema = z.object({
  sessionId: z.string().uuid(),
  content: z
    .string()
    .max(5000, "메모는 5000자 이하로 입력해 주세요.")
    .default(""),
});

export type SaveClassMemoInput = z.infer<typeof SaveClassMemoSchema>;