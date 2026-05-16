import "server-only";

import { createHash, randomBytes } from "node:crypto";

/**
 * URL-safe random invite token (~43 chars). The raw token only ever leaves
 * the server inside the redirect URL of the magic link email and is never
 * persisted — only the sha256 hash goes to invites.token_hash.
 */
export function generateInviteToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * sha256 hex digest matching the algorithm used in acceptInvite when looking
 * the token back up.
 */
export function hashInviteToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}
