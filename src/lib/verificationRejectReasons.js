export const VERIFICATION_REJECT_REASONS = [
  { id: "unreadable", label: "Unreadable ID" },
  { id: "not_student_card", label: "Not a student card" },
  { id: "mismatch", label: "Details do not match the ID" },
  { id: "duplicate", label: "Duplicate student ID" },
  { id: "other", label: "Other" },
];

export function formatVerificationRejectReason(presetId, note) {
  const preset = VERIFICATION_REJECT_REASONS.find((item) => item.id === presetId);
  const label = preset?.label ?? "Other";
  const extra = String(note ?? "").trim();
  if (presetId === "other") {
    return extra || label;
  }
  return extra ? `${label}: ${extra}` : label;
}
