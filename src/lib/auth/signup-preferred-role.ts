export type SignupPreferredRole = "owner_admin" | "group_admin" | "instructor";
export type JoinRequestDefaultRole = SignupPreferredRole;

export function coerceSignupPreferredRole(
  value: unknown,
): SignupPreferredRole | null {
  if (
    value === "owner_admin" ||
    value === "group_admin" ||
    value === "instructor"
  ) {
    return value;
  }
  return null;
}

export function defaultJoinRequestRoleFromPreference(
  role: SignupPreferredRole | null,
): JoinRequestDefaultRole {
  return role ?? "instructor";
}
