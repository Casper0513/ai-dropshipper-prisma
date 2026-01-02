// src/workers/fulfillmentRetryWorker.js
import { prisma } from "../db/client.js";
import { createCjOrderFromFulfillmentOrder } from "../services/cjFulfillment.js";
import {
  createAliExpressOrderFromFulfillmentOrder,
} from "../services/aliexpressFulfillment.js";
import { pushLiveLog } from "../utils/liveLogs.js";

const RETRY_MINUTES = Number(process.env.CJ_RETRY_MINUTES || "15");
const INTERVAL_MS = Math.max(5, RETRY_MINUTES) * 60 * 1000;

/**
 * Retry failed / pending CJ fulfillment orders
 *
 * Guarantees:
 * - CJ primary
 * - AliExpress fallback
 * - Never duplicates CJ orders
 * - Safe for Railway / long-running servers
 * - Stores retry + fallback info in metaJson
 */
export function startFulfillmentRetryWorker() {
  pushLiveLog(`🔁 CJ fulfillment retry every ${RETRY_MINUTES} minutes`);

  const tick = async () => {
    let candidates = [];

    try {
      candidates = await prisma.fulfillmentOrder.findMany({
        where: {
          supplier: "cj",
          status: { in: ["pending", "failed"] },
          cjOrderId: null, // 🔒 NEVER retry once CJ order exists
        },
        take: 20,
        orderBy: { createdAt: "asc" },
      });
    } catch (err) {
      pushLiveLog(`❌ Retry fetch failed: ${err.message}`);
      return;
    }

    for (const fo of candidates) {
      try {
        pushLiveLog(
          `♻️ Retrying CJ fulfillment orderId=${fo.shopifyOrderId} (id=${fo.id})`
        );

        await createCjOrderFromFulfillmentOrder(fo.id);

        // createCjOrderFromFulfillmentOrder updates status internally
        pushLiveLog(`✅ CJ retry success orderId=${fo.shopifyOrderId}`);
      } catch (err) {
        const msg = err?.message || "Unknown error";
        const meta = safeJson(fo.metaJson);

        const retryCount = (meta.retryCount || 0) + 1;
        const MAX_RETRIES = Number(process.env.CJ_MAX_RETRIES || "3");

        /**
         * 🟡 FALLBACK CONDITIONS
         * - Profit blocked
         * - Explicit CJ failure
         * - Retry limit reached
         */
        const shouldFallback =
          msg.includes("NEGATIVE_PROFIT") ||
          meta.blockedReason === "NEGATIVE_PROFIT" ||
          (meta.retryCount || 0) >= 3;

        if (shouldFallback && meta.fallbackTo !== "aliexpress") {
          pushLiveLog(
            `🟡 [FALLBACK] Switching Shopify ${fo.shopifyOrderId} → AliExpress`
          );

          await createAliExpressOrderFromFulfillmentOrder(fo.id);
          continue;
        }

        // ❌ Persist CJ failure
        await prisma.fulfillmentOrder.update({
          where: { id: fo.id },
          data: {
            status: "failed",
            metaJson: JSON.stringify({
              ...meta,
              lastRetryError: msg.slice(0, 500),
              lastRetryAt: new Date().toISOString(),
              retryCount: (meta.retryCount || 0) + 1,
            }),
          },
        });

        pushLiveLog(
          `❌ CJ retry failed (${retryCount}/${MAX_RETRIES}) order=${fo.shopifyOrderId}`
        );

        // 🚑 AUTO-FALLBACK → ALIEXPRESS
        if (retryCount >= MAX_RETRIES) {
          pushLiveLog(
            `🚨 CJ max retries reached — switching to AliExpress for order=${fo.shopifyOrderId}`
          );

          await prisma.fulfillmentOrder.create({
            data: {
              shopifyOrderId: fo.shopifyOrderId,
              shopifyLineItemId: fo.shopifyLineItemId,
              supplier: "aliexpress",
              status: "pending",

              // Preserve profit context
              salePrice: fo.salePrice,

              metaJson: JSON.stringify({
                ...meta,
                fallbackFrom: "cj",
                fallbackReason: "CJ retry limit reached",
                fallbackAt: new Date().toISOString(),
              }),
            },
          });
    
          pushLiveLog(
            `🛒 AliExpress fallback created for Shopify order=${fo.shopifyOrderId}`
          );
        }
      }
  // ▶ Run immediately, then on interval
  tick();
  setInterval(tick, INTERVAL_MS);
}

/**
 * Safe JSON parse helper
 */
function safeJson(s) {
  if (!s) return {};
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}

