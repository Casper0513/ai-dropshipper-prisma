
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
 * - Inventory quantity is NEVER used
 */
export async function syncAllVariants() {
  pushLiveLog("🔁 Starting variant-level auto-sync…");

  // ✅ Create a system run (INSIDE function)
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
       * 🛑 HARD GUARD — do not touch deleted records
       */
      if (v.deleted) continue;

      /**
       * 🛑 HARD GUARD — invalid Shopify mapping
       */
      if (!v.shopifyProductId || !v.shopifyVariantId) {
        pushLiveLog(`⚠️ Missing Shopify IDs → marking deleted (${v.asin || v.sku})`);

        await prisma.syncedVariant.update({
          where: { id: v.id },
          data: { deleted: true, inStock: false },
        });

        continue;
      }

      const details = await fetchBestSourceDetails(v);

      /**
       * ❌ Supplier no longer has product
       */
      if (!details) {
        pushLiveLog(`❌ Supplier removed product → deleting ${v.asin || v.sku}`);

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
            shopifyProductId: v.shopifyProductId,
          },
        });

        continue;
      }

      const { price, inStock } = details;

      /**
       * 📦 STOCK SYNC (dropshipping-safe)
       * - Toggle Shopify product status only
       */
      if (inStock !== v.inStock) {
        pushLiveLog(
          `📦 Stock change ${v.asin || v.sku}: ${
            v.inStock ? "IN" : "OUT"
          } → ${inStock ? "IN" : "OUT"}`
        );

        const ok = await setShopifyInStock(
          v.shopifyProductId,
          v.shopifyVariantId,
          inStock
        );

        if (!ok) {
          pushLiveLog(`⚠️ Shopify stock update failed → marking deleted`);

          await prisma.syncedVariant.update({
            where: { id: v.id },
            data: { deleted: true, inStock: false },
          });

          continue;
        }

        await prisma.syncedVariant.update({
          where: { id: v.id },
          data: { inStock },
        });

        await prisma.productLog.create({
          data: {
            runId: autoSyncRun.id,
            asin: v.asin,
            title: "Stock status update",
            shopifyProductId: v.shopifyProductId,
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

        /**
         * ❌ Shopify returned 404 / error
         * → Product likely deleted or invalid
         */
        if (!updated) {
          pushLiveLog(`❌ Shopify price update failed → marking deleted`);

          await prisma.syncedVariant.update({
            where: { id: v.id },
            data: { deleted: true, inStock: false },
          });

          continue;
        }

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
            shopifyProductId: v.shopifyProductId,
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
 * Manual execution support:
 * node src/workers/syncWorker.js
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  syncAllVariants()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

