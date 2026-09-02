import {
  SRI_LANKA_UNIVERSITIES,
  emailHost,
  hostMatchesDomain,
} from "./universities.js";

export const UNIVERSAL_STUDENT_EMAIL_SUFFIXES = [
  ".ac.lk",
  ".edu.lk",
  ".sliit.lk",
  ".edu",
  ".edu.au",
  ".ac.uk",
];

/** Host after the last @, lowercased. */
export function emailDomain(email) {
  return emailHost(email);
}

/**
 * Match an email host against a suffix or apex domain.
 * `.sliit.lk` matches both `name@sliit.lk` and `name@mail.sliit.lk`.
 */
export function hostMatchesSuffix(host, suffix) {
  let s = String(suffix ?? "").trim().toLowerCase();
  if (s.startsWith(".")) s = s.slice(1);
  return hostMatchesDomain(host, s);
}

function catalogDomains() {
  return SRI_LANKA_UNIVERSITIES.flatMap((uni) => uni.domains || []);
}

export function isAllowedStudentEmail(email, allowedDomains) {
  const host = emailDomain(email);
  if (!host) return false;

  if (UNIVERSAL_STUDENT_EMAIL_SUFFIXES.some((suffix) => hostMatchesSuffix(host, suffix))) {
    return true;
  }

  const extras = [...(allowedDomains || []), ...catalogDomains()];
  return extras.some((allowed) => hostMatchesSuffix(host, allowed));
}
