
// src/services/shopifySync.js
import axios from "axios";
import { CONFIG } from "../config.js";

const SHOPIFY_API_VERSION = "2024-01";

const BASE_URL = `https://${CONFIG.shopify.domain}/admin/api/${SHOPIFY_API_VERSION}`;
const HEADERS = {
  "X-Shopify-Access-Token": CONFIG.shopify.token,
  "Content-Type": "application/json",
};

/**
 * Update variant price
 * ⚠️ Shopify REQUIRES updating variants via the PRODUCT endpoint
 */
export async function updateShopifyPrice(productId, variantId, newPrice) {
  try {
    await axios.put(
      `${BASE_URL}/products/${productId}.json`,
      {
        product: {
          id: productId,
          variants: [
            {
              id: variantId,
              price: Number(newPrice).toFixed(2),
            },
          ],
        },
      },
      { headers: HEADERS }
    );

    return true;
  } catch (err) {
    console.error(
      "updateShopifyPrice error:",
      err.response?.data || err.message
    );
    return false;
  }
}

/**
 * Enable / disable product based on stock
 */
export async function setShopifyInStock(productId, variantId, inStock) {
  try {
    await axios.put(
      `${BASE_URL}/products/${productId}.json`,
      {
        product: {
          id: productId,
          status: inStock ? "active" : "draft",
        },
      },
      { headers: HEADERS }
    );
    return true;
  } catch (err) {
    console.error(
      "setShopifyInStock error:",
      err.response?.data || err.message
    );
    return false;
  }
}

/**
 * Delete product
 */
export async function deleteShopifyProduct(productId) {
  try {
    await axios.delete(`${BASE_URL}/products/${productId}.json`, {
      headers: HEADERS,
    });
    console.log("🗑 Deleted Shopify product", productId);
    return true;
  } catch (err) {
    console.error(
      "deleteShopifyProduct error:",
      err.response?.data || err.message
    );
    return false;
  }
}
