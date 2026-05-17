"use server";

import "server-only";

import type { ZodError } from "zod";

import { requireUser } from "@/lib/auth/require-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { apiError, apiOk, type ApiResult } from "@/lib/api/errors";
import type { PayoutAccount, UUID } from "@/lib/api/types";
import {
  PayoutAccountSchema,
  type PayoutAccountInput,
} from "@/lib/validators/payout-account";

import { loadCurrentMembership } from "./access";

type PayoutAccountRow = {
  id: string;
  bank_name: string;
  account_number: string;
  account_holder: string;
  created_at: string;
  updated_at: string;
};

function toDto(row: PayoutAccountRow): PayoutAccount {
  return {
    id: row.id,
    bankName: row.bank_name,
    accountNumber: row.account_number,
    accountHolder: row.account_holder,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * 현재 사용자의 본 워크스페이스 계좌 정보를 조회.
 * RLS로 user_id = auth.uid()만 조회되므로 추가 가드 불필요.
 */
export async function getMyPayoutAccount(
  workspaceId: UUID,
): Promise<ApiResult<{ account: PayoutAccount | null }>> {
  await requireUser();
  const membership = await loadCurrentMembership(workspaceId);
  if (!membership) {
    return apiError(
      "WORKSPACE_ACCESS_DENIED",
      "워크스페이스 접근 권한이 없습니다.",
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("instructor_payout_accounts")
    .select("id, bank_name, account_number, account_holder, created_at, updated_at")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (error) return apiError("INTERNAL_ERROR", error.message);
  return apiOk({ account: data ? toDto(data as PayoutAccountRow) : null });
}

/**
 * 계좌 정보 upsert. 강사만 호출 가능.
 * 한 번 입력해도 자유롭게 수정 가능 (사용자 결정사항).
 */
export async function savePayoutAccount(
  workspaceId: UUID,
  rawInput: PayoutAccountInput,
): Promise<ApiResult<{ account: PayoutAccount }>> {
  const parsed = PayoutAccountSchema.safeParse(rawInput);
  if (!parsed.success) {
    return apiError("VALIDATION_FAILED", "입력값을 확인해 주세요.", {
      fieldErrors: collectFieldErrors(parsed.error),
    });
  }

  const user = await requireUser();
  const membership = await loadCurrentMembership(workspaceId);
  if (!membership) {
    return apiError(
      "WORKSPACE_ACCESS_DENIED",
      "워크스페이스 접근 권한이 없습니다.",
    );
  }
  if (membership.role !== "instructor") {
    return apiError("ROLE_FORBIDDEN", "강사만 계좌 정보를 등록할 수 있습니다.");
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("instructor_payout_accounts")
    .upsert(
      {
        workspace_id: workspaceId,
        user_id: user.id,
        bank_name: parsed.data.bankName,
        account_number: parsed.data.accountNumber,
        account_holder: parsed.data.accountHolder,
      },
      { onConflict: "workspace_id,user_id" },
    )
    .select("id, bank_name, account_number, account_holder, created_at, updated_at")
    .single();

  if (error || !data) {
    return apiError(
      "INTERNAL_ERROR",
      error?.message ?? "계좌 정보를 저장하지 못했습니다.",
    );
  }

  return apiOk({ account: toDto(data as PayoutAccountRow) });
}

function collectFieldErrors(error: ZodError): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".") || "_";
    (result[path] ??= []).push(issue.message);
  }
  return result;
}
