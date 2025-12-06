
// src/utils/normalize.js
/**
 * Normalize product shape from Amazon / Walmart / AliExpress into a common format.
 * This version is more aggressive about finding image fields to reduce "no image" cases.
 */
export function normalizeProduct(item) {
  if (!item) return null;

  const image =
    item.product_photo ||
    item.image ||
    item.thumbnail ||
    item.product_image ||
    item.img ||
    item.img_url ||
    item.picture ||
    item.main_image ||
    item.product_main_image_url ||
    item.image_url ||
    item.image?.url ||
    item.image?.assetSizeUrls?.primary ||
    null;

  const rawPrice =
    item.product_price ||
    item.sale_price ||
    item.price ||
    item.price_string ||
    item.priceText ||
    "";

  const parsedPrice = parseFloat(String(rawPrice).replace(/[^0-9.]/g, "")) || 0;

  const title =
    item.product_title ||
    item.title ||
    item.name ||
    item.productName ||
    "";

  const url =
    item.product_url ||
    item.product_detail_url ||
    item.url ||
    item.productPageUrl ||
    "";

  const asin =
    item.asin ||
    item.usItemId ||
    item.itemId ||
    item.product_id ||
    item.productId ||
    null;

  const rating =
    item.product_star_rating ||
    item.customerRating ||
    item.rating ||
    null;

  const reviews =
    item.product_num_ratings ||
    item.numReviews ||
    item.review_count ||
    item.reviewsCount ||
    0;

  const currency = item.currency || "USD";

  if (!title) return null;

  return {
    asin,
    title,
    price: parsedPrice,
    image,
    url,
    rating,
    reviews,
    currency
  };
}
