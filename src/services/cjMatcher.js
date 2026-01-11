// src/services/cjMatcher.js
import { cjRequest } from "./cjClient.js";

/**
 * Try to find CJ product by Amazon ASIN / SKU
 */
export async function findCjMatchForAmazon({ asin, title }) {
  // 1️⃣ Try exact SKU / ASIN match
  if (asin) {
    const exact = await cjRequest("GET", "/product/list", {
      params: {
        keyword: asin,
        pageSize: 5,
      },
    });

    const hit = exact?.data?.list?.[0];
    if (hit?.pid && hit?.variants?.length) {
      return {
        cjProductId: hit.pid,
        cjVariantId: hit.variants[0].vid,
        confidence: "exact",
      };
    }
  }

  // 2️⃣ Title similarity fallback
  if (title) {
    const fuzzy = await cjRequest("GET", "/product/list", {
      params: {
        keyword: title.slice(0, 60),
        pageSize: 5,
      },
    });

    const hit = fuzzy?.data?.list?.[0];
    if (hit?.pid && hit?.variants?.length) {
      return {
        cjProductId: hit.pid,
        cjVariantId: hit.variants[0].vid,
        confidence: "fuzzy",
      };
    }
  }

  return null;
}
