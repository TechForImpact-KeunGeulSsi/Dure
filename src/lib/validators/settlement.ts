import { z } from "zod";

export const SETTLEMENT_RECEIPT_MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export const SETTLEMENT_RECEIPT_ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "application/pdf",
] as const;

export const SETTLEMENT_RECEIPT_ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "pdf"] as const;

const ItemSchema = z.object({
  itemName: z
    .string()
    .trim()
    .min(1, "물품명을 입력해 주세요.")
    .max(100, "물품명은 100자 이하로 입력해 주세요."),
  quantity: z
    .number()
    .int("개수는 정수여야 합니다.")
    .min(1, "개수는 1 이상이어야 합니다.")
    .max(1000000, "개수가 너무 큽니다."),
  unitPrice: z
    .number()
    .int("단가는 정수여야 합니다.")
    .min(0, "단가는 0 이상이어야 합니다.")
    .max(999999999999, "단가가 너무 큽니다."),
});

export const CreateSettlementRequestSchema = z.object({
  memo: z
    .string()
    .max(1000, "메모는 1000자 이하로 입력해 주세요.")
    .optional()
    .default(""),
  items: z
    .array(ItemSchema)
    .min(1, "물품을 1개 이상 입력해 주세요.")
    .max(30, "물품은 30개까지 입력할 수 있습니다."),
});

export type CreateSettlementRequestInput = z.infer<typeof CreateSettlementRequestSchema>;
export type SettlementItemInput = z.infer<typeof ItemSchema>;

export function extractExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  if (dot < 0 || dot === filename.length - 1) return "";
  return filename.slice(dot + 1).toLowerCase();
}

export function validateReceiptPolicy(file: {
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
}): { ok: true } | { ok: false; field: string; message: string } {
  const ext = extractExtension(file.originalFilename);
  if (!ext) {
    return { ok: false, field: "originalFilename", message: "파일 확장자가 필요합니다." };
  }
  if (
    !SETTLEMENT_RECEIPT_ALLOWED_EXTENSIONS.includes(
      ext as (typeof SETTLEMENT_RECEIPT_ALLOWED_EXTENSIONS)[number],
    )
  ) {
    return {
      ok: false,
      field: "originalFilename",
      message: "허용되지 않은 확장자입니다. (jpg, jpeg, png, pdf만 가능)",
    };
  }
  if (
    !SETTLEMENT_RECEIPT_ALLOWED_MIME_TYPES.includes(
      file.mimeType as (typeof SETTLEMENT_RECEIPT_ALLOWED_MIME_TYPES)[number],
    )
  ) {
    return { ok: false, field: "mimeType", message: "허용되지 않은 파일 형식입니다." };
  }
  if (file.sizeBytes > SETTLEMENT_RECEIPT_MAX_SIZE_BYTES) {
    return { ok: false, field: "sizeBytes", message: "영수증 파일은 10MB 이하여야 합니다." };
  }
  return { ok: true };
}

export function safeReceiptFilename(filename: string): string {
  const trimmed = filename.trim().replace(/\s+/g, "_");
  const cleaned = trimmed.replace(/[^A-Za-z0-9._\-]/g, "");
  return cleaned.length > 0 ? cleaned : "receipt";
}
