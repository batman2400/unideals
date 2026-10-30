import { prepareImageFile } from "./compressImage";
import { supabase } from "./supabaseClient";

export const BRAND_LOGOS_BUCKET = "brand-logos";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB

function sanitizePathSegment(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function extractExtension(fileName) {
  const match = String(fileName ?? "")
    .toLowerCase()
    .match(/\.([a-z0-9]+)$/);
  return match ? match[1] : "png";
}

export async function uploadBrandLogo({ file, brandName }) {
  if (!file) {
    throw new Error("Please select an image file to upload.");
  }

  if (!brandName) {
    throw new Error("Brand name is required.");
  }

  const prepared = await prepareImageFile(file, {
    maxBytes: MAX_IMAGE_BYTES,
    tooLargeMessage: "Image is too large. Maximum size is 5MB.",
  });

  const brandSegment = sanitizePathSegment(brandName) || "brand";
  const extension = extractExtension(prepared.name);
  const randomSuffix = Math.random().toString(36).slice(2, 8);
  const filePath = `logos/${brandSegment}-${Date.now()}-${randomSuffix}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from(BRAND_LOGOS_BUCKET)
    .upload(filePath, prepared, {
      cacheControl: "3600",
      contentType: prepared.type,
      upsert: false,
    });

  if (uploadError) {
    throw new Error(uploadError.message || "Failed to upload logo.");
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(BRAND_LOGOS_BUCKET).getPublicUrl(filePath);

  if (!publicUrl) {
    throw new Error("Logo uploaded but URL could not be resolved.");
  }

  return {
    filePath,
    publicUrl,
  };
}

export async function uploadApplicationLogo({ file, userId }) {
  if (!file) {
    throw new Error("Please select an image file to upload.");
  }

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId ?? "")) {
    throw new Error("Sign in again before uploading a logo.");
  }

  const prepared = await prepareImageFile(file, {
    maxBytes: MAX_IMAGE_BYTES,
    tooLargeMessage: "Image is too large. Maximum size is 5MB.",
  });

  const extension = extractExtension(prepared.name);
  const randomSuffix = Math.random().toString(36).slice(2, 8);
  const filePath = `applications/${userId}/${Date.now()}-${randomSuffix}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from(BRAND_LOGOS_BUCKET)
    .upload(filePath, prepared, {
      cacheControl: "3600",
      contentType: prepared.type,
      upsert: false,
    });

  if (uploadError) {
    throw new Error(uploadError.message || "Failed to upload logo.");
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(BRAND_LOGOS_BUCKET).getPublicUrl(filePath);

  if (!publicUrl) {
    throw new Error("Logo uploaded but URL could not be resolved.");
  }

  return { filePath, publicUrl };
}
