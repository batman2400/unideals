/**
 * Shrinks a picked photo before upload.
 *
 * Phone pictures are often far larger than a logo or cover needs. A file over
 * 5MB used to be rejected, or uploaded whole until the request timed out.
 * Already-small JPEG, PNG, and WEBP files are left as they are so logo
 * lettering and transparency stay intact.
 */

export const IMAGE_MAX_EDGE = 1600;
export const IMAGE_JPEG_QUALITY = 0.88;
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const KEEP_ORIGINAL_MAX_BYTES = 4 * 1024 * 1024;

const PASSTHROUGH_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

export function fittedSize(width, height, maxEdge) {
  const longEdge = Math.max(width, height);
  if (width <= 0 || height <= 0 || longEdge <= maxEdge) {
    return { width, height, resized: false };
  }
  const scale = maxEdge / longEdge;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    resized: true,
  };
}

export function canKeepImageFile(file, width, height, maxEdge, maxKeepBytes = KEEP_ORIGINAL_MAX_BYTES) {
  const mime = String(file?.type || "").toLowerCase().split(";")[0].trim();
  const longEdge = Math.max(width, height);
  return (
    file.size <= maxKeepBytes &&
    longEdge > 0 &&
    longEdge <= maxEdge &&
    PASSTHROUGH_TYPES.has(mime === "image/jpg" ? "image/jpeg" : mime)
  );
}

async function decodeImage(file) {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        close() {
          bitmap.close();
        },
      };
    } catch {
      // Some files decode through an Image element when createImageBitmap refuses them.
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Could not read that image. Try a JPEG or PNG."));
      el.src = url;
    });
    return {
      source: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      close() {
        URL.revokeObjectURL(url);
      },
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

function canvasBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Could not prepare that image."));
          return;
        }
        resolve(blob);
      },
      type,
      quality,
    );
  });
}

export async function prepareImageFile(file, options = {}) {
  if (!file) {
    throw new Error("Please select an image file to upload.");
  }
  if (file.type && !file.type.startsWith("image/")) {
    throw new Error("Only image files are allowed.");
  }

  const maxEdge = options.maxEdge ?? IMAGE_MAX_EDGE;
  const quality = options.quality ?? IMAGE_JPEG_QUALITY;
  const maxBytes = options.maxBytes ?? IMAGE_MAX_BYTES;
  const tooLargeMessage = options.tooLargeMessage ?? "Image is too large. Maximum size is 5MB.";

  const decoded = await decodeImage(file);
  try {
    if (canKeepImageFile(file, decoded.width, decoded.height, maxEdge)) {
      return file;
    }

    const next = fittedSize(decoded.width, decoded.height, maxEdge);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, next.width);
    canvas.height = Math.max(1, next.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Could not prepare that image.");
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(decoded.source, 0, 0, canvas.width, canvas.height);

    const blob = await canvasBlob(canvas, "image/jpeg", quality);
    if (blob.size > maxBytes) {
      throw new Error(tooLargeMessage);
    }

    const baseName = String(file.name || "image").replace(/\.[^/.]+$/, "") || "image";
    return new File([blob], `${baseName}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } finally {
    decoded.close();
  }
}
