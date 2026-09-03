/**
 * Utilities for image framing, aspect ratios, bounding clamp calculations,
 * and high-resolution canvas exporting.
 */

export const ASPECT_RATIOS = {
  SQUARE: { id: "1:1", label: "1:1 Square", ratio: 1, tag: "Card" },
  WIDESCREEN: { id: "16:9", label: "16:9 Wide", ratio: 16 / 9, tag: "Banner" },
  STANDARD: { id: "4:3", label: "4:3 Standard", ratio: 4 / 3, tag: "Photo" },
  HERO: { id: "4:5", label: "4:5 Portrait", ratio: 4 / 5, tag: "Hero" },
  ORIGINAL: { id: "original", label: "Original", ratio: null, tag: "Auto" },
};

export const DEAL_ASPECT_OPTIONS = [
  { ...ASPECT_RATIOS.SQUARE, recommended: true, note: "Best for deal cards" },
  { ...ASPECT_RATIOS.WIDESCREEN, note: "Wide banner" },
  { ...ASPECT_RATIOS.HERO, note: "Hero view" },
  { ...ASPECT_RATIOS.STANDARD, note: "Standard photo" },
  { ...ASPECT_RATIOS.ORIGINAL, note: "Keep source ratio" },
];

export const EVENT_ASPECT_OPTIONS = [
  { ...ASPECT_RATIOS.WIDESCREEN, recommended: true, note: "Best for event banners" },
  { ...ASPECT_RATIOS.STANDARD, note: "Standard card" },
  { ...ASPECT_RATIOS.SQUARE, note: "Square layout" },
  { ...ASPECT_RATIOS.HERO, note: "Portrait banner" },
  { ...ASPECT_RATIOS.ORIGINAL, note: "Keep source ratio" },
];

/**
 * Calculate the crop box display size inside a bounding container.
 */
export function calculateCropBoxSize(containerWidth, containerHeight, targetRatio) {
  if (!containerWidth || !containerHeight) {
    return { width: 300, height: 300 };
  }

  const padding = 24;
  const availW = Math.max(100, containerWidth - padding * 2);
  const availH = Math.max(100, containerHeight - padding * 2);

  const ratio = targetRatio > 0 ? targetRatio : 1;
  const containerRatio = availW / availH;

  let width, height;
  if (ratio >= containerRatio) {
    width = availW;
    height = Math.round(availW / ratio);
  } else {
    height = availH;
    width = Math.round(availH * ratio);
  }

  return {
    width: Math.max(50, width),
    height: Math.max(50, height),
  };
}

/**
 * Get effective image dimensions after rotation (0, 90, 180, 270).
 */
export function getRotatedDimensions(naturalWidth, naturalHeight, rotation = 0) {
  const normalized = ((rotation % 360) + 360) % 360;
  if (normalized === 90 || normalized === 270) {
    return { width: naturalHeight, height: naturalWidth };
  }
  return { width: naturalWidth, height: naturalHeight };
}

/**
 * Calculate base cover scale and clamp limits for pan offset.
 */
export function calculatePanBounds({
  cropWidth,
  cropHeight,
  imageWidth,
  imageHeight,
  rotation = 0,
  zoom = 1,
}) {
  const { width: effW, height: effH } = getRotatedDimensions(
    imageWidth,
    imageHeight,
    rotation
  );

  if (effW <= 0 || effH <= 0 || cropWidth <= 0 || cropHeight <= 0) {
    return { baseScale: 1, currentScale: 1, maxPanX: 0, maxPanY: 0 };
  }

  const baseScale = Math.max(cropWidth / effW, cropHeight / effH);
  const currentScale = baseScale * Math.max(1, zoom);

  const dispW = effW * currentScale;
  const dispH = effH * currentScale;

  const maxPanX = Math.max(0, (dispW - cropWidth) / 2);
  const maxPanY = Math.max(0, (dispH - cropHeight) / 2);

  return {
    baseScale,
    currentScale,
    maxPanX,
    maxPanY,
  };
}

/**
 * Clamps pan offset so image doesn't drift outside the crop frame.
 */
export function clampPan(panX, panY, maxPanX, maxPanY) {
  return {
    x: Math.max(-maxPanX, Math.min(maxPanX, panX || 0)),
    y: Math.max(-maxPanY, Math.min(maxPanY, panY || 0)),
  };
}

/**
 * Renders the framed image onto an offscreen canvas and converts to Blob/File.
 */
export async function renderCroppedImageToFile({
  imageElement,
  cropWidth,
  cropHeight,
  panX,
  panY,
  zoom = 1,
  rotation = 0,
  originalFileName = "image.jpg",
  mimeType = "image/jpeg",
  maxOutputDimension = 1600,
}) {
  if (!imageElement || !imageElement.naturalWidth || !imageElement.naturalHeight) {
    throw new Error("Invalid image element provided for cropping.");
  }

  const naturalW = imageElement.naturalWidth;
  const naturalH = imageElement.naturalHeight;
  const { width: effW, height: effH } = getRotatedDimensions(
    naturalW,
    naturalH,
    rotation
  );

  const { baseScale, currentScale, maxPanX, maxPanY } = calculatePanBounds({
    cropWidth,
    cropHeight,
    imageWidth: naturalW,
    imageHeight: naturalH,
    rotation,
    zoom,
  });

  const clamped = clampPan(panX, panY, maxPanX, maxPanY);

  // Compute crisp export output size
  const targetRatio = cropWidth / cropHeight;
  let outW, outH;

  if (targetRatio >= 1) {
    outW = Math.min(maxOutputDimension, Math.max(800, effW));
    outH = Math.round(outW / targetRatio);
  } else {
    outH = Math.min(maxOutputDimension, Math.max(800, effH));
    outW = Math.round(outH * targetRatio);
  }

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Could not create canvas 2D rendering context.");
  }

  // Smooth rendering
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // Canvas-to-crop display ratio
  const canvasToCrop = outW / cropWidth;

  // Move origin to center + clamped pan offset scaled to canvas
  ctx.translate(
    outW / 2 + clamped.x * canvasToCrop,
    outH / 2 + clamped.y * canvasToCrop
  );

  // Apply rotation
  const rad = (rotation * Math.PI) / 180;
  ctx.rotate(rad);

  // Draw natural image centered
  const drawScale = currentScale * canvasToCrop;
  const drawW = naturalW * drawScale;
  const drawH = naturalH * drawScale;

  ctx.drawImage(imageElement, -drawW / 2, -drawH / 2, drawW, drawH);

  // Determine output mime and extension
  const safeMime = mimeType === "image/png" ? "image/png" : "image/jpeg";
  const quality = 0.92;

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Failed to generate cropped image blob."));
          return;
        }

        const extension = safeMime === "image/png" ? "png" : "jpg";
        const baseName = originalFileName.replace(/\.[^/.]+$/, "");
        const fileName = `${baseName || "cropped"}-framed.${extension}`;

        const croppedFile = new File([blob], fileName, {
          type: safeMime,
          lastModified: Date.now(),
        });

        resolve({
          file: croppedFile,
          blob,
          width: outW,
          height: outH,
        });
      },
      safeMime,
      quality
    );
  });
}
