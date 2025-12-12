// src/sync/analytics.js
import { prisma } from "../db/client.js";

/**
 * Build a profit summary from ProductLog + Run.
 */
export async function getProfitSummary() {
  const logs = await prisma.productLog.findMany({
    include: {
      run: true
    }
  });

  let totalSource = 0;
  let totalRevenue = 0;
  const perKeyword = new Map();

  for (const log of logs) {
    const src = log.sourcePrice ?? 0;
    const rev = log.finalPrice ?? 0;

    totalSource += src;
    totalRevenue += rev;

    const keyword = log.run?.keyword || "unknown";
    if (!perKeyword.has(keyword)) {
      perKeyword.set(keyword, {
        keyword,
        source: 0,
        revenue: 0,
        count: 0
      });
    }
    const bucket = perKeyword.get(keyword);
    bucket.source += src;
    bucket.revenue += rev;
    bucket.count += 1;
  }

  const totalProfit = totalRevenue - totalSource;
  const marginPercent =
    totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  const keywordStats = Array.from(perKeyword.values())
    .map(k => ({
      keyword: k.keyword,
      products: k.count,
      sourceCost: k.source,
      revenue: k.revenue,
      profit: k.revenue - k.source,
      marginPercent:
        k.revenue > 0 ? ((k.revenue - k.source) / k.revenue) * 100 : 0
    }))
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 20);

  return {
    totals: {
      totalProducts: logs.length,
      totalSourceCost: totalSource,
      totalRevenue,
      totalProfit,
      marginPercent: Number(marginPercent.toFixed(2))
    },
    byKeyword: keywordStats
  };
}
