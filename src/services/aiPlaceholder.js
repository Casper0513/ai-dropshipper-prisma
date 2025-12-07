
import axios from "axios";

// Generate AI placeholder via Stability AI, return base64 string (no prefix), or null on failure.
export async function generatePlaceholderImage(title) {
  const key = process.env.STABILITY_API_KEY;
  if (!key) return null;

  try {
    const prompt = `High-quality ecommerce product photo of ${title}, white background, centered, 1024x1024`;

    const res = await axios.post(
      "https://api.stability.ai/v2beta/stable-image/generate/core",
      { prompt, output_format: "png" },
      {
        headers: { Authorization: `Bearer ${key}` },
        responseType: "arraybuffer",
      }
    );

    return Buffer.from(res.data).toString("base64");
  } catch (err) {
    console.error(
      "generatePlaceholderImage failed:",
      err.response?.data || err.message
    );
    return null;
  }
}
