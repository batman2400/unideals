import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateCropBoxSize,
  getRotatedDimensions,
  calculatePanBounds,
  clampPan,
  DEAL_ASPECT_OPTIONS,
  EVENT_ASPECT_OPTIONS,
} from "../../src/lib/imageCropUtils.js";

test("Image Framing & Aspect Ratio Calculations", async (t) => {
  await t.test("Presets configuration integrity", () => {
    const dealSquare = DEAL_ASPECT_OPTIONS.find((opt) => opt.id === "1:1");
    assert.ok(dealSquare, "Deal options must include 1:1");
    assert.strictEqual(dealSquare.recommended, true, "1:1 must be recommended for deals");
    assert.strictEqual(dealSquare.ratio, 1);

    const eventWide = EVENT_ASPECT_OPTIONS.find((opt) => opt.id === "16:9");
    assert.ok(eventWide, "Event options must include 16:9");
    assert.strictEqual(eventWide.recommended, true, "16:9 must be recommended for events");
    assert.strictEqual(eventWide.ratio, 16 / 9);
  });

  await t.test("calculateCropBoxSize: maintains aspect ratio inside container", () => {
    // Container 600x400 with 1:1 aspect ratio
    const squareBox = calculateCropBoxSize(600, 400, 1);
    assert.strictEqual(squareBox.width, squareBox.height, "Width and height must be equal for 1:1");
    assert.ok(squareBox.width <= 600 && squareBox.height <= 400);

    // Container 800x600 with 16:9
    const wideBox = calculateCropBoxSize(800, 600, 16 / 9);
    const calculatedRatio = wideBox.width / wideBox.height;
    assert.ok(Math.abs(calculatedRatio - 16 / 9) < 0.05, "Aspect ratio must be close to 16:9");
  });

  await t.test("getRotatedDimensions: correctly swaps width/height on 90 and 270 degrees", () => {
    const orig = getRotatedDimensions(1920, 1080, 0);
    assert.deepStrictEqual(orig, { width: 1920, height: 1080 });

    const rot90 = getRotatedDimensions(1920, 1080, 90);
    assert.deepStrictEqual(rot90, { width: 1080, height: 1920 });

    const rot180 = getRotatedDimensions(1920, 1080, 180);
    assert.deepStrictEqual(rot180, { width: 1920, height: 1080 });

    const rot270 = getRotatedDimensions(1920, 1080, 270);
    assert.deepStrictEqual(rot270, { width: 1080, height: 1920 });
  });

  await t.test("calculatePanBounds and clampPan: prevent image drift outside crop area", () => {
    const bounds = calculatePanBounds({
      cropWidth: 400,
      cropHeight: 400,
      imageWidth: 800,
      imageHeight: 600,
      rotation: 0,
      zoom: 1,
    });

    // Base scale = Math.max(400/800, 400/600) = 400/600 = 2/3
    // dispW = 800 * (2/3) = 533.33, cropW = 400 => maxPanX = (533.33 - 400)/2 = 66.66
    // dispH = 600 * (2/3) = 400, cropH = 400 => maxPanY = 0
    assert.ok(bounds.maxPanX > 60 && bounds.maxPanX < 70);
    assert.strictEqual(bounds.maxPanY, 0);

    // Pan within bounds should not be clamped
    const normal = clampPan(30, 0, bounds.maxPanX, bounds.maxPanY);
    assert.strictEqual(normal.x, 30);
    assert.strictEqual(normal.y, 0);

    // Pan exceeding bounds should be clamped
    const clamped = clampPan(200, 50, bounds.maxPanX, bounds.maxPanY);
    assert.strictEqual(clamped.x, bounds.maxPanX);
    assert.strictEqual(clamped.y, 0);
  });
});
