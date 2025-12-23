// src/sync/stockPriceSync.js
import { listImportedProducts, updateProductStatusAndPrice } from "../services/shopify.js";
import { getBestSupplierSnapshot } from "./supplierSnapshots.js";
import { prisma } from "../db/client.js";
import { log } from "../utils/logger.js";

function normalizeTags(tags) {
  if (!tags) return [];
  if (Array.isArray(tags)) {
    return tags
      .filter(t => typeof t === "string")
      .map(t => t.trim())
      .filter(Boolean);
  }
  // CSV string
  return String(tags)
    .split(",")
    .map(t => t.trim())
    .filter(Boolean);
}

function getTagValue(tags, prefix) {
  const match = tags.find(t => t.toLowerCase().startsWith(prefix.toLowerCase()));
  if (!match) return null;
  return match.slice(prefix.length);
}

/**
 * Run a full sync:
 *  - Fetch imported Shopify products
 *  - For each product, get the best supplier snapshot (Amazon / Ali / Walmart)
 *  - Update Shopify price + publish/unpublish based on stock
 *  - Log a Run + ProductLog entries for analytics
 */
export async function runFullSync() {
  log.info("🔄 Starting full stock + price sync…");

  // Create a Run entry to attach logs to
  const run = await prisma.run.create({
    data: {
      keyword: "__sync__",
      markupPercent: 0,
      source: "sync",
      status: "running"
    }
  });

  let updatedCount = 0;

  try {
    const products = await listImportedProducts();
    log.info(`Found ${products.length} imported Shopify products to sync.`);

    for (const p of products) {
      const tags = normalizeTags(p.tags);
      const asin = getTagValue(tags, "asin:");
      const supplier = getTagValue(tags, "supplier:") || "amazon";

      const ctx = {
        asin,
        keyword: p.product_type || null,
        title: p.title,
        supplier
      };

      const snapshot = await getBestSupplierSnapshot(ctx);
      if (!snapshot) {
        log.warn(
          `No supplier snapshot for Shopify product #${p.id} (${p.title})`
        );
        continue;
      }

      const supplierPrice = snapshot.price;
      const inStock = snapshot.inStock;
      const currency = snapshot.currency || "USD";

      const variant = (p.variants && p.variants[0]) || null;
      if (!variant) {
        log.warn(`Product #${p.id} has no variants, skipping.`);
        continue;
      }

      const currentPrice = parseFloat(variant.price);
      const updatedPrice =
        !Number.isFinite(currentPrice) ||
        Math.abs(currentPrice - supplierPrice) >= 0.01;

      // If nothing changed and still active/in stock, skip
      if (!priceChanged && inStock && p.status === "active") {
        continue;
      }

      // Update Shopify
      await updateProductStatusAndPrice(
        p.id,
        variant.id,
        updatedPrice,
        inStock
      );

      updatedCount++;

      // Log to ProductLog for analytics dashboard
      try {
        await prisma.productLog.create({
          data: {
            runId: run.id,
            asin: asin || null,
            title: p.title,
            sourcePrice: supplierPrice ?? null,
            finalPrice: updatedPrice ?? null,
            currency,
            shopifyProductId: String(p.id),
            shopifyHandle: p.handle || null
          }
        });
      } catch (err) {
        log.error(
          `Failed to create ProductLog for product #${p.id}: ${err.message}`
        );
      }
    }

    await prisma.run.update({
      where: { id: run.id },
      data: {
        status: "success",
        createdCount: updatedCount,
        finishedAt: new Date()
      }
    });

    log.success(
      `✅ Full sync complete. Updated ${updatedCount} product(s).`
    );
    return { updatedCount, runId: run.id };
  } catch (err) {
    log.error(`❌ Sync fatal error: ${err.message}`);

    await prisma.run.update({
      where: { id: run.id },
      data: {
        status: "error",
        errorMessage: err.message,
        finishedAt: new Date()
      }
    });

    throw err;
  }
}
