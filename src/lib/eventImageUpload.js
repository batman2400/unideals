import { supabase } from "./supabaseClient";

export const EVENT_IMAGES_BUCKET = "event-images";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB

function extractExtension(fileName) {
  const match = String(fileName ?? "")
    .toLowerCase()
    .match(/\.([a-z0-9]+)$/);
  return match ? match[1] : "jpg";
}

export async function uploadEventImage({ file, userId }) {
  if (!file) {
    throw new Error("Please select an image file to upload.");
  }

  if (!userId) {
    throw new Error("Unable to resolve user account for image upload.");
  }

  if (!file.type.startsWith("image/")) {
    throw new Error("Only image files are allowed.");
  }

  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("Image is too large. Maximum size is 5MB.");
  }

  const extension = extractExtension(file.name);
  const randomSuffix = Math.random().toString(36).slice(2, 8);
  // Must be `{userId}/...` — storage RLS checks foldername(name)[1] = auth.uid()
  const filePath = `${userId}/${Date.now()}-${randomSuffix}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from(EVENT_IMAGES_BUCKET)
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
  } = supabase.storage.from(EVENT_IMAGES_BUCKET).getPublicUrl(filePath);

  if (!publicUrl) {
    throw new Error("Image uploaded but URL could not be resolved.");
  }

  return {
    filePath,
    publicUrl,
  };
}
