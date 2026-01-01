// src/services/cjFulfillment.js
import { prisma } from "../db/client.js";
import { cjRequest } from "./cjClient.js";
import { pushLiveLog } from "../utils/liveLogs.js";

/**
 * Create a CJ order from a FulfillmentOrder row
 * - Assumes Shopify webhook already stored:
 *   - shopifySku
 *   - quantity
 *   - shippingName / address / city / province / country / zip / phone
 */
export async function createCjOrderFromFulfillmentOrder(fulfillmentOrderId) {
  const fo = await prisma.fulfillmentOrder.findUnique({
    where: { id: fulfillmentOrderId },
  });

  if (!fo) throw new Error("FulfillmentOrder not found");
  if (fo.supplier !== "cj") return fo;
  if (fo.status !== "pending") return fo;

  if (!fo.shopifySku) {
    throw new Error("FulfillmentOrder missing shopifySku");
  }

  const variant = await prisma.syncedVariant.findFirst({
    where: {
      source: "cj",
      sku: fo.shopifySku,
      deleted: false,
    },
  });

  if (!variant?.cjVariantId) {
    throw new Error(
      `No CJ mapping for sku=${fo.shopifySku} (missing cjVariantId)`
    );
  }

  // ✅ Build CJ payload (STRICT + VALID)
  const payload = {
    orderNumber: String(fo.shopifyOrderId),

    recipient: {
      name: fo.shippingName,
      address: fo.shippingAddress1,
      address2: fo.shippingAddress2 || "",
      city: fo.shippingCity,
      province: fo.shippingProvince || "",
      country: fo.shippingCountry,
      zip: fo.shippingZip || "",
      phone: fo.shippingPhone || "",
    },

    products: [
      {
        vid: variant.cjVariantId,
        quantity: fo.quantity || 1,
      },
    ],
  };

  pushLiveLog(
    `📦 [CJ] Creating CJ order for Shopify ${fo.shopifyOrderId} sku=${fo.shopifySku}`
  );

  const res = await cjRequest(
    "POST",
    "/shopping/order/createOrderV2",
    { data: payload }
  );

  const data = res?.data || {};
  const cjOrderId = data.orderId || data.id;

  if (!cjOrderId) {
    throw new Error(
      `[CJ] createOrderV2 returned no orderId: ${JSON.stringify(res)}`
    );
  }
  // -------------------------------
  // 💰 PROFIT CALCULATION (AT FULFILLMENT)
  // -------------------------------

  // CJ usually returns product + logistics cost
  const cjProductCost = Number( 
    data.productAmount || data.goodsAmount || 0
  );

  const cjShippingCost = Number(
    data.logisticsAmount || data.shippingFee || 0
  );

  const supplierCost = cjProductCost + cjShippingCost;
  // Sale price must be stored earlier (recommended in metaJson or column)
  const salePrice =
    fo.salePrice ??
    (fo.metaJson
    ? (() => {
        try {
          return JSON.parse(fo.metaJson)?.salePrice;
        } catch {
          return null;
        }
      })()
    : null);

  const profit =
    salePrice && supplierCost
      ? salePrice - supplierCost
      : null;

  await prisma.fulfillmentOrder.update({
    where: { id: fo.id },
    data: {
      cjOrderId,
      supplierCost,
      shippingCost: cjShippingCost,
      profit,
      status: "ordered",
    },
  });
  const updated = await prisma.fulfillmentOrder.update({
    where: { id: fo.id },
    data: {
      cjOrderId,
      status: "ordered",
    },
  });

  pushLiveLog(
    `✅ [CJ] Order submitted cjOrderId=${cjOrderId} for Shopify ${fo.shopifyOrderId}`
  );

  return updated;
}

// ---- PROFIT CALCULATION ----

// CJ usually returns product + logistics cost
const cjProductCost =
  Number(data.productAmount || data.goodsAmount || 0);

const cjShippingCost =
  Number(data.logisticsAmount || data.shippingFee || 0);

const supplierCost = cjProductCost + cjShippingCost;

const salePrice = fo.salePrice ?? 0;

const profit =
  salePrice && supplierCost
    ? salePrice - supplierCost
    : null;

await prisma.fulfillmentOrder.update({
  where: { id: fo.id },
  data: {
    cjOrderId,
    supplierCost,
    shippingCost: cjShippingCost,
    profit,
    status: "ordered",
  },
});


