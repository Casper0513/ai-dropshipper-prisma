// src/services/cjClient.js
import axios from "axios";

const CJ_BASE = "https://developers.cjdropshipping.com/api2.0/v1";

/**
 * Required env:
 *  CJ_EMAIL
 *  CJ_PASSWORD
 */

let cachedToken = null;
let tokenExpiresAt = 0;

function nowMs() {
  return Date.now();
}

//
// 🔐 Get CJ access token
//
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
    throw new Error(`CJ auth failed: ${JSON.stringify(res.data)}`);
  }

  cachedToken = token;
  tokenExpiresAt = nowMs() + 55 * 60 * 1000; // 55 min safe TTL

  return cachedToken;
}

//
// 🧠 GLOBAL CJ REQUEST QUEUE
// Guarantees STRICT 1 request at a time
//
let cjQueue = Promise.resolve();

function enqueueCJ(fn) {
  const run = cjQueue.then(() => fn());
  cjQueue = run.catch(() => {}); // keep queue alive on error
  return run;
}

//
// 🚀 Unified CJ request (rate-limit safe)
//
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

    // 🔒 HARD WAIT → respects CJ 1 req/sec limit
    await new Promise((r) => setTimeout(r, 1100));

    return res.data?.data ?? res.data;
  });
}

//
// 📦 Submit CJ order
//
export async function submitCJOrder(payload) {
  return cjRequest("POST", "/shopping/order/createOrder", {
    data: payload,
  });
}

//
// 🚚 Get tracking
//
export async function cjGetTracking(trackNumber) {
  return cjRequest("GET", "/logistic/trackInfo", {
    params: { trackNumber },
  });
}

