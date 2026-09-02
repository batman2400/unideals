import { supabase } from "./supabaseClient";

export const SESSION_EXPIRED_MESSAGE =
  "Your session expired. Please sign out, sign back in, and try again.";

export function isAuthFailureMessage(message) {
  if (!message) return false;
  const text = String(message);
  return (
    /not authenticated/i.test(text) ||
    /jwt expired/i.test(text) ||
    /invalid jwt/i.test(text) ||
    /invalid claim/i.test(text)
  );
}

export function explainAuthFailure(message) {
  return isAuthFailureMessage(message)
    ? SESSION_EXPIRED_MESSAGE
    : message || SESSION_EXPIRED_MESSAGE;
}

export function promptSignIn() {
  window.dispatchEvent(
    new CustomEvent("open-auth-modal", { detail: { tab: "login" } }),
  );
}

/**
 * Returns a live access token, refreshing if the current one is missing
 * or about to expire. Throws SESSION_EXPIRED_MESSAGE when the user must
 * sign in again.
 */
export async function requireAccessToken() {
  const { data: sessionData, error: sessionError } =
    await supabase.auth.getSession();
  let session = sessionData?.session ?? null;
  const expiresAtMs = (session?.expires_at ?? 0) * 1000;
  const stale = !session?.access_token || expiresAtMs < Date.now() + 60_000;

  if (sessionError || stale) {
    const refreshed = await supabase.auth.refreshSession();
    session = refreshed.data?.session ?? null;
    if (refreshed.error || !session?.access_token) {
      throw new Error(SESSION_EXPIRED_MESSAGE);
    }
  }

  return session.access_token;
}

export async function invokeAuthedFunction(name, body = {}) {
  const accessToken = await requireAccessToken();
  return supabase.functions.invoke(name, {
    headers: { Authorization: `Bearer ${accessToken}` },
    body,
  });
}
