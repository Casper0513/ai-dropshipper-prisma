// src/services/searchCjProducts.js
import { cjRequest } from "./cjClient.js";

export async function searchCjProducts(query) {
  if (!query) {
    throw new Error("Missing query");
  }

  const res = await cjRequest(
    "GET",
    "/product/list",
    {
      params: {
        keyword: query,
        page: 1,
        pageSize: 20,
      },
    }
  );

  return res?.data?.list || [];
}
