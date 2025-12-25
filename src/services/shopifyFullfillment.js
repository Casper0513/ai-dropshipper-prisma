// src/services/shopifyFulfillment.js
import axios from "axios";
import { CONFIG } from "../config.js";

const API_VERSION = "2024-01";
const BASE = `https://${CONFIG.shopify.domain}/admin/api/${API_VERSION}`;
const HEADERS = {
  "X-Shopify-Access-Token": CONFIG.shopify.token,
  "Content-Type": "application/json",
};

/**
 * Create a Shopify fulfillment with tracking
 * - Shopify 2024+ compliant
 * - Uses fulfillment_orders API
 */
export async function createShopifyFulfillment({
  orderId,
  trackingNumber,
  trackingUrl,
  carrier = "CJ Dropshipping",
}) {
  try {
    // 1️⃣ Fetch fulfillment orders
    const foRes = await axios.get(
      `${BASE}/orders/${orderId}/fulfillment_orders.json`,
      { headers: HEADERS }
    );

    const fulfillmentOrders = foRes.data.fulfillment_orders || [];

    // Find first OPEN fulfillment order
    const openFO = fulfillmentOrders.find(
      (fo) => fo.status === "open"
    );

    if (!openFO) {
      console.warn(
        `⚠️ No open fulfillment order for Shopify order ${orderId}`
      );
      return null;
    }

    // 2️⃣ Create fulfillment
    const fulfillRes = await axios.post(
      `${BASE}/fulfillments.json`,
      {
        fulfillment: {
          fulfillment_order_id: openFO.id,
          notify_customer: true,
          tracking_info: {
            number: trackingNumber,
            url: trackingUrl,
            company: carrier,
          },
        },
      },
      { headers: HEADERS }
    );

    return fulfillRes.data.fulfillment;
  } catch (err) {
    console.error(
      "Shopify fulfillment error:",
      err.response?.data || err.message
    );
    return null;
  }
}

