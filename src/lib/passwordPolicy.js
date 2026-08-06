/**
 * Password Policy
 *
 * Shared by signup, password reset, and the profile settings form so the
 * rules cannot drift apart and lock a user out of one screen but not another.
 */

export const PASSWORD_HINT =
  "At least 8 characters, with upper and lower case letters and a number.";

export function validatePasswordStrength(password) {
  if (password.length < 8) return "Password must be at least 8 characters.";
  // bcrypt silently truncates past 72 bytes, so reject rather than mislead.
  if (password.length > 72) return "Password must be 72 characters or fewer.";
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)) {
    return "Password must include both uppercase and lowercase letters.";
  }
  if (!/[0-9]/.test(password)) return "Password must include at least one number.";
  return null;
}

/**
 * Server faults and rate limits say nothing about whether an account exists,
 * so naming them is safe and stops an outage from looking like a typo.
 * Anything else stays deliberately vague to prevent email enumeration.
 */
export function describeAuthFailure(error, fallback) {
  if (!error.status || error.status >= 500) {
    return "We couldn't reach the server. Please check your connection and try again in a moment.";
  }
  if (error.status === 429) {
    return "Too many attempts. Please wait a minute and try again.";
  }
  return fallback;
}
