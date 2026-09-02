export const OFFER_TYPE_OPTIONS = [
  { value: "percentage_off", label: "Percentage Off" },
  { value: "flat_amount_off", label: "Flat Amount Off" },
  { value: "bogo", label: "Buy One Get One" },
  { value: "free_trial", label: "Free Trial / Free Period" },
  { value: "free_item", label: "Free Item / Service" },
  { value: "custom", label: "Custom Offer" },
];

export function isOfferValueRequired(offerType) {
  return offerType !== "bogo";
}

export function getOfferValueLabel(offerType) {
  switch (offerType) {
    case "percentage_off":
      return "Percent Value";
    case "flat_amount_off":
      return "Amount Value";
    case "free_trial":
      return "Free Period";
    case "free_item":
      return "Free Item / Service";
    case "custom":
      return "Custom Offer Text";
    default:
      return "Offer Value";
  }
}

export function getOfferValuePlaceholder(offerType) {
  switch (offerType) {
    case "percentage_off":
      return "Enter percent, e.g. 10";
    case "flat_amount_off":
      return "Enter amount, e.g. $15";
    case "free_trial":
      return "Enter period, e.g. 1 Month";
    case "free_item":
      return "Enter item or service";
    case "custom":
      return "Describe your offer";
    default:
      return "Enter offer value";
  }
}

export function buildOfferLabel(offerType, offerValue) {
  const normalized = String(offerValue ?? "").trim();

  switch (offerType) {
    case "percentage_off": {
      const numberOnly = normalized.replace(/%/g, "");
      return numberOnly ? `${numberOnly}% OFF` : "";
    }
    case "flat_amount_off":
      return normalized ? `${normalized} OFF` : "";
    case "bogo":
      return "BUY 1 GET 1";
    case "free_trial":
      return normalized ? `FREE ${normalized}` : "";
    case "free_item":
      return normalized ? `FREE ${normalized}` : "";
    case "custom":
      return normalized;
    default:
      return normalized;
  }
}

export function parseOfferLabel(offerLabel) {
  const normalized = String(offerLabel ?? "").trim();

  if (!normalized) {
    return {
      offerType: "percentage_off",
      offerValue: "",
    };
  }

  const percentageMatch = normalized.match(/^(\d+(?:\.\d+)?)\s*%\s*OFF$/i);
  if (percentageMatch) {
    return {
      offerType: "percentage_off",
      offerValue: percentageMatch[1],
    };
  }

  if (/^buy\s*1\s*get\s*1$/i.test(normalized) || /^bogo$/i.test(normalized)) {
    return {
      offerType: "bogo",
      offerValue: "",
    };
  }

  const freeMatch = normalized.match(/^FREE\s+(.+)$/i);
  if (freeMatch) {
    const freeValue = freeMatch[1].trim();
    const likelyTrial = /(month|week|day|trial|subscription|pass)/i.test(
      freeValue,
    );

    return {
      offerType: likelyTrial ? "free_trial" : "free_item",
      offerValue: freeValue,
    };
  }

  const flatMatch = normalized.match(/^(.+?)\s+OFF$/i);
  if (flatMatch) {
    return {
      offerType: "flat_amount_off",
      offerValue: flatMatch[1].trim(),
    };
  }

  return {
    offerType: "custom",
    offerValue: normalized,
  };
}

/** Percent 1–100, flat amount > 0. Empty string means valid. */
export function validateOfferValue(offerType, offerValue) {
  if (!isOfferValueRequired(offerType)) return "";

  const raw = String(offerValue ?? "").trim();
  if (!raw) return "Please enter an offer value.";

  if (offerType === "percentage_off") {
    const n = Number(raw.replace(/%/g, "").replace(/,/g, "").trim());
    if (!Number.isFinite(n) || n < 1 || n > 100) {
      return "Percent off must be between 1 and 100.";
    }
  }

  if (offerType === "flat_amount_off") {
    if (raw.includes("-")) {
      return "Flat amount off must be greater than 0.";
    }
    const n = Number(raw.replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(n) || n <= 0) {
      return "Flat amount off must be greater than 0.";
    }
  }

  return "";
}

/**
 * End must be on or after start. If there is no start, end must be in the future.
 */
export function validateSchedule(startValue, endValue) {
  const start = startValue ? new Date(startValue) : null;
  const end = endValue ? new Date(endValue) : null;
  const startOk = start && !Number.isNaN(start.getTime());
  const endOk = end && !Number.isNaN(end.getTime());

  if (startValue && !startOk) return "Invalid start date.";
  if (endValue && !endOk) return "Invalid end date.";

  if (startOk && endOk && end.getTime() < start.getTime()) {
    return "End date must be on or after the start date.";
  }

  if (!startValue && endOk && end.getTime() <= Date.now()) {
    return "End date must be in the future.";
  }

  return "";
}
