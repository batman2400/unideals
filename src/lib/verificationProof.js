import { supabase } from "./supabaseClient";

export const PROOF_BUCKET = "verification-documents";
const SIGNED_URL_TTL_SECONDS = 300;

export function toStoragePath(value) {
  if (!value) return null;
  const marker = `/${PROOF_BUCKET}/`;
  const index = String(value).indexOf(marker);
  return index >= 0 ? String(value).slice(index + marker.length) : value;
}

async function signPath(value) {
  const path = toStoragePath(value);
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from(PROOF_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error) {
    console.error("Could not sign proof document:", error);
    return null;
  }
  return data?.signedUrl ?? null;
}

export async function signVerificationProofs(row) {
  const [front, back] = await Promise.all([
    signPath(row?.proof_image_url),
    signPath(row?.proof_image_back_url),
  ]);
  return { front, back };
}
