// src/routes/hotAmazon.js
import axios from "axios";
import { CONFIG } from "../config.js";

const AMAZON_HOT_URL =
  "https://amazon-datahub.p.rapidapi.com/product-search";

export async function searchHotAmazon(req, res) {
  try {
    const q =
      typeof req.query.q === "string" && req.query.q.trim()
        ? req.query.q.trim()
        : "best sellers";

    const category = req.query.category || "aps";
    const limit = Number(req.query.limit || 20);
    const country = req.query.country || "US";

    const response = await axios.get("https://amazon-datahub.p.rapidapi.com/products/search", {
      params: {
        query: q,
        category,
        page: 1,
        country,
      },
      headers: {
        "X-RapidAPI-Key": CONFIG.rapid.key,
        "X-RapidAPI-Host": CONFIG.rapid.host,
      },
      timeout: 15000,
    });

    const items = response?.data?.data || [];

    // Normalize response (VERY important)
    const products = items.slice(0, limit).map((p) => ({
      asin: p.asin,
      title: p.title,
      price: Number(p.price?.value || 0),
      currency: p.price?.currency || "USD",
      image: p.main_image,
      rating: p.rating || null,
      reviews: p.reviews_count || 0,
      url: p.url,
      source: "amazon",
    }));

    res.json({
      source: "amazon",
      query: q,
      count: products.length,
      products,
    });
  } catch (err) {
    console.error("🔥 Amazon hot search error:", err?.message);

    res.status(500).json({
      error: "Amazon hot product fetch failed",
      details: err?.message,
    });
  }
}
