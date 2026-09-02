/**
 * Cleanly format raw scanned payloads for partner dashboard UI.
 */
export function formatScannedCode(rawCode) {
  if (!rawCode) return "—";
  const str = String(rawCode).trim();
  if (str.toLowerCase().startsWith("unideals://ticket/")) {
    return str.slice("unideals://ticket/".length);
  }
  if (str.toLowerCase().startsWith("unideals://student/")) {
    return `Student Pass (${str.slice("unideals://student/".length).slice(0, 8)}…)`;
  }
  return str;
}
