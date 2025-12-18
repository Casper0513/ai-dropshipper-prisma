
// src/workers/syncWorker.js
import { prisma } from "../db/client.js";
import { fetchBestSourceDetails } from "../services/sourceDetails.js";
import {
  updateShopifyPrice,
  setShopifyInStock,
  deleteShopifyProduct,
} from "../services/shopifySync.js";
import { sendPriceIncreaseAlert } from "../services/notify.js";

const PRICE_INCREASE_ALERT_THRESHOLD = Number(
  process.env.PRICE_INCREASE_ALERT_THRESHOLD || "0.15" // 15%
);

// Create or reuse a system auto-sync run
const autoSyncRun = await prisma.run.create({
  data: {
    keyword: "__auto_sync__",
    source: "system",
    status: "running",
    markupPercent: 0,
  },
});

export async function syncAllVariants() {
  console.log("🔁 Starting variant-level auto-sync…");

  const variants = await prisma.syncedVariant.findMany({
    where: { deleted: false },
  });

  for (const v of variants) {
    const details = await fetchBestSourceDetails(v);

    // If no details found → product probably gone → delete
    if (!details) {
      console.log(`❌ No details for ${v.asin || v.sku} → deleting Shopify product`);
      await deleteShopifyProduct(v.shopifyProductId);
      await prisma.syncedVariant.update({
        where: { id: v.id },
        data: { deleted: true, inStock: false },
      });
      await prisma.productLog.create({
        data: {
          runId: autoSyncRun.id,
          asin: v.asin,
          title: "Unknown (deleted)",
          oldPrice,
          updatedPrice,
          stockStatus: "deleted",
          profitAtSale,
        },
      });
      continue;
    }

    const { price, inStock } = details;

    // 1) Stock sync
    if (inStock !== v.inStock) {
      console.log(
        `📦 Stock change ${v.asin || v.sku}: ${v.inStock ? "IN" : "OUT"} → ${
          inStock ? "IN" : "OUT"
        }`
      );
      await setShopifyInStock(v.shopifyProductId, v.shopifyVariantId, inStock);
      await prisma.syncedVariant.update({
        where: { id: v.id },
        data: { inStock },
      });
      await prisma.productLog.create({
        data: {
          asin: v.asin,
          stockStatus: inStock ? "in" : "out",
        },
      });
    }

    // 2) Price sync + profit tracking
    if (price && price > 0 && price !== v.currentPrice) {
      const old = v.currentPrice ?? price;
      const newPrice = price;

      console.log(
        `💲 Price change ${v.asin || v.sku}: ${old} → ${newPrice}`
      );

      await updateShopifyPrice(
        v.shopifyProductId,
        v.shopifyVariantId,
        newPrice
      );

      const lastCost = v.lastCostPrice ?? newPrice;
      const profit = newPrice - lastCost;

      await prisma.productLog.create({
        data: {
          asin: v.asin,
          title: v.title || "Auto-sync update",
          oldPrice: old,
          updatedPrice: newPrice,
          stockStatus: inStock ? "in" : "out",
          profitAtSale: profit,
        },
      });

      await prisma.syncedVariant.update({
        where: { id: v.id },
        data: { currentPrice: newPrice },
      });

      // 3) Email alert if price jumped
      if (newPrice > old) {
        const changeRatio = (newPrice - old) / old;
        if (changeRatio >= PRICE_INCREASE_ALERT_THRESHOLD) {
          await sendPriceIncreaseAlert({
            asin: v.asin,
            oldPrice: old,
            newPrice,
            ratio: changeRatio,
          });
        }
      }
    }
  }

  console.log("✅ Variant-level auto-sync complete.");
}

// Allow running as a script: node src/workers/syncWorker.js
if (import.meta.url === `file://${process.argv[1]}`) {
  syncAllVariants().catch(err => {
    console.error("Sync failed:", err);
    process.exit(1);
  });
}
