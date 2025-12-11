
// src/utils/normalize.js – WITH STOCK + PRICE VALIDATION
export function normalizeProduct(mode, item, keyword) {
  if (!item) return null;

  // Extract REAL price — minimum offer price is the most reliable
  let rawPrice =
    item.product_minimum_offer_price ||
    item.product_price ||
    item.price ||
    null;

  let price = 0;
  if (rawPrice) {
    price = parseFloat(String(rawPrice).replace(/[^0-9.]/g, "")) || 0;
  }

  // Stock signals
  const availability =
    (item.product_availability || item.availability || "").toLowerCase();

  const offerCount =
    item.product_num_offers ??
    item.num_offers ??
    item.offers ??
    null;

  const inStock =
    (availability && !availability.includes("out of stock")) ||
    (typeof offerCount === "number" && offerCount > 0) ||
    item.delivery != null;

  // If product has no price or is not in stock → skip
  if (!price || price <= 0) return null;
  if (!inStock) return null;

  // Extract best possible image
  const image =
    item.product_photo ||
    item.image ||
    item.thumbnail ||
    item.product_image ||
    item.main_image ||
    item.image_url ||
    null;

  return {
    asin: item.asin || null,
    title: item.product_title || item.title || "Untitled Product",
    price,
    image,
    url: item.product_url || item.url || "",
    inStock,
    offerCount,
    availability,
  };
}
