// src/services/shopify.js
import axios from "axios";
import { CONFIG } from "../config.js";
import { log } from "../utils/logger.js";
import { prisma } from "../db/client.js";

/**
 * Create a Shopify product (used by your import pipeline)
 * ALSO registers the product variant for auto-sync
 */
export async function createProduct(product, bodyHtml, keyword) {
  const url = `https://${CONFIG.shopify.domain}/admin/api/2025-10/products.json`;

  const tags = [
    "ai-generated",
    "rapidapi-import",
    `keyword:${keyword}`,
    product.asin ? `asin:${product.asin}` : undefined,
    `supplier:amazon`, // default source (can be dynamic later)
  ].filter(Boolean);

  const payload = {
    product: {
      title: product.title,
      body_html: bodyHtml,
      vendor: product.brand,
      product_type: keyword,
      tags: tags.join(", "),
      variants: [
        {
          price: (product.price || 0).toFixed(2),
          sku: product.asin || undefined,
          inventory_management: "shopify",
          inventory_policy: "continue",
        },
      ],
      images: product.image ? [{ src: product.image }] : [],
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
    const variant = shopifyProduct.variants?.[0];

    log.success(
      `Created Shopify product #${shopifyProduct.id}: ${shopifyProduct.title}`
    );

    // ✅ Register variant for auto-sync
    if (variant) {
      await prisma.syncedVariant.create({
        data: {
          asin: product.asin || null,
          sku: variant.sku || null,
          source: "amazon", // future: amazon | aliexpress | walmart
          shopifyProductId: String(shopifyProduct.id),
          shopifyVariantId: String(variant.id),
          currentPrice: Number(variant.price),
          lastCostPrice: Number(product.price),
          inStock: true,
          deleted: false,
        },
      });
    }

    return shopifyProduct;
  } catch (err) {
    log.error(`Shopify error (createProduct): ${err.message}`);
    return null;
  }
}

/**
 * List imported products (those tagged with "rapidapi-import").
 * Used by sync system discovery / audits.
 */
export async function listImportedProducts() {
  const url = `https://${CONFIG.shopify.domain}/admin/api/2025-10/products.json?limit=250&status=any&fields=id,title,tags,variants,handle,status,product_type`;

  try {
    const res = await axios.get(url, {
      headers: {
        "X-Shopify-Access-Token": CONFIG.shopify.token,
        "Content-Type": "application/json",
      },
    });

    const products = res.data.products || [];

    return products.filter((p) => {
      if (!p.tags) return false;
      if (Array.isArray(p.tags)) {
        return p.tags.some(
          (t) =>
            typeof t === "string" &&
            t.toLowerCase().includes("rapidapi-import")
        );
      }
      return String(p.tags)
        .toLowerCase()
        .includes("rapidapi-import");
    });
  } catch (err) {
    log.error(`Shopify error (listImportedProducts): ${err.message}`);
    return [];
  }
}

/**
 * Update product price + stock status
 * (used by auto-sync worker)
 */
export async function updateProductStatusAndPrice(
  productId,
  variantId,
  newPrice,
  inStock
) {
  const url = `https://${CONFIG.shopify.domain}/admin/api/2025-10/products/${productId}.json`;

  const payload = {
    product: {
      id: productId,
      status: inStock ? "active" : "draft",
      variants: [
        {
          id: variantId,
          price:
            newPrice != null ? Number(newPrice).toFixed(2) : undefined,
        },
      ],
    },
  };

  try {
    const res = await axios.put(url, payload, {
      headers: {
        "X-Shopify-Access-Token": CONFIG.shopify.token,
        "Content-Type": "application/json",
      },
    });

    log.info(
      `Updated Shopify product #${productId} → price=${newPrice}, inStock=${inStock}`
    );
    return res.data.product;
  } catch (err) {
    log.error(
      `Shopify error (updateProductStatusAndPrice #${productId}): ${err.message}`
    );
    throw err;
  }
}
