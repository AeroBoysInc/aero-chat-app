/**
 * One-shot in-memory password holder.
 *
 * LoginForm sets the password just before calling signInWithPassword.
 * App.tsx's resolveSession consumes it (clears after first read) to decrypt
 * the encrypted private key blob stored in Supabase.
 *
 * The password is never persisted — it lives in memory only long enough for
 * the auth state change handler to complete key restoration.
 */

let _pendingPassword: string | null = null;

export function setPendingPassword(password: string): void {
  _pendingPassword = password;
}

export function consumePendingPassword(): string | null {
  const pw = _pendingPassword;
  _pendingPassword = null;
  return pw;
}
