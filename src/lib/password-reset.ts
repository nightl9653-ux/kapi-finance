export const PASSWORD_RESET_COOKIE = "kapi_password_reset";

/** 点「忘了密码」时记下，邮件回调据此进设密页（不依赖 next 是否被邮件客户端改掉）。 */
export function markPasswordResetIntent() {
  if (typeof document === "undefined") return;
  document.cookie = `${PASSWORD_RESET_COOKIE}=1; path=/; max-age=3600; SameSite=Lax`;
}

export function peekPasswordResetIntent(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.split("; ").some((part) => part === `${PASSWORD_RESET_COOKIE}=1`);
}

export function clearPasswordResetIntent() {
  if (typeof document === "undefined") return;
  document.cookie = `${PASSWORD_RESET_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}

export function hasPasswordResetIntentCookie(value: string | undefined): boolean {
  return value === "1";
}
