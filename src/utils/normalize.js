export function normalizeProduct(p) {
  const title = p.product_title || p.title || "";
  const priceStr = p.product_price || p.price || "";
  const num = priceStr.match(/[\d.,]+/);
  const price = num ? parseFloat(num[0].replace(/,/g, "")) : null;

  return {
    asin: p.asin,
    title,
    price,
    image: p.product_photo || (p.product_photos?.[0] ?? null),
    url: p.product_url,
    brand:
      p.product_details?.Brand ||
      p.product_details?.brand ||
      p.brand ||
      "Unknown",
    bulletPoints: p.about_product || [],
    rawDescription: p.product_description || "",
  };
}
