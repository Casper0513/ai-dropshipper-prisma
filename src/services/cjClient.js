// src/services/cjClient.js
import axios from "axios";

const CJ_BASE = "https://developers.cjdropshipping.com/api2.0/v1";

/**
 * Required env:
 *  CJ_EMAIL
 *  CJ_PASSWORD
 *
 * Optional:
 *  CJ_ACCESS_TOKEN
 */

let cachedToken = process.env.CJ_ACCESS_TOKEN || null;
let tokenExpiresAt = 0;

function nowMs() {
  return Date.now();
}

/**
 * Fetch or reuse CJ access token
 */
async function getAccessToken(forceRefresh = false) {
  if (!forceRefresh && cachedToken && nowMs() < tokenExpiresAt) {
    return cachedToken;
  }

  const email = process.env.CJ_EMAIL;
  const password = process.env.CJ_PASSWORD;

  if (!email || !password) {
    throw new Error("CJ credentials missing: set CJ_EMAIL and CJ_PASSWORD");
  }

  const res = await axios.post(
    `${CJ_BASE}/authentication/getAccessToken`,
    { email, password },
    { timeout: 30_000 }
  );

  const data = res.data?.data || {};
  const token = data.accessToken || data.token || data.access_token;

  if (!token) {
    throw new Error(
      `CJ auth failed: ${JSON.stringify(res.data)}`
    );
  }

  cachedToken = token;
  tokenExpiresAt = nowMs() + 55 * 60 * 1000; // safe TTL

  return cachedToken;
}

/**
 * Unified CJ request with retry-on-401
 */
export async function cjRequest(method, path, { params, data } = {}) {
  let token = await getAccessToken();
  const url = `${CJ_BASE}${path}`;

  try {
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

    return res.data?.data ?? res.data;
  } catch (err) {
    // Retry once if token expired
    if (err.response?.status === 401) {
      token = await getAccessToken(true);

      const retry = await axios.request({
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

      return retry.data?.data ?? retry.data;
    }

    const msg = err.response?.data || err.message;
    throw new Error(
      `CJ API error ${method} ${path}: ${JSON.stringify(msg)}`
    );
  }
}

/**
 * Submit CJ order
 * Used by fulfillment dispatcher
 */
export async function submitCJOrder(payload) {
  return cjRequest("POST", "/shopping/order/createOrder", {
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

