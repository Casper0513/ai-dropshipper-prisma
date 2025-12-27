// src/workers/syncWorker.js
import { prisma } from "../db/client.js";
import { fetchBestSourceDetails } from "../services/sourceDetails.js";
import {
  updateShopifyPrice,
  setShopifyInStock,
  deleteShopifyProduct,
} from "../services/shopifySync.js";
import { sendPriceIncreaseAlert } from "../services/notify.js";
import { pushLiveLog } from "../utils/liveLogs.js";

const PRICE_INCREASE_ALERT_THRESHOLD = Number(
  process.env.PRICE_INCREASE_ALERT_THRESHOLD || "0.15"
);

/**
 * Variant-level auto-sync
 * - Amazon / AliExpress: price + stock
 * - CJ: fulfillment-only (NO price / stock sync)
 */
export async function syncAllVariants() {
  pushLiveLog("🔁 Starting variant-level auto-sync…");

  const autoSyncRun = await prisma.run.create({
    data: {
      keyword: "__auto_sync__",
      source: "system",
      status: "running",
      markupPercent: 0,
    },
  });

  try {
    const variants = await prisma.syncedVariant.findMany({
      where: { deleted: false },
    });

    for (const v of variants) {
      /**
       * 🔒 CJ DROPSHIPPING RULE
       * CJ is fulfillment-only
       * NEVER touch price or stock
       */
      if (v.source === "cj") {
        continue;
      }

      let details;
      try {
        details = await fetchBestSourceDetails(v);
      } catch (err) {
        pushLiveLog(
          `⚠️ Supplier fetch failed ${v.asin || v.sku}: ${err.message}`
        );
        continue;
      }

      /**
       * ❌ Supplier product removed
       */
      if (!details) {
        pushLiveLog(`❌ No supplier data → deleting ${v.asin || v.sku}`);

        await deleteShopifyProduct(v.shopifyProductId);

        await prisma.syncedVariant.update({
          where: { id: v.id },
          data: {
            deleted: true,
            inStock: false,
          },
        });

        await prisma.productLog.create({
          data: {
            runId: autoSyncRun.id,
            asin: v.asin,
            title: "Supplier removed product",
            shopifyProductId: v.shopifyProductId ?? null,
          },
        });

        continue;
      }

      const { price, inStock } = details;

      /**
       * 📦 STOCK SYNC (NON-CJ ONLY)
       * Shopify status toggle only
       */
      if (typeof inStock === "boolean" && inStock !== v.inStock) {
        pushLiveLog(
          `📦 Stock ${v.asin || v.sku}: ${
            v.inStock ? "IN" : "OUT"
          } → ${inStock ? "IN" : "OUT"}`
        );

        await setShopifyInStock(
          v.shopifyProductId,
          v.shopifyVariantId,
          inStock
        );

        await prisma.syncedVariant.update({
          where: { id: v.id },
          data: { inStock },
        });
      }

      /**
       * 💲 PRICE SYNC (NON-CJ ONLY)
       */
      if (price && price > 0 && price !== v.currentPrice) {
        const oldPrice = v.currentPrice ?? price;
        const newPrice = price;

        pushLiveLog(
          `💲 Price ${v.asin || v.sku}: ${oldPrice} → ${newPrice}`
        );

        const ok = await updateShopifyPrice(
          v.shopifyProductId,
          v.shopifyVariantId,
          newPrice
        );

        if (!ok) {
          pushLiveLog(
            `⚠️ Shopify price update failed ${v.asin || v.sku}`
          );
          continue;
        }

        await prisma.productLog.create({
          data: {
            runId: autoSyncRun.id,
            asin: v.asin,
            title: "Auto-sync price update",
            sourcePrice: oldPrice,
            finalPrice: newPrice,
            shopifyProductId: v.shopifyProductId ?? null,
            shopifyHandle: v.shopifyHandle ?? null,
          },
        });

        await prisma.syncedVariant.update({
          where: { id: v.id },
          data: { currentPrice: newPrice },
        });

        /**
         * 🚨 PRICE INCREASE ALERT
         */
        if (newPrice > oldPrice) {
          const ratio = (newPrice - oldPrice) / oldPrice;
          if (ratio >= PRICE_INCREASE_ALERT_THRESHOLD) {
            await sendPriceIncreaseAlert({
              asin: v.asin,
              oldPrice,
              newPrice,
              ratio,
            });
          }
        }
      }
    }

    await prisma.run.update({
      where: { id: autoSyncRun.id },
      data: { status: "success" },
    });

    pushLiveLog("✅ Variant-level auto-sync complete.");
  } catch (err) {
    await prisma.run.update({
      where: { id: autoSyncRun.id },
      data: {
        status: "error",
        errorMessage: err?.message || "Unknown error",
      },
    });

    pushLiveLog(`❌ Auto-sync failed: ${err.message}`);
    throw err;
  }
}



