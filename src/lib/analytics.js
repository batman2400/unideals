/**
 * Production-only GA4 + Microsoft Clarity.
 *
 * Scripts stay off unless:
 *   - the build is production (`vite build`)
 *   - the page is www.unideals.co (preview/localhost stay dark)
 *   - the matching VITE_* id is set at build time
 *
 * Do not send emails, names, promo codes, or ticket strings.
 */

const GA_MEASUREMENT_ID = String(
  import.meta.env.VITE_GA_MEASUREMENT_ID ?? "",
).trim();
const CLARITY_PROJECT_ID = String(
  import.meta.env.VITE_CLARITY_PROJECT_ID ?? "",
).trim();

let gaReady = false;
let clarityReady = false;
let inputMaskObserver = null;

function isLiveProduction() {
  if (!import.meta.env.PROD) return false;
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host === "www.unideals.co" || host === "unideals.co";
}

function isGaMeasurementId(value) {
  return /^G-[A-Z0-9]+$/i.test(value);
}

function isClarityProjectId(value) {
  return /^[a-z0-9]+$/i.test(value) && value.length >= 6 && value.length <= 24;
}

function maskInputNode(node) {
  if (!node || node.nodeType !== 1) return;
  if (node.matches?.("input, textarea, select")) {
    node.setAttribute("data-clarity-mask", "true");
  }
  node.querySelectorAll?.("input, textarea, select").forEach((el) => {
    el.setAttribute("data-clarity-mask", "true");
  });
}

/** Hosted Clarity has no maskAllInputs flag — stamp every field in the DOM. */
function watchMaskedInputs() {
  if (inputMaskObserver || typeof MutationObserver === "undefined") return;
  maskInputNode(document.documentElement);
  inputMaskObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        maskInputNode(node);
      }
    }
  });
  inputMaskObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
}

function loadGtag() {
  if (gaReady || !isGaMeasurementId(GA_MEASUREMENT_ID)) return;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer.push(arguments);
  };
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_MEASUREMENT_ID)}`;
  document.head.appendChild(script);
  window.gtag("js", new Date());
  window.gtag("config", GA_MEASUREMENT_ID, {
    anonymize_ip: true,
    send_page_view: false,
  });
  gaReady = true;
}

function loadClarity() {
  if (clarityReady || !isClarityProjectId(CLARITY_PROJECT_ID)) return;
  window.clarity =
    window.clarity ||
    function clarityStub() {
      (window.clarity.q = window.clarity.q || []).push(arguments);
    };
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.clarity.ms/tag/${encodeURIComponent(CLARITY_PROJECT_ID)}`;
  const firstScript = document.getElementsByTagName("script")[0];
  firstScript?.parentNode?.insertBefore(script, firstScript);
  watchMaskedInputs();
  clarityReady = true;
}

export function initTelemetry() {
  if (!isLiveProduction()) return;
  loadGtag();
  loadClarity();
}

export function trackPageView(path) {
  if (!gaReady || typeof window.gtag !== "function") return;
  window.gtag("event", "page_view", {
    page_path: path,
    page_location: window.location.href,
    page_title: document.title,
  });
}

export function trackDealEvent(eventName, { dealId, brand, category } = {}) {
  if (!gaReady || typeof window.gtag !== "function") return;
  const params = {};
  if (dealId != null && dealId !== "") params.deal_id = String(dealId);
  if (brand) params.brand = brand;
  if (category) params.category = category;
  window.gtag("event", eventName, params);
}
