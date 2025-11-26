import "dotenv/config";

export const CONFIG = {
  rapid: {
    key: process.env.RAPIDAPI_KEY,
    host: process.env.RAPIDAPI_HOST,
  },
  openai: {
    key: process.env.OPENAI_API_KEY,
  },
  shopify: {
    domain: process.env.SHOPIFY_STORE_DOMAIN,
    token: process.env.SHOPIFY_ADMIN_ACCESS_TOKEN,
  },
  keywords: (process.env.KEYWORDS || "")
    .split(",")
    .map(k => k.trim())
    .filter(Boolean),

  defaultCountry: process.env.DEFAULT_COUNTRY || "US",

  priceRange: {
    minImport: parseFloat(process.env.MIN_PRICE_USD || "0"),
    maxImport: parseFloat(process.env.MAX_PRICE_USD || "999999")
  },

  pricing: {
    markupPercent: parseFloat(process.env.MARKUP_PERCENT || "0"),
    roundTo: parseFloat(process.env.PRICE_ENDING || "0"), // e.g. .99
    fallbackPrice: parseFloat(process.env.FALLBACK_PRICE_USD || "19.99"),
  },

  images: {
    mode: process.env.IMAGE_ENHANCEMENT_MODE || "none", // none | proxy
    proxyUrl: process.env.IMAGE_PROXY_URL || "",
  },

  server: {
    port: parseInt(process.env.PORT || "3000", 10),
  }
};
