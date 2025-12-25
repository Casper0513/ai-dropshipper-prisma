// src/services/shopifyWebhooks.js
import crypto from "crypto";

export function verifyShopifyHmac(rawBodyBuffer, hmacHeader, secret) {
  if (!secret) throw new Error("SHOPIFY_WEBHOOK_SECRET missing");
  if (!hmacHeader) return false;

  const digest = crypto
    .createHmac("sha256", secret)
    .update(rawBodyBuffer, "utf8")
    .digest("base64");

  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hmacHeader));
}
