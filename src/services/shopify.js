// src/services/shopify.js
import axios from "axios";
import { CONFIG } from "../config.js";
import { log } from "../utils/logger.js";

/**
 * Create a Shopify product (used by your import pipeline)
 */
export async function createProduct(product, bodyHtml, keyword) {
  const url = `https://${CONFIG.shopify.domain}/admin/api/2025-10/products.json`;

  const tags = [
    "ai-generated",
    "rapidapi-import",
    `keyword:${keyword}`,
    product.asin ? `asin:${product.asin}` : undefined,
    // default supplier tag for now
    `supplier:amazon`
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
          inventory_policy: "continue"
        }
      ],
      images: product.image ? [{ src: product.image }] : []
    }
  };

  try {
    const res = await axios.post(url, payload, {
      headers: {
        "X-Shopify-Access-Token": CONFIG.shopify.token,
        "Content-Type": "application/json"
      }
    });

    log.success(
      `Created Shopify product #${res.data.product.id}: ${res.data.product.title}`
    );
    return res.data.product;
  } catch (err) {
    log.error(`Shopify error (createProduct): ${err.message}`);
    return null;
  }
}

/**
 * List imported products (those tagged with "rapidapi-import").
 * Used by the sync system.
 */
export async function listImportedProducts() {
  const url = `https://${CONFIG.shopify.domain}/admin/api/2025-10/products.json?limit=250&status=any&fields=id,title,tags,variants,handle,status,product_type`;

  try {
    const res = await axios.get(url, {
      headers: {
        "X-Shopify-Access-Token": CONFIG.shopify.token,
        "Content-Type": "application/json"
      }
    });

    const products = res.data.products || [];

    return products.filter(p => {
      if (!p.tags) return false;
      if (Array.isArray(p.tags)) {
        return p.tags.some(
          t => typeof t === "string" && t.toLowerCase().includes("rapidapi-import")
        );
      }
      // tags as CSV string
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
 * Update a single-variant product's price and status (active/draft).
 * We use this instead of full inventory APIs to keep things simple:
 * - inStock = true  => status: "active"
 * - inStock = false => status: "draft"
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
          price: newPrice != null ? newPrice.toFixed(2) : undefined
        }
      ]
    }
  };

  try {
    const res = await axios.put(url, payload, {
      headers: {
        "X-Shopify-Access-Token": CONFIG.shopify.token,
        "Content-Type": "application/json"
      }
    });

    log.info(
      `Updated Shopify product #${productId} → price=${newPrice}, inStock=${inStock}, status=${res.data.product.status}`
    );
    return res.data.product;
  } catch (err) {
    log.error(
      `Shopify error (updateProductStatusAndPrice for #${productId}): ${err.message}`
    );
    throw err;
  }
}
