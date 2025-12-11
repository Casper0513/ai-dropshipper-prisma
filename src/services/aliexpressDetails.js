
// src/services/aliexpressDetails.js
// NOTE: You must plug in the correct RapidAPI host + params for your AliExpress provider.
import axios from "axios";

export async function fetchAliExpressDetails(skuOrId) {
  const host = process.env.RAPIDAPI_AE_HOST;
  const key = process.env.RAPIDAPI_AE_KEY;

  if (!host || !key || !skuOrId) return null;

  try {
    const res = await axios.get(`https://${host}/product-details`, {
      params: { product_id: skuOrId }, // adapt to actual API
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
    console.error("fetchAliExpressDetails error:", err.message);
    return null;
  }
}
