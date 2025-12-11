
// src/services/shopifySync.js
import axios from "axios";

const shop = process.env.SHOPIFY_STORE_DOMAIN;
const key = process.env.SHOPIFY_ADMIN_API_KEY;
const pass = process.env.SHOPIFY_ADMIN_API_PASSWORD;

const base = `https://${key}:${pass}@${shop}/admin/api/2024-01`;

export async function updateShopifyPrice(productId, variantId, newPrice) {
  try {
    await axios.put(`${base}/variants/${variantId}.json`, {
      variant: { id: variantId, price: newPrice },
    });
    return true;
  } catch (err) {
    console.error("updateShopifyPrice error:", err.response?.data || err.message);
    return false;
  }
}

export async function setShopifyInStock(productId, variantId, inStock) {
  try {
    await axios.put(`${base}/products/${productId}.json`, {
      product: { id: productId, status: inStock ? "active" : "draft" },
    });
    return true;
  } catch (err) {
    console.error("setShopifyInStock error:", err.response?.data || err.message);
    return false;
  }
}

export async function deleteShopifyProduct(productId) {
  try {
    await axios.delete(`${base}/products/${productId}.json`);
    console.log("🗑 Deleted Shopify product", productId);
    return true;
  } catch (err) {
    console.error("deleteShopifyProduct error:", err.response?.data || err.message);
    return false;
  }
}
