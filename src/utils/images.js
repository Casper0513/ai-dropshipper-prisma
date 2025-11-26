import { CONFIG } from "../config.js";

/**
 * Hook for "auto image enhancement".
 *
 * Modes:
 * - none:      return source URL as-is (Shopify will still optimize on its CDN).
 * - proxy:     send through a proxy AI/image-optimizer service:
 *              PROXY_URL?url=<encoded_src>
 *
 * You can point IMAGE_PROXY_URL to any service that upscales / enhances images.
 */
export function enhanceImageUrl(src) {
  if (!src) return null;

  if (CONFIG.images.mode === "proxy" && CONFIG.images.proxyUrl) {
    const encoded = encodeURIComponent(src);
    return `${CONFIG.images.proxyUrl}?url=${encoded}`;
  }

  // Default: just use original URL and let Shopify's CDN optimize.
  return src;
}
