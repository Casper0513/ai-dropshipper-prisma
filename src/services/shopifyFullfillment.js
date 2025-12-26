// src/services/shopifyFulfillment.js
import axios from "axios";
import { CONFIG } from "../config.js";

const API_VERSION = "2024-01";

const BASE_URL = `https://${CONFIG.shopify.domain}/admin/api/${API_VERSION}`;
const HEADERS = {
  "X-Shopify-Access-Token": CONFIG.shopify.token,
  "Content-Type": "application/json",
};

/**
 * Create a Shopify fulfillment
 * - Used after CJ (or other supplier) provides tracking
 * - SAFE for partial fulfillments
 */
export async function createShopifyFulfillment({
  orderId,
  lineItems = [],
  trackingNumber,
  trackingUrl,
  carrier = "CJ Dropshipping",
}) {
  try {
    const payload = {
      fulfillment: {
        notify_customer: true,
        tracking_number: trackingNumber,
        tracking_url: trackingUrl || undefined,
        tracking_company: carrier,
      },
    };

    /**
     * Optional: limit fulfillment to specific line items
     * Shopify allows partial fulfillments
     */
    if (Array.isArray(lineItems) && lineItems.length > 0) {
      payload.fulfillment.line_items = lineItems.map((li) => ({
        id: li.shopifyLineItemId || li.id,
        quantity: li.quantity || 1,
      }));
    }

    const res = await axios.post(
      `${BASE_URL}/orders/${orderId}/fulfillments.json`,
      payload,
      { headers: HEADERS }
    );

    return res.data.fulfillment;
  } catch (err) {
    console.error(
      "❌ Shopify fulfillment error:",
      err.response?.data || err.message
    );
    return null;
  }
}

/**
 * Update tracking on an existing fulfillment
 * - Used by tracking sync worker
 */
export async function updateShopifyTracking({
  fulfillmentId,
  trackingNumber,
  trackingUrl,
  carrier = "CJ Dropshipping",
}) {
  try {
    const res = await axios.put(
      `${BASE_URL}/fulfillments/${fulfillmentId}.json`,
      {
        fulfillment: {
          tracking_number: trackingNumber,
          tracking_url: trackingUrl || undefined,
          tracking_company: carrier,
        },
      },
      { headers: HEADERS }
    );

    return res.data.fulfillment;
  } catch (err) {
    console.error(
      "❌ Shopify tracking update error:",
      err.response?.data || err.message
    );
    return null;
  }
}

/**
 * Fetch fulfillments for an order
 * - Used by dashboard + reconciliation
 */
export async function getShopifyFulfillments(orderId) {
  try {
    const res = await axios.get(
      `${BASE_URL}/orders/${orderId}/fulfillments.json`,
      { headers: HEADERS }
    );

    return res.data.fulfillments || [];
  } catch (err) {
    console.error(
      "❌ Shopify get fulfillments error:",
      err.response?.data || err.message
    );
    return [];
  }
}


