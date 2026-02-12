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
// GLOBAL CJ REQUEST QUEUE (REAL FIX)
// Ensures strict 1 request at a time
// --------------------------------
let cjQueue = Promise.resolve();

function enqueueCJ(fn) {
  const run = cjQueue.then(() => fn());
  cjQueue = run.catch(() => {}); // keep queue alive on error
  return run;
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
  return enqueueCJ(async () => {
    const token = await getAccessToken();
    const url = `${CJ_BASE}${path}`;

    const res = await axios.request({
      method,
      url,
      params,
      data,
      timeout: 45_000,
      headers: {
        "Content-Type": "application/json",
        "CJ-Access-Token": token,
      },
    });

    if (res.data?.code && res.data.code !== 200) {
      throw new Error(`CJ error: ${JSON.stringify(res.data)}`);
    }

    // 🔒 HARD WAIT to respect QPS
    await new Promise((r) => setTimeout(r, 1100));

    return res.data?.data ?? res.data;
  });
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
