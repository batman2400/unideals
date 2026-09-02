/**
 * Share helper for Uni Deals.
 *
 * Uses the Web Share API on mobile / modern browsers (which triggers
 * the native OS share sheet: WhatsApp, Instagram, Telegram, SMS, etc.).
 *
 * If Web Share is unsupported or fails, falls back gracefully to copying
 * the link to the clipboard.
 *
 * @param {Object} options
 * @param {string} [options.title]
 * @param {string} [options.text]
 * @param {string} [options.url]
 * @returns {Promise<{ success: boolean, method: 'native' | 'clipboard', cancelled?: boolean }>}
 */
export async function shareLink({
  title = "Uni Deals | Sri Lanka's Student Deals & Perks",
  text = "Check out Uni Deals for exclusive student discounts and perks in Sri Lanka!",
  url,
} = {}) {
  const shareUrl = url || (typeof window !== "undefined" ? window.location.href : "https://www.unideals.co");
  const shareTitle = title || (typeof document !== "undefined" ? document.title : "Uni Deals");

  // 1. Try Web Share API (native share drawer on mobile & supported desktop)
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({
        title: shareTitle,
        text,
        url: shareUrl,
      });
      return { success: true, method: "native" };
    } catch (err) {
      // User tapped Cancel / dismissed share sheet
      if (err?.name === "AbortError") {
        return { success: false, method: "native", cancelled: true };
      }
      // If native share fails for permission or other reasons, fall through to clipboard
    }
  }

  // 2. Fallback: Copy link to clipboard
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(shareUrl);
      return { success: true, method: "clipboard" };
    }

    // Legacy fallback for older environments
    if (typeof document !== "undefined") {
      const textarea = document.createElement("textarea");
      textarea.value = shareUrl;
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      textarea.style.top = "0";
      textarea.setAttribute("readonly", "");
      document.body.appendChild(textarea);
      textarea.select();
      const successful = document.execCommand("copy");
      document.body.removeChild(textarea);

      if (successful) {
        return { success: true, method: "clipboard" };
      }
    }
    throw new Error("Unable to copy link to clipboard");
  } catch (err) {
    console.error("Clipboard copy failed:", err);
    return { success: false, method: "clipboard", error: err };
  }
}
