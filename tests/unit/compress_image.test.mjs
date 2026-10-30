import test from "node:test";
import assert from "node:assert/strict";
import { canKeepImageFile, fittedSize } from "../../src/lib/compressImage.js";

test("fittedSize keeps a logo that already fits", () => {
  assert.deepEqual(fittedSize(1200, 600, 1600), {
    width: 1200,
    height: 600,
    resized: false,
  });
});

test("fittedSize shrinks the long edge of a phone photo", () => {
  assert.deepEqual(fittedSize(4000, 3000, 1600), {
    width: 1600,
    height: 1200,
    resized: true,
  });
  assert.deepEqual(fittedSize(3000, 4000, 1600), {
    width: 1200,
    height: 1600,
    resized: true,
  });
});

test("canKeepImageFile leaves a small logo alone", () => {
  const file = { type: "image/png", size: 200_000 };
  assert.equal(canKeepImageFile(file, 800, 400, 1600), true);
});

test("canKeepImageFile resizes a large photo even under the old 5MB cutoff", () => {
  const file = { type: "image/jpeg", size: 3_000_000 };
  assert.equal(canKeepImageFile(file, 4000, 3000, 1600), false);
});
