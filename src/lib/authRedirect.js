/**
 * Shared OAuth redirect helpers for Google (and future providers).
 *
 * Supabase only accepts redirect URLs that are allowlisted in
 * Authentication → URL Configuration. Sending the user back to the
 * current path (e.g. /deals/12?q=...) fails unless every page is listed.
 * Always bounce through `/auth/callback` instead, and stash the original
 * location so we can restore it after the session lands.
 */

const AUTH_NEXT_KEY = "unideals:auth-next";

export function getOAuthRedirectUrl() {
  return `${window.location.origin}/auth/callback`;
}

export function rememberReturnPath() {
  const path = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (!path || path.startsWith("/auth/callback") || path.startsWith("/reset-password")) {
    return;
  }
  sessionStorage.setItem(AUTH_NEXT_KEY, path);
}

export function consumeReturnPath() {
  const next = sessionStorage.getItem(AUTH_NEXT_KEY);
  sessionStorage.removeItem(AUTH_NEXT_KEY);

  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/auth/callback")) {
    return "/";
  }

  return next;
}
