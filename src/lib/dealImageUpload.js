import { supabase } from "./supabaseClient";

export const DEAL_IMAGES_BUCKET = "deal-images";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function sanitizePathSegment(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function extractExtension(fileName) {
  const match = String(fileName ?? "").toLowerCase().match(/\.([a-z0-9]+)$/);
  return match ? match[1] : "jpg";
}

export async function uploadDealImage({ file, userId, brandName }) {
  if (!file) {
    throw new Error("Please select an image file to upload.");
  }

  if (!userId) {
    throw new Error("Unable to resolve partner account for image upload.");
  }

  if (!file.type.startsWith("image/")) {
    throw new Error("Only image files are allowed.");
  }

  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("Image is too large. Maximum size is 5MB.");
  }

  const brandSegment = sanitizePathSegment(brandName) || "brand";
  const extension = extractExtension(file.name);
  const randomSuffix = Math.random().toString(36).slice(2, 8);
  const filePath = `partners/${userId}/${brandSegment}/${Date.now()}-${randomSuffix}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from(DEAL_IMAGES_BUCKET)
    .upload(filePath, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    throw new Error(uploadError.message || "Failed to upload image.");
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(DEAL_IMAGES_BUCKET).getPublicUrl(filePath);

  if (!publicUrl) {
    throw new Error("Image uploaded but URL could not be resolved.");
  }

  return {
    filePath,
    publicUrl,
  };
}
