// src/services/cjClient.js
import axios from "axios";

const CJ_BASE = "https://developers.cjdropshipping.com/api2.0/v1";

/**
 * Env you must set:
 *  CJ_EMAIL
 *  CJ_PASSWORD
 *
 * Optional:
 *  CJ_ACCESS_TOKEN (if you want to hard-set it, but we auto-refresh)
 */
let cachedToken = process.env.CJ_ACCESS_TOKEN || null;
let tokenExpiresAt = 0;

function nowMs() {
  return Date.now();
}

async function getAccessToken() {
  // reuse if still valid (we keep a short TTL; CJ token expiry can vary)
  if (cachedToken && nowMs() < tokenExpiresAt) return cachedToken;

  const email = process.env.CJ_EMAIL;
  const password = process.env.CJ_PASSWORD;

  if (!email || !password) {
    throw new Error("CJ credentials missing: set CJ_EMAIL and CJ_PASSWORD");
  }

  const url = `${CJ_BASE}/authentication/getAccessToken`;

  // CJ docs: POST + JSON body
  const res = await axios.post(url, { email, password }, { timeout: 30_000 });

  // Typical CJ response format: { code, result, message, data: { accessToken, ... } }
  const data = res.data?.data || {};
  const token = data.accessToken || data.token || data.access_token;

  if (!token) {
    throw new Error(`CJ getAccessToken failed: ${JSON.stringify(res.data)}`);
  }

  cachedToken = token;

  // set a conservative expiry (55 minutes)
  tokenExpiresAt = nowMs() + 55 * 60 * 1000;

  return cachedToken;
}

export async function cjRequest(method, path, { params, data } = {}) {
  const token = await getAccessToken();
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
    return res.data;
  } catch (err) {
    const msg = err.response?.data || err.message;
    throw new Error(`CJ API error ${method} ${path}: ${JSON.stringify(msg)}`);
  }
}

/**
 * Tracking query:
 * GET /logistic/trackInfo?trackNumber=XXXX
 * (CJ docs show trackInfo as current endpoint) :contentReference[oaicite:2]{index=2}
 */
export async function cjGetTracking(trackNumber) {
  const res = await cjRequest("GET", "/logistic/trackInfo", {
    params: { trackNumber },
  });
  return res;
}
