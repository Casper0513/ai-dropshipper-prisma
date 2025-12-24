// src/services/cj.js

/**
 * CJ Dropshipping service
 * 
 * NOTE:
 * - This is intentionally SAFE by default
 * - No API calls unless you later enable them
 * - You can fully automate later without refactors
 */

export async function fetchCJDetails(variant) {
  // Placeholder for future CJ price/stock checks
  // For now, return null so auto-sync ignores CJ as a source
  return null;
}

export async function submitCJOrder({ order, lineItems }) {
  // Stub for CJ order creation
  // Later: build payload + call CJ API

  return {
    success: false,
    message: "CJ API not enabled",
  };
}

export async function pollCJShipment(supplierOrderId) {
  // Stub for shipment polling
  return null;
}
