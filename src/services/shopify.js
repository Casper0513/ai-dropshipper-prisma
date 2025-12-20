// src/services/shopify.js
import axios from "axios";
import { CONFIG } from "../config.js";
import { log } from "../utils/logger.js";
import { prisma } from "../db/client.js";

import {
  getShopifyApiVersion,
  getFallbackVersions,
  isVersionError,
} from "./shopifyApiVersion.js";

// Common headers for Shopify REST Admin API calls
function shopifyHeaders() {
  return {
    "X-Shopify-Access-Token": CONFIG.shopify.token,
    "Content-Type": "application/json",
  };
}

function buildBaseUrl(version) {
  return `https://${CONFIG.shopify.domain}/admin/api/${version}`;
}

/**
 * Generic request helper with:
 * - Version fallback retry (handles deprecated/unsupported API version)
 * - Clear logging when fallback happens
 */
async function requestWithVersionFallback({ method, path, data, params }) {
  const primary = getShopifyApiVersion();
  const versions = getFallbackVersions();

  // Ensure primary is tried first even if user changes env var
  const ordered = [primary, ...versions.filter((v) => v !== primary)];

  let lastErr;

  for (const version of ordered) {
    try {
      const base = buildBaseUrl(version);
      const url = `${base}${path}`;

      const res = await axios.request({
        method,
        url,
        data,
        params,
        headers: shopifyHeaders(),
        timeout: 30_000,
      });

      if (version !== primary) {
        console.warn(
          `⚠️ Shopify API version fallback in use: ${version} (primary was ${primary})`
        );
      }

      return res;
    } catch (err) {
      lastErr = err;

      // If it's NOT a version problem, don't retry versions
      if (!isVersionError(err)) throw err;

      console.warn(
        `⚠️ Shopify API version ${version} rejected; trying next fallback...`
      );
    }
  }

  throw lastErr;
}

/**
 * Create a Shopify product (used by your import pipeline)
 * ALSO registers the product variant for auto-sync
 */
export async function createProduct(product, bodyHtml, keyword) {
  const tags = [
    "ai-generated",
    "rapidapi-import",
    `keyword:${keyword}`,
    product.asin ? `asin:${product.asin}` : undefined,
    `supplier:amazon`, // TODO: set dynamic later (amazon/aliexpress/walmart)
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
    const res = await requestWithVersionFallback({
      method: "POST",
      path: "/products.json",
      data: payload,
    });

    const shopifyProduct = res.data.product;
    const variant = shopifyProduct?.variants?.[0];

    log.success(
      `Created Shopify product #${shopifyProduct.id}: ${shopifyProduct.title}`
    );

    // ✅ Register variant for auto-sync
    if (variant) {
      // Avoid duplicate rows if you re-import same ASIN/variant
      const shopifyVariantId = String(variant.id);

      await prisma.syncedVariant.upsert({
        where: { shopifyVariantId }, // requires unique in schema; if not unique, change to findFirst+create
        update: {
          asin: product.asin || null,
          sku: variant.sku || null,
          source: "amazon",
          shopifyProductId: String(shopifyProduct.id),
          currentPrice: Number(variant.price),
          lastCostPrice: Number(product.price || variant.price || 0),
          inStock: true,
          deleted: false,
        },
        create: {
          asin: product.asin || null,
          sku: variant.sku || null,
          source: "amazon",
          shopifyProductId: String(shopifyProduct.id),
          shopifyVariantId: String(variant.id),
          currentPrice: Number(variant.price),
          lastCostPrice: Number(product.price || variant.price || 0),
          inStock: true,
          deleted: false,
        },
      });
    }

    return shopifyProduct;
  } catch (err) {
    log.error(
      `Shopify error (createProduct): ${
        err?.response?.data?.errors || err.message
      }`
    );
    return null;
  }
}

/**
 * List imported products (those tagged with "rapidapi-import").
 * Used by sync system discovery / audits.
 */
export async function listImportedProducts() {
  try {
    const res = await requestWithVersionFallback({
      method: "GET",
      path: "/products.json",
      params: {
        limit: 250,
        status: "any",
        fields: "id,title,tags,variants,handle,status,product_type",
      },
    });

    const products = res.data.products || [];

    return products.filter((p) => {
      if (!p.tags) return false;
      if (Array.isArray(p.tags)) {
        return p.tags.some(
          (t) =>
            typeof t === "string" && t.toLowerCase().includes("rapidapi-import")
        );
      }
      return String(p.tags).toLowerCase().includes("rapidapi-import");
    });
  } catch (err) {
    log.error(
      `Shopify error (listImportedProducts): ${
        err?.response?.data?.errors || err.message
      }`
    );
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
  const payload = {
    product: {
      id: productId,
      status: inStock ? "active" : "draft",
      variants: [
        {
          id: variantId,
          price: newPrice != null ? Number(newPrice).toFixed(2) : undefined,
        },
      ],
    },
  };

  try {
    const res = await requestWithVersionFallback({
      method: "PUT",
      path: `/products/${productId}.json`,
      data: payload,
    });

    log.info(
      `Updated Shopify product #${productId} → price=${newPrice}, inStock=${inStock}`
    );
    return res.data.product;
  } catch (err) {
    log.error(
      `Shopify error (updateProductStatusAndPrice #${productId}): ${
        err?.response?.data?.errors || err.message
      }`
    );
    throw err;
  }
}
