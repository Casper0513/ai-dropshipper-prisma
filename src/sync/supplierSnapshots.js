// src/sync/supplierSnapshots.js
import { fetchAmazonData } from "../services/rapidapi.js";
import { log } from "../utils/logger.js";

function parsePrice(raw) {
  if (!raw) return null;
  const cleaned = String(raw).replace(/[^0-9.,]/g, "").replace(/,/g, "");
  const val = parseFloat(cleaned);
  return Number.isFinite(val) ? val : null;
}

function decideInStock(product) {
  const text =
    product.product_availability ||
    product.availability ||
    product.stock ||
    "";

  if (!text) return true; // assume true if not specified
  return !/out of stock|unavailable/i.test(text);
}

/**
 * Primary: Amazon snapshot using your existing RapidAPI integration.
 */
export async function getAmazonSnapshot(ctx) {
  const { asin, keyword, title } = ctx;
  const query = asin || keyword || title;
  if (!query) return null;

  try {
    const items = await fetchAmazonData("search", query);
    if (!Array.isArray(items) || items.length === 0) return null;

    const p = items[0];

    return {
      supplier: "amazon",
      supplierId: p.asin || asin || null,
      price: parsePrice(p.product_price || p.product_minimum_offer_price),
      currency: p.currency || "USD",
      inStock: decideInStock(p),
      raw: p
    };
  } catch (err) {
    log.error(`Amazon snapshot error for "${query}": ${err.message}`);
    return null;
  }
}

/**
 * Stub for AliExpress – ready for you to wire a RapidAPI later.
 * If ALIEXPRESS_API_KEY / HOST are not present, we skip.
 */
export async function getAliExpressSnapshot(ctx) {
  if (!process.env.ALIEXPRESS_API_KEY || !process.env.ALIEXPRESS_API_HOST) {
    return null;
  }

  // TODO: plug in your preferred AliExpress RapidAPI endpoint here.
  // Return same shape as getAmazonSnapshot.
  return null;
}

/**
 * Stub for Walmart – also ready for RapidAPI later.
 */
export async function getWalmartSnapshot(ctx) {
  if (!process.env.WALMART_API_KEY || !process.env.WALMART_API_HOST) {
    return null;
  }

  // TODO: plug in your preferred Walmart RapidAPI endpoint here.
  // Return same shape as getAmazonSnapshot.
  return null;
}

/**
 * Aggregates all supplier snapshots and picks the "best":
 * - Prefer in-stock offers
 * - Among them, choose lowest price
 * - If none are in stock, choose overall lowest price
 */
export async function getBestSupplierSnapshot(ctx) {
  const snapshots = await Promise.all([
    getAmazonSnapshot(ctx),
    getAliExpressSnapshot(ctx),
    getWalmartSnapshot(ctx)
  ]);

  const valid = snapshots.filter(
    s => s && s.price != null && Number.isFinite(s.price)
  );
  if (valid.length === 0) return null;

  const inStock = valid.filter(s => s.inStock);
  const pool = inStock.length ? inStock : valid;

  pool.sort((a, b) => a.price - b.price);
  return pool[0];
}
