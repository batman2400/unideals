export const CHUNK_RELOAD_FLAG = "unideals-chunk-reload";

export function isChunkLoadError(error) {
  const text = `${error?.name || ""} ${error?.message || ""}`;
  return /ChunkLoadError|Loading chunk|dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(
    text,
  );
}

/** One hard reload per failure. A second failure leaves the flag set. */
export function reloadForStaleChunk() {
  if (typeof window === "undefined") return false;
  try {
    if (sessionStorage.getItem(CHUNK_RELOAD_FLAG) === "1") return false;
    sessionStorage.setItem(CHUNK_RELOAD_FLAG, "1");
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

export function clearChunkReloadFlag() {
  try {
    sessionStorage.removeItem(CHUNK_RELOAD_FLAG);
  } catch {
    // Ignore private-mode storage failures.
  }
}
