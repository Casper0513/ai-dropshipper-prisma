// src/services/shopifyApiVersion.js

const PRIMARY_VERSION = "2024-01";

/**
 * Ordered from newest → oldest safe fallbacks
 * Shopify usually supports ~4 versions at once
 */
const FALLBACK_VERSIONS = [
  "2024-01",
  "2023-10",
  "2023-07",
  "2023-04",
];

export function getShopifyApiVersion() {
  return process.env.SHOPIFY_API_VERSION || PRIMARY_VERSION;
}

/**
 * If Shopify rejects the API version, retry with fallback
 */
export function getFallbackVersions() {
  return FALLBACK_VERSIONS;
}

/**
 * Detect version-related Shopify API errors
 */
export function isVersionError(err) {
  const msg =
    err?.response?.data?.errors ||
    err?.response?.data?.error ||
    err?.message ||
    "";

  return (
    typeof msg === "string" &&
    (msg.includes("deprecated") ||
      msg.includes("unsupported") ||
      msg.includes("invalid api version"))
  );
}
