// src/services/shopifyFulfillment.js
import axios from "axios";
import { CONFIG } from "../config.js";

const API_VERSION = "2024-01";

const BASE = `https://${CONFIG.shopify.domain}/admin/api/${API_VERSION}`;
const HEADERS = {
  "X-Shopify-Access-Token": CONFIG.shopify.token,
  "Content-Type": "application/json",
};

export async function createShopifyFulfillment({
  orderId,
  trackingNumber,
  trackingUrl,
  carrier,
}) {
  try {
    const res = await axios.post(
      `${BASE}/orders/${orderId}/fulfillments.json`,
      {
        fulfillment: {
          tracking_number: trackingNumber,
          tracking_url: trackingUrl,
          tracking_company: carrier || "CJ Dropshipping",
        },
      },
      { headers: HEADERS }
    );

    return res.data.fulfillment;
  } catch (err) {
    console.error(
      "Shopify fulfillment error:",
      err.response?.data || err.message
    );
    return null;
  }
}
