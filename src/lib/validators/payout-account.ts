import { z } from "zod";

export const PayoutAccountSchema = z.object({
  bankName: z
    .string()
    .trim()
    .min(1, "은행명을 입력해 주세요.")
    .max(50, "은행명은 50자 이하로 입력해 주세요."),
  accountNumber: z
    .string()
    .trim()
    .min(1, "계좌번호를 입력해 주세요.")
    .max(30, "계좌번호는 30자 이하로 입력해 주세요.")
    .regex(/^[0-9\-]+$/, "계좌번호는 숫자와 하이픈(-)만 입력할 수 있습니다."),
  accountHolder: z
    .string()
    .trim()
    .min(1, "예금주를 입력해 주세요.")
    .max(50, "예금주는 50자 이하로 입력해 주세요."),
});

export type PayoutAccountInput = z.infer<typeof PayoutAccountSchema>;
