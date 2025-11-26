import axios from "axios";
import { CONFIG } from "../config.js";
import { log } from "../utils/logger.js";

export async function searchRapidProducts(keyword, page = 1) {
  const url = `https://${CONFIG.rapid.host}/search`;

  const params = {
    query: keyword,
    page,
    country: CONFIG.defaultCountry
  };

  try {
    const res = await axios.get(url, {
      params,
      headers: {
        "x-rapidapi-key": CONFIG.rapid.key,
        "x-rapidapi-host": CONFIG.rapid.host,
      }
    });

    const items = res.data?.data || res.data?.results || [];
    log.info(`RapidAPI returned ${items.length} items for "${keyword}"`);
    return items;
  } catch (err) {
    log.error(`RapidAPI error: ${err.message}`);
    return [];
  }
}
