
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
 * - SAFE for dropshipping
 * - Stock = product status (active/draft)
 * - Inventory quantity is NOT used
 */
export async function syncAllVariants() {
  pushLiveLog("🔁 Starting variant-level auto-sync…");

  // ✅ Create a run INSIDE the function (no top-level await)
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
      const details = await fetchBestSourceDetails(v);

      /**
       * ❌ Product no longer exists at supplier
       */
      if (!details) {
        pushLiveLog(`❌ No supplier data → deleting ${v.asin || v.sku}`);

        await deleteShopifyProduct(v.shopifyProductId);

        await prisma.syncedVariant.update({
          where: { id: v.id },
          data: { deleted: true, inStock: false },
        });

        await prisma.productLog.create({
          data: {
            runId: autoSyncRun.id,
            asin: v.asin,
            title: "Supplier removed product",
            stockStatus: "deleted",
            shopifyProductId: v.shopifyProductId ?? null,
          },
        });

        continue;
      }

      const { price, inStock } = details;

      /**
       * 📦 STOCK SYNC (dropshipping-safe)
       * - We NEVER touch inventory quantity
       * - We toggle Shopify product status only
       */
      if (inStock !== v.inStock) {
        pushLiveLog(
          `📦 Stock change ${v.asin || v.sku}: ${
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

        await prisma.productLog.create({
          data: {
            runId: autoSyncRun.id,
            asin: v.asin,
            title: "Stock status update",
            stockStatus: inStock ? "in" : "out",
            shopifyProductId: v.shopifyProductId ?? null,
          },
        });
      }

      /**
       * 💲 PRICE SYNC
       */
      if (price && price > 0 && price !== v.currentPrice) {
        const oldPrice = v.currentPrice ?? price;
        const newPrice = price;

        pushLiveLog(
          `💲 Price change ${v.asin || v.sku}: ${oldPrice} → ${newPrice}`
        );

        const updated = await updateShopifyPrice(
          v.shopifyProductId,
          v.shopifyVariantId,
          newPrice
        );

        if (!updated) continue;

        const lastCost = v.lastCostPrice ?? newPrice;
        const profit = newPrice - lastCost;

        await prisma.productLog.create({
          data: {
            runId: autoSyncRun.id,
            asin: v.asin,
            title: "Auto-sync price update",
            sourcePrice: oldPrice,
            finalPrice: newPrice,
            profitAtSale: profit,
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
      data: { status: "error" },
    });

    pushLiveLog(`❌ Auto-sync failed: ${err.message}`);
    throw err;
  }
}

/**
 * Allow manual execution:
 * node src/workers/syncWorker.js
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  syncAllVariants()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
