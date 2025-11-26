#!/usr/bin/env node
import { CONFIG } from "./src/config.js";
import { importKeyword } from "./src/pipeline.js";

console.log("🛒 AI Dropshipper — CLI");

if (!CONFIG.keywords.length) {
  console.error("No KEYWORDS configured in .env");
  process.exit(1);
}

const run = async () => {
  for (const kw of CONFIG.keywords) {
    await importKeyword(kw, { source: "cli" });
  }
  console.log("🎉 Finished CLI import for all keywords");
};

run().catch(err => {
  console.error("Fatal CLI error:", err);
  process.exit(1);
});
