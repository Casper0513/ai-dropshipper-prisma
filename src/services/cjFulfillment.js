// src/services/cjFulfillment.js
import { prisma } from "../db/client.js";
import { cjRequest } from "./cjClient.js";
import { pushLiveLog } from "../utils/liveLogs.js";

/**
 * Create a CJ order from a FulfillmentOrder row
 * - Idempotent
 * - Calculates profit at fulfillment time
 * - Guarded against double execution & terminal states
 */
export async function createCjOrderFromFulfillmentOrder(fulfillmentOrderId) {
  const fo = await prisma.fulfillmentOrder.findUnique({
    where: { id: fulfillmentOrderId },
  });

  if (!fo) throw new Error("FulfillmentOrder not found");

  // --------------------------------------------------
  // 🛑 TERMINAL STATE GUARD
  // --------------------------------------------------
  if (["delivered", "cancelled", "returned"].includes(fo.status)) {
    return fo;
  }

  // --------------------------------------------------
  // 🛑 SUPPLIER / IDEMPOTENCY GUARDS
  // --------------------------------------------------
  if (fo.supplier !== "cj") return fo;
  if (fo.cjOrderId) return fo;

  const meta = safeJson(fo.metaJson);

  // --------------------------------------------------
  // 🛑 FALLBACK GUARD
  // --------------------------------------------------
  if (meta.fallback?.provider === "aliexpress") {
    return fo;
  }

  // --------------------------------------------------
  // 🔒 IN-PROGRESS LOCK
  // --------------------------------------------------
  if (meta._cjLock === true) {
    return fo;
  }

  // Acquire lock
  await prisma.fulfillmentOrder.update({
    where: { id: fo.id },
    data: {
      metaJson: JSON.stringify({
        ...meta,
        _cjLock: true,
        _cjLockAt: new Date().toISOString(),
      }),
    },
  });

  try {
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
    // 💰 PROFIT CALCULATION (SAFE)
    // -------------------------------
    const cjProductCost = Number(
      data.productAmount || data.goodsAmount || 0
    );

    const cjShippingCost = Number(
      data.logisticsAmount || data.shippingFee || 0
    );

    const supplierCost = cjProductCost + cjShippingCost;

    const salePrice =
      fo.salePrice ??
      (meta.salePrice ?? null);

    // -------------------------------
    // 🛑 NEGATIVE PROFIT HARD STOP
    // -------------------------------
    if (salePrice != null && supplierCost > salePrice) {
      const loss = supplierCost - salePrice;

      await prisma.fulfillmentOrder.update({
        where: { id: fo.id },
        data: {
          status: "failed",
          supplierCost,
          shippingCost: cjShippingCost,
          profit: -loss,
          metaJson: JSON.stringify({
            ...meta,
            blockedReason: "NEGATIVE_PROFIT",
            blockedAt: new Date().toISOString(),
            salePrice,
            supplierCost,
          }),
        },
      });

      pushLiveLog(
        `🛑 [CJ BLOCKED] Order ${fo.shopifyOrderId} blocked (loss $${loss.toFixed(
          2
        )})`
      );

      throw new Error(
        `Order blocked: supplierCost (${supplierCost}) > salePrice (${salePrice})`
      );
    }

    const profit =
      salePrice && supplierCost
        ? salePrice - supplierCost
        : null;

    const updated = await prisma.fulfillmentOrder.update({
      where: { id: fo.id },
      data: {
        cjOrderId,
        supplierCost,
        shippingCost: cjShippingCost,
        profit,
        status: "ordered",
      },
    });

    pushLiveLog(
      `✅ [CJ] Order submitted cjOrderId=${cjOrderId} profit=${profit ?? "n/a"}`
    );

    return updated;
  } finally {
    // --------------------------------------------------
    // 🔓 RELEASE LOCK
    // --------------------------------------------------
    const latest = await prisma.fulfillmentOrder.findUnique({
      where: { id: fo.id },
    });

    const latestMeta = safeJson(latest?.metaJson);

    if (latestMeta._cjLock) {
      delete latestMeta._cjLock;
      delete latestMeta._cjLockAt;

      await prisma.fulfillmentOrder.update({
        where: { id: fo.id },
        data: {
          metaJson: JSON.stringify(latestMeta),
        },
      });
    }
  }
}

/**
 * Safe JSON parse helper
 */
function safeJson(s) {
  if (!s) return {};
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}




