"use server";

import "server-only";

import { apiError, apiOk, type ApiResult } from "@/lib/api/errors";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SignupInputSchema, type SignupInput } from "@/lib/validators/workspace";

import { authUsersIncludeEmail } from "./auth-users";

type SignupActionInput = SignupInput & {
  emailRedirectTo: string;
};

export async function signupAction(
  rawInput: SignupActionInput,
): Promise<ApiResult<null>> {
  const parsed = SignupInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".") || "_";
      (fieldErrors[path] ??= []).push(issue.message);
    }
    return apiError("VALIDATION_FAILED", "입력값을 확인해 주세요.", {
      fieldErrors,
    });
  }

  const emailExistsResult = await authUserExistsByEmail(parsed.data.email);
  if (!emailExistsResult.ok) {
    return emailExistsResult;
  }
  const emailExists = emailExistsResult.data;
  if (emailExists) {
    return apiError("CONFLICT", "이미 가입된 이메일입니다. 로그인을 시도해 주세요.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        display_name: parsed.data.displayName,
        signup_preferred_role: parsed.data.preferredRole,
      },
      emailRedirectTo: rawInput.emailRedirectTo,
    },
  });

  if (error) {
    return apiError("INTERNAL_ERROR", translateSignupError(error.message));
  }

  return apiOk(null);
}

async function authUserExistsByEmail(email: string): Promise<ApiResult<boolean>> {
  const admin = createSupabaseAdminClient();
  const perPage = 1000;

  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      return apiError("INTERNAL_ERROR", error.message);
    }

    const users = data.users ?? [];
    if (authUsersIncludeEmail(users, email)) {
      return apiOk(true);
    }
    if (users.length < perPage) {
      return apiOk(false);
    }
  }
}

function translateSignupError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("already registered") || lower.includes("already exists")) {
    return "이미 가입된 이메일입니다. 로그인을 시도해 주세요.";
  }
  if (lower.includes("password should be")) {
    return "비밀번호는 8자 이상이어야 합니다.";
  }
  return message;
}
