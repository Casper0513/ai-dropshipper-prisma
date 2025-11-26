import { CONFIG } from "../config.js";

export function applyPricingRules(basePrice, overrideMarkupPercent) {
  const markupPercent =
    typeof overrideMarkupPercent === "number" && !isNaN(overrideMarkupPercent)
      ? overrideMarkupPercent
      : CONFIG.pricing.markupPercent;

  if (basePrice == null || isNaN(basePrice)) {
    return CONFIG.pricing.fallbackPrice;
  }

  const markedUp = basePrice * (1 + markupPercent / 100);

  const ending = CONFIG.pricing.roundTo;
  if (!ending || isNaN(ending) || ending <= 0) {
    return markedUp;
  }

  // Example: 34.27 → floor(34.27) + 0.99 = 34.99
  const floored = Math.floor(markedUp);
  const final = floored + ending;

  return final;
}
