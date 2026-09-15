export const ACCOUNT_DISABLED_MESSAGE =
  "This account has been disabled. Contact ABTalks support.";

export function isAccountFrozen(user: {
  deletedAt?: Date | null;
  disabledAt?: Date | null;
}): boolean {
  return Boolean(user.deletedAt || user.disabledAt);
}

export function isJwtInvalidated(
  tokenIat: number | undefined,
  sessionInvalidatedAt: Date | null | undefined,
): boolean {
  if (!sessionInvalidatedAt) return false;
  const iat = tokenIat ?? 0;
  return iat < Math.floor(sessionInvalidatedAt.getTime() / 1000);
}
