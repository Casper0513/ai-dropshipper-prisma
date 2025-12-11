
// src/services/walmartDetails.js
// NOTE: You must plug in the correct RapidAPI host + params for your Walmart provider.
import axios from "axios";

export async function fetchWalmartDetails(skuOrId) {
  const host = process.env.RAPIDAPI_WM_HOST;
  const key = process.env.RAPIDAPI_WM_KEY;

  if (!host || !key || !skuOrId) return null;

  try {
    const res = await axios.get(`https://${host}/product-details`, {
      params: { item_id: skuOrId }, // adapt to actual API
      headers: {
        "x-rapidapi-key": key,
        "x-rapidapi-host": host,
      },
    });

    const d = res.data?.data;
    if (!d) return null;

    const price = parseFloat(
      String(d.price || d.sale_price || "0").replace(/[^0-9.]/g, "")
    );
    const availability = (d.availability || "").toLowerCase();
    const stock = d.stock ?? null;
    const inStock = (typeof stock === "number" && stock > 0) ||
      availability.includes("in stock");

    return {
      price,
      inStock,
      availability: d.availability || "",
      offerCount: stock,
    };
  } catch (err) {
    console.error("fetchWalmartDetails error:", err.message);
    return null;
  }
}
