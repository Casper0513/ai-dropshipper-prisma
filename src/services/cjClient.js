// src/services/cjClient.js
import axios from "axios";

const CJ_BASE = "https://developers.cjdropshipping.com/api2.0/v1";

/**
 * Required env:
 *  CJ_API_KEY
 *  CJ_ACCESS_TOKEN
 */

function getHeaders() {
  const apiKey = process.env.CJ_API_KEY;
  const token = process.env.CJ_ACCESS_TOKEN;

  if (!apiKey || !token) {
    throw new Error(
      "CJ credentials missing: set CJ_API_KEY and CJ_ACCESS_TOKEN"
    );
  }

  return {
    "Content-Type": "application/json",
    "CJ-Access-Token": token,
    "CJ-API-Key": apiKey,
  };
}

// --------------------------------
// CJ RATE LIMITER (1 req/sec)
// --------------------------------
let lastRequestTime = 0;

async function cjThrottle() {
  const now = Date.now();
  const diff = now - lastRequestTime;

  if (diff < 1000) {
    await new Promise((r) => setTimeout(r, 1000 - diff));
  }

  lastRequestTime = Date.now();
}

/**
 * Unified CJ request
 */
export async function cjRequest(method, path, { params, data } = {}) {
  const url = `${CJ_BASE}${path}`;

  try {
     // 🔒 enforce CJ QPS limit
    await cjThrottle();

    const res = await axios.request({
      method,
      url,
      params,
      data,
      timeout: 45_000,
      headers: getHeaders(),
    });

    if (res.data?.code && res.data.code !== 200) {
      throw new Error(`CJ error: ${JSON.stringify(res.data)}`);
    }

    return res.data?.data ?? res.data;
  } catch (err) {
    const msg = err.response?.data || err.message;
    throw new Error(
      `CJ API error ${method} ${path}: ${JSON.stringify(msg)}`
    );
  }
}

/**
 * Submit CJ order
 */
export async function submitCJOrder(payload) {
  return cjRequest("POST", "/shopping/order/createOrderV2", {
    data: payload,
  });
}

/**
 * Get CJ tracking info
 */
export async function cjGetTracking(trackNumber) {
  return cjRequest("GET", "/logistic/trackInfo", {
    params: { trackNumber },
  });
}
