// src/utils/normalize.js
export function normalizeProduct(mode, p, value) {
  // Default: treat "search" and "product-details" similarly.
  if (mode === "search" || mode === "product-details") {
    const title = p.product_title || p.title || "";
    const priceStr = p.product_price || p.price || "";
    const num = priceStr.match(/[\d.,]+/);
    const price = num ? parseFloat(num[0].replace(/,/g, "")) : null;

    return {
      asin: p.asin,
      title,
      price,
      image: p.product_photo || (p.product_photos?.[0] ?? null),
      url: p.product_url || p.product_link || "",
      brand:
        p.product_details?.Brand ||
        p.product_details?.brand ||
        p.brand ||
        "Unknown",
      bulletPoints: p.about_product || p.features || [],
      rawDescription: p.product_description || "",
    };
  }

  // For now, we don't try to convert offers/reviews/sellers directly into products.
  // We could later use them as enrichment data.
  return null;
}
