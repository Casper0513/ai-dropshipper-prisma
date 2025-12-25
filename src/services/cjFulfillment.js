// src/services/cjFulfillment.js
import { prisma } from "../db/client.js";
import { cjRequest } from "./cjClient.js";
import { pushLiveLog } from "../utils/liveLogs.js";

/**
 * This file assumes:
 * - You create FulfillmentOrder rows when Shopify webhook fires
 * - For CJ items, we already stored cjVariantId / cjProductId in SyncedVariant
 *
 * CJ order create endpoint differs by account + doc version; we implement
 * a "best-effort" create using the commonly documented path:
 *   POST /shopping/order/createOrderV2
 *
 * If CJ changes fields, you only update this file.
 */
export async function createCjOrderFromFulfillmentOrder(fulfillmentOrderId) {
  const fo = await prisma.fulfillmentOrder.findUnique({
    where: { id: fulfillmentOrderId },
  });

  if (!fo) throw new Error("FulfillmentOrder not found");
  if (fo.supplier !== "cj") return fo; // not CJ
  if (fo.status !== "pending") return fo; // already processed

  // We need to map the Shopify line item to a SyncedVariant (CJ)
  // Strategy: store sku in FulfillmentOrder.shopifySku (if you add it) OR
  // use the lineItemId to look up in your own mapping.
  //
  // Minimal approach here: require CJ_VARIANT_ID to be stored on FulfillmentOrder.metaJson,
  // OR match by shopifyLineItemId -> your own table if you have one.
  //
  // Since you asked “generate files”, we’ll use a pragmatic approach:
  // - If you already store sku on FulfillmentOrder (recommended), match by sku.
  // - Otherwise, you can patch the webhook handler to store sku.

  const meta = fo.metaJson ? safeJson(fo.metaJson) : {};
  const sku = fo.shopifySku || meta.sku;

  if (!sku) {
    throw new Error("FulfillmentOrder missing sku (need shopifySku or metaJson.sku)");
  }

  const variant = await prisma.syncedVariant.findFirst({
    where: { source: "cj", deleted: false, sku },
  });

  if (!variant?.cjVariantId) {
    throw new Error(`No CJ variant mapping found for sku=${sku} (missing cjVariantId)`);
  }

  // Build CJ order payload (minimum viable)
  // NOTE: CJ expects shipping details + products array referencing their variant id.
  const payload = {
    // external order id so we can correlate:
    orderNumber: String(fo.shopifyOrderId),
    // Recipient info must be captured from webhook (metaJson)
    // You must store shipping address in metaJson during webhook.
    recipient: meta.recipient || {},
    // Products
    products: [
      {
        vid: variant.cjVariantId, // CJ variant id
        quantity: meta.quantity || 1,
      },
    ],
    // Optional:
    // logisticName: meta.logisticName,
  };

  pushLiveLog(`📦 [CJ] Creating CJ order for Shopify order ${fo.shopifyOrderId} sku=${sku}`);

  // Create order (V2)
  const res = await cjRequest("POST", "/shopping/order/createOrderV2", { data: payload });

  // Typical response: { code, result, message, data: { orderId, trackingNumber? } }
  const data = res?.data || {};
  const cjOrderId = data.orderId || data.id || null;

  if (!cjOrderId) {
    throw new Error(`CJ createOrderV2 returned no orderId: ${JSON.stringify(res)}`);
  }

  const updated = await prisma.fulfillmentOrder.update({
    where: { id: fo.id },
    data: {
      supplier: "cj",
      cjOrderId,
      status: "ordered",
    },
  });

  pushLiveLog(`✅ [CJ] Order created cjOrderId=${cjOrderId} for Shopify order ${fo.shopifyOrderId}`);

  return updated;
}

function safeJson(s) {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}
