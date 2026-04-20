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
      return "10";
    case "flat_amount_off":
      return "$15";
    case "free_trial":
      return "1 Month";
    case "free_item":
      return "Coffee";
    case "custom":
      return "Student Bundle Pack";
    default:
      return "Offer value";
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
    const likelyTrial = /(month|week|day|trial|subscription|pass)/i.test(freeValue);

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
