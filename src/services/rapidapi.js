// src/services/rapidapi.js
import axios from "axios";
import { CONFIG } from "../config.js";
import { log } from "../utils/logger.js";

/**
 * Fetch Amazon data for different modes.
 * 
 * Modes:
 * - search           → /search?query=keyword
 * - product-details  → /product-details?asin=ASIN
 * - product-offers   → /product-offers?asin=ASIN   (currently just logged)
 * - product-reviews  → /product-reviews?asin=ASIN  (enrichment only, not used for products yet)
 * - product-sellers  → /product-sellers?asin=ASIN  (enrichment only)
 * - product-categories → /product-categories?query=keyword (enrichment only)
 *
 * Returns: ALWAYS an array (may be empty).
 */
export async function fetchAmazonData(mode, value, page = 1) {
  const base = `https://${CONFIG.rapid.host}`;
  const headers = {
    "x-rapidapi-key": CONFIG.rapid.key,
    "x-rapidapi-host": CONFIG.rapid.host,
  };

  try {
    let url;
    let params = {};

    switch (mode) {
      case "search": {
        url = `${base}/search`;
        params = {
          query: value,
          page,
          country: CONFIG.defaultCountry,
        };
        break;
      }

      case "product-details": {
        url = `${base}/product-details`;
        params = {
          asin: value,
          country: CONFIG.defaultCountry,
        };
        break;
      }

      case "product-offers": {
        url = `${base}/product-offers`;
        params = {
          asin: value,
          country: CONFIG.defaultCountry,
        };
        break;
      }

      case "product-reviews": {
        url = `${base}/product-reviews`;
        params = {
          asin: value,
          country: CONFIG.defaultCountry,
          page,
        };
        break;
      }

      case "product-sellers": {
        url = `${base}/product-sellers`;
        params = {
          asin: value,
          country: CONFIG.defaultCountry,
        };
        break;
      }

      case "product-categories": {
        url = `${base}/product-categories`;
        params = {
          query: value,
          country: CONFIG.defaultCountry,
        };
        break;
      }

      default: {
        log.error(`Unknown mode "${mode}", falling back to search.`);
        url = `${base}/search`;
        params = {
          query: value,
          page,
          country: CONFIG.defaultCountry,
        };
        break;
      }
    }

    const res = await axios.get(url, { params, headers });

    // Now normalize top-level shape into an array safely:
    const body = res.data;

    let items;

    if (mode === "search" || mode === "product-categories") {
      // Typically arrays under .data or .results
      const raw = body?.data || body?.results;
      if (!Array.isArray(raw)) {
        log.error(`RapidAPI returned non-array for "${value}" in mode "${mode}"`, raw);
        return [];
      }
      items = raw;
    } else if (mode === "product-details") {
      const d = body?.data;
      if (!d) {
        log.error(`No data for product-details "${value}"`);
        return [];
      }
      items = [d];
    } else {
      // For now, product-offers / reviews / sellers: just pass raw data array-ish if present
      const d = body?.data;
      if (Array.isArray(d)) {
        items = d;
      } else if (d) {
        items = [d];
      } else {
        log.error(`No data returned for mode "${mode}" value "${value}"`);
        return [];
      }
    }

    log.info(`RapidAPI mode="${mode}" returned ${items.length} item(s) for "${value}"`);
    return items;
  } catch (err) {
    log.error(`RapidAPI error in mode "${mode}" for "${value}": ${err.message}`);
    return [];
  }
}

