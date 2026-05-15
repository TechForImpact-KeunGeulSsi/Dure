import "server-only";

import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";

import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Returns the current authenticated Supabase user, or redirects to /login.
 *
 * Use in Server Components and Server Actions whenever the route is auth-gated.
 * The middleware refreshes the session cookie chain; this function is the
 * single source of truth for "is the user logged in?" in server code
 * (architecture.md §8 — clients never claim a user identity).
 */
export async function requireUser(): Promise<User> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}
