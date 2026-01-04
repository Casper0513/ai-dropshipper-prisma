// src/workers/fulfillmentRetryWorker.js
import { prisma } from "../db/client.js";
import { createCjOrderFromFulfillmentOrder } from "../services/cjFulfillment.js";
import { pushLiveLog } from "../utils/liveLogs.js";

const RETRY_MINUTES = Number(process.env.CJ_RETRY_MINUTES || "15");
const MAX_RETRIES = Number(process.env.CJ_MAX_RETRIES || "3");
const INTERVAL_MS = Math.max(5, RETRY_MINUTES) * 60 * 1000;

/**
 * Retry failed / pending CJ fulfillment orders
 *
 * Guarantees:
 * - CJ only
 * - Never duplicates CJ orders
 * - Auto-fallback CJ → AliExpress (IN-PLACE)
 * - Idempotent & restart-safe
 * - Guarded against terminal states + double execution
 */
export function startFulfillmentRetryWorker() {
  pushLiveLog(
    `🔁 CJ fulfillment retry every ${RETRY_MINUTES} minutes (max=${MAX_RETRIES})`
  );

  const tick = async () => {
    let candidates = [];

    try {
      candidates = await prisma.fulfillmentOrder.findMany({
        where: {
          supplier: "cj",
          status: { in: ["pending", "failed"] },
          cjOrderId: null, // 🔒 never retry once CJ order exists
        },
        take: 20,
        orderBy: { createdAt: "asc" },
      });
    } catch (err) {
      pushLiveLog(`❌ Retry fetch failed: ${err?.message || err}`);
      return;
    }

    for (const fo of candidates) {
      const meta = safeJson(fo.metaJson);
      const retryCount = Number(meta.retryCount || 0);

      // --------------------------------------------------
      // 🛑 TERMINAL STATE GUARD
      // --------------------------------------------------
      if (
        ["delivered", "cancelled", "returned"].includes(fo.status)
      ) {
        continue;
      }

      // --------------------------------------------------
      // 🔒 IN-PROGRESS LOCK (prevents double execution)
      // --------------------------------------------------
      if (meta._retryLock === true) {
        continue;
      }

      // --------------------------------------------------
      // 🛑 FALLBACK HARD STOP
      // --------------------------------------------------
      if (meta.fallback?.provider === "aliexpress") {
        continue;
      }

      // 🔐 Acquire lock
      await prisma.fulfillmentOrder.update({
        where: { id: fo.id },
        data: {
          metaJson: JSON.stringify({
          ...meta,
          _retryLock: true,
          _retryLockAt: meta._retryLockAt,
          retryCount: nextRetry,
          lastRetryError: msg.slice(0, 500),
          lastRetryAt: new Date().toISOString(),
        }),
        },
      });

      try {
        pushLiveLog(
          `♻️ Retrying CJ fulfillment order=${fo.shopifyOrderId} (id=${fo.id}) attempt ${retryCount + 1}/${MAX_RETRIES}`
        );

        await createCjOrderFromFulfillmentOrder(fo.id);

        pushLiveLog(`✅ CJ retry success order=${fo.shopifyOrderId}`);
      } catch (err) {
        const msg = err?.message || "Unknown error";
        const nextRetry = retryCount + 1;

        // ⛔ Update failure state
        await prisma.fulfillmentOrder.update({
          where: { id: fo.id },
          data: {
            status: "failed",
            metaJson: JSON.stringify({
              ...meta,
              retryCount: nextRetry,
              lastRetryError: msg.slice(0, 500),
              lastRetryAt: new Date().toISOString(),
            }),
          },
        });

        pushLiveLog(
          `❌ CJ retry failed (${nextRetry}/${MAX_RETRIES}) order=${fo.shopifyOrderId}`
        );

        // 🚨 AUTO-FALLBACK → ALIEXPRESS (IN PLACE)
        if (nextRetry >= MAX_RETRIES) {
          await prisma.fulfillmentOrder.update({
            where: { id: fo.id },
            data: {
              supplier: "aliexpress",
              status: "pending",
              metaJson: JSON.stringify({
                ...meta,
                retryCount: nextRetry,
                lastRetryError: msg.slice(0, 500),
                fallback: {
                  provider: "aliexpress",
                  from: "cj",
                  reason: "CJ retry limit reached",
                  at: new Date().toISOString(),
                },
              }),
            },
          });

          pushLiveLog(
            `🟣 Fallback applied: CJ → AliExpress order=${fo.shopifyOrderId}`
          );
        }
      } finally {
        // --------------------------------------------------
        // 🔓 RELEASE LOCK
        // --------------------------------------------------
        const latest = await prisma.fulfillmentOrder.findUnique({
          where: { id: fo.id },
        });

        const latestMeta = safeJson(latest?.metaJson);

        if (latestMeta._retryLock) {
          delete latestMeta._retryLock;
          delete latestMeta._retryLockAt;

          await prisma.fulfillmentOrder.update({
            where: { id: fo.id },
            data: {
              metaJson: JSON.stringify(latestMeta),
            },
          });
        }
      }
    }
  };

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


