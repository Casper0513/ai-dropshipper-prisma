import axios from "axios";
import { CONFIG } from "../config.js";
import { log } from "../utils/logger.js";

export async function createProduct(product, bodyHtml, keyword) {
  const url = `https://${CONFIG.shopify.domain}/admin/api/2025-10/products.json`;

  const payload = {
    product: {
      title: product.title,
      body_html: bodyHtml,
      vendor: product.brand,
      product_type: keyword,
      tags: [
        "ai-generated",
        "rapidapi-import",
        `keyword:${keyword}`,
        product.asin ? `asin:${product.asin}` : undefined,
      ].filter(Boolean),
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

    log.success(`Created Shopify product #${res.data.product.id}: ${res.data.product.title}`);
    return res.data.product;
  } catch (err) {
    log.error(`Shopify error: ${err.message}`);
    return null;
  }
}
