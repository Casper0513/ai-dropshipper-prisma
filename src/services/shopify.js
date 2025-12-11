import axios from "axios";
import { CONFIG } from "../config.js";
import { log } from "../utils/logger.js";
import { prisma } from "../db/client.js";

/**
 * Creates a Shopify product, registers its variant in Prisma for auto-sync,
 * and supports AI-enhanced images + fallback.
 */
export async function createProduct(product, bodyHtml, keyword) {
  const url = `https://${CONFIG.shopify.domain}/admin/api/2025-10/products.json`;

  // Determine brand fallback
  const brand =
    product.brand ||
    product.vendor ||
    product.asin ||
    "DropBopp Imports";

  // Build Shopify payload
  const payload = {
    product: {
      title: product.title,
      body_html: bodyHtml,
      vendor: brand,
      product_type: keyword,
      tags: [
        "ai-generated",
        "rapidapi-import",
        `keyword:${keyword}`,
        product.asin ? `asin:${product.asin}` : undefined,
      ].filter(Boolean),

      // Variants (single variant auto-created)
      variants: [
        {
          price: (product.price || 0).toFixed(2),
          sku: product.asin || undefined,
          inventory_management: "shopify",
          inventory_policy: "continue",
        },
      ],

      // Image support: if AI replaced the image, we may have `attachment`
      images: product.imageBase64
        ? [
            {
              attachment: product.imageBase64, // Base64 from AI enhancement
            },
          ]
        : product.image
        ? [
            {
              src: product.image, // Normal URL
            },
          ]
        : [],
    },
  };

  try {
    const res = await axios.post(url, payload, {
      headers: {
        "X-Shopify-Access-Token": CONFIG.shopify.token,
        "Content-Type": "application/json",
      },
    });

    const shopifyProduct = res.data.product;
    const primaryVariant = shopifyProduct.variants?.[0];

    log.success(
      `Created Shopify product #${shopifyProduct.id}: ${shopifyProduct.title}`
    );

    // -----------------------------
    // ⭐ REGISTER VARIANT FOR AUTO-SYNC
    // -----------------------------
    if (primaryVariant) {
      await prisma.syncedVariant.create({
        data: {
          asin: product.asin || null,
          sku: primaryVariant.sku || null,
          source: product.source || "amazon", // default source
          shopifyProductId: String(shopifyProduct.id),
          shopifyVariantId: String(primaryVariant.id),

          currentPrice: product.price ?? null,
          lastCostPrice: product.price ?? null, // or supplier cost if you track it
          inStock: true,
        },
      });
    }

    log.info(
      `SyncedVariant created for product #${shopifyProduct.id}, variant #${primaryVariant?.id}`
    );

    return shopifyProduct;
  } catch (err) {
    log.error(
      `Shopify error: ${err.response?.data?.errors || err.message}`
    );
    return null;
  }
}
