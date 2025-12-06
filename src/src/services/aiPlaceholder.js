
// src/services/aiPlaceholder.js
import axios from "axios";
import { log } from "../utils/logger.js";

/**
 * Generate an AI placeholder image for a product using Stability AI.
 * Returns base64 data URL.
 */
export async function generatePlaceholderImage(title) {
  if (!process.env.STABILITY_API_KEY) {
    log.warn("STABILITY_API_KEY not set, using static placeholder");
    return defaultFallbackImage();
  }

  try {
    const prompt = `High-quality product photo of ${title}, white background, ecommerce style, centered, 1024x1024`;

    const res = await axios.post(
      "https://api.stability.ai/v2beta/stable-image/generate/core",
      {
        prompt,
        output_format: "png"
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.STABILITY_API_KEY}`
        },
        responseType: "arraybuffer"
      }
    );

    return `data:image/png;base64,${Buffer.from(res.data).toString("base64")}`;
  } catch (err) {
    log.error("AI placeholder generation failed:", err.response?.data || err.message);
    return defaultFallbackImage();
  }
}

/**
 * Very small inline PNG placeholder (1x1 transparent).
 * Replace with a better base64 if desired.
 */
function defaultFallbackImage() {
  const base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAQAAAEAAUCBY+UAAAAASUVORK5CYII=";
  return "data:image/png;base64," + base64;
}
