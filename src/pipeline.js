
import pLimit from "p-limit";
import { fetchAmazonData } from "./services/rapidapi.js";
import { generateDescription } from "./services/openai.js";
import { createProduct } from "./services/shopify.js";
import { normalizeProduct } from "./utils/normalize.js";
import { applyPricingRules } from "./utils/pricing.js";
import { CONFIG } from "./config.js";
import { log } from "./utils/logger.js";
import { prisma } from "./db/client.js";
import { enhanceImage } from "./services/imageEnhancer.js";
import { generatePlaceholderImage } from "./services/aiPlaceholder.js";

const enhancementLimit = pLimit(2);

async function fetchUpTo20Products(target) {
  let all = [];
  for (let page = 1; page <= 4; page++) {
    const batch = await fetchAmazonData("search", target, page);
    if (!Array.isArray(batch) || batch.length === 0) break;
    all.push(...batch);
    if (all.length >= 20) break;
  }
  return all.slice(0, 20);
}

export async function importKeyword(target, options = {}) {
  const overrideMarkup = options.markupPercent;
  const source = options.source || "unknown";
  const mode = options.mode || CONFIG.mode || "search";

  log.info(
    `Starting import for "${target}" (mode: ${mode}, source: ${source}, override markup: ${
      overrideMarkup ?? "default"
    })`
  );

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
    let rawItems;
    if (mode === "search") {
      rawItems = await fetchUpTo20Products(target);
    } else {
      rawItems = await fetchAmazonData(mode, target);
    }

    const normalized = (rawItems || [])
      .map(p => normalizeProduct(mode, p, target))
      .filter(p => p && p.title);

    const filtered = normalized.filter(p => {
      if (p.price == null || isNaN(p.price)) return false;
      return (
        p.price >= CONFIG.priceRange.minImport &&
        p.price <= CONFIG.priceRange.maxImport
      );
    });

    const items = filtered.slice(0, 20);
    let createdCount = 0;

    for (const baseProduct of items) {
      try {
        const sellingPrice = applyPricingRules(baseProduct.price, overrideMarkup);

        let imageAttachment = null;
        if (baseProduct.image) {
          imageAttachment = await enhancementLimit(() =>
            enhanceImage(baseProduct.image)
          );
        }
        if (!imageAttachment) {
          imageAttachment = await generatePlaceholderImage(baseProduct.title);
        }

        const productForShopify = {
          ...baseProduct,
          price: sellingPrice,
          imageUrl: baseProduct.image || null,
          imageAttachment,
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

        await new Promise(res => setTimeout(res, 350));
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
