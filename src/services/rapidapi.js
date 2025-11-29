
import axios from "axios";
import { CONFIG } from "../config.js";
import { log } from "../utils/logger.js";

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
      case "search":
        url = `${base}/search`;
        params = { query: value, page: 1,
        country: CONFIG.defaultCountry };
        break;

      case "product-details":
        url = `${base}/product`;
        params = { asin: value };
        break;

      case "product-reviews":
        url = `${base}/reviews`;
        params = { asin: value, page };
        break;

      default:
        log.error(`Unknown mode "${mode}", using search`);
        url = `${base}/search-products`;
        params = { query: value, page };
    }

    const res = await axios.get(url, { params, headers });
    const body = res.data;

    let items;

    if (mode === "search") {
      const raw = body?.data?.products;
      if (!Array.isArray(raw)) {
        log.error(`Non-array for "${value}" in search`, raw);
        return [];
      }
      items = raw;
    }

    return items;
  } catch (err) {
    log.error(`RapidAPI error mode "${mode}" for "${value}": ${err.message}`);
    return [];
  }
}
