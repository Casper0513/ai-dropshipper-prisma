import { CONFIG } from "./config.js";
import { importKeyword } from "./pipeline.js";

export async function runAllKeywords() {
  for (const kw of CONFIG.keywords) {
    await importKeyword(kw, { source: "index" });
  }
}
