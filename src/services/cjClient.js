// src/services/cjClient.js
import axios from "axios";

const CJ_BASE = "https://developers.cjdropshipping.com/api2.0/v1";

/**
 * Supported env configs:
 *
 * 🔐 Preferred (production)
 *   CJ_API_KEY
 *   CJ_ACCESS_TOKEN   (optional)
 *
 * 🪪 Legacy fallback
 *   CJ_EMAIL
 *   CJ_PASSWORD
 */

let cachedToken = process.env.CJ_ACCESS_TOKEN || null;
let tokenExpiresAt = 0;

function nowMs() {
  return Date.now();
}

/**
 * --------------------------------------------------
 * Get CJ access token
 * --------------------------------------------------
 * Priority:
 *   1) CJ_API_KEY  → permanent auth (best)
 *   2) CJ_ACCESS_TOKEN → reuse
 *   3) Email/password → login fallback
 */
async function getAccessToken(forceRefresh = false) {
  // ✅ 1) Permanent API key mode
  if (process.env.CJ_API_KEY) {
    return process.env.CJ_API_KEY;
  }

  // ✅ 2) Cached token reuse
  if (!forceRefresh && cachedToken && nowMs() < tokenExpiresAt) {
    return cachedToken;
  }

  // ⚠️ 3) Email/password fallback
  const email = process.env.CJ_EMAIL;
  const password = process.env.CJ_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "CJ auth missing. Set CJ_API_KEY OR CJ_EMAIL/CJ_PASSWORD"
    );
  }

  const res = await axios.post(
    `${CJ_BASE}/authentication/getAccessToken`,
    { email, password },
    { timeout: 30_000 }
  );

  const data = res.data?.data || {};
  const token = data.accessToken || data.token || data.access_token;

  if (!token) {
    throw new Error(`CJ login failed: ${JSON.stringify(res.data)}`);
  }

  cachedToken = token;

  // token valid ~60min → refresh early
  tokenExpiresAt = nowMs() + 55 * 60 * 1000;

  return cachedToken;
}

/**
 * --------------------------------------------------
 * Unified CJ request helper
 * --------------------------------------------------
 */
export async function cjRequest(method, path, { params, data } = {}) {
  let token = await getAccessToken();
  const url = `${CJ_BASE}${path}`;

  try {
    await waitForRateLimit();

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

    // CJ returns non-200 codes inside body
    if (res.data?.code && res.data.code !== 200) {
      throw new Error(JSON.stringify(res.data));
    }

    return res.data?.data ?? res.data;
  } catch (err) {
    // 🔁 Retry once if token expired AND using email/password mode
    if (
      err.response?.status === 401 &&
      !process.env.CJ_API_KEY
    ) {
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

// --------------------------------------------------
// CJ rate limiter (1 request / second)
// --------------------------------------------------
let lastRequestTime = 0;

async function waitForRateLimit() {
  const now = Date.now();
  const diff = now - lastRequestTime;

  if (diff < 1100) {
    await new Promise((r) => setTimeout(r, 1100 - diff));
  }

  lastRequestTime = Date.now();
}

/**
 * --------------------------------------------------
 * Create CJ order
 * --------------------------------------------------
 */
export async function submitCJOrder(payload) {
  return cjRequest("POST", "/shopping/order/createOrder", {
    data: payload,
  });
}

/**
 * --------------------------------------------------
 * Get tracking info
 * --------------------------------------------------
 */
export async function cjGetTracking(trackNumber) {
  return cjRequest("GET", "/logistic/trackInfo", {
    params: { trackNumber },
  });
}


