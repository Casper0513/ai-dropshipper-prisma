// src/routes/hotAmazon.js
import axios from "axios";
import { CONFIG } from "../config.js";

export async function searchHotAmazon(req, res) {
  try {
    const q = req.query.q;
    if (!q) return res.status(400).json({ error: "Missing query" });

    const { data } = await axios.get(
      "https://real-time-amazon-data.p.rapidapi.com/search",
      {
        params: {
          query: q,
          country: "US",
          page: "1",
        },
        headers: {
          "X-RapidAPI-Key": CONFIG.rapid.key,
          "X-RapidAPI-Host": CONFIG.rapid.host,
        },
      }
    );

    const ranked = (data?.data?.products || [])
      .map(p => ({
        asin: p.asin,
        title: p.title,
        price: Number(p.price?.current_price || 0),
        rating: Number(p.rating || 0),
        reviews: Number(p.reviews_count || 0),
        image: p.thumbnail,
        score:
          (Number(p.rating || 0) * 20) +
          Math.log10(Number(p.reviews_count || 1)) * 10
      }))
      .filter(p => p.price >= 15 && p.price <= 80)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);

    res.json({ source: "amazon", results: ranked });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
