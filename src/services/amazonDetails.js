
// src/services/amazonDetails.js
import axios from "axios";

export async function fetchProductDetails(asin) {
  const host = process.env.RAPIDAPI_HOST;
  const key = process.env.RAPIDAPI_KEY;

  if (!host || !key || !asin) return null;

  try {
    const res = await axios.get(`https://${host}/product-details`, {
      params: { asin, country: "US" },
      headers: {
        "x-rapidapi-key": key,
        "x-rapidapi-host": host,
      },
    });

    const d = res.data?.data;
    if (!d) return null;

    const price = parseFloat(
      (d.product_minimum_offer_price || d.product_price || "0").replace(
        /[^0-9.]/g,
        ""
      )
    );

    const availability = (d.availability || "").toLowerCase();
    const offerCount = d.product_num_offers ?? 0;
    const inStock =
      offerCount > 0 && !availability.includes("out of stock");

    return {
      asin,
      price,
      inStock,
      availability,
      offerCount,
    };
  } catch (err) {
    console.error("fetchProductDetails(Amazon) error:", err.message);
    return null;
  }
}
