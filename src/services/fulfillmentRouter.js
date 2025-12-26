// src/services/fulfillmentRouter.js
import { prisma } from "../db/client.js";

/**
 * Decide how each Shopify line item should be fulfilled
 *
 * Priority:
 *  1) CJ (auto)
 *  2) AliExpress (manual for now, auto-ready later)
 *  3) Manual fallback
 *
 * Output is used by:
 *  - Shopify webhook (orders/paid)
 *  - Dashboard fulfillment table
 *  - Auto-retry worker
 */
export async function routeFulfillment(shopifyOrder) {
  const results = [];

  for (const item of shopifyOrder.line_items || []) {
    const sku = item.sku || null;

    const variant = sku
      ? await prisma.syncedVariant.findFirst({
          where: {
            sku,
            deleted: false,
          },
        })
      : null;

    /**
     * ❌ No synced variant
     */
    if (!variant) {
      results.push({
        lineItemId: String(item.id),
        supplier: "manual",
        fulfillmentMode: "manual",
        retryable: false,
        reason: "No synced variant found",
      });
      continue;
    }

    /**
     * ✅ Supplier routing with fallback
     */
    let supplier = variant.source;
    let fulfillmentMode = "manual";
    let retryable = false;

    // CJ → AUTO
    if (variant.source === "cj") {
      supplier = "cj";
      fulfillmentMode = "auto";
      retryable = true;
    }

    // AliExpress → MANUAL (future auto-ready)
    else if (variant.source === "aliexpress") {
      supplier = "aliexpress";
      fulfillmentMode = "manual";
      retryable = true;
    }

    // Amazon / Walmart / unknown → MANUAL
    else {
      supplier = variant.source || "manual";
      fulfillmentMode = "manual";
      retryable = false;
    }

    results.push({
      lineItemId: String(item.id),
      supplier,
      fulfillmentMode,
      retryable,

      // Minimal safe payload
      variant: {
        id: variant.id,
        sku: variant.sku,
        asin: variant.asin,
        source: variant.source,

        shopifyProductId: variant.shopifyProductId,
        shopifyVariantId: variant.shopifyVariantId,

        cjProductId: variant.cjProductId || null,
        cjVariantId: variant.cjVariantId || null,
      },
    });
  }

  return results;
}


