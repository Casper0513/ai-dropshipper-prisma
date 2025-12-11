
// src/services/sourceDetails.js
import { fetchProductDetails as fetchAmazonDetails } from "./amazonDetails.js";
import { fetchAliExpressDetails } from "./aliexpressDetails.js";
import { fetchWalmartDetails } from "./walmartDetails.js";

/**
 * variant: SyncedVariant record
 *  - asin
 *  - sku
 *  - source ("amazon" | "aliexpress" | "walmart")
 */
export async function fetchBestSourceDetails(variant) {
  const { asin, sku, source } = variant;

  // 1) Try original source first
  if (source === "amazon" && asin) {
    const d = await fetchAmazonDetails(asin);
    if (d) return { ...d, source: "amazon" };
  }
  if (source === "aliexpress" && sku) {
    const d = await fetchAliExpressDetails(sku);
    if (d) return { ...d, source: "aliexpress" };
  }
  if (source === "walmart" && sku) {
    const d = await fetchWalmartDetails(sku);
    if (d) return { ...d, source: "walmart" };
  }

  // 2) Try fallbacks by priority
  if (asin) {
    const d = await fetchAmazonDetails(asin);
    if (d) return { ...d, source: "amazon" };
  }
  if (sku) {
    const dAli = await fetchAliExpressDetails(sku);
    if (dAli) return { ...dAli, source: "aliexpress" };

    const dWm = await fetchWalmartDetails(sku);
    if (dWm) return { ...dWm, source: "walmart" };
  }

  // 3) Nothing found
  return null;
}
