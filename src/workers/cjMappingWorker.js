// src/workers/cjMappingWorker.js
import { prisma } from "../db/client.js";
import { pushLiveLog } from "../utils/liveLogs.js";
import { findCjMatchForAmazon } from "../services/cjMatcher.js";

export function startCjMappingWorker() {
  pushLiveLog("🔗 CJ mapping worker started (Amazon → CJ)");

  const tick = async () => {
    const variants = await prisma.syncedVariant.findMany({
      where: {
        source: "amazon",
        cjVariantId: null,
        deleted: false,
      },
      take: 10,
    });

    for (const v of variants) {
      try {
        const match = await findCjMatchForAmazon({
          asin: v.asin,
          title: v.shopifyHandle,
        });

        if (!match) continue;

        await prisma.syncedVariant.update({
          where: { id: v.id },
          data: {
            cjProductId: match.cjProductId,
            cjVariantId: match.cjVariantId,
          },
        });

        pushLiveLog(
          `🔗 Amazon → CJ mapped sku=${v.sku} (${match.confidence})`
        );
      } catch (err) {
        pushLiveLog(
          `❌ CJ map failed sku=${v.sku}: ${err.message}`
        );
      }
    }
  };

  tick();
  setInterval(tick, 15 * 60 * 1000); // every 15 min
}
