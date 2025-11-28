// src/pipeline.js
import { fetchAmazonData } from "./services/rapidapi.js";
import { generateDescription } from "./services/openai.js";
import { createProduct } from "./services/shopify.js";
import { normalizeProduct } from "./utils/normalize.js";
import { applyPricingRules } from "./utils/pricing.js";
import { enhanceImageUrl } from "./utils/images.js";
import { CONFIG } from "./config.js";
import { log } from "./utils/logger.js";
import { prisma } from "./db/client.js";

export async function importKeyword(target, options = {}) {
  const overrideMarkup = options.markupPercent;
  const source = options.source || "unknown";
  const mode = options.mode || CONFIG.mode || "search";

  log.info(
    `Starting import for "${target}" (mode: ${mode}, source: ${source}, override markup: ${overrideMarkup ?? "default"})`
  );

  // Log Run in DB
  const run = await prisma.run.create({
    data: {
      keyword: target,
      markupPercent:
        typeof overrideMarkup === "number" && !isNaN(overrideMarkup)
          ? overrideMarkup
          : CONFIG.pricing.markupPercent,
      source,
      status: "running",
    },
  });

  try {
    const rawItems = await fetchAmazonData(mode, target);

    // Normalize only products we can actually turn into Shopify items
    const normalized = rawItems
      .map(p => normalizeProduct(mode, p, target))
      .filter(p => p && p.title);

    // Filter by price
    const filtered = normalized.filter(p => {
      if (p.price == null || isNaN(p.price)) return false;
      return (
        p.price >= CONFIG.priceRange.minImport &&
        p.price <= CONFIG.priceRange.maxImport
      );
    });

    // Limit per run
    const items = filtered.slice(0, 5);
    let createdCount = 0;

    for (const baseProduct of items) {
      try {
        const sellingPrice = applyPricingRules(baseProduct.price, overrideMarkup);
        const enhancedImage = enhanceImageUrl(baseProduct.image);

        const productForShopify = {
          ...baseProduct,
          price: sellingPrice,
          image: enhancedImage,
        };

        log.info(`Generating AI description for: ${baseProduct.title}`);
        const desc = await generateDescription(productForShopify, target);

        log.info("Creating Shopify product…");
        const shopifyProduct = await createProduct(
          productForShopify,
          desc,
          target
        );

        if (shopifyProduct) {
          createdCount += 1;

          await prisma.productLog.create({
            data: {
              runId: run.id,
              asin: baseProduct.asin || null,
              title: baseProduct.title,
              sourcePrice: baseProduct.price ?? null,
              finalPrice: sellingPrice ?? null,
              currency: "USD",
              shopifyProductId: String(shopifyProduct.id),
              shopifyHandle: shopifyProduct.handle || null,
            },
          });
        }
      } catch (err) {
        log.error(
          `Pipeline error for "${baseProduct.title}" (mode: ${mode}): ${err.message}`
        );
      }
    }

    await prisma.run.update({
      where: { id: run.id },
      data: {
        status: "success",
        createdCount,
        finishedAt: new Date(),
      },
    });

    log.success(
      `Finished import for "${target}" (mode: ${mode}) → created ${createdCount} products`
    );
    return { createdCount, runId: run.id };
  } catch (err) {
    log.error(
      `Fatal pipeline error for "${target}" (mode: ${mode}): ${err.message}`
    );
    await prisma.run.update({
      where: { id: run.id },
      data: {
        status: "error",
        errorMessage: err.message,
        finishedAt: new Date(),
      },
    });
    throw err;
  }
}

