type AuthUserEmail = {
  email?: string | null;
};

export function authUsersIncludeEmail(
  users: AuthUserEmail[],
  email: string,
): boolean {
  const normalizedEmail = normalizeEmail(email);

  return users.some((user) => normalizeEmail(user.email ?? "") === normalizedEmail);
}

function normalizeEmail(email: string): string {
  return email.trim().toLocaleLowerCase("en-US");
}
