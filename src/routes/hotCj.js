// src/routes/hotCj.js
import { cjRequest } from "../services/cjClient.js";

export async function searchHotCj(req, res) {
  try {
    const q = req.query.q || "";

    const { data } = await cjRequest("GET", "/product/list", {
      params: {
        keyword: q,
        pageSize: 20,
        sort: "orderCount", // 🔥 key
      },
    });

    const ranked = (data?.list || []).map(p => ({
      cjProductId: p.pid,
      title: p.productName,
      price: Number(p.sellPrice || 0),
      orders: Number(p.orderCount || 0),
      image: p.productImage,
      variants: p.variants?.length || 0,
    }));

    res.json({ source: "cj", results: ranked });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
